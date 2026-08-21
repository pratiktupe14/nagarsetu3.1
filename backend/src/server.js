require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcryptjs');
const { initDatabase, query } = require('./config/db');

const authRoutes = require('./routes/auth.routes');
const complaintRoutes = require('./routes/complaint.routes');
const officerRoutes = require('./routes/officer.routes');
const staffRoutes = require('./routes/staff.routes');
const adminRoutes = require('./routes/admin.routes');
const departmentRoutes = require('./routes/department.routes');
const notificationRoutes = require('./routes/notification.routes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Register API Routes
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/officer', officerRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'NAGARSETU Express Backend API', version: '1.0.0' });
});

// Initial Seed Users for fast demo testing
async function seedDefaultUsers() {
  try {
    const resCount = await query(`SELECT COUNT(*) as count FROM users`);
    if (resCount.rows && resCount.rows[0].count === 0) {
      console.log('Seeding default demo users (Citizen, Officer, Staff, Admin)...');
      const salt = await bcrypt.genSalt(10);
      const password_hash = await bcrypt.hash('password123', salt);

      const usersToSeed = [
        { name: 'Rahul Sharma (Citizen)', mobile: '9876543210', email: 'rahul@citizen.nagarsetu.gov.in', role: 'citizen', lang: 'en' },
        { name: 'Inspector V. K. Patil (Officer)', mobile: '9876543211', email: 'officer@nagarsetu.gov.in', role: 'officer', lang: 'en' },
        { name: 'Ramesh Kumar (Field Staff)', mobile: '9876543212', email: 'staff@nagarsetu.gov.in', role: 'staff', lang: 'en' },
        { name: 'Municipal Admin', mobile: '9876543213', email: 'admin@nagarsetu.gov.in', role: 'admin', lang: 'en' }
      ];

      for (const u of usersToSeed) {
        await query(
          `INSERT INTO users (name, mobile, email, password_hash, role, language_pref) VALUES (?, ?, ?, ?, ?, ?)`,
          [u.name, u.mobile, u.email, password_hash, u.role, u.lang]
        );
      }
      console.log('Default demo users seeded successfully.');
    }
  } catch (err) {
    console.error('Error seeding default users:', err);
  }
}

// Start Server after DB Init
initDatabase()
  .then(async () => {
    await seedDefaultUsers();
    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`  NAGARSETU Backend API running on http://localhost:${PORT}`);
      console.log(`=======================================================`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
  });
