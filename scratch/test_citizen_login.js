const path = require('path');
const bcrypt = require(path.join(__dirname, '../backend/node_modules/bcryptjs'));
const { query, initDatabase } = require(path.join(__dirname, '../backend/src/config/db'));

async function testSeedAndAuth() {
  await initDatabase();

  const citizenPass = '8788562103';
  const citizenSalt = await bcrypt.genSalt(10);
  const citizenHash = await bcrypt.hash(citizenPass, citizenSalt);
  const citizenEmail = 'citizen8788@nagarsetu.gov.in';

  const citizenCheck = await query(`SELECT id FROM users WHERE mobile = '8788562103' OR LOWER(email) = ? OR name = 'Demo Citizen' OR name = 'Citizen User'`, [citizenEmail]);
  let userId;
  if (citizenCheck.rows && citizenCheck.rows.length > 0) {
    userId = citizenCheck.rows[0].id;
    await query(
      `UPDATE users SET name = 'Pratik Dilip Tupe', mobile = '8788562103', email = ?, password_hash = ?, role = 'citizen', status = 'active' WHERE id = ?`,
      [citizenEmail, citizenHash, userId]
    );
    console.log(`[SEED SUCCESS] Citizen account (8788562103) updated idempotently for DB User ID: ${userId}`);
  } else {
    const insRes = await query(
      `INSERT INTO users (name, mobile, email, password_hash, role, status, language_pref) VALUES (?, ?, ?, ?, 'citizen', 'active', 'en')`,
      ['Pratik Dilip Tupe', '8788562103', citizenEmail, citizenHash]
    );
    userId = insRes.rows[0].id;
    console.log(`[SEED SUCCESS] Citizen account (8788562103) created with DB User ID: ${userId}`);
  }

  // Verify database record
  const dbUser = await query(`SELECT id, name, mobile, email, role, status, password_hash FROM users WHERE id = ?`, [userId]);
  console.log('\n--- DB USER RECORD ---');
  console.log(dbUser.rows[0]);

  // Test bcrypt authentication via mobile
  const mobileMatch = await bcrypt.compare('8788562103', dbUser.rows[0].password_hash);
  console.log('\n--- AUTH TEST (Mobile: 8788562103 + Pass: 8788562103) ---');
  console.log('Mobile Login Bcrypt Match:', mobileMatch);

  // Test bcrypt authentication via email
  const emailUser = await query(`SELECT id, name, mobile, email, role, status, password_hash FROM users WHERE LOWER(email) = ?`, [citizenEmail]);
  const emailMatch = await bcrypt.compare('8788562103', emailUser.rows[0].password_hash);
  console.log('\n--- AUTH TEST (Email: ' + citizenEmail + ' + Pass: 8788562103) ---');
  console.log('Email Login Bcrypt Match:', emailMatch);
  console.log('Mobile & Email User IDs match:', dbUser.rows[0].id === emailUser.rows[0].id);

  process.exit(0);
}

testSeedAndAuth().catch(err => {
  console.error('Error in script:', err);
  process.exit(1);
});
