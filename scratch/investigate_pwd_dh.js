const { initDatabase, query } = require('../backend/src/config/db');

async function run() {
  await initDatabase();
  console.log('=== STEP 4: TRACE ACTOR DEPARTMENT (Rahul Kumar) ===');
  const userRes = await query(`SELECT id, name, email, role, department_id, employee_id FROM users WHERE LOWER(email) = 'rahul.kumar@nagarsetu.gov.in'`);
  console.log('Users table record:', userRes.rows);

  const dhRes = await query(`SELECT id, user_id, department_id, name, email, employee_id FROM department_heads WHERE LOWER(email) = 'rahul.kumar@nagarsetu.gov.in'`);
  console.log('Department_heads table record:', dhRes.rows);

  console.log('\n=== STEP 5: TRACE ACTUAL PWD DEPARTMENT ===');
  const deptRes = await query(`SELECT id, name, code, description FROM departments WHERE code = 'PWD' OR id = 1 OR LOWER(name) LIKE '%public works%'`);
  console.log('PWD department record:', deptRes.rows);

  console.log('\n=== STEP 6: TRACE ACTUAL PWD COMPLAINTS ===');
  const pwdCompRes = await query(`
    SELECT c.id, c.complaint_number, c.category, c.title, c.status, c.department_id, c.priority
    FROM complaints c
    WHERE CAST(c.department_id AS TEXT) = '1' OR UPPER(CAST(c.department_id AS TEXT)) = 'PWD'
  `);
  console.log('PWD complaints count in DB:', pwdCompRes.rows.length);
  console.log('Sample PWD complaints (first 5):', pwdCompRes.rows.slice(0, 5));

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
