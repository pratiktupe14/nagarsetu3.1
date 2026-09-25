require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const requestCorrelation = require('./middleware/requestCorrelation');
const { authRateLimiter, publicRateLimiter, authedRateLimiter, authenticatedRateLimiter, aiRateLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

const authRoutes = require('./routes/auth.routes');
const complaintRoutes = require('./routes/complaint.routes');
const officerRoutes = require('./routes/officer.routes');
const staffRoutes = require('./routes/staff.routes');
const adminRoutes = require('./routes/admin.routes');
const departmentRoutes = require('./routes/department.routes');
const notificationRoutes = require('./routes/notification.routes');
const announcementRoutes = require('./routes/announcement.routes');
const mapsRoutes = require('./routes/maps.routes');
const aiRoutes = require('./routes/ai.routes');

const app = express();
app.set('trust proxy', 1);

// Attach Request Correlation ID & Performance Timing Middleware
app.use(requestCorrelation);

// Security Headers & Core Middleware — CORS MUST BE FIRST
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://nagarsetu3-1.vercel.app',
  'https://nagarsetu3-1-87or2o4na-pratik-dilip-tupes-projects.vercel.app',
  'https://nagarsetu-backend-api.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:5000'
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    if (process.env.NODE_ENV !== 'production' && (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1'))) {
      return callback(null, true);
    }
    callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Cache-Control', 'Pragma', 'Expires', 'X-Request-ID']
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Database initialization middleware (skip for OPTIONS preflight)
const { initDatabase, query, getIsSqlite } = require('./config/db');
let dbInitPromise = null;
app.use(async (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }
  try {
    if (!dbInitPromise && typeof initDatabase === 'function') {
      dbInitPromise = initDatabase();
    }
    if (dbInitPromise) {
      await dbInitPromise;
    }
    next();
  } catch (err) {
    dbInitPromise = null;
    logger.error('DATABASE_INIT_FATAL_ERROR', { requestId: req.requestId, message: err.message });
    return res.status(500).json({
      error: 'Database Connection Error',
      message: err.message,
      requestId: req.requestId
    });
  }
});

// Serve static uploads safely (Prevent execution as script/code)
app.use('/uploads', (req, res, next) => {
  let reqPath = '';
  try {
    reqPath = decodeURIComponent(req.path || '').toLowerCase();
  } catch (e) {
    return res.status(400).json({ error: 'Security Violation: Malformed URL path.' });
  }

  // Block path traversal attempts
  if (reqPath.includes('..') || reqPath.includes('\0')) {
    return res.status(400).json({ error: 'Security Violation: Path traversal rejected.' });
  }

  // Restrict serving to valid image formats only
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const hasAllowedExt = allowedExtensions.some(ext => reqPath.endsWith(ext));

  if (!hasAllowedExt) {
    return res.status(403).json({ error: 'Security Violation: Direct access restricted to valid image assets.' });
  }

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'");
  res.setHeader('Content-Disposition', 'inline');
  next();
}, express.static(path.join(__dirname, '../uploads')));

// Root Welcome & Health Check Endpoints
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'NAGARSETU Express Backend API is live on Vercel',
    health: '/api/health',
    version: '1.0.0',
    requestId: req.requestId,
    timestamp: new Date().toISOString()
  });
});

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'NAGARSETU API Root',
    health: '/api/health',
    version: '1.0.0',
    requestId: req.requestId,
    timestamp: new Date().toISOString()
  });
});

// Liveness & Basic System Health Endpoint
app.get('/api/health', publicRateLimiter, async (req, res) => {
  try {
    const isSqlite = getIsSqlite();
    const testSql = isSqlite ? "SELECT datetime('now') as db_time" : "SELECT NOW() as db_time";
    const dbRes = await query(testSql);
    const metrics = logger.getMetrics();

    res.json({
      success: true,
      message: 'NAGARSETU Backend is running',
      status: 'ok',
      service: 'NAGARSETU Express Backend API',
      database: 'connected',
      database_type: isSqlite ? 'sqlite' : 'postgres',
      db_time: dbRes.rows[0]?.db_time || new Date().toISOString(),
      version: '1.0.0',
      requestId: req.requestId,
      uptimeSeconds: metrics.uptimeSeconds,
      metrics: {
        totalRequests: metrics.totalRequests,
        clientErrors: metrics.clientErrors,
        serverErrors: metrics.serverErrors,
        slowRequests: metrics.slowRequests
      },
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logger.recordDatabaseError();
    res.status(503).json({
      success: false,
      message: 'Database connection check failed',
      status: 'database_error',
      error: err.message,
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// Production Readiness Check Endpoint (Verifies Core Infrastructure Dependencies)
app.get('/api/health/ready', publicRateLimiter, async (req, res) => {
  try {
    const isSqlite = getIsSqlite();
    const testSql = isSqlite ? "SELECT 1 as ready" : "SELECT 1 as ready";
    const dbRes = await query(testSql);

    if (dbRes && dbRes.rows && dbRes.rows.length > 0) {
      return res.status(200).json({
        success: true,
        status: 'ready',
        database: 'connected',
        requestId: req.requestId,
        timestamp: new Date().toISOString()
      });
    }
    throw new Error('Database ping query returned empty result.');
  } catch (err) {
    logger.recordDatabaseError();
    logger.error('READINESS_CHECK_FAILED', { requestId: req.requestId, message: err.message });
    return res.status(503).json({
      success: false,
      status: 'not_ready',
      database: 'disconnected',
      error: 'Core database dependency unavailable',
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    });
  }
});

// Register API Routes with Appropriate Rate Limiters
app.use('/api/auth', authRateLimiter, authRoutes);
app.use('/api/maps', publicRateLimiter, mapsRoutes);
app.use('/api/ai', aiRateLimiter || publicRateLimiter, aiRoutes);

app.use('/api/complaints', authedRateLimiter || authenticatedRateLimiter, complaintRoutes);
app.use('/api/officer', authedRateLimiter || authenticatedRateLimiter, officerRoutes);
app.use('/api/staff', authedRateLimiter || authenticatedRateLimiter, staffRoutes);
app.use('/api/admin', authedRateLimiter || authenticatedRateLimiter, adminRoutes);
app.use('/api/departments', authedRateLimiter || authenticatedRateLimiter, departmentRoutes);
app.use('/api/department', authedRateLimiter || authenticatedRateLimiter, departmentRoutes);
app.use('/api/notifications', authedRateLimiter || authenticatedRateLimiter, notificationRoutes);
app.use('/api/announcements', authedRateLimiter || authenticatedRateLimiter, announcementRoutes);

// Centralized Error Handling Middleware (Prevents stack trace / information leakage)
app.use(errorHandler);

module.exports = app;
