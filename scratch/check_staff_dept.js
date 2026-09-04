const { Pool } = require('../backend/node_modules/pg');
const pool = new Pool({ connectionString: 'postgresql://postgres.ozeiymkbxtrqqdoxtmhm:P1d2s3j4t5%40@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres' });

async function check() {
  const u = await pool.query("SELECT id, name, email, role, department_id, employee_id, status FROM users WHERE LOWER(email) = 'staff@nagarsetu.gov.in'");
  console.log('users row for staff@nagarsetu.gov.in:', u.rows);
  
  const fs = await pool.query("SELECT id, user_id, department_id, name, email, employee_id, status FROM field_staff WHERE LOWER(email) = 'staff@nagarsetu.gov.in'");
  console.log('field_staff row for staff@nagarsetu.gov.in:', fs.rows);

  const depts = await pool.query("SELECT id, name, code FROM departments");
  console.log('all departments:', depts.rows);

  await pool.end();
}

check().catch(console.error);
