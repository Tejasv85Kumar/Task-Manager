const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();
router.use(authenticate);

// GET /api/projects
router.get('/', (req, res) => {
  const projects = req.user.role === 'admin'
    ? db.projects.all()
    : db.projects.forUser(req.user.id);

  const result = projects.map(p => ({
    ...p,
    owner_name:   (db.users.findById(p.owner_id) || {}).name,
    task_count:   db.projects.taskCount(p.id),
    member_count: db.projects.memberCount(p.id),
  }));
  res.json({ projects: result });
});

// POST /api/projects
router.post('/', requireRole('admin'), (req, res) => {
  const { name, description } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Project name is required' });

  const project = db.projects.create({ name: name.trim(), description, owner_id: req.user.id });
  db.members.add(project.id, req.user.id);
  res.status(201).json({ message: 'Project created', project });
});

// GET /api/projects/:id
router.get('/:id', (req, res) => {
  const project = db.projects.findById(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  if (req.user.role !== 'admin') {
    const access = db.members.isMember(project.id, req.user.id) || project.owner_id === req.user.id;
    if (!access) return res.status(403).json({ error: 'Access denied' });
  }

  const members = db.members.ofProject(project.id);
  res.json({ project: { ...project, owner_name: (db.users.findById(project.owner_id) || {}).name }, members });
});

// PUT /api/projects/:id
router.put('/:id', (req, res) => {
  const project = db.projects.findById(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (req.user.role !== 'admin' && project.owner_id !== req.user.id)
    return res.status(403).json({ error: 'Access denied' });

  const { name, description } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Project name is required' });

  const updated = db.projects.update(project.id, { name: name.trim(), description });
  res.json({ message: 'Project updated', project: updated });
});

// DELETE /api/projects/:id
router.delete('/:id', requireRole('admin'), (req, res) => {
  const project = db.projects.findById(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  db.projects.delete(project.id);
  res.json({ message: 'Project deleted successfully' });
});

// POST /api/projects/:id/members
router.post('/:id/members', requireRole('admin'), (req, res) => {
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: 'user_id is required' });
  const project = db.projects.findById(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  const user = db.users.findById(user_id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  db.members.add(project.id, user_id);
  res.json({ message: 'Member added', user: db.users.safe(user) });
});

// DELETE /api/projects/:id/members/:userId
router.delete('/:id/members/:userId', requireRole('admin'), (req, res) => {
  const project = db.projects.findById(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  if (project.owner_id === +req.params.userId)
    return res.status(400).json({ error: 'Cannot remove the project owner' });
  db.members.remove(project.id, req.params.userId);
  res.json({ message: 'Member removed' });
});

module.exports = router;
