/**
 * Mailer utility.
 * When SMTP_HOST is configured in .env, emails are sent via nodemailer.
 * In development (no SMTP_HOST), reset links are printed to the console instead.
 */
const nodemailer = require('nodemailer');
const config = require('../config');

let _transporter = null;

function getTransporter() {
  if (!config.smtpHost) return null;
  if (!_transporter) {
    _transporter = nodemailer.createTransport({
      host:   config.smtpHost,
      port:   config.smtpPort,
      secure: config.smtpSecure,
      auth:   config.smtpUser
        ? { user: config.smtpUser, pass: config.smtpPass }
        : undefined,
    });
  }
  return _transporter;
}

/**
 * Send a password-reset email.
 * Falls back to console output when SMTP is not configured.
 */
async function sendPasswordReset(toEmail, resetUrl) {
  const transport = getTransporter();

  if (!transport) {
    // Dev fallback — print link to server console so the user can test without SMTP
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[Email] Password reset requested');
    console.log(`[Email] To:  ${toEmail}`);
    console.log(`[Email] URL: ${resetUrl}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    return;
  }

  await transport.sendMail({
    from:    config.smtpFrom,
    to:      toEmail,
    subject: 'Password Reset — Portfolio Manager',
    html: `
      <p>Hi,</p>
      <p>Someone requested a password reset for your Portfolio Manager account.</p>
      <p>
        <a href="${resetUrl}" style="
          display:inline-block;padding:10px 20px;background:#4f46e5;
          color:#fff;border-radius:6px;text-decoration:none;font-weight:bold
        ">Reset My Password</a>
      </p>
      <p>This link expires in <strong>1 hour</strong>.</p>
      <p>If you did not request this, you can safely ignore this email.</p>
      <hr/>
      <p style="font-size:0.85em;color:#6b7280">
        Or copy this URL into your browser:<br/>${resetUrl}
      </p>
    `,
  });
}

module.exports = { sendPasswordReset };
