const fs = require('fs');
const path = require('path');
const db = require('./database');

// Safely adds a column to a table if it doesn't already exist.
// SQLite doesn't support ADD COLUMN IF NOT EXISTS, so we check PRAGMA first.
function addColumnIfMissing(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  const exists = cols.some(c => c.name === column);
  if (!exists) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    console.log(`[DB] Added column: ${table}.${column}`);
  }
}

function migrate() {
  // 1. Run base schema (CREATE TABLE IF NOT EXISTS — safe to re-run)
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  db.exec(schema);

  // 2. Incremental column additions for existing databases
  addColumnIfMissing('portfolios', 'priority',   'INTEGER NOT NULL DEFAULT 5');
  addColumnIfMissing('portfolios', 'start_date', 'TEXT');
  addColumnIfMissing('portfolios', 'end_date',   'TEXT');

  addColumnIfMissing('programs',   'priority',   'INTEGER NOT NULL DEFAULT 5');
  addColumnIfMissing('programs',   'start_date', 'TEXT');
  addColumnIfMissing('programs',   'end_date',   'TEXT');

  addColumnIfMissing('projects',   'priority',   'INTEGER NOT NULL DEFAULT 5');
  addColumnIfMissing('projects',   'start_date', 'TEXT');
  addColumnIfMissing('projects',   'end_date',   'TEXT');
  addColumnIfMissing('projects',   'clickup_id', 'TEXT');

  addColumnIfMissing('tasks',      'start_date',        'TEXT');
  addColumnIfMissing('tasks',      'percent_complete',  'INTEGER NOT NULL DEFAULT 0');
  addColumnIfMissing('tasks',      'is_milestone',      'INTEGER NOT NULL DEFAULT 0');

  // users.updated_at — referenced by the PUT /api/users/:id route.
  // Must use plain TEXT (nullable, no default expression) because SQLite's
  // ALTER TABLE ADD COLUMN only accepts literal constant defaults, not (datetime('now')).
  addColumnIfMissing('users', 'updated_at',   'TEXT');
  addColumnIfMissing('users', 'hourly_rate',  'REAL');

  // task_resources hours fields (replaces allocation_pct design)
  addColumnIfMissing('task_resources', 'estimated_hours', 'REAL');
  addColumnIfMissing('task_resources', 'actual_hours',    'REAL');

  // 3. Upsert any new pages added after initial seed
  upsertPage('Admin: Dashboard', 'admin.dashboard', 'Dashboard schedule order');
  upsertPage('Admin: Teams',     'admin.teams',     'Team administration');

  console.log('[DB] Migration complete');
}

// Idempotent: inserts a page + default permissions if the slug doesn't exist yet
function upsertPage(name, slug, description) {
  const existing = db.prepare('SELECT id FROM pages WHERE slug = ?').get(slug);
  if (existing) return;

  const result = db.prepare(
    'INSERT INTO pages (name, slug, description) VALUES (?, ?, ?)'
  ).run(name, slug, description);
  const pageId = result.lastInsertRowid;

  // Grant edit to admin roles, none to everyone else for admin.* pages
  const roles = db.prepare('SELECT id, name, is_admin FROM roles').all();
  for (const role of roles) {
    const level = role.is_admin ? 'edit' : (slug.startsWith('admin.') ? 'none' : 'view');
    db.prepare(
      'INSERT OR IGNORE INTO page_permissions (role_id, page_id, access_level) VALUES (?, ?, ?)'
    ).run(role.id, pageId, level);
  }
  console.log(`[DB] Added page: ${slug}`);
}

module.exports = migrate;
