const { query, initDatabase } = require('../backend/src/config/db');
const { getCanonicalDepartmentId, isDeptMatch } = require('../backend/src/utils/departmentUtils');

async function inspect() {
  await initDatabase();

  console.log('=== DEPARTMENT HEADS ===');
  const dhs = await query("SELECT dh.id, dh.user_id, dh.name, dh.email, dh.department_id, u.department_id as user_dept_id FROM department_heads dh LEFT JOIN users u ON dh.user_id = u.id");
  console.log(dhs.rows);

  console.log('\n=== FIELD STAFF / USERS STAFF ===');
  const staff = await query("SELECT fs.id, fs.user_id, fs.name, fs.email, fs.department_id as fs_dept_id, fs.employee_id, u.department_id as u_dept_id FROM field_staff fs LEFT JOIN users u ON fs.user_id = u.id");
  console.log(staff.rows);

  console.log('\n=== COMPLAINTS SAMPLE ===');
  const comps = await query("SELECT id, complaint_number, department_id, status FROM complaints LIMIT 10");
  console.log(comps.rows);

  process.exit(0);
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
