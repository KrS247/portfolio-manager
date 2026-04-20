const express = require('express');
const db = require('../db/database');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

function computeRisk(probability, impact) {
  const rate = probability * impact;
  let status;
  if      (rate <= 5)  status = 'Low Risk';
  else if (rate <= 10) status = 'Medium Risk';
  else if (rate <= 15) status = 'High Risk';
  else                 status = 'Critical Risk';
  return { risk_rate: rate, risk_status: status };
}

function clamp(val, min, max) {
  return Math.min(max, Math.max(min, parseInt(val) || min));
}

// ── GET /api/risks?task_id=N ─────────────────────────────────────────────────
// Returns the risk record for a given task (or null if none).
router.get('/', authenticate, authorize('tasks', 'view'), (req, res, next) => {
  try {
    const { task_id } = req.query;
    if (!task_id) {
      return res.status(400).json({ error: { code: 'MISSING_PARAM', message: 'task_id is required' } });
    }
    const risk = db.prepare('SELECT * FROM risks WHERE task_id = ?').get(parseInt(task_id));
    res.json(risk || null);
  } catch (err) { next(err); }
});

// ── POST /api/risks ───────────────────────────────────────────────────────────
router.post('/', authenticate, authorize('tasks', 'edit'), (req, res, next) => {
  try {
    const { task_id, name, description, probability, impact, mitigation_plan } = req.body;
    if (!task_id || !name) {
      return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'task_id and name are required' } });
    }

    // Verify task exists
    const task = db.prepare('SELECT id FROM tasks WHERE id = ?').get(parseInt(task_id));
    if (!task) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Task not found' } });
    }

    const prob = clamp(probability, 1, 5);
    const imp  = clamp(impact,      1, 5);
    const { risk_rate, risk_status } = computeRisk(prob, imp);

    const result = db.prepare(`
      INSERT INTO risks (task_id, name, description, probability, impact, risk_rate, risk_status, mitigation_plan)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      parseInt(task_id), name.trim(),
      description || null,
      prob, imp, risk_rate, risk_status,
      mitigation_plan || null
    );

    res.status(201).json(db.prepare('SELECT * FROM risks WHERE id = ?').get(result.lastInsertRowid));
  } catch (err) { next(err); }
});

// ── PUT /api/risks/:id ────────────────────────────────────────────────────────
router.put('/:id', authenticate, authorize('tasks', 'edit'), (req, res, next) => {
  try {
    const existing = db.prepare('SELECT id FROM risks WHERE id = ?').get(req.params.id);
    if (!existing) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Risk not found' } });

    const { name, description, probability, impact, mitigation_plan } = req.body;
    const prob = clamp(probability, 1, 5);
    const imp  = clamp(impact,      1, 5);
    const { risk_rate, risk_status } = computeRisk(prob, imp);

    db.prepare(`
      UPDATE risks
      SET name = COALESCE(?, name),
          description     = ?,
          probability     = ?,
          impact          = ?,
          risk_rate       = ?,
          risk_status     = ?,
          mitigation_plan = ?,
          updated_at      = datetime('now')
      WHERE id = ?
    `).run(
      name ? name.trim() : null,
      description || null,
      prob, imp, risk_rate, risk_status,
      mitigation_plan || null,
      req.params.id
    );

    res.json(db.prepare('SELECT * FROM risks WHERE id = ?').get(req.params.id));
  } catch (err) { next(err); }
});

// ── DELETE /api/risks/:id ─────────────────────────────────────────────────────
router.delete('/:id', authenticate, authorize('tasks', 'edit'), (req, res, next) => {
  try {
    db.prepare('DELETE FROM risks WHERE id = ?').run(req.params.id);
    res.json({ message: 'Risk deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
