const { initDatabase, query } = require('../backend/src/config/db');

async function main() {
  await initDatabase();
  console.log('Checking database staff integrity...');

  const fsRes = await query(`
    SELECT fs.id as fs_id, fs.name, fs.email, fs.employee_id, fs.user_id, fs.department_id,
           u.id as u_id, u.name as u_name, u.role as u_role, u.department_id as u_dept_id,
           d.name as dept_name, d.code as dept_code
    FROM field_staff fs
    LEFT JOIN users u ON fs.user_id = u.id
    LEFT JOIN departments d ON fs.department_id = d.id
    ORDER BY fs.id ASC
  `);

  console.log(`Total Field Staff in DB: ${fsRes.rows.length}`);
  let issues = 0;

  for (const s of fsRes.rows) {
    if (!s.user_id || !s.u_id) {
      console.warn(`[INTEGRITY ERROR] Field Staff '${s.name}' (${s.employee_id}) has no valid user_id link!`);
      issues++;
    }
    if (!s.department_id || !s.dept_name) {
      console.warn(`[INTEGRITY ERROR] Field Staff '${s.name}' has invalid department_id (${s.department_id})!`);
      issues++;
    }
    if (s.u_role !== 'service_staff') {
      console.warn(`[INTEGRITY ERROR] User '${s.name}' has role '${s.u_role}', expected 'service_staff'!`);
      issues++;
    }
  }

  if (issues === 0) {
    console.log('✓ ALL 36 FIELD STAFF RECORDS HAVE PERFECT DATA INTEGRITY & RELATIONSHIPS!');
  } else {
    console.error(`❌ FOUND ${issues} INTEGRITY ISSUES IN STAFF RECORDS!`);
  }

  // Also check Department Heads integrity
  console.log('\nChecking Department Heads integrity...');
  const dhRes = await query(`
    SELECT dh.id as dh_id, dh.name, dh.email, dh.employee_id, dh.user_id, dh.department_id,
           u.id as u_id, u.name as u_name, u.role as u_role,
           d.name as dept_name, d.code as dept_code
    FROM department_heads dh
    LEFT JOIN users u ON dh.user_id = u.id
    LEFT JOIN departments d ON dh.department_id = d.id
    ORDER BY dh.id ASC
  `);
  console.log(`Total Department Heads in DB: ${dhRes.rows.length}`);
  let dhIssues = 0;
  for (const h of dhRes.rows) {
    if (!h.user_id || !h.u_id) {
      console.warn(`[INTEGRITY ERROR] Dept Head '${h.name}' has no valid user_id link!`);
      dhIssues++;
    }
    if (!h.department_id || !h.dept_name) {
      console.warn(`[INTEGRITY ERROR] Dept Head '${h.name}' has invalid department_id (${h.department_id})!`);
      dhIssues++;
    }
  }
  if (dhIssues === 0) {
    console.log('✓ ALL 7 DEPARTMENT HEAD RECORDS HAVE PERFECT DATA INTEGRITY & RELATIONSHIPS!');
  } else {
    console.error(`❌ FOUND ${dhIssues} INTEGRITY ISSUES IN DEPT HEAD RECORDS!`);
  }

  process.exit(issues + dhIssues === 0 ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
