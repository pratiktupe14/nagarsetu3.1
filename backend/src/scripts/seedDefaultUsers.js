const bcrypt = require('bcryptjs');

async function seedDefaultUsers(query) {
  try {
    // Purge Rahul Sharma (Citizen) demo account if present
    await query(`DELETE FROM users WHERE mobile = '9876543210' OR LOWER(email) = 'rahul@citizen.nagarsetu.gov.in'`).catch(() => {});

    const resCount = await query(`SELECT COUNT(*) as count FROM users`);
    if (resCount.rows && resCount.rows[0].count === 0) {
      console.log('Seeding default demo users (Citizen, Officer, Staff, Admin)...');
      const salt = await bcrypt.genSalt(10);
      const userPass = process.env.DEMO_USER_PASSWORD || 'password123';
      const adminPass = process.env.DEMO_ADMIN_PASSWORD || 'NagarSetu@Admin2026!';
      const defaultHash = await bcrypt.hash(userPass, salt);
      const adminHash = await bcrypt.hash(adminPass, salt);

      const usersToSeed = [
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

    // Ensure Pratik Dilip Tupe Citizen account (mobile: 8788562103) exists idempotently with valid bcrypt password_hash
    const citizenPass = '8788562103';
    const citizenSalt = await bcrypt.genSalt(10);
    const citizenHash = await bcrypt.hash(citizenPass, citizenSalt);
    const citizenEmail = 'citizen8788@nagarsetu.gov.in';

    const citizenCheck = await query(`SELECT id FROM users WHERE mobile = '8788562103' OR LOWER(email) = ? OR name = 'Demo Citizen' OR name = 'Citizen User'`, [citizenEmail]);
    if (citizenCheck.rows && citizenCheck.rows.length > 0) {
      const existingId = citizenCheck.rows[0].id;
      await query(
        `UPDATE users SET name = 'Pratik Dilip Tupe', mobile = '8788562103', email = ?, password_hash = ?, role = 'citizen', status = 'active' WHERE id = ?`,
        [citizenEmail, citizenHash, existingId]
      );
      console.log(`Citizen demo account (8788562103) updated idempotently for DB User ID: ${existingId}`);
    } else {
      const insRes = await query(
        `INSERT INTO users (name, mobile, email, password_hash, role, status, language_pref) VALUES (?, ?, ?, ?, 'citizen', 'active', 'en')`,
        ['Pratik Dilip Tupe', '8788562103', citizenEmail, citizenHash]
      );
      const newId = insRes.rows[0].id;
      console.log(`Citizen demo account (8788562103) created with DB User ID: ${newId}`);
    }
  } catch (err) {
    console.error('Error seeding default users:', err);
  }
}

module.exports = seedDefaultUsers;
