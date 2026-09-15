const { initDatabase, query } = require('../backend/src/config/db');
const bcrypt = require('../backend/node_modules/bcryptjs');

async function debug() {
  await initDatabase();
  const u = await query(`SELECT * FROM users WHERE email = 'kunal.kulkarni@nagarsetu.gov.in'`);
  console.log('Kunal user in DB:', u.rows);

  const dh = await query(`SELECT * FROM department_heads WHERE email = 'kunal.kulkarni@nagarsetu.gov.in'`);
  console.log('Kunal DH in DB:', dh.rows);

  if (u.rows && u.rows.length > 0) {
    const isMatch = await bcrypt.compare('kunal@123', u.rows[0].password_hash);
    console.log('Is kunal@123 match:', isMatch);
  }

  process.exit(0);
}

debug();
