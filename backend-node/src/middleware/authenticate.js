const jwt = require('jsonwebtoken');
const db = require('../db/database');
const config = require('../config');

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: { code: 'NO_TOKEN', message: 'Authentication required' } });
  }

  const token = authHeader.slice(7);
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch (err) {
    const code = err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID';
    return res.status(401).json({ error: { code, message: 'Invalid or expired token' } });
  }

  const user = db.prepare(`
    SELECT u.id, u.username, u.email, u.role_id, r.name AS role_name, r.is_admin
    FROM users u
    JOIN roles r ON r.id = u.role_id
    WHERE u.id = ?
  `).get(payload.sub);

  if (!user) {
    return res.status(401).json({ error: { code: 'USER_NOT_FOUND', message: 'User no longer exists' } });
  }

  req.user = user;
  next();
}

module.exports = authenticate;
