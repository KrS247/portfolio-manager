const express = require('express');
const db = require('../db/database');
const authenticate = require('../middleware/authenticate');

const router = express.Router();

// GET /api/permissions/me — current user's permission map (public to authenticated users)
router.get('/me', authenticate, (req, res, next) => {
  try {
    if (req.user.is_admin) {
      const pages = db.prepare('SELECT slug FROM pages').all();
      const map = {};
      pages.forEach(p => { map[p.slug] = 'edit'; });
      return res.json(map);
    }

    const rows = db.prepare(`
      SELECT p.slug, pp.access_level
      FROM pages p
      LEFT JOIN page_permissions pp ON pp.page_id = p.id AND pp.role_id = ?
    `).all(req.user.role_id);

    const map = {};
    rows.forEach(r => { map[r.slug] = r.access_level || 'none'; });
    res.json(map);
  } catch (err) { next(err); }
});

// All routes below require admin
router.use(authenticate);
router.use((req, res, next) => {
  if (!req.user.is_admin) {
    return res.status(403).json({ error: { code: 'ADMIN_ONLY', message: 'Admin access required' } });
  }
  next();
});

// GET /api/permissions — full matrix: all roles × all pages
router.get('/', (req, res, next) => {
  try {
    const roles = db.prepare('SELECT * FROM roles ORDER BY id ASC').all();
    const pages = db.prepare('SELECT * FROM pages ORDER BY id ASC').all();
    const perms = db.prepare('SELECT role_id, page_id, access_level FROM page_permissions').all();

    const matrix = {};
    perms.forEach(p => {
      if (!matrix[p.role_id]) matrix[p.role_id] = {};
      matrix[p.role_id][p.page_id] = p.access_level;
    });

    res.json({ roles, pages, matrix });
  } catch (err) { next(err); }
});

// PUT /api/permissions — bulk update
// Body: { updates: [{ role_id, page_id, access_level }] }
router.put('/', (req, res, next) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates)) {
      return res.status(400).json({ error: { code: 'INVALID_BODY', message: 'updates must be an array' } });
    }

    const upsert = db.prepare(`
      INSERT INTO page_permissions (role_id, page_id, access_level)
      VALUES (?, ?, ?)
      ON CONFLICT(role_id, page_id) DO UPDATE SET access_level = excluded.access_level
    `);

    const txn = db.transaction(() => {
      for (const u of updates) {
        if (!u.role_id || !u.page_id || !u.access_level) continue;
        if (!['none', 'view', 'edit'].includes(u.access_level)) continue;
        upsert.run(u.role_id, u.page_id, u.access_level);
      }
    });
    txn();

    res.json({ message: 'Permissions updated successfully' });
  } catch (err) { next(err); }
});

module.exports = router;
