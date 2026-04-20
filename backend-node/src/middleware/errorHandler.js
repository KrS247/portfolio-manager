function errorHandler(err, req, res, next) {
  console.error(err);

  // ── better-sqlite3 style error codes ──────────────────────────────────────
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    return res.status(409).json({ error: { code: 'CONFLICT', message: 'A record with that value already exists' } });
  }
  if (err.code && err.code.startsWith('SQLITE_CONSTRAINT')) {
    return res.status(400).json({ error: { code: 'CONSTRAINT_VIOLATION', message: err.message } });
  }

  // ── node:sqlite (built-in) style error codes ───────────────────────────────
  // node:sqlite throws errors with code 'ERR_SQLITE_ERROR'; the SQLite message
  // is in err.message (e.g. "UNIQUE constraint failed: users.username").
  if (err.code === 'ERR_SQLITE_ERROR') {
    const msg = err.message || '';
    if (msg.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ error: { code: 'CONFLICT', message: 'A record with that value already exists' } });
    }
    if (msg.includes('constraint failed') || msg.toLowerCase().includes('foreign key')) {
      return res.status(400).json({ error: { code: 'CONSTRAINT_VIOLATION', message: msg } });
    }
    return res.status(400).json({ error: { code: 'SQLITE_ERROR', message: msg } });
  }

  const status = err.status || 500;
  res.status(status).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: status === 500 ? 'An unexpected error occurred' : err.message,
    },
  });
}

module.exports = errorHandler;
