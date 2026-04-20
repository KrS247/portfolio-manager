require('dotenv').config();

const required = ['JWT_SECRET'];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`FATAL: Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3001,
  dbPath: process.env.DB_PATH || './data/portfolio.db',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  adminInitialPassword: process.env.ADMIN_INITIAL_PASSWORD || 'Admin@1234',
  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
  appUrl: process.env.APP_URL || 'http://localhost:5173',
  nodeEnv: process.env.NODE_ENV || 'development',
  // SMTP — all optional; if absent, reset links are logged to the console instead
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parseInt(process.env.SMTP_PORT, 10) || 587,
  smtpSecure: process.env.SMTP_SECURE === 'true',
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpFrom: process.env.SMTP_FROM || 'Portfolio Manager <noreply@portfolio-manager.local>',
  clickupMcpToken: process.env.CLICKUP_MCP_TOKEN || '',
};
