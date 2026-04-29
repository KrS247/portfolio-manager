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

const PORT_PCT_SQL = `COALESCE((
  SELECT ROUND(AVG(COALESCE((
    SELECT COALESCE(ROUND(AVG(COALESCE(
      (SELECT AVG(t.percent_complete) FROM tasks t WHERE t.parent_type = 'project' AND t.parent_id = pj.id),
      0
    ))), 0)
    FROM projects pj WHERE pj.program_id = pr.id
  ), 0)))
  FROM programs pr WHERE pr.portfolio_id = p.id
), 0)`;

const ALL_TASKS_FOR_PORTFOLIO = `(
  t.parent_type = 'portfolio' AND t.parent_id = p.id
  OR t.parent_type = 'program'  AND t.parent_id IN (SELECT id FROM programs WHERE portfolio_id = p.id)
  OR t.parent_type = 'project'  AND t.parent_id IN (
       SELECT pj.id FROM projects pj
       JOIN programs pr ON pj.program_id = pr.id
       WHERE pr.portfolio_id = p.id)
)`;

// ── GET /api/portfolios ───────────────────────────────────────────────────────
router.get('/', authenticate, authorize('portfolios', 'view'), (req, res, next) => {
  try {
    const pmFilter = isPM(req) ? 'WHERE p.owner_id = ?' : '';
    const params   = isPM(req) ? [req.user.id] : [];

    const portfolios = db.prepare(`
      SELECT p.*,
        u.username AS owner_name,
        (SELECT COUNT(*) FROM programs pr WHERE pr.portfolio_id = p.id) AS program_count,
        (SELECT COUNT(*) FROM projects pj
           JOIN programs pr ON pj.program_id = pr.id
           WHERE pr.portfolio_id = p.id) AS project_count,
        (SELECT COUNT(*) FROM tasks t WHERE ${ALL_TASKS_FOR_PORTFOLIO}
           AND t.status IN ('open','in_progress')) AS active_task_count,
        (SELECT MIN(t.start_date) FROM tasks t WHERE ${ALL_TASKS_FOR_PORTFOLIO}
           AND t.start_date IS NOT NULL) AS task_start_date,
        (SELECT MAX(t.due_date)   FROM tasks t WHERE ${ALL_TASKS_FOR_PORTFOLIO}
           AND t.due_date IS NOT NULL) AS task_end_date,
        (SELECT COUNT(*) FROM tasks t WHERE t.parent_type = 'portfolio' AND t.parent_id = p.id) AS task_count,
        ${PORT_PCT_SQL} AS percent_complete,
        (SELECT ROUND(AVG(r.risk_rate))
         FROM programs pr2
         JOIN projects pj ON pj.program_id = pr2.id
         JOIN tasks t ON t.parent_type = 'project' AND t.parent_id = pj.id
         JOIN risks r ON r.task_id = t.id
         WHERE pr2.portfolio_id = p.id) AS avg_risk_rate
      FROM portfolios p
      LEFT JOIN users u ON u.id = p.owner_id
      ${pmFilter}
      ORDER BY p.created_at DESC
    `).all(...params);
    res.json(portfolios);
  } catch (err) { next(err); }
});

// ── GET /api/portfolios/:id ───────────────────────────────────────────────────
router.get('/:id', authenticate, authorize('portfolios', 'view'), (req, res, next) => {
  try {
    const portfolio = db.prepare(`
      SELECT p.*, u.username AS owner_name
      FROM portfolios p LEFT JOIN users u ON u.id = p.owner_id
      WHERE p.id = ?
    `).get(req.params.id);
    if (!portfolio) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Portfolio not found' } });

    // PM can only view portfolios they own
    if (isPM(req) && portfolio.owner_id !== req.user.id) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Portfolio not found' } });
    }

    // Programs: PM sees only their own
    let programQuery = `
      SELECT pr.*, u.username AS owner_name,
        (SELECT COUNT(*) FROM projects pj WHERE pj.program_id = pr.id) AS project_count,
        ${PROG_PCT_SQL} AS percent_complete,
        (SELECT ROUND(AVG(r.risk_rate))
         FROM projects pj2
         JOIN tasks t ON t.parent_type = 'project' AND t.parent_id = pj2.id
         JOIN risks r ON r.task_id = t.id
         WHERE pj2.program_id = pr.id) AS avg_risk_rate
      FROM programs pr LEFT JOIN users u ON u.id = pr.owner_id
      WHERE pr.portfolio_id = ?
    `;
    const programParams = [req.params.id];
    if (isPM(req)) { programQuery += ' AND pr.owner_id = ?'; programParams.push(req.user.id); }
    programQuery += ' ORDER BY pr.created_at DESC';
    const programs = db.prepare(programQuery).all(...programParams);

    // Tasks at portfolio level: PM sees only their own
    let taskQuery = `
      SELECT t.*, u.username AS assigned_to_name,
             r.id AS risk_id, r.risk_status, r.risk_rate
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_to
      LEFT JOIN risks r ON r.task_id = t.id
      WHERE t.parent_type = 'portfolio' AND t.parent_id = ?
    `;
    const taskParams = [req.params.id];
    if (isPM(req)) { taskQuery += ' AND t.created_by = ?'; taskParams.push(req.user.id); }
    taskQuery += ' ORDER BY t.sequence ASC, t.priority ASC';
    const tasks = db.prepare(taskQuery).all(...taskParams);

    const percent_complete = programs.length > 0
      ? Math.round(programs.reduce((s, pr) => s + (pr.percent_complete ?? 0), 0) / programs.length)
      : 0;
    const riskPrograms = programs.filter(pr => pr.avg_risk_rate != null);
    const avg_risk_rate = riskPrograms.length > 0
      ? Math.round(riskPrograms.reduce((s, pr) => s + pr.avg_risk_rate, 0) / riskPrograms.length)
      : null;

    res.json({ ...portfolio, programs, tasks, percent_complete, avg_risk_rate });
  } catch (err) { next(err); }
});

// ── POST /api/portfolios ──────────────────────────────────────────────────────
router.post('/', authenticate, authorize('portfolios', 'edit'), (req, res, next) => {
  try {
    const { name, description, status = 'active', priority = 5, start_date, end_date, owner_id } = req.body;
    if (!name) return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'Name is required' } });

    const p = Math.min(10, Math.max(1, parseInt(priority) || 5));
    // PM always owns portfolios they create
    const resolvedOwnerId = isPM(req) ? req.user.id : (owner_id || req.user.id);
    const result = db.prepare(
      'INSERT INTO portfolios (name, description, status, priority, start_date, end_date, owner_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(name, description || null, status, p, start_date || null, end_date || null, resolvedOwnerId);

    res.status(201).json(db.prepare('SELECT * FROM portfolios WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) { next(err); }
});

// ── PUT /api/portfolios/:id ───────────────────────────────────────────────────
router.put('/:id', authenticate, authorize('portfolios', 'edit'), (req, res, next) => {
  try {
    const existing = db.prepare('SELECT id, owner_id FROM portfolios WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Portfolio not found' } });

    if (isPM(req) && existing.owner_id !== req.user.id) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only edit your own portfolios' } });
    }

    const { name, description, status, priority, start_date, end_date, owner_id } = req.body;
    const p = priority != null ? Math.min(10, Math.max(1, parseInt(priority) || 5)) : null;
    const resolvedOwnerId = isPM(req) ? null : (owner_id ?? null);

    db.prepare(`
      UPDATE portfolios SET
        name        = COALESCE(?, name),
        description = COALESCE(?, description),
        status      = COALESCE(?, status),
        priority    = COALESCE(?, priority),
        start_date  = COALESCE(?, start_date),
        end_date    = COALESCE(?, end_date),
        owner_id    = COALESCE(?, owner_id),
        updated_at  = datetime('now')
      WHERE id = ?
    `).run(name ?? null, description ?? null, status ?? null, p ?? null, start_date ?? null, end_date ?? null, resolvedOwnerId, req.params.id);

    res.json(db.prepare('SELECT * FROM portfolios WHERE id = ?').get(req.params.id));
  } catch (err) { next(err); }
});

// ── DELETE /api/portfolios/:id ────────────────────────────────────────────────
router.delete('/:id', authenticate, authorize('portfolios', 'edit'), (req, res, next) => {
  try {
    const existing = db.prepare('SELECT id, owner_id FROM portfolios WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Portfolio not found' } });

    if (isPM(req) && existing.owner_id !== req.user.id) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only delete your own portfolios' } });
    }

    db.prepare('DELETE FROM portfolios WHERE id = ?').run(req.params.id);
    res.json({ message: 'Portfolio deleted successfully' });
  } catch (err) { next(err); }
});

module.exports = router;
