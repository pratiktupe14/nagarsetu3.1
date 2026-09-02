require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { authRateLimiter, publicRateLimiter, authedRateLimiter, authenticatedRateLimiter, aiRateLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');

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

const { initDatabase, query, getIsSqlite } = require('./config/db');
let dbInitPromise = null;
app.use(async (req, res, next) => {
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
    console.error('[DB INIT FATAL ERROR]:', err.message);
    return res.status(500).json({
      error: 'Database Connection Error',
      message: err.message
    });
  }
});

// Security Headers & Core Middleware
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://nagarsetu3-1-87or2o4na-pratik-dilip-tupes-projects.vercel.app',
  'https://nagarsetu3-1.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:5000',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
  'http://127.0.0.1:5000'
].filter(Boolean);

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin) || origin.endsWith('.vercel.app') || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(null, true);
    }
  },
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static uploads safely (Prevent execution as script/code)
app.use('/uploads', (req, res, next) => {
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
    timestamp: new Date().toISOString()
  });
});

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'NAGARSETU API Root',
    health: '/api/health',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', publicRateLimiter, async (req, res) => {
  try {
    const isSqlite = getIsSqlite();
    const testSql = isSqlite ? "SELECT datetime('now') as db_time" : "SELECT NOW() as db_time";
    const dbRes = await query(testSql);
    res.json({
      success: true,
      message: 'NAGARSETU Backend is running',
      status: 'ok',
      service: 'NAGARSETU Express Backend API',
      database: 'connected',
      database_type: isSqlite ? 'sqlite' : 'postgres',
      db_time: dbRes.rows[0]?.db_time || new Date().toISOString(),
      version: '1.0.0',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(503).json({
      success: false,
      message: 'Database connection check failed',
      status: 'database_error',
      error: err.message,
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
