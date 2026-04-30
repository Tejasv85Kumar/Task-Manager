const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();
router.use(authenticate);

const VALID_STATUSES   = ['todo', 'in_progress', 'done'];
const VALID_PRIORITIES = ['low', 'medium', 'high'];

// GET /api/tasks/dashboard  — must come before /:id
router.get('/dashboard', (req, res) => {
  const { total, todo, inProgress, done, overdue, recent } = db.tasks.dashboard(req.user.id, req.user.role);
  res.json({ stats: { total, todo, inProgress, done, overdue }, recent });
});

// GET /api/tasks
router.get('/', (req, res) => {
  const { project_id, status, priority, assigned_to } = req.query;

  if (project_id) {
    const project = db.projects.findById(project_id);
    if (!project) return res.status(404).json({ error: 'Project not found' });
    if (req.user.role !== 'admin') {
      const access = db.members.isMember(project.id, req.user.id) || project.owner_id === req.user.id;
      if (!access) return res.status(403).json({ error: 'Access denied to this project' });
    }
  }

  const tasks = db.tasks.query({ project_id, status, priority, assigned_to, userId: req.user.id, role: req.user.role });
  res.json({ tasks });
});

// POST /api/tasks
router.post('/', requireRole('admin'), (req, res) => {
  const { title, description, project_id, assigned_to, status, priority, due_date } = req.body;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Task title is required' });
  if (!project_id) return res.status(400).json({ error: 'project_id is required' });
  if (status && !VALID_STATUSES.includes(status))     return res.status(400).json({ error: 'Invalid status' });
  if (priority && !VALID_PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Invalid priority' });
  if (!db.projects.findById(project_id)) return res.status(404).json({ error: 'Project not found' });
  if (assigned_to && !db.users.findById(assigned_to)) return res.status(404).json({ error: 'Assigned user not found' });

  const task = db.tasks.create({ title: title.trim(), description, project_id, assigned_to: assigned_to || null, status, priority, due_date, created_by: req.user.id });
  
  if (assigned_to) {
    db.members.add(project_id, assigned_to);
  }
  
  res.status(201).json({ message: 'Task created', task });
});

// PUT /api/tasks/:id
router.put('/:id', (req, res) => {
  const task = db.tasks.findById(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const isAdmin    = req.user.role === 'admin';
  const isAssignee = task.assigned_to === req.user.id;

  if (!isAdmin && !isAssignee)
    return res.status(403).json({ error: 'You can only update tasks assigned to you' });

  if (!isAdmin) {
    // Members can only update status
    const { status } = req.body;
    if (!status) return res.status(400).json({ error: 'Members can only update status' });
    if (!VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });
    const updated = db.tasks.update(task.id, { status });
    return res.json({ message: 'Task updated', task: updated });
  }

  // Admin full update
  const { title, description, project_id, assigned_to, status, priority, due_date } = req.body;
  if (status   && !VALID_STATUSES.includes(status))    return res.status(400).json({ error: 'Invalid status' });
  if (priority && !VALID_PRIORITIES.includes(priority)) return res.status(400).json({ error: 'Invalid priority' });
  if (project_id && !db.projects.findById(project_id))  return res.status(404).json({ error: 'Project not found' });

  const fields = {};
  if (title !== undefined)       fields.title       = title.trim();
  if (description !== undefined) fields.description = description;
  if (status !== undefined)      fields.status      = status;
  if (priority !== undefined)    fields.priority    = priority;
  if (due_date !== undefined)    fields.due_date    = due_date || null;
  if (project_id !== undefined)  fields.project_id  = +project_id;
  
  if (assigned_to !== undefined) {
    fields.assigned_to = assigned_to ? +assigned_to : null;
    if (fields.assigned_to) {
      db.members.add(fields.project_id || task.project_id, fields.assigned_to);
    }
  }

  const updated = db.tasks.update(task.id, fields);
  res.json({ message: 'Task updated', task: updated });
});

// DELETE /api/tasks/:id
router.delete('/:id', requireRole('admin'), (req, res) => {
  const task = db.tasks.findById(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  db.tasks.delete(task.id);
  res.json({ message: 'Task deleted successfully' });
});

module.exports = router;
