require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { authRateLimiter, publicRateLimiter, authenticatedRateLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');

const authRoutes = require('./routes/auth.routes');
const complaintRoutes = require('./routes/complaint.routes');
const officerRoutes = require('./routes/officer.routes');
const staffRoutes = require('./routes/staff.routes');
const adminRoutes = require('./routes/admin.routes');
const departmentRoutes = require('./routes/department.routes');
const notificationRoutes = require('./routes/notification.routes');
const mapsRoutes = require('./routes/maps.routes');
const aiRoutes = require('./routes/ai.routes');

const app = express();

// Security Headers & Core Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static uploads safely (Prevent execution as code)
app.use('/uploads', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'");
  res.setHeader('Content-Disposition', 'inline');
  next();
}, express.static(path.join(__dirname, '../uploads')));

// Public Health Check Endpoint with Moderate Public Rate Limiting
app.get('/api/health', publicRateLimiter, (req, res) => {
  res.json({ status: 'ok', service: 'NAGARSETU Express Backend API', version: '1.0.0' });
});

// Register API Routes with Appropriate Rate Limiters
app.use('/api/auth', authRateLimiter, authRoutes);
app.use('/api/maps', publicRateLimiter, mapsRoutes);
app.use('/api/ai', publicRateLimiter, aiRoutes);

app.use('/api/complaints', authenticatedRateLimiter, complaintRoutes);
app.use('/api/officer', authenticatedRateLimiter, officerRoutes);
app.use('/api/staff', authenticatedRateLimiter, staffRoutes);
app.use('/api/admin', authenticatedRateLimiter, adminRoutes);
app.use('/api/departments', authenticatedRateLimiter, departmentRoutes);
app.use('/api/notifications', authenticatedRateLimiter, notificationRoutes);

// Centralized Error Handling Middleware (Prevents stack trace / information leakage)
app.use(errorHandler);

module.exports = app;
