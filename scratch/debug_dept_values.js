const { query, initDatabase } = require('../backend/src/config/db');

async function traceDepartmentValues() {
  await initDatabase();

  console.log('--- 1. ACTOR: Rahul Kumar (PWD Head) ---');
  const uHead = await query("SELECT id, name, email, role, department_id FROM users WHERE LOWER(email) = 'rahul.kumar@nagarsetu.gov.in'");
  console.log('users table:', uHead.rows);
  const dhHead = await query("SELECT id, user_id, name, email, department_id FROM department_heads WHERE LOWER(email) = 'rahul.kumar@nagarsetu.gov.in'");
  console.log('department_heads table:', dhHead.rows);

  console.log('\n--- 2. STAFF: Amit Patil (PWD-STF-001) ---');
  const fsStaff = await query("SELECT id, user_id, name, email, employee_id, department_id, status FROM field_staff WHERE employee_id = 'PWD-STF-001' OR LOWER(name) LIKE '%patil%'");
  console.log('field_staff table:', fsStaff.rows);
  if (fsStaff.rows[0]) {
    const uStaff = await query("SELECT id, name, email, role, department_id, employee_id FROM users WHERE id = $1 OR employee_id = $2", [fsStaff.rows[0].user_id, fsStaff.rows[0].employee_id]);
    console.log('users table for staff:', uStaff.rows);
  }

  console.log('\n--- 3. COMPLAINTS ---');
  const comps = await query("SELECT id, complaint_number, department_id, status FROM complaints ORDER BY id DESC LIMIT 5");
  console.log('complaints table:', comps.rows);

  console.log('\n--- 4. DEPARTMENTS TABLE ---');
  const depts = await query("SELECT * FROM departments");
  console.log('departments table:', depts.rows);

  process.exit(0);
}

traceDepartmentValues();
