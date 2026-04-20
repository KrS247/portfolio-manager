// Uses Node.js built-in sqlite module (available in Node v22.5+, stable in v24)
// No native compilation required — no external dependency needed
const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const config = require('../config');

const dbPath = path.resolve(config.dbPath);
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);

// Pragmas (node:sqlite uses exec() for pragmas, not .pragma())
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// Add transaction() helper to mirror better-sqlite3's API
// Usage: const txn = db.transaction(fn); txn(...args);
db.transaction = (fn) => {
  return (...args) => {
    db.exec('BEGIN');
    try {
      const result = fn(...args);
      db.exec('COMMIT');
      return result;
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };
};

module.exports = db;
