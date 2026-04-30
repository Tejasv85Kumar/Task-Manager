/* ─── State & Config ─────────────────────────────────────────────────────── */
const API = '';  // Same origin — Express serves both API and static files
let token = localStorage.getItem('ttm_token') || null;
let currentUser = JSON.parse(localStorage.getItem('ttm_user') || 'null');
let currentProjectId = null;
let allProjects = [];

/* ─── API Helper ─────────────────────────────────────────────────────────── */
async function api(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (token) opts.headers['Authorization'] = `Bearer ${token}`;
  if (body)  opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

/* ─── Toast ──────────────────────────────────────────────────────────────── */
function toast(msg, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  const icons = { success:'✅', error:'❌', info:'ℹ️' };
  el.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

/* ─── Auth Tab Switch ────────────────────────────────────────────────────── */
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
  document.getElementById(`tab-${tab}`).classList.add('active');
  document.getElementById(`${tab}-form`).classList.add('active');
  clearErrors();
}

function clearErrors() {
  document.querySelectorAll('.form-error').forEach(el => {
    el.classList.add('hidden'); el.textContent = '';
  });
}

function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg;
  el.classList.remove('hidden');
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.querySelector('span').textContent = loading ? 'Please wait…' : btn.dataset.label || btn.querySelector('span').textContent;
}

/* ─── Auth Handlers ──────────────────────────────────────────────────────── */
async function handleLogin(e) {
  e.preventDefault();
  clearErrors();
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn = document.getElementById('login-btn');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Signing in…';
  try {
    const data = await api('POST', '/api/auth/login', { email, password });
    onAuthSuccess(data);
  } catch (err) {
    showError('login-error', err.message);
  } finally {
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Sign In';
  }
}

async function handleSignup(e) {
  e.preventDefault();
  clearErrors();
  const name     = document.getElementById('signup-name').value.trim();
  const email    = document.getElementById('signup-email').value.trim();
  const password = document.getElementById('signup-password').value;
  const role     = document.getElementById('signup-role').value;
  const btn = document.getElementById('signup-btn');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Creating account…';
  try {
    const data = await api('POST', '/api/auth/signup', { name, email, password, role });
    onAuthSuccess(data);
  } catch (err) {
    showError('signup-error', err.message);
  } finally {
    btn.disabled = false;
    btn.querySelector('span').textContent = 'Create Account';
  }
}

function onAuthSuccess(data) {
  token       = data.token;
  currentUser = data.user;
  localStorage.setItem('ttm_token', token);
  localStorage.setItem('ttm_user', JSON.stringify(currentUser));
  initApp();
}

function logout() {
  token = null; currentUser = null;
  localStorage.removeItem('ttm_token');
  localStorage.removeItem('ttm_user');
  document.getElementById('auth-screen').classList.add('active');
  document.getElementById('app-screen').classList.remove('active');
}

/* ─── App Init ───────────────────────────────────────────────────────────── */
function initApp() {
  document.getElementById('auth-screen').classList.remove('active');
  document.getElementById('app-screen').classList.add('active');

  // Sidebar user info
  document.getElementById('sidebar-name').textContent   = currentUser.name;
  document.getElementById('sidebar-avatar').textContent = currentUser.name.charAt(0).toUpperCase();
  const roleBadge = document.getElementById('sidebar-role');
  roleBadge.textContent = currentUser.role;
  roleBadge.className   = `user-role-badge ${currentUser.role}`;

  // Show/hide admin-only elements
  document.querySelectorAll('.admin-only').forEach(el => {
    el.style.display = currentUser.role === 'admin' ? '' : 'none';
  });

  navigate('dashboard');
}

/* ─── Router ─────────────────────────────────────────────────────────────── */
function navigate(view, projectId) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const viewEl = document.getElementById(`view-${view}`);
  const navEl  = document.getElementById(`nav-${view}`);
  if (viewEl) viewEl.classList.add('active');
  if (navEl)  navEl.classList.add('active');

  if (view === 'dashboard')       loadDashboard();
  else if (view === 'projects')   loadProjects();
  else if (view === 'tasks')      loadAllTasks();
  else if (view === 'team')       loadTeam();
  else if (view === 'project-detail') loadProjectDetail(projectId);
}

/* ─── Dashboard ──────────────────────────────────────────────────────────── */
async function loadDashboard() {
  const greeting = document.getElementById('dashboard-greeting');
  const hour = new Date().getHours();
  const g = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  greeting.textContent = `${g}, ${currentUser.name}!`;

  try {
    const data = await api('GET', '/api/tasks/dashboard');
    document.getElementById('stat-total-val').textContent    = data.stats.total;
    document.getElementById('stat-progress-val').textContent = data.stats.inProgress;
    document.getElementById('stat-done-val').textContent     = data.stats.done;
    document.getElementById('stat-overdue-val').textContent  = data.stats.overdue;

    const tbody = document.getElementById('recent-tasks-body');
    if (!data.recent.length) {
      tbody.innerHTML = `<tr><td colspan="5" class="table-empty">No tasks yet. Create a project and add tasks!</td></tr>`;
      return;
    }
    tbody.innerHTML = data.recent.map(t => `
      <tr>
        <td><strong>${esc(t.title)}</strong>${t.description ? `<br><small style="color:var(--text2)">${esc(t.description).slice(0,60)}</small>` : ''}</td>
        <td>${esc(t.project_name || '—')}</td>
        <td>${t.assignee_name ? `<span class="member-chip" style="padding:4px 10px">${esc(t.assignee_name)}</span>` : '<span style="color:var(--text2)">Unassigned</span>'}</td>
        <td><span class="badge badge-${t.priority}">${t.priority}</span></td>
        <td>${statusBadge(t.status)}</td>
      </tr>`).join('');
  } catch (err) {
    toast(err.message, 'error');
  }
}

/* ─── Projects ───────────────────────────────────────────────────────────── */
async function loadProjects() {
  const grid = document.getElementById('projects-grid');
  grid.innerHTML = '<div class="loading-state">Loading projects…</div>';
  try {
    const data = await api('GET', '/api/projects');
    allProjects = data.projects;
    if (!allProjects.length) {
      grid.innerHTML = `<div class="loading-state">
        <p style="font-size:1.1rem;margin-bottom:8px">No projects yet</p>
        <p style="color:var(--text2)">${currentUser.role === 'admin' ? 'Click "New Project" to get started.' : 'Ask an admin to add you to a project.'}</p>
      </div>`;
      return;
    }
    grid.innerHTML = allProjects.map(p => `
      <div class="project-card" onclick="navigate('project-detail', ${p.id})">
        <div class="project-card-header">
          <div class="project-card-name">${esc(p.name)}</div>
          <span style="font-size:1.4rem">📁</span>
        </div>
        <div class="project-card-desc">${esc(p.description || 'No description')}</div>
        <div class="project-card-meta">
          <span>✅ ${p.task_count} tasks</span>
          <span>👥 ${p.member_count} members</span>
        </div>
        <div class="project-actions" onclick="event.stopPropagation()">
          <button class="btn btn-ghost btn-sm" onclick="navigate('project-detail', ${p.id})">Open →</button>
          ${currentUser.role === 'admin' ? `
          <button class="btn btn-ghost btn-sm" onclick="openProjectModal(${p.id}, '${esc(p.name)}', '${esc(p.description || '')}')">Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteProject(${p.id})">Delete</button>` : ''}
        </div>
      </div>`).join('');
  } catch (err) { toast(err.message, 'error'); }
}

/* ─── Project Detail ─────────────────────────────────────────────────────── */
async function loadProjectDetail(id) {
  currentProjectId = id;
  document.getElementById('view-project-detail').classList.add('active');
  document.querySelectorAll('.view:not(#view-project-detail)').forEach(v => v.classList.remove('active'));

  try {
    const data = await api('GET', `/api/projects/${id}`);
    document.getElementById('detail-project-name').textContent = data.project.name;
    document.getElementById('detail-project-desc').textContent = data.project.description || '';

    // Members
    const membersList = document.getElementById('detail-members');
    membersList.innerHTML = data.members.map(m => `
      <div class="member-chip">
        <div class="member-chip-avatar">${m.name.charAt(0)}</div>
        <div>
          <div class="member-chip-name">${esc(m.name)}</div>
          <div class="member-chip-role">${m.role}</div>
        </div>
        ${currentUser.role === 'admin' && m.id !== data.project.owner_id
          ? `<button class="btn-remove-member" onclick="removeMember(${id}, ${m.id})" title="Remove">✕</button>` : ''}
      </div>`).join('') || '<span style="color:var(--text2)">No members yet.</span>';

    // Tasks
    const taskData = await api('GET', `/api/tasks?project_id=${id}`);
    renderKanban(taskData.tasks, id);
  } catch (err) { toast(err.message, 'error'); }
}

function renderKanban(tasks, projectId) {
  const cols = { todo: [], in_progress: [], done: [] };
  tasks.forEach(t => { if (cols[t.status]) cols[t.status].push(t); });
  const today = new Date().toISOString().split('T')[0];

  ['todo', 'in_progress', 'done'].forEach(status => {
    document.getElementById(`count-${status}`).textContent = cols[status].length;
    document.getElementById(`cards-${status}`).innerHTML = cols[status].map(t => {
      const isOverdue = t.due_date && t.due_date < today && t.status !== 'done';
      return `
        <div class="task-card" onclick="openEditTaskModal(${JSON.stringify(t).replace(/"/g,'&quot;')})">
          <div class="task-card-title">${esc(t.title)}</div>
          <div class="task-card-meta">
            <span class="badge badge-${t.priority}">${t.priority}</span>
            ${t.assignee_name ? `<span class="task-card-assignee">👤 ${esc(t.assignee_name)}</span>` : ''}
            ${t.due_date ? `<span class="task-card-due ${isOverdue ? 'overdue' : ''}">${isOverdue ? '⚠️ ' : '📅 '}${t.due_date}</span>` : ''}
          </div>
        </div>`;
    }).join('') || `<div style="color:var(--text2);font-size:.85rem;padding:12px 0">No tasks here</div>`;
  });
}

/* ─── All Tasks ──────────────────────────────────────────────────────────── */
async function loadAllTasks() {
  // Populate project filter
  try {
    const projData = await api('GET', '/api/projects');
    allProjects = projData.projects;
    const sel = document.getElementById('filter-project');
    const cur = sel.value;
    sel.innerHTML = '<option value="">All Projects</option>' +
      allProjects.map(p => `<option value="${p.id}" ${p.id == cur ? 'selected' : ''}>${esc(p.name)}</option>`).join('');
  } catch (_) {}

  const status   = document.getElementById('filter-status').value;
  const priority = document.getElementById('filter-priority').value;
  const projId   = document.getElementById('filter-project').value;

  let url = '/api/tasks?';
  if (status)   url += `status=${status}&`;
  if (priority) url += `priority=${priority}&`;
  if (projId)   url += `project_id=${projId}&`;

  const today = new Date().toISOString().split('T')[0];
  try {
    const data = await api('GET', url);
    const tbody = document.getElementById('all-tasks-body');
    if (!data.tasks.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="table-empty">No tasks found.</td></tr>';
      return;
    }
    tbody.innerHTML = data.tasks.map(t => {
      const isOverdue = t.due_date && t.due_date < today && t.status !== 'done';
      return `<tr>
        <td><strong>${esc(t.title)}</strong></td>
        <td>${esc(t.project_name || '—')}</td>
        <td>${t.assignee_name ? esc(t.assignee_name) : '<span style="color:var(--text2)">—</span>'}</td>
        <td><span class="badge badge-${t.priority}">${t.priority}</span></td>
        <td>${t.due_date ? `<span class="${isOverdue ? 'badge badge-overdue' : ''}">${isOverdue ? '⚠️ ' : ''}${t.due_date}</span>` : '—'}</td>
        <td>${statusBadge(t.status)}</td>
        ${currentUser.role === 'admin' ? `<td style="display:flex;gap:6px;">
          <button class="btn btn-ghost btn-sm" onclick='openEditTaskModal(${JSON.stringify(t).replace(/'/g,"&#39;")})'>Edit</button>
          <button class="btn btn-danger btn-sm" onclick="deleteTask(${t.id})">Del</button>
        </td>` : '<td></td>'}
      </tr>`;
    }).join('');
  } catch (err) { toast(err.message, 'error'); }
}

/* ─── Team ───────────────────────────────────────────────────────────────── */
async function loadTeam() {
  try {
    const data = await api('GET', '/api/users');
    const tbody = document.getElementById('team-body');
    tbody.innerHTML = data.users.map(u => `
      <tr>
        <td><strong>${esc(u.name)}</strong></td>
        <td>${esc(u.email)}</td>
        <td><span class="badge ${u.role === 'admin' ? 'badge-high' : 'badge-todo'}">${u.role}</span></td>
        <td style="color:var(--text2)">${new Date(u.created_at).toLocaleDateString()}</td>
        <td>
          ${u.id !== currentUser.id ? `
          <select onchange="changeRole(${u.id}, this.value)" style="background:var(--bg3);border:1px solid var(--border);border-radius:6px;padding:5px 10px;color:var(--text);font-size:.83rem;">
            <option value="member" ${u.role === 'member' ? 'selected' : ''}>Member</option>
            <option value="admin"  ${u.role === 'admin'  ? 'selected' : ''}>Admin</option>
          </select>` : '<span style="color:var(--text2)">You</span>'}
        </td>
      </tr>`).join('');
  } catch (err) { toast(err.message, 'error'); }
}

async function changeRole(userId, role) {
  try {
    await api('PUT', `/api/users/${userId}/role`, { role });
    toast('Role updated!', 'success');
    loadTeam();
  } catch (err) { toast(err.message, 'error'); }
}

/* ─── Project Modal ──────────────────────────────────────────────────────── */
function openProjectModal(id, name, desc) {
  document.getElementById('proj-id').value   = id || '';
  document.getElementById('proj-name').value = name || '';
  document.getElementById('proj-desc').value = desc || '';
  document.getElementById('project-modal-title').textContent = id ? 'Edit Project' : 'New Project';
  document.getElementById('project-modal').classList.remove('hidden');
}

async function saveProject(e) {
  e.preventDefault();
  const id   = document.getElementById('proj-id').value;
  const name = document.getElementById('proj-name').value.trim();
  const desc = document.getElementById('proj-desc').value.trim();
  try {
    if (id) {
      await api('PUT', `/api/projects/${id}`, { name, description: desc });
      toast('Project updated!', 'success');
    } else {
      await api('POST', '/api/projects', { name, description: desc });
      toast('Project created!', 'success');
    }
    closeModal('project-modal');
    loadProjects();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteProject(id) {
  if (!confirm('Delete this project and all its tasks? This cannot be undone.')) return;
  try {
    await api('DELETE', `/api/projects/${id}`);
    toast('Project deleted.', 'success');
    loadProjects();
  } catch (err) { toast(err.message, 'error'); }
}

/* ─── Task Modal ─────────────────────────────────────────────────────────── */
async function openTaskModal(projectId) {
  document.getElementById('task-id').value          = '';
  document.getElementById('task-title').value       = '';
  document.getElementById('task-desc').value        = '';
  document.getElementById('task-priority').value    = 'medium';
  document.getElementById('task-status').value      = 'todo';
  document.getElementById('task-due').value         = '';
  document.getElementById('task-modal-title').textContent = 'New Task';

  await populateTaskSelects(projectId);
  document.getElementById('task-modal').classList.remove('hidden');
}

async function openEditTaskModal(task) {
  if (typeof task === 'string') task = JSON.parse(task);
  document.getElementById('task-id').value          = task.id;
  document.getElementById('task-title').value       = task.title;
  document.getElementById('task-desc').value        = task.description || '';
  document.getElementById('task-priority').value    = task.priority;
  document.getElementById('task-status').value      = task.status;
  document.getElementById('task-due').value         = task.due_date || '';
  document.getElementById('task-modal-title').textContent = 'Edit Task';

  await populateTaskSelects(task.project_id, task.assigned_to);

  // Members can only change status
  const isAdmin = currentUser.role === 'admin';
  ['task-title','task-desc','task-project','task-assignee','task-priority','task-due'].forEach(id => {
    document.getElementById(id).disabled = !isAdmin;
  });

  document.getElementById('task-modal').classList.remove('hidden');
}

async function populateTaskSelects(selectedProject, selectedAssignee) {
  // Projects
  const projSel = document.getElementById('task-project');
  if (!allProjects.length) {
    const pd = await api('GET', '/api/projects');
    allProjects = pd.projects;
  }
  projSel.innerHTML = allProjects.map(p =>
    `<option value="${p.id}" ${p.id == selectedProject ? 'selected' : ''}>${esc(p.name)}</option>`
  ).join('');

  // Users
  const assignSel = document.getElementById('task-assignee');
  try {
    const ud = await api('GET', '/api/users/members');
    assignSel.innerHTML = '<option value="">Unassigned</option>' +
      ud.users.map(u => `<option value="${u.id}" ${u.id == selectedAssignee ? 'selected' : ''}>${esc(u.name)}</option>`).join('');
  } catch (_) {}
}

async function saveTask(e) {
  e.preventDefault();
  const id = document.getElementById('task-id').value;

  const body = {
    title:       document.getElementById('task-title').value.trim(),
    description: document.getElementById('task-desc').value.trim(),
    project_id:  document.getElementById('task-project').value,
    assigned_to: document.getElementById('task-assignee').value || null,
    priority:    document.getElementById('task-priority').value,
    status:      document.getElementById('task-status').value,
    due_date:    document.getElementById('task-due').value || null,
  };

  // Members only update status
  if (currentUser.role !== 'admin') {
    Object.keys(body).forEach(k => { if (k !== 'status') delete body[k]; });
  }

  try {
    if (id) {
      await api('PUT', `/api/tasks/${id}`, body);
      toast('Task updated!', 'success');
    } else {
      await api('POST', '/api/tasks', body);
      toast('Task created!', 'success');
    }
    closeModal('task-modal');
    if (currentProjectId) loadProjectDetail(currentProjectId);
    else loadAllTasks();
  } catch (err) { toast(err.message, 'error'); }
}

async function deleteTask(id) {
  if (!confirm('Delete this task?')) return;
  try {
    await api('DELETE', `/api/tasks/${id}`);
    toast('Task deleted.', 'success');
    if (currentProjectId) loadProjectDetail(currentProjectId);
    else loadAllTasks();
  } catch (err) { toast(err.message, 'error'); }
}

/* ─── Member Modal ───────────────────────────────────────────────────────── */
async function openAddMemberModal() {
  const sel = document.getElementById('member-select');
  try {
    const data = await api('GET', '/api/users/members');
    sel.innerHTML = data.users.map(u =>
      `<option value="${u.id}">${esc(u.name)} (${u.role})</option>`
    ).join('');
  } catch (err) { toast(err.message, 'error'); return; }
  document.getElementById('member-modal').classList.remove('hidden');
}

async function addMember() {
  const userId = document.getElementById('member-select').value;
  if (!userId || !currentProjectId) return;
  try {
    await api('POST', `/api/projects/${currentProjectId}/members`, { user_id: userId });
    toast('Member added!', 'success');
    closeModal('member-modal');
    loadProjectDetail(currentProjectId);
  } catch (err) { toast(err.message, 'error'); }
}

async function removeMember(projectId, userId) {
  if (!confirm('Remove this member from the project?')) return;
  try {
    await api('DELETE', `/api/projects/${projectId}/members/${userId}`);
    toast('Member removed.', 'success');
    loadProjectDetail(projectId);
  } catch (err) { toast(err.message, 'error'); }
}

/* ─── Helpers ────────────────────────────────────────────────────────────── */
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

function esc(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function statusBadge(status) {
  const map = { todo:'badge-todo', in_progress:'badge-progress', done:'badge-done' };
  const labels = { todo:'To Do', in_progress:'In Progress', done:'Done' };
  return `<span class="badge ${map[status] || ''}">${labels[status] || status}</span>`;
}

/* ─── Bootstrap ──────────────────────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  if (token && currentUser) {
    // Verify token is still valid
    api('GET', '/api/auth/me')
      .then(data => { currentUser = data.user; initApp(); })
      .catch(() => {
        localStorage.removeItem('ttm_token');
        localStorage.removeItem('ttm_user');
        document.getElementById('auth-screen').classList.add('active');
      });
  } else {
    document.getElementById('auth-screen').classList.add('active');
  }

  // Close modals on overlay click
  document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.add('hidden');
    });
  });
});
