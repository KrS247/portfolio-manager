const express = require('express');
const db = require('../db/database');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

const isPM = (req) => req.user.role_name === 'project_manager';

// ── GET /api/projects?program_id=X ───────────────────────────────────────────
router.get('/', authenticate, authorize('projects', 'view'), (req, res, next) => {
  try {
    const { program_id } = req.query;
    const conditions = [];
    const params = [];

    if (program_id) { conditions.push('pj.program_id = ?'); params.push(program_id); }
    if (isPM(req))  { conditions.push('pj.owner_id = ?');   params.push(req.user.id); }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    const query = `
      SELECT pj.*, u.username AS owner_name, pr.name AS program_name, p.name AS portfolio_name,
        (SELECT COUNT(*) FROM tasks t WHERE t.parent_type = 'project' AND t.parent_id = pj.id) AS task_count,
        COALESCE((SELECT ROUND(AVG(t.percent_complete))
                  FROM tasks t WHERE t.parent_type = 'project' AND t.parent_id = pj.id), 0) AS percent_complete,
        (SELECT ROUND(AVG(r.risk_rate))
         FROM tasks t JOIN risks r ON r.task_id = t.id
         WHERE t.parent_type = 'project' AND t.parent_id = pj.id) AS avg_risk_rate,
        (SELECT COALESCE(SUM(tr.estimated_hours * usr.hourly_rate), 0)
         FROM tasks t
         JOIN task_resources tr ON tr.task_id = t.id
         JOIN users usr ON usr.id = tr.user_id
         WHERE t.parent_type = 'project' AND t.parent_id = pj.id
           AND tr.estimated_hours IS NOT NULL AND usr.hourly_rate IS NOT NULL) AS estimated_cost,
        (SELECT COALESCE(SUM(tr.actual_hours * usr.hourly_rate), 0)
         FROM tasks t
         JOIN task_resources tr ON tr.task_id = t.id
         JOIN users usr ON usr.id = tr.user_id
         WHERE t.parent_type = 'project' AND t.parent_id = pj.id
           AND tr.actual_hours IS NOT NULL AND usr.hourly_rate IS NOT NULL) AS actual_cost
      FROM projects pj
      LEFT JOIN users u ON u.id = pj.owner_id
      LEFT JOIN programs pr ON pr.id = pj.program_id
      LEFT JOIN portfolios p ON p.id = pr.portfolio_id
      ${where}
      ORDER BY pj.created_at DESC
    `;
    res.json(db.prepare(query).all(...params));
  } catch (err) { next(err); }
});

// ── GET /api/projects/:id ─────────────────────────────────────────────────────
router.get('/:id', authenticate, authorize('projects', 'view'), (req, res, next) => {
  try {
    const project = db.prepare(`
      SELECT pj.*, u.username AS owner_name, pr.name AS program_name, p.name AS portfolio_name
      FROM projects pj
      LEFT JOIN users u ON u.id = pj.owner_id
      LEFT JOIN programs pr ON pr.id = pj.program_id
      LEFT JOIN portfolios p ON p.id = pr.portfolio_id
      WHERE pj.id = ?
    `).get(req.params.id);

    if (!project) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });

    // PM can only see their own projects
    if (isPM(req) && project.owner_id !== req.user.id) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });
    }

    let tasksQuery = `
      SELECT t.*, u.username AS assigned_to_name,
             r.id AS risk_id, r.risk_status, r.risk_rate
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_to
      LEFT JOIN risks r ON r.task_id = t.id
      WHERE t.parent_type = 'project' AND t.parent_id = ?
    `;
    const tasksParams = [req.params.id];
    if (isPM(req)) { tasksQuery += ' AND t.created_by = ?'; tasksParams.push(req.user.id); }
    tasksQuery += ' ORDER BY t.sequence ASC, t.priority ASC';

    const tasks = db.prepare(tasksQuery).all(...tasksParams);

    // Attach dependency ids to each task
    const taskIds = tasks.map(t => t.id);
    const depsMap = {};
    if (taskIds.length > 0) {
      const placeholders = taskIds.map(() => '?').join(',');
      const deps = db.prepare(
        `SELECT task_id, depends_on FROM task_dependencies WHERE task_id IN (${placeholders})`
      ).all(...taskIds);
      for (const d of deps) {
        if (!depsMap[d.task_id]) depsMap[d.task_id] = [];
        depsMap[d.task_id].push(d.depends_on);
      }
    }
    const tasksWithDeps = tasks.map(t => ({ ...t, depends_on: depsMap[t.id] || [] }));

    // Compute project completion from tasks
    const percent_complete = tasks.length > 0
      ? Math.round(tasks.reduce((s, t) => s + (t.percent_complete ?? 0), 0) / tasks.length)
      : 0;

    // Compute avg_risk_rate from tasks that have risks
    const riskTasks = tasks.filter(t => t.risk_rate != null);
    const avg_risk_rate = riskTasks.length > 0
      ? Math.round(riskTasks.reduce((s, t) => s + t.risk_rate, 0) / riskTasks.length)
      : null;

    res.json({ ...project, tasks: tasksWithDeps, percent_complete, avg_risk_rate });
  } catch (err) { next(err); }
});

// ── POST /api/projects ────────────────────────────────────────────────────────
router.post('/', authenticate, authorize('projects', 'edit'), (req, res, next) => {
  try {
    const { name, description, status = 'active', priority = 5, start_date, end_date, owner_id, program_id, clickup_id } = req.body;
    if (!name || !program_id) {
      return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'Name and program_id are required' } });
    }
    const program = db.prepare('SELECT id FROM programs WHERE id = ?').get(program_id);
    if (!program) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Program not found' } });

    const p = Math.min(10, Math.max(1, parseInt(priority) || 5));
    // PM always owns the projects they create; other roles can set an explicit owner
    const resolvedOwnerId = isPM(req) ? req.user.id : (owner_id || req.user.id);

    const result = db.prepare(
      'INSERT INTO projects (program_id, name, description, status, priority, start_date, end_date, owner_id, clickup_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(program_id, name, description || null, status, p, start_date || null, end_date || null, resolvedOwnerId, clickup_id || null);

    res.status(201).json(db.prepare('SELECT * FROM projects WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) { next(err); }
});

// ── PUT /api/projects/:id ─────────────────────────────────────────────────────
router.put('/:id', authenticate, authorize('projects', 'edit'), (req, res, next) => {
  try {
    const existing = db.prepare('SELECT id, owner_id FROM projects WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });

    if (isPM(req) && existing.owner_id !== req.user.id) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only edit your own projects' } });
    }

    const { name, description, status, priority, start_date, end_date, owner_id, clickup_id } = req.body;
    const p = priority != null ? Math.min(10, Math.max(1, parseInt(priority) || 5)) : null;
    // PM cannot reassign ownership to another user
    const resolvedOwnerId = isPM(req) ? null : (owner_id ?? null);

    db.prepare(`
      UPDATE projects SET name = COALESCE(?, name), description = COALESCE(?, description),
        status = COALESCE(?, status), priority = COALESCE(?, priority),
        start_date = COALESCE(?, start_date), end_date = COALESCE(?, end_date),
        owner_id = COALESCE(?, owner_id),
        clickup_id = CASE WHEN ? IS NOT NULL THEN ? ELSE clickup_id END,
        updated_at = datetime('now')
      WHERE id = ?
    `).run(name ?? null, description ?? null, status ?? null, p ?? null, start_date ?? null, end_date ?? null, resolvedOwnerId, clickup_id ?? null, clickup_id ?? null, req.params.id);
    res.json(db.prepare('SELECT * FROM projects WHERE id = ?').get(req.params.id));
  } catch (err) { next(err); }
});

// ── DELETE /api/projects/:id ──────────────────────────────────────────────────
router.delete('/:id', authenticate, authorize('projects', 'edit'), (req, res, next) => {
  try {
    const existing = db.prepare('SELECT id, owner_id FROM projects WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found' } });

    if (isPM(req) && existing.owner_id !== req.user.id) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only delete your own projects' } });
    }

    db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
    res.json({ message: 'Project deleted successfully' });
  } catch (err) { next(err); }
});

module.exports = router;
