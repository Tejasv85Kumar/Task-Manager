const express = require('express');
const db = require('../db');
const { authenticate } = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');

const router = express.Router();
router.use(authenticate);

// GET /api/users  (admin only)
router.get('/', requireRole('admin'), (req, res) => {
  const users = db.users.all().map(db.users.safe);
  res.json({ users });
});

// GET /api/users/members  (admin only — for dropdowns)
router.get('/members', requireRole('admin'), (req, res) => {
  const users = db.users.all().map(db.users.safe);
  res.json({ users });
});

// PUT /api/users/:id/role  (admin only)
router.put('/:id/role', requireRole('admin'), (req, res) => {
  const { role } = req.body;
  if (!['admin', 'member'].includes(role))
    return res.status(400).json({ error: 'Role must be admin or member' });
  if (+req.params.id === req.user.id)
    return res.status(400).json({ error: 'Cannot change your own role' });

  const user = db.users.findById(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const updated = db.users.updateRole(req.params.id, role);
  res.json({ message: 'Role updated', user: db.users.safe(updated) });
});

module.exports = router;
