require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoose = require('mongoose');
const morgan = require('morgan');
const fs = require('fs');
const path = require('path');
const { validateConfig, config } = require('./config/config');
const errorHandler = require('./utils/errorHandler');
const logger = require('./utils/logger');
const { globalLimiter, authLimiter, aiLimiter } = require('./middleware/rateLimiter');
const apiRoutes = require('./routes/index');

// Validate configuration on startup
validateConfig();

// Ensure logs directory exists
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const app = express();
const PORT = config.port;

// ─── Security & Parsing ───────────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: config.cors.origin }));
app.use(express.json({ limit: '10kb' }));

// ─── HTTP Request Logging (Morgan → Winston) ──────────────────────
const morganFormat = ':method :url :status :response-time ms - :res[content-length]';
app.use(morgan(morganFormat, {
  stream: { write: (msg) => logger.info(msg.trim(), { type: 'http' }) },
  skip: (req) => req.url === '/api/health', // don't log health checks
}));

// ─── Rate Limits ──────────────────────────────────────────────────
app.use(globalLimiter);                    // 100 req/min global
app.use('/api/v1/auth', authLimiter);      // 5 req/min  — brute-force guard
app.use('/api/v1/ai', aiLimiter);          // 10 req/min — AI cost control

// ─── Health Check ─────────────────────────────────────────────────
app.get('/api/health', (req, res) =>
  res.status(200).json({
    success: true,
    data: { status: 'UP', service: 'MediAI Backend', timestamp: new Date().toISOString() },
  })
);

// ─── API Routes ───────────────────────────────────────────────────
app.use('/api/v1', apiRoutes);

// ─── 404 Handler ──────────────────────────────────────────────────
app.use((req, res) =>
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found`, code: 'NOT_FOUND' })
);

// ─── Global Error Handler ─────────────────────────────────────────
app.use(errorHandler);

// ─── Unhandled Promise Rejections ─────────────────────────────────
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection — shutting down', { message: err.message, stack: err.stack });
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception — shutting down', { message: err.message, stack: err.stack });
  process.exit(1);
});

// ─── Database + Server ────────────────────────────────────────────
mongoose.connect(config.mongodb.uri)
  .then(() => {
    logger.info('✅ MongoDB Connected');
    app.listen(PORT, () => {
      logger.info(`🚀 Backend running on port ${PORT} | env: ${config.env}`);
    });
  })
  .catch(err => {
    logger.error('❌ MongoDB Connection Error', { message: err.message });
    process.exit(1);
  });
