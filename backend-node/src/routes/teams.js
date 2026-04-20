const express = require('express');
const db = require('../db/database');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

router.use(authenticate);

// GET /api/teams — accessible to all authenticated users (needed for the New User dropdown)
router.get('/', (req, res, next) => {
  try {
    res.json(db.prepare('SELECT * FROM teams ORDER BY name ASC').all());
  } catch (err) { next(err); }
});

// Admin-only guard for write operations
function adminOnly(req, res, next) {
  if (!req.user.is_admin) {
    return res.status(403).json({ error: { code: 'ADMIN_ONLY', message: 'Admin access required' } });
  }
  next();
}

// POST /api/teams
router.post('/', adminOnly, (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'Team name is required' } });
    const result = db.prepare('INSERT INTO teams (name) VALUES (?)').run(name.trim());
    res.status(201).json(db.prepare('SELECT * FROM teams WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: { code: 'DUPLICATE', message: 'A team with that name already exists' } });
    }
    next(err);
  }
});

// PUT /api/teams/:id
router.put('/:id', adminOnly, (req, res, next) => {
  try {
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
    if (!team) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Team not found' } });
    const { name } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'Team name is required' } });
    db.prepare('UPDATE teams SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
    res.json(db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id));
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: { code: 'DUPLICATE', message: 'A team with that name already exists' } });
    }
    next(err);
  }
});

// DELETE /api/teams/:id
router.delete('/:id', adminOnly, (req, res, next) => {
  try {
    const team = db.prepare('SELECT * FROM teams WHERE id = ?').get(req.params.id);
    if (!team) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Team not found' } });
    db.prepare('DELETE FROM teams WHERE id = ?').run(req.params.id);
    res.json({ message: 'Team deleted successfully' });
  } catch (err) { next(err); }
});

module.exports = router;
