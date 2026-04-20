const express = require('express');
const db = require('../db/database');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

router.use(authenticate);
router.use((req, res, next) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ error: { code: 'ADMIN_ONLY', message: 'Admin access required' } });
  }
  next();
});

// GET /api/roles
router.get('/', (req, res, next) => {
  try {
    res.json(db.prepare('SELECT * FROM roles ORDER BY id ASC').all());
  } catch (err) { next(err); }
});

// POST /api/roles
router.post('/', (req, res, next) => {
  try {
    const { name, description, is_admin = 0 } = req.body;
    if (!name) return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'Name is required' } });
    const result = db.prepare('INSERT INTO roles (name, description, is_admin) VALUES (?, ?, ?)').run(name, description || null, is_admin ? 1 : 0);

    // Insert default 'none' permissions for this new role on all pages
    const allPages = db.prepare('SELECT id FROM pages').all();
    const insertPerm = db.prepare('INSERT INTO page_permissions (role_id, page_id, access_level) VALUES (?, ?, ?)');
    const txn = db.transaction(() => {
      for (const page of allPages) {
        insertPerm.run(result.lastInsertRowid, page.id, 'none');
      }
    });
    txn();

    res.status(201).json(db.prepare('SELECT * FROM roles WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) { next(err); }
});

// PUT /api/roles/:id
router.put('/:id', (req, res, next) => {
  try {
    const existing = db.prepare('SELECT id FROM roles WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Role not found' } });
    const { name, description, is_admin } = req.body;
    db.prepare('UPDATE roles SET name = COALESCE(?, name), description = COALESCE(?, description), is_admin = COALESCE(?, is_admin) WHERE id = ?')
      .run(name ?? null, description ?? null, is_admin != null ? (is_admin ? 1 : 0) : null, req.params.id);
    res.json(db.prepare('SELECT * FROM roles WHERE id = ?').get(req.params.id));
  } catch (err) { next(err); }
});

// DELETE /api/roles/:id
router.delete('/:id', (req, res, next) => {
  try {
    const role = db.prepare('SELECT * FROM roles WHERE id = ?').get(req.params.id);
    if (!role) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Role not found' } });
    if (role.name === 'admin') return res.status(400).json({ error: { code: 'PROTECTED', message: 'The admin role cannot be deleted' } });
    const usersWithRole = db.prepare('SELECT COUNT(*) AS c FROM users WHERE role_id = ?').get(req.params.id);
    if (usersWithRole.c > 0) return res.status(409).json({ error: { code: 'ROLE_IN_USE', message: 'Cannot delete a role that is assigned to users' } });
    db.prepare('DELETE FROM roles WHERE id = ?').run(req.params.id);
    res.json({ message: 'Role deleted successfully' });
  } catch (err) { next(err); }
});

module.exports = router;
