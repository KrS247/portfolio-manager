const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const config = require('../config');
const { sendPasswordReset } = require('../utils/mailer');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'Username and password are required' } });
    }

    const user = db.prepare(`
      SELECT u.id, u.username, u.email, u.password_hash, u.role_id, r.name AS role_name, r.is_admin
      FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.username = ?
    `).get(username);

    if (!user) {
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' } });
    }

    bcrypt.compare(password, user.password_hash, (err, match) => {
      if (err) return next(err);
      if (!match) {
        return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password' } });
      }

      const token = jwt.sign(
        { sub: user.id, username: user.username, role_id: user.role_id, is_admin: user.is_admin },
        config.jwtSecret,
        { expiresIn: config.jwtExpiresIn }
      );

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role_id: user.role_id,
          role_name: user.role_name,
          is_admin: user.is_admin,
        },
      });
    });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/register
router.post('/register', async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    if (!username || !email || !password) {
      return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'Username, email, and password are required' } });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters' } });
    }

    const memberRole = db.prepare("SELECT id FROM roles WHERE name = 'member'").get();
    if (!memberRole) {
      return res.status(500).json({ error: { code: 'SETUP_ERROR', message: 'Default role not found' } });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = db.prepare(
      'INSERT INTO users (username, email, password_hash, role_id) VALUES (?, ?, ?, ?)'
    ).run(username, email, passwordHash, memberRole.id);

    res.status(201).json({ message: 'User registered successfully', userId: result.lastInsertRowid });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/forgot-password
// Always returns a generic message to prevent email enumeration.
router.post('/forgot-password', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'Email is required' } });
    }

    const GENERIC = { message: 'If that email address is registered, a reset link has been sent.' };

    const user = db.prepare('SELECT id, email FROM users WHERE email = ?').get(email);
    if (!user) return res.json(GENERIC);

    // Invalidate any existing tokens before issuing a new one
    db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(user.id);

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    db.prepare(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)'
    ).run(user.id, token, expiresAt);

    const resetUrl = `${config.appUrl}/reset-password?token=${token}`;
    await sendPasswordReset(user.email, resetUrl);

    res.json(GENERIC);
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res, next) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'Token and new password are required' } });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 8 characters' } });
    }

    const record = db.prepare('SELECT * FROM password_reset_tokens WHERE token = ?').get(token);
    if (!record) {
      return res.status(400).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or already-used reset link' } });
    }

    if (new Date(record.expires_at) < new Date()) {
      db.prepare('DELETE FROM password_reset_tokens WHERE id = ?').run(record.id);
      return res.status(400).json({ error: { code: 'EXPIRED_TOKEN', message: 'This reset link has expired. Please request a new one.' } });
    }

    const hash = await bcrypt.hash(password, 12);
    db.prepare("UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?")
      .run(hash, record.user_id);
    db.prepare('DELETE FROM password_reset_tokens WHERE id = ?').run(record.id);

    res.json({ message: 'Password updated successfully. You can now sign in.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
