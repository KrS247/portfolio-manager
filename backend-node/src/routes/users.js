const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../db/database');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

// Admin guard — all routes require authentication + is_admin
router.use(authenticate);
router.use((req, res, next) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ error: { code: 'ADMIN_ONLY', message: 'Admin access required' } });
  }
  next();
});

// POST /api/users — admin creates a new user with a chosen role
router.post('/', async (req, res, next) => {
  try {
    const { username, email, password, role_id } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'Username, email, and password are required' } });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters' } });
    }

    // Default to the 'member' role if none supplied
    const resolvedRoleId = role_id
      ? parseInt(role_id, 10)
      : db.prepare("SELECT id FROM roles WHERE name = 'member'").get()?.id;

    if (!resolvedRoleId) {
      return res.status(400).json({ error: { code: 'INVALID_ROLE', message: 'Role not found' } });
    }
    const role = db.prepare('SELECT id FROM roles WHERE id = ?').get(resolvedRoleId);
    if (!role) {
      return res.status(400).json({ error: { code: 'INVALID_ROLE', message: 'Role not found' } });
    }

    const { hourly_rate } = req.body;
    const hash = await bcrypt.hash(password, 12);
    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash, role_id, hourly_rate) VALUES (?, ?, ?, ?, ?)'
    ).run(username, email, hash, resolvedRoleId, hourly_rate ?? null);

    const created = db.prepare(`
      SELECT u.id, u.username, u.email, u.role_id, u.hourly_rate, u.created_at, r.name AS role_name, r.is_admin
      FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(created);
  } catch (err) { next(err); }
});

// GET /api/users
router.get('/', (req, res, next) => {
  try {
    const users = db.prepare(`
      SELECT u.id, u.username, u.email, u.role_id, u.hourly_rate, u.created_at, r.name AS role_name, r.is_admin
      FROM users u JOIN roles r ON r.id = u.role_id
      ORDER BY u.created_at DESC
    `).all();
    res.json(users);
  } catch (err) { next(err); }
});

// GET /api/users/:id
router.get('/:id', (req, res, next) => {
  try {
    const user = db.prepare(`
      SELECT u.id, u.username, u.email, u.role_id, u.hourly_rate, u.created_at, r.name AS role_name, r.is_admin
      FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?
    `).get(req.params.id);
    if (!user) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    res.json(user);
  } catch (err) { next(err); }
});

// PUT /api/users/:id — update role, email, or reset password
router.put('/:id', async (req, res, next) => {
  try {
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });

    const { email, role_id, password, hourly_rate } = req.body;
    if (role_id) {
      const role = db.prepare('SELECT id FROM roles WHERE id = ?').get(role_id);
      if (!role) return res.status(400).json({ error: { code: 'INVALID_ROLE', message: 'Role not found' } });
    }

    if (password) {
      const hash = await bcrypt.hash(password, 12);
      db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?").run(hash, req.params.id);
    }
    db.prepare(`
      UPDATE users SET email = COALESCE(?, email), role_id = COALESCE(?, role_id),
        hourly_rate = CASE WHEN ? IS NOT NULL THEN ? ELSE hourly_rate END WHERE id = ?
    `).run(email ?? null, role_id ?? null, hourly_rate ?? null, hourly_rate ?? null, req.params.id);

    const updated = db.prepare(`
      SELECT u.id, u.username, u.email, u.role_id, u.hourly_rate, u.created_at, r.name AS role_name, r.is_admin
      FROM users u JOIN roles r ON r.id = u.role_id WHERE u.id = ?
    `).get(req.params.id);
    res.json(updated);
  } catch (err) { next(err); }
});

// DELETE /api/users/:id
router.delete('/:id', (req, res, next) => {
  try {
    if (parseInt(req.params.id) === req.user.id) {
      return res.status(400).json({ error: { code: 'SELF_DELETE', message: 'You cannot delete your own account' } });
    }
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (err) { next(err); }
});

module.exports = router;
