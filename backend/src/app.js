require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { authRateLimiter, publicRateLimiter, authedRateLimiter } = require('./middleware/rateLimiter');
const errorHandler = require('./middleware/errorHandler');

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

// Base Middlewares
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Secure static uploads serving - prevent direct script execution
app.use('/uploads', (req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self' data:;");
  next();
}, express.static(path.join(__dirname, '../uploads')));

// Health Check (Public Rate Limited)
app.get('/api/health', publicRateLimiter, (req, res) => {
  res.json({ status: 'ok', service: 'NAGARSETU Express Backend API', version: '1.0.0' });
});

// Tiered API Routes & Rate Limiters
app.use('/api/auth', authRateLimiter, authRoutes);

app.use('/api/maps', publicRateLimiter, mapsRoutes);

app.use('/api/complaints', authedRateLimiter, complaintRoutes);
app.use('/api/officer', authedRateLimiter, officerRoutes);
app.use('/api/staff', authedRateLimiter, staffRoutes);
app.use('/api/admin', authedRateLimiter, adminRoutes);
app.use('/api/departments', authedRateLimiter, departmentRoutes);
app.use('/api/notifications', authedRateLimiter, notificationRoutes);
app.use('/api/ai', authedRateLimiter, aiRoutes);

// Centralized Error Handler (Must be registered after all routes)
app.use(errorHandler);

module.exports = app;
