const { Pool } = require('./backend/node_modules/pg');
require('dotenv').config({ path: './backend/.env' });

async function testPostgresStaff() {
  const dbUrl = process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL || process.env.DATABASE_URL;
  console.log('Testing Database URL:', dbUrl ? dbUrl.split('@')[1] : 'NONE');

  if (!dbUrl) {
    console.log('No PostgreSQL URL found in backend/.env');
    return;
  }

  const pool = new Pool({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('\n--- 1. Raw field_staff count on PostgreSQL ---');
    const cRes = await pool.query('SELECT COUNT(*) as count FROM field_staff');
    console.log('PostgreSQL field_staff count:', cRes.rows[0].count);

    console.log('\n--- 2. department.routes.js staff query on PostgreSQL ---');
    const sql = `
      SELECT fs.id, fs.user_id, fs.name, fs.email, fs.phone as mobile, fs.department_id, fs.employee_id, fs.status, fs.created_at,
             d.name as department_name, d.code as department_code,
             u.language_pref
      FROM field_staff fs
      LEFT JOIN departments d ON fs.department_id = d.id
      LEFT JOIN users u ON fs.user_id = u.id
      WHERE 1=1 AND LOWER(fs.status) != 'archived'
      ORDER BY fs.created_at DESC
    `;
    const sRes = await pool.query(sql, []);
    console.log('PostgreSQL department staff query rows returned:', sRes.rows.length);

    if (sRes.rows.length > 0) {
      console.log('First 3 records on PostgreSQL:');
      sRes.rows.slice(0, 3).forEach((r, i) => {
        console.log(`[${i+1}] ID=${r.id}, UserID=${r.user_id}, Name='${r.name}', Email='${r.email}', DeptID=${r.department_id}, DeptName='${r.department_name}'`);
      });
    }
  } catch (e) {
    console.error('PostgreSQL Error:', e.message);
  } finally {
    await pool.end();
  }
}

testPostgresStaff();
