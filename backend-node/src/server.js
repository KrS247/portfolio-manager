const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const config = require('./config');
const migrate = require('./db/migrate');
const seed = require('./db/seed');
const errorHandler = require('./middleware/errorHandler');

async function startServer() {
  // 1. Run DB migration (schema) then seed
  migrate();
  await seed();

  const app = express();

  // 2. Security headers
  app.use(helmet());

  // 3. CORS
  const corsOptions = {
    origin: config.nodeEnv === 'production' ? config.frontendOrigin : true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  };
  app.use(cors(corsOptions));

  // 4. Body parsing
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // 5. API routes
  app.use('/api', require('./routes'));

  // 6. Health check
  app.get('/health', (req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }));

  // 7. 404 handler
  app.use((req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
  });

  // 8. Error handler
  app.use(errorHandler);

  app.listen(config.port, () => {
    console.log(`[Server] Portfolio Manager API running on http://localhost:${config.port}`);
    console.log(`[Server] Environment: ${config.nodeEnv}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
