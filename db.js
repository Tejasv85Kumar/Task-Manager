/**
 * db.js — Pure-JS JSON "database"
 * Mimics a synchronous SQLite-like API so all route code stays clean.
 * Data is persisted to a JSON file on disk.
 */
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'taskmanager.json');

// ─── Load / init store ────────────────────────────────────────────────────────
let store = {
  users: [],   // { id, name, email, password_hash, role, created_at }
  projects: [],   // { id, name, description, owner_id, created_at }
  project_members: [],   // { project_id, user_id }
  tasks: [],   // { id, title, description, project_id, assigned_to, status, priority, due_date, created_by, created_at }
  _seq: { users: 0, projects: 0, tasks: 0 }
};

if (fs.existsSync(DB_PATH)) {
  try {
    store = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    console.log('✅ Database loaded from:', DB_PATH);
  } catch (e) {
    console.warn('⚠️  Could not parse database file, starting fresh.');
  }
} else {
  save();
  console.log('✅ New database created at:', DB_PATH);
}

function save() {
  fs.writeFileSync(DB_PATH, JSON.stringify(store, null, 2));
}

function nextId(table) {
  store._seq[table] = (store._seq[table] || 0) + 1;
  return store._seq[table];
}

function now() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

// ─── Public DB API ─────────────────────────────────────────────────────────────

const db = {
  save,

  // ── USERS ──
  users: {
    findByEmail: (email) => store.users.find(u => u.email === email.toLowerCase()),
    findById: (id) => store.users.find(u => u.id === +id),
    all: () => [...store.users].sort((a, b) => b.id - a.id),

    create({ name, email, password_hash, role }) {
      const user = { id: nextId('users'), name, email: email.toLowerCase(), password_hash, role, created_at: now() };
      store.users.push(user);
      save();
      return user;
    },

    updateRole(id, role) {
      const u = store.users.find(u => u.id === +id);
      if (u) { u.role = role; save(); }
      return u;
    },

    delete(id) {
      store.users = store.users.filter(u => u.id !== +id);
      store.project_members = store.project_members.filter(m => m.user_id !== +id);
      save();
    },

    safe: (u) => { if (!u) return null; const { password_hash, ...rest } = u; return rest; }
  },

  // ── PROJECTS ──
  projects: {
    all: () => [...store.projects].sort((a, b) => b.id - a.id),
    findById: (id) => store.projects.find(p => p.id === +id),

    forUser(userId) {
      const memberProjectIds = store.project_members
        .filter(pm => pm.user_id === +userId)
        .map(pm => pm.project_id);
      return store.projects
        .filter(p => p.owner_id === +userId || memberProjectIds.includes(p.id))
        .sort((a, b) => b.id - a.id);
    },

    create({ name, description, owner_id }) {
      const p = { id: nextId('projects'), name, description: description || '', owner_id: +owner_id, created_at: now() };
      store.projects.push(p);
      save();
      return p;
    },

    update(id, { name, description }) {
      const p = store.projects.find(p => p.id === +id);
      if (p) { p.name = name; p.description = description ?? p.description; save(); }
      return p;
    },

    delete(id) {
      store.projects = store.projects.filter(p => p.id !== +id);
      store.project_members = store.project_members.filter(pm => pm.project_id !== +id);
      store.tasks = store.tasks.filter(t => t.project_id !== +id);
      save();
    },

    taskCount: (id) => store.tasks.filter(t => t.project_id === +id).length,
    memberCount: (id) => store.project_members.filter(pm => pm.project_id === +id).length,
  },

  // ── PROJECT MEMBERS ──
  members: {
    ofProject: (projectId) => {
      const ids = store.project_members.filter(pm => pm.project_id === +projectId).map(pm => pm.user_id);
      return store.users.filter(u => ids.includes(u.id)).map(db.users.safe);
    },
    isMember: (projectId, userId) =>
      store.project_members.some(pm => pm.project_id === +projectId && pm.user_id === +userId),

    add(projectId, userId) {
      if (!db.members.isMember(projectId, userId)) {
        store.project_members.push({ project_id: +projectId, user_id: +userId });
        save();
      }
    },
    remove(projectId, userId) {
      store.project_members = store.project_members.filter(
        pm => !(pm.project_id === +projectId && pm.user_id === +userId)
      );
      save();
    }
  },

  // ── TASKS ──
  tasks: {
    findById: (id) => store.tasks.find(t => t.id === +id),

    query({ project_id, status, priority, assigned_to, userId, role }) {
      let tasks = [...store.tasks];

      // If not admin, they can ONLY see their assigned tasks
      if (role !== 'admin') {
        tasks = tasks.filter(t => t.assigned_to === +userId);
      }

      if (project_id) {
        tasks = tasks.filter(t => t.project_id === +project_id);
      }

      if (status) tasks = tasks.filter(t => t.status === status);
      if (priority) tasks = tasks.filter(t => t.priority === priority);
      if (assigned_to) tasks = tasks.filter(t => t.assigned_to === +assigned_to);

      return tasks.sort((a, b) => b.id - a.id).map(t => db.tasks._enrich(t));
    },

    dashboard(userId, role) {
      let allTasks = [...store.tasks];

      // If not admin, they can ONLY see their assigned tasks
      if (role !== 'admin') {
        allTasks = allTasks.filter(t => t.assigned_to === +userId);
      }

      const today = new Date().toISOString().split('T')[0];
      return {
        total: allTasks.length,
        todo: allTasks.filter(t => t.status === 'todo').length,
        inProgress: allTasks.filter(t => t.status === 'in_progress').length,
        done: allTasks.filter(t => t.status === 'done').length,
        overdue: allTasks.filter(t => t.due_date && t.due_date < today && t.status !== 'done').length,
        recent: allTasks.sort((a, b) => b.id - a.id).slice(0, 5).map(t => db.tasks._enrich(t))
      };
    },

    create({ title, description, project_id, assigned_to, status, priority, due_date, created_by }) {
      const t = {
        id: nextId('tasks'), title, description: description || '',
        project_id: +project_id,
        assigned_to: assigned_to ? +assigned_to : null,
        status: status || 'todo',
        priority: priority || 'medium',
        due_date: due_date || null,
        created_by: +created_by,
        created_at: now()
      };
      store.tasks.push(t);
      save();
      return db.tasks._enrich(t);
    },

    update(id, fields) {
      const t = store.tasks.find(t => t.id === +id);
      if (!t) return null;
      Object.assign(t, fields);
      save();
      return db.tasks._enrich(t);
    },

    delete(id) {
      store.tasks = store.tasks.filter(t => t.id !== +id);
      save();
    },

    _enrich(t) {
      const assignee = t.assigned_to ? store.users.find(u => u.id === t.assigned_to) : null;
      const creator = store.users.find(u => u.id === t.created_by);
      const project = store.projects.find(p => p.id === t.project_id);
      return {
        ...t,
        assignee_name: assignee ? assignee.name : null,
        creator_name: creator ? creator.name : null,
        project_name: project ? project.name : null,
      };
    }
  }
};

module.exports = db;
