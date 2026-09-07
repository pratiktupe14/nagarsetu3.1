const bcrypt = require('bcryptjs');

async function seedDefaultUsers(query) {
  try {
    // Purge legacy demo account if present
    await query(`DELETE FROM users WHERE mobile = '9876543210' OR LOWER(email) = 'rahul@citizen.nagarsetu.gov.in'`).catch(() => {});

    const userSalt = await bcrypt.genSalt(10);
    const adminPass = process.env.DEMO_ADMIN_PASSWORD || 'NagarSetu@Admin2026!';
    const adminHash = await bcrypt.hash(adminPass, userSalt);
    const staffPass = 'nagarsetu@123';
    const staffHash = await bcrypt.hash(staffPass, userSalt);

    // 1. Ensure Municipal Admin exists idempotently
    const adminCheck = await query(`SELECT * FROM users WHERE email = 'admin@nagarsetu.gov.in'`);
    if (!adminCheck.rows || adminCheck.rows.length === 0) {
      await query(
        `INSERT INTO users (name, mobile, email, password_hash, role, status, language_pref) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['Municipal Admin', '9876543213', 'admin@nagarsetu.gov.in', adminHash, 'admin', 'active', 'en']
      );
      console.log('Municipal Admin user added.');
    } else {
      await query(
        `UPDATE users SET password_hash = ?, role = 'admin', status = 'active' WHERE email = 'admin@nagarsetu.gov.in'`,
        [adminHash]
      );
      console.log('Municipal Admin user updated idempotently.');
    }

    // 2. Ensure Staff demo account exists idempotently
    const staffCheck = await query(`SELECT * FROM users WHERE email = 'staff@nagarsetu.gov.in'`);
    if (!staffCheck.rows || staffCheck.rows.length === 0) {
      await query(
        `INSERT INTO users (name, mobile, email, password_hash, role, department_id, employee_id, status, language_pref) VALUES (?, ?, ?, ?, 'service_staff', 1, 'STF-001', 'active', 'en')`,
        ['Ramesh Kumar (Field Staff)', '9876543212', 'staff@nagarsetu.gov.in', staffHash]
      );
      console.log('Staff user added.');
    } else {
      await query(
        `UPDATE users SET password_hash = ?, role = 'service_staff', department_id = COALESCE(department_id, 1), status = 'active' WHERE email = 'staff@nagarsetu.gov.in'`,
        [staffHash]
      );
      console.log('Staff user updated idempotently.');
    }

    // 3. Ensure Officer demo account exists idempotently
    const officerHash = await bcrypt.hash('password123', userSalt);
    const officerCheck = await query(`SELECT * FROM users WHERE email = 'officer@nagarsetu.gov.in'`);
    if (!officerCheck.rows || officerCheck.rows.length === 0) {
      await query(
        `INSERT INTO users (name, mobile, email, password_hash, role, status, language_pref) VALUES (?, ?, ?, ?, 'officer', 'active', 'en')`,
        ['Inspector V. K. Patil (Officer)', '9876543211', 'officer@nagarsetu.gov.in', officerHash]
      );
    }

    // 4. Ensure Pratik Dilip Tupe Citizen account (mobile: 8788562103) exists idempotently with valid bcrypt password_hash
    const citizenPass = '8788562103';
    const citizenHash = await bcrypt.hash(citizenPass, userSalt);
    const citizenEmail = 'citizen8788@nagarsetu.gov.in';

    const citizenCheck = await query(`SELECT id FROM users WHERE mobile = '8788562103' OR LOWER(email) = ? OR name = 'Demo Citizen' OR name = 'Citizen User'`, [citizenEmail]);
    if (citizenCheck.rows && citizenCheck.rows.length > 0) {
      const existingId = citizenCheck.rows[0].id;
      await query(
        `UPDATE users SET name = ?, mobile = ?, email = ?, password_hash = ?, role = ?, status = ? WHERE id = ?`,
        ['Pratik Dilip Tupe', '8788562103', citizenEmail, citizenHash, 'citizen', 'active', existingId]
      );
      console.log(`Citizen demo account (8788562103) updated idempotently for DB User ID: ${existingId}`);
    } else {
      const insRes = await query(
        `INSERT INTO users (name, mobile, email, password_hash, role, status, language_pref) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        ['Pratik Dilip Tupe', '8788562103', citizenEmail, citizenHash, 'citizen', 'active', 'en']
      );
      const newId = insRes.rows[0].id;
      console.log(`Citizen demo account (8788562103) created with DB User ID: ${newId}`);
    }

    // 5. Ensure corresponding profile record exists in profiles table for UUID referential integrity
    try {
      const pCheck = await query(`SELECT id FROM profiles WHERE mobile = '8788562103' OR LOWER(email) = ? LIMIT 1`, [citizenEmail]);
      if (!pCheck.rows || pCheck.rows.length === 0) {
        const citizenProfileUuid = 'e2a4338c-5d49-4ae3-b766-40d99fb26f87';
        await query(
          `INSERT INTO profiles (id, full_name, mobile, email, role, language_pref, status) VALUES (?, ?, ?, ?, 'citizen', 'en', 'active')`,
          [citizenProfileUuid, 'Pratik Dilip Tupe', '8788562103', citizenEmail]
        );
        console.log('Citizen demo profile created in profiles table for Pratik Dilip Tupe:', citizenProfileUuid);
      }
    } catch (pErr) {
      console.warn('[SEED PROFILE WARN]:', pErr.message);
    }
  } catch (err) {
    console.error('Error seeding default users:', err);
  }
}

module.exports = seedDefaultUsers;
