const { initDatabase, query } = require('../backend/src/config/db');

async function run() {
  await initDatabase();

  console.log('=== TESTING DEPARTMENT ID REPRESENTATIONS IN DB ===');

  // Let's check all distinct department_id values in complaints table
  const compDepts = await query(`SELECT DISTINCT department_id FROM complaints`);
  console.log('Distinct department_id in complaints:', compDepts.rows);

  // Let's check all records in departments table
  const depts = await query(`SELECT id, code, name FROM departments`);
  console.log('All departments:', depts.rows);

  // Let's check department_heads table
  const dhs = await query(`SELECT id, user_id, department_id, name, email FROM department_heads`);
  console.log('All department_heads:', dhs.rows);

  // Let's check users table for department_heads
  const dhUsers = await query(`SELECT id, name, email, role, department_id FROM users WHERE role = 'department_head'`);
  console.log('All DH users:', dhUsers.rows);

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
