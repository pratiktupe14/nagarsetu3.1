require('dotenv').config();
const bcrypt = require('bcryptjs');
const { initDatabase, query } = require('./config/db');
const app = require('./app');

const PORT = process.env.PORT || 5000;

// Initial Seed Users for fast demo testing
async function seedDefaultUsers() {
  try {
    const resCount = await query(`SELECT COUNT(*) as count FROM users`);
    if (resCount.rows && resCount.rows[0].count === 0) {
      console.log('Seeding default demo users (Citizen, Officer, Staff, Admin)...');
      const salt = await bcrypt.genSalt(10);
      const userPass = process.env.DEMO_USER_PASSWORD || 'password123';
      const adminPass = process.env.DEMO_ADMIN_PASSWORD || 'NagarSetu@Admin2026!';
      const defaultHash = await bcrypt.hash(userPass, salt);
      const adminHash = await bcrypt.hash(adminPass, salt);

      const usersToSeed = [
        { name: 'Rahul Sharma (Citizen)', mobile: '9876543210', email: 'rahul@citizen.nagarsetu.gov.in', role: 'citizen', lang: 'en', passHash: defaultHash },
        { name: 'Inspector V. K. Patil (Officer)', mobile: '9876543211', email: 'officer@nagarsetu.gov.in', role: 'officer', lang: 'en', passHash: defaultHash },
        { name: 'Ramesh Kumar (Field Staff)', mobile: '9876543212', email: 'staff@nagarsetu.gov.in', role: 'staff', lang: 'en', passHash: defaultHash },
        { name: 'Municipal Admin', mobile: '9876543213', email: 'admin@nagarsetu.gov.in', role: 'admin', lang: 'en', passHash: adminHash }
      ];

      for (const u of usersToSeed) {
        await query(
          `INSERT INTO users (name, mobile, email, password_hash, role, language_pref) VALUES (?, ?, ?, ?, ?, ?)`,
          [u.name, u.mobile, u.email, u.passHash, u.role, u.lang]
        );
      }
      console.log('Default demo users seeded successfully.');
    } else {
      // Ensure Municipal Admin exists even if DB already has other users
      const adminCheck = await query(`SELECT * FROM users WHERE email = 'admin@nagarsetu.gov.in'`);
      if (!adminCheck.rows || adminCheck.rows.length === 0) {
        const salt = await bcrypt.genSalt(10);
        const adminPass = process.env.DEMO_ADMIN_PASSWORD || 'NagarSetu@Admin2026!';
        const adminHash = await bcrypt.hash(adminPass, salt);
        await query(
          `INSERT INTO users (name, mobile, email, password_hash, role, language_pref) VALUES (?, ?, ?, ?, ?, ?)`,
          ['Municipal Admin', '9876543213', 'admin@nagarsetu.gov.in', adminHash, 'admin', 'en']
        );
        console.log('Municipal Admin user added.');
      }
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
