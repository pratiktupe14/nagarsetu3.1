const { query } = require('../backend/src/config/db');

async function check() {
  const uRes = await query(`SELECT id, name, email, department_id FROM users WHERE id = 32`);
  const fsRes = await query(`SELECT id, user_id, name, email, department_id FROM field_staff WHERE user_id = 32 OR id = 32`);
  const dhRes = await query(`SELECT id, user_id, department_id FROM department_heads WHERE email = 'aditya.joshi@nagarsetu.gov.in'`);
  console.log('User 32:', uRes.rows);
  console.log('Field Staff 32:', fsRes.rows);
  console.log('ELE Head:', dhRes.rows);
}

check();
