const express = require('express');
const db = require('../db/database');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();
const GAP = 1000;

const isPM = (req) => req.user.role_name === 'project_manager';

function getParentExists(parent_type, parent_id) {
  const table = { portfolio: 'portfolios', program: 'programs', project: 'projects' }[parent_type];
  if (!table) return false;
  return !!db.prepare(`SELECT id FROM ${table} WHERE id = ?`).get(parent_id);
}

function getNextSequence(parent_type, parent_id) {
  const max = db.prepare(
    'SELECT MAX(sequence) AS m FROM tasks WHERE parent_type = ? AND parent_id = ?'
  ).get(parent_type, parent_id);
  return ((max && max.m != null) ? max.m : 0) + GAP;
}

function renumberScope(parent_type, parent_id) {
  const tasks = db.prepare(
    'SELECT id FROM tasks WHERE parent_type = ? AND parent_id = ? ORDER BY sequence ASC'
  ).all(parent_type, parent_id);
  const update = db.prepare('UPDATE tasks SET sequence = ? WHERE id = ?');
  const txn = db.transaction(() => {
    tasks.forEach((t, i) => update.run((i + 1) * GAP, t.id));
  });
  txn();
}

// GET /api/tasks
router.get('/', authenticate, authorize('tasks', 'view'), (req, res, next) => {
  try {
    const { parent_type, parent_id, assigned_to, status } = req.query;
    let query = `
      SELECT t.*, u.username AS assigned_to_name,
             r.id AS risk_id, r.risk_status, r.risk_rate,
             CASE
               WHEN t.parent_type = 'portfolio' THEN (SELECT name FROM portfolios WHERE id = t.parent_id)
               WHEN t.parent_type = 'program'   THEN (SELECT name FROM programs   WHERE id = t.parent_id)
               WHEN t.parent_type = 'project'   THEN (SELECT name FROM projects   WHERE id = t.parent_id)
             END AS parent_name,
             CASE
               WHEN t.parent_type = 'project' THEN (SELECT pr.name FROM programs pr JOIN projects pj ON pj.program_id = pr.id WHERE pj.id = t.parent_id)
               WHEN t.parent_type = 'program' THEN (SELECT name FROM programs WHERE id = t.parent_id)
             END AS program_name
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_to
      LEFT JOIN risks r ON r.task_id = t.id
      WHERE 1=1
    `;
    const params = [];
    if (parent_type) { query += ' AND t.parent_type = ?'; params.push(parent_type); }
    if (parent_id)   { query += ' AND t.parent_id = ?';   params.push(parent_id); }
    if (assigned_to) { query += ' AND t.assigned_to = ?'; params.push(assigned_to); }
    if (status)      { query += ' AND t.status = ?';      params.push(status); }
    // PM sees only tasks they created
    if (isPM(req)) { query += ' AND t.created_by = ?'; params.push(req.user.id); }
    query += ' ORDER BY t.sequence ASC, t.priority ASC';
    res.json(db.prepare(query).all(...params));
  } catch (err) { next(err); }
});

// GET /api/tasks/high-risk
router.get('/high-risk', authenticate, authorize('tasks', 'view'), (req, res, next) => {
  try {
    let query = `
      SELECT
        t.id, t.title, t.status, t.parent_type, t.parent_id,
        r.risk_rate, r.risk_status,
        CASE WHEN t.parent_type = 'project' THEN proj.id   ELSE NULL END AS project_id,
        CASE WHEN t.parent_type = 'project' THEN proj.name ELSE NULL END AS project_name,
        CASE
          WHEN t.parent_type = 'project' THEN prog.id
          WHEN t.parent_type = 'program' THEN prog2.id
          ELSE NULL
        END AS program_id,
        CASE
          WHEN t.parent_type = 'project' THEN prog.name
          WHEN t.parent_type = 'program' THEN prog2.name
          ELSE NULL
        END AS program_name
      FROM tasks t
      INNER JOIN risks r ON r.task_id = t.id
      LEFT JOIN projects  proj  ON t.parent_type = 'project' AND t.parent_id = proj.id
      LEFT JOIN programs  prog  ON proj.program_id = prog.id
      LEFT JOIN programs  prog2 ON t.parent_type = 'program' AND t.parent_id = prog2.id
      WHERE r.risk_rate > 14
    `;
    const params = [];
    if (isPM(req)) { query += ' AND t.created_by = ?'; params.push(req.user.id); }
    query += ' ORDER BY r.risk_rate DESC, t.title ASC';
    res.json(db.prepare(query).all(...params));
  } catch (err) { next(err); }
});

// GET /api/tasks/overdue
router.get('/overdue', authenticate, authorize('tasks', 'view'), (req, res, next) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    let query = `
      SELECT
        t.id, t.title, t.status, t.due_date, t.parent_type, t.parent_id,
        CASE WHEN t.parent_type = 'project' THEN proj.id   ELSE NULL END AS project_id,
        CASE WHEN t.parent_type = 'project' THEN proj.name ELSE NULL END AS project_name,
        CASE
          WHEN t.parent_type = 'project' THEN prog.id
          WHEN t.parent_type = 'program' THEN prog2.id
          ELSE NULL
        END AS program_id,
        CASE
          WHEN t.parent_type = 'project' THEN prog.name
          WHEN t.parent_type = 'program' THEN prog2.name
          ELSE NULL
        END AS program_name
      FROM tasks t
      LEFT JOIN projects proj  ON t.parent_type = 'project' AND t.parent_id = proj.id
      LEFT JOIN programs prog  ON proj.program_id = prog.id
      LEFT JOIN programs prog2 ON t.parent_type = 'program' AND t.parent_id = prog2.id
      WHERE t.due_date IS NOT NULL
        AND t.due_date < ?
        AND t.status NOT IN ('completed', 'cancelled')
        AND t.is_milestone = 0
    `;
    const params = [today];
    if (isPM(req)) { query += ' AND t.created_by = ?'; params.push(req.user.id); }
    query += ' ORDER BY t.due_date ASC, t.title ASC';
    res.json(db.prepare(query).all(...params));
  } catch (err) { next(err); }
});

// GET /api/tasks/over-budget
router.get('/over-budget', authenticate, authorize('tasks', 'view'), (req, res, next) => {
  try {
    let query = `
      SELECT
        t.id, t.title, t.status, t.parent_type, t.parent_id,
        ROUND(SUM(CASE
          WHEN tr.actual_hours > tr.estimated_hours
          THEN tr.actual_hours - tr.estimated_hours
          ELSE 0
        END), 2) AS hours_over,
        ROUND(SUM(tr.estimated_hours), 2) AS total_estimated,
        ROUND(SUM(tr.actual_hours), 2)    AS total_actual,
        CASE WHEN t.parent_type = 'project' THEN proj.id   ELSE NULL END AS project_id,
        CASE WHEN t.parent_type = 'project' THEN proj.name ELSE NULL END AS project_name,
        CASE
          WHEN t.parent_type = 'project' THEN prog.id
          WHEN t.parent_type = 'program' THEN prog2.id
          ELSE NULL
        END AS program_id,
        CASE
          WHEN t.parent_type = 'project' THEN prog.name
          WHEN t.parent_type = 'program' THEN prog2.name
          ELSE NULL
        END AS program_name
      FROM tasks t
      JOIN task_resources tr ON tr.task_id = t.id
      LEFT JOIN projects  proj  ON t.parent_type = 'project' AND t.parent_id = proj.id
      LEFT JOIN programs  prog  ON proj.program_id = prog.id
      LEFT JOIN programs  prog2 ON t.parent_type = 'program' AND t.parent_id = prog2.id
      WHERE tr.actual_hours IS NOT NULL
        AND tr.estimated_hours IS NOT NULL
        AND tr.actual_hours > tr.estimated_hours
    `;
    const params = [];
    if (isPM(req)) { query += ' AND t.created_by = ?'; params.push(req.user.id); }
    query += ' GROUP BY t.id ORDER BY hours_over DESC, t.title ASC';
    res.json(db.prepare(query).all(...params));
  } catch (err) { next(err); }
});

// GET /api/tasks/:id
router.get('/:id', authenticate, authorize('tasks', 'view'), (req, res, next) => {
  try {
    const task = db.prepare(`
      SELECT t.*, u.username AS assigned_to_name,
             r.id AS risk_id, r.risk_status, r.risk_rate
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assigned_to
      LEFT JOIN risks r ON r.task_id = t.id
      WHERE t.id = ?
    `).get(req.params.id);
    if (!task) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } });
    // PM can only see their own tasks
    if (isPM(req) && task.created_by !== req.user.id) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } });
    }
    res.json(task);
  } catch (err) { next(err); }
});

// POST /api/tasks
router.post('/', authenticate, authorize('tasks', 'edit'), (req, res, next) => {
  try {
    const { title, description, priority = 5, status = 'open', due_date, assigned_to, parent_type, parent_id } = req.body;
    if (!title || !parent_type || !parent_id) {
      return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'title, parent_type, and parent_id are required' } });
    }
    if (!['portfolio', 'program', 'project'].includes(parent_type)) {
      return res.status(400).json({ error: { code: 'INVALID_PARENT_TYPE', message: 'parent_type must be portfolio, program, or project' } });
    }
    if (!getParentExists(parent_type, parent_id)) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: `${parent_type} not found` } });
    }

    const { start_date, percent_complete = 0, is_milestone = 0 } = req.body;
    const pct = Math.min(100, Math.max(0, parseInt(percent_complete) || 0));
    const milestone = is_milestone ? 1 : 0;
    const sequence = getNextSequence(parent_type, parent_id);

    const result = db.prepare(`
      INSERT INTO tasks (title, description, priority, sequence, status, percent_complete,
        start_date, due_date, is_milestone, assigned_to, parent_type, parent_id, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      title, description || null, priority, sequence, status, pct,
      milestone ? null : (start_date || null), due_date || null, milestone,
      assigned_to || null, parent_type, parent_id,
      req.user.id   // always record the creator
    );

    res.status(201).json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) { next(err); }
});

// PUT /api/tasks/:id
router.put('/:id', authenticate, authorize('tasks', 'edit'), (req, res, next) => {
  try {
    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } });

    if (isPM(req) && existing.created_by !== req.user.id) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only edit your own tasks' } });
    }

    const { title, description, priority, status, start_date, due_date, assigned_to, percent_complete, is_milestone } = req.body;
    const pct = percent_complete != null ? Math.min(100, Math.max(0, parseInt(percent_complete) || 0)) : null;
    const milestone = is_milestone != null ? (is_milestone ? 1 : 0) : null;
    const effectiveStartDate = milestone === 1 ? null : (start_date ?? null);
    db.prepare(`
      UPDATE tasks SET title = COALESCE(?, title), description = COALESCE(?, description),
        priority = COALESCE(?, priority), status = COALESCE(?, status),
        percent_complete = COALESCE(?, percent_complete),
        start_date = ?, due_date = COALESCE(?, due_date),
        is_milestone = COALESCE(?, is_milestone),
        assigned_to = COALESCE(?, assigned_to), updated_at = datetime('now')
      WHERE id = ?
    `).run(title ?? null, description ?? null, priority ?? null, status ?? null, pct ?? null, effectiveStartDate, due_date ?? null, milestone ?? null, assigned_to ?? null, req.params.id);
    res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id));
  } catch (err) { next(err); }
});

// PUT /api/tasks/:id/sequence
router.put('/:id/sequence', authenticate, authorize('tasks', 'edit'), (req, res, next) => {
  try {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } });

    const { after_id } = req.body;
    const scopedTasks = db.prepare(
      'SELECT id, sequence FROM tasks WHERE parent_type = ? AND parent_id = ? AND id != ? ORDER BY sequence ASC'
    ).all(task.parent_type, task.parent_id, task.id);

    let newSeq;
    if (after_id == null) {
      const first = scopedTasks[0];
      newSeq = first ? Math.floor(first.sequence / 2) : GAP;
      if (newSeq <= 0) { renumberScope(task.parent_type, task.parent_id); newSeq = GAP / 2; }
    } else {
      const afterIdx = scopedTasks.findIndex(t => t.id === after_id);
      if (afterIdx === -1) {
        return res.status(400).json({ error: { code: 'INVALID_AFTER_ID', message: 'after_id not found in same scope' } });
      }
      const afterTask = scopedTasks[afterIdx];
      const nextTask  = scopedTasks[afterIdx + 1];
      if (nextTask) {
        newSeq = Math.floor((afterTask.sequence + nextTask.sequence) / 2);
        if (newSeq === afterTask.sequence) {
          renumberScope(task.parent_type, task.parent_id);
          const refreshed = db.prepare(
            'SELECT id, sequence FROM tasks WHERE parent_type = ? AND parent_id = ? AND id != ? ORDER BY sequence ASC'
          ).all(task.parent_type, task.parent_id, task.id);
          const rAfter = refreshed.find(t => t.id === after_id);
          const rNext  = refreshed[refreshed.findIndex(t => t.id === after_id) + 1];
          newSeq = rNext ? Math.floor((rAfter.sequence + rNext.sequence) / 2) : rAfter.sequence + GAP;
        }
      } else {
        newSeq = afterTask.sequence + GAP;
      }
    }

    db.prepare("UPDATE tasks SET sequence = ?, updated_at = datetime('now') WHERE id = ?").run(newSeq, task.id);
    res.json(db.prepare('SELECT * FROM tasks WHERE id = ?').get(task.id));
  } catch (err) { next(err); }
});

// GET /api/tasks/:id/dependencies
router.get('/:id/dependencies', authenticate, authorize('tasks', 'view'), (req, res, next) => {
  try {
    const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } });
    const deps = db.prepare(`
      SELECT t.id, t.title, t.status, t.percent_complete
      FROM task_dependencies td
      JOIN tasks t ON t.id = td.depends_on
      WHERE td.task_id = ?
      ORDER BY t.sequence ASC
    `).all(req.params.id);
    res.json(deps);
  } catch (err) { next(err); }
});

// PUT /api/tasks/:id/dependencies
router.put('/:id/dependencies', authenticate, authorize('tasks', 'edit'), (req, res, next) => {
  try {
    const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } });

    const { depends_on = [] } = req.body;
    const ids = depends_on.filter(id => Number.isInteger(id) && id !== parseInt(req.params.id));

    db.transaction(() => {
      db.prepare('DELETE FROM task_dependencies WHERE task_id = ?').run(req.params.id);
      const insert = db.prepare('INSERT OR IGNORE INTO task_dependencies (task_id, depends_on) VALUES (?, ?)');
      for (const depId of ids) insert.run(req.params.id, depId);
    })();

    res.json({ task_id: parseInt(req.params.id), depends_on: ids });
  } catch (err) { next(err); }
});

// GET /api/tasks/:id/resources
router.get('/:id/resources', authenticate, authorize('tasks', 'view'), (req, res, next) => {
  try {
    const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } });
    const resources = db.prepare(`
      SELECT tr.user_id, tr.estimated_hours, tr.actual_hours, u.username, u.email, u.hourly_rate
      FROM task_resources tr
      JOIN users u ON u.id = tr.user_id
      WHERE tr.task_id = ?
      ORDER BY u.username
    `).all(req.params.id);
    res.json(resources);
  } catch (err) { next(err); }
});

// PUT /api/tasks/:id/resources
router.put('/:id/resources', authenticate, authorize('tasks', 'edit'), (req, res, next) => {
  try {
    const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(req.params.id);
    if (!task) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } });

    const { resources = [] } = req.body;
    const valid = resources.filter(r => Number.isInteger(r.user_id));

    db.transaction(() => {
      db.prepare('DELETE FROM task_resources WHERE task_id = ?').run(req.params.id);
      const insert = db.prepare(
        'INSERT OR REPLACE INTO task_resources (task_id, user_id, estimated_hours, actual_hours) VALUES (?, ?, ?, ?)'
      );
      for (const r of valid) {
        insert.run(req.params.id, r.user_id,
          r.estimated_hours != null ? parseFloat(r.estimated_hours) : null,
          r.actual_hours    != null ? parseFloat(r.actual_hours)    : null
        );
      }
    })();

    const saved = db.prepare(`
      SELECT tr.user_id, tr.estimated_hours, tr.actual_hours, u.username, u.email, u.hourly_rate
      FROM task_resources tr
      JOIN users u ON u.id = tr.user_id
      WHERE tr.task_id = ?
      ORDER BY u.username
    `).all(req.params.id);
    res.json(saved);
  } catch (err) { next(err); }
});

// DELETE /api/tasks/:id
router.delete('/:id', authenticate, authorize('tasks', 'edit'), (req, res, next) => {
  try {
    const existing = db.prepare('SELECT id, created_by FROM tasks WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } });
    if (isPM(req) && existing.created_by !== req.user.id) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only delete your own tasks' } });
    }
    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    res.json({ message: 'Task deleted successfully' });
  } catch (err) { next(err); }
});

module.exports = router;
