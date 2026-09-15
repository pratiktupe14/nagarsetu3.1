const { initDatabase, query } = require('../backend/src/config/db');

async function test() {
  await initDatabase();
  const res = await query("SELECT id, name, email, role, password_hash, department_id FROM users WHERE email = 'rahul.kumar@nagarsetu.gov.in'");
  console.log('User row:', res.rows);
}

test().catch(console.error);
