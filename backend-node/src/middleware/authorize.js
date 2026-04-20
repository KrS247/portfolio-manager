const db = require('../db/database');

const LEVEL = { none: 0, view: 1, edit: 2 };

function authorize(pageSlug, requiredLevel) {
  return function (req, res, next) {
    // Admin role bypasses all permission checks
    if (req.user.is_admin) {
      req.accessLevel = 'edit';
      return next();
    }

    const row = db.prepare(`
      SELECT pp.access_level
      FROM page_permissions pp
      JOIN pages p ON p.id = pp.page_id
      WHERE pp.role_id = ? AND p.slug = ?
    `).get(req.user.role_id, pageSlug);

    const granted = row ? row.access_level : 'none';

    if (LEVEL[granted] < LEVEL[requiredLevel]) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'You do not have permission to perform this action' },
      });
    }

    req.accessLevel = granted;
    next();
  };
}

module.exports = authorize;
