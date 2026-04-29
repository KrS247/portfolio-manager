const express = require('express');
const db = require('../db/database');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

const isPM = (req) => req.user.role_name === 'project_manager';

const PROG_PCT_SQL = `COALESCE((
  SELECT ROUND(AVG(COALESCE(
    (SELECT AVG(t.percent_complete) FROM tasks t WHERE t.parent_type = 'project' AND t.parent_id = pj.id),
    0
  )))
  FROM projects pj WHERE pj.program_id = pr.id
), 0)`;

// ── GET /api/programs?portfolio_id=X ─────────────────────────────────────────
router.get('/', authenticate, authorize('programs', 'view'), (req, res, next) => {
  try {
    const { portfolio_id } = req.query;
    const conditions = [];
    const params = [];

    if (portfolio_id) { conditions.push('pr.portfolio_id = ?'); params.push(portfolio_id); }
    if (isPM(req))    { conditions.push('pr.owner_id = ?');     params.push(req.user.id); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const query = `
      SELECT pr.*, u.username AS owner_name, p.name AS portfolio_name,
        (SELECT COUNT(*) FROM projects pj WHERE pj.program_id = pr.id) AS project_count,
        (SELECT COUNT(*) FROM tasks t WHERE t.parent_type = 'program' AND t.parent_id = pr.id) AS task_count,
        ${PROG_PCT_SQL} AS percent_complete,
        (SELECT ROUND(AVG(r.risk_rate))
         FROM projects pj2
         JOIN tasks t ON t.parent_type = 'project' AND t.parent_id = pj2.id
         JOIN risks r ON r.task_id = t.id
         WHERE pj2.program_id = pr.id) AS avg_risk_rate
      FROM programs pr
      LEFT JOIN users u ON u.id = pr.owner_id
      LEFT JOIN portfolios p ON p.id = pr.portfolio_id
      ${where}
      ORDER BY pr.created_at DESC
    `;
    res.json(db.prepare(query).all(...params));
  } catch (err) { next(err); }
});

// ── GET /api/programs/:id ─────────────────────────────────────────────────────
router.get('/:id', authenticate, authorize('programs', 'view'), (req, res, next) => {
  try {
    const program = db.prepare(`
      SELECT pr.*, u.username AS owner_name, p.name AS portfolio_name
      FROM programs pr
      LEFT JOIN users u ON u.id = pr.owner_id
      LEFT JOIN portfolios p ON p.id = pr.portfolio_id
      WHERE pr.id = ?
    `).get(req.params.id);
    if (!program) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Program not found' } });

    // PM can only view programs they own
    if (isPM(req) && program.owner_id !== req.user.id) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Program not found' } });
    }

    // Projects: PM sees only their own
    let projectQuery = `
      SELECT pj.*, u.username AS owner_name,
        (SELECT COUNT(*) FROM tasks t WHERE t.parent_type = 'project' AND t.parent_id = pj.id) AS task_count,
        COALESCE((SELECT ROUND(AVG(t.percent_complete))
                  FROM tasks t WHERE t.parent_type = 'project' AND t.parent_id = pj.id), 0) AS percent_complete,
        (SELECT ROUND(AVG(r.risk_rate))
         FROM tasks t JOIN risks r ON r.task_id = t.id
         WHERE t.parent_type = 'project' AND t.parent_id = pj.id) AS avg_risk_rate
      FROM projects pj LEFT JOIN users u ON u.id = pj.owner_id
      WHERE pj.program_id = ?
    `;
    const projectParams = [req.params.id];
    if (isPM(req)) { projectQuery += ' AND pj.owner_id = ?'; projectParams.push(req.user.id); }
    projectQuery += ' ORDER BY pj.created_at DESC';
    const projects = db.prepare(projectQuery).all(...projectParams);

    // Tasks: PM sees only their own
    let taskQuery = `
      SELECT t.*, u.username AS assigned_to_name,
             r.id AS risk_id, r.risk_status, r.risk_rate
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_to
      LEFT JOIN risks r ON r.task_id = t.id
      WHERE t.parent_type = 'program' AND t.parent_id = ?
    `;
    const taskParams = [req.params.id];
    if (isPM(req)) { taskQuery += ' AND t.created_by = ?'; taskParams.push(req.user.id); }
    taskQuery += ' ORDER BY t.sequence ASC, t.priority ASC';
    const tasks = db.prepare(taskQuery).all(...taskParams);

    const percent_complete = projects.length > 0
      ? Math.round(projects.reduce((s, p) => s + (p.percent_complete ?? 0), 0) / projects.length)
      : 0;
    const riskProjects = projects.filter(p => p.avg_risk_rate != null);
    const avg_risk_rate = riskProjects.length > 0
      ? Math.round(riskProjects.reduce((s, p) => s + p.avg_risk_rate, 0) / riskProjects.length)
      : null;

    res.json({ ...program, projects, tasks, percent_complete, avg_risk_rate });
  } catch (err) { next(err); }
});

// ── POST /api/programs ────────────────────────────────────────────────────────
router.post('/', authenticate, authorize('programs', 'edit'), (req, res, next) => {
  try {
    const { name, description, status = 'active', priority = 5, start_date, end_date, owner_id, portfolio_id } = req.body;
    if (!name || !portfolio_id) {
      return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'Name and portfolio_id are required' } });
    }
    const portfolio = db.prepare('SELECT id FROM portfolios WHERE id = ?').get(portfolio_id);
    if (!portfolio) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Portfolio not found' } });

    const p = Math.min(10, Math.max(1, parseInt(priority) || 5));
    // PM always owns programs they create
    const resolvedOwnerId = isPM(req) ? req.user.id : (owner_id || req.user.id);
    const result = db.prepare(
      'INSERT INTO programs (portfolio_id, name, description, status, priority, start_date, end_date, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(portfolio_id, name, description || null, status, p, start_date || null, end_date || null, resolvedOwnerId);

    res.status(201).json(db.prepare('SELECT * FROM programs WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) { next(err); }
});

// ── PUT /api/programs/:id ─────────────────────────────────────────────────────
router.put('/:id', authenticate, authorize('programs', 'edit'), (req, res, next) => {
  try {
    const existing = db.prepare('SELECT id, owner_id FROM programs WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Program not found' } });

    if (isPM(req) && existing.owner_id !== req.user.id) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only edit your own programs' } });
    }

    const { name, description, status, priority, start_date, end_date, owner_id } = req.body;
    const p = priority != null ? Math.min(10, Math.max(1, parseInt(priority) || 5)) : null;
    const resolvedOwnerId = isPM(req) ? null : (owner_id ?? null);

    db.prepare(`
      UPDATE programs SET name = COALESCE(?, name), description = COALESCE(?, description),
        status = COALESCE(?, status), priority = COALESCE(?, priority),
        start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date),
        owner_id = COALESCE(?, owner_id), updated_at = datetime('now')
      WHERE id = ?
    `).run(name ?? null, description ?? null, status ?? null, p ?? null, start_date ?? null, end_date ?? null, resolvedOwnerId, req.params.id);

    res.json(db.prepare('SELECT * FROM programs WHERE id = ?').get(req.params.id));
  } catch (err) { next(err); }
});

// ── DELETE /api/programs/:id ──────────────────────────────────────────────────
router.delete('/:id', authenticate, authorize('programs', 'edit'), (req, res, next) => {
  try {
    const existing = db.prepare('SELECT id, owner_id FROM programs WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Program not found' } });

    if (isPM(req) && existing.owner_id !== req.user.id) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only delete your own programs' } });
    }

    db.prepare('DELETE FROM programs WHERE id = ?').run(req.params.id);
    res.json({ message: 'Program deleted successfully' });
  } catch (err) { next(err); }
});

module.exports = router;
