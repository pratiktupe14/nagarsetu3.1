const path = require('path');
const { query } = require(path.join(__dirname, '../backend/src/config/db.js'));

async function testAdminApis() {
  console.log('=== ADMIN PORTAL API INTEGRATION TEST ===\n');

  // 1. Direct DB Query for Department Heads
  console.log('1. DIRECT DB QUERY: department_heads join users join departments');
  try {
    const dhSql = `
      SELECT dh.id, dh.department_id, dh.user_id, dh.status,
             u.full_name as user_name, u.email as user_email, u.phone as user_phone,
             d.code as dept_code, d.name as dept_name
      FROM department_heads dh
      JOIN users u ON CAST(dh.user_id AS TEXT) = CAST(u.id AS TEXT)
      LEFT JOIN departments d ON CAST(dh.department_id AS TEXT) = CAST(d.id AS TEXT) OR dh.department_id = d.code
    `;
    const dhRes = await query(dhSql);
    console.log(`- Total department_heads rows in DB: ${dhRes.rows.length}`);
    dhRes.rows.forEach(r => {
      console.log(`  HOD: ${r.user_name} (${r.user_email}) | Dept ID: ${r.department_id} (Code: ${r.dept_code}) | Status: ${r.status}`);
    });
  } catch (err) {
    console.error('DB query error:', err.message);
  }

  // 2. Direct DB Query for Field Staff
  console.log('\n2. DIRECT DB QUERY: field_staff');
  try {
    const fsSql = `
      SELECT fs.id, fs.name, fs.email, fs.department_id, fs.status, d.code as dept_code, d.name as dept_name
      FROM field_staff fs
      LEFT JOIN departments d ON CAST(fs.department_id AS TEXT) = CAST(d.id AS TEXT) OR UPPER(CAST(fs.department_id AS TEXT)) = d.code
    `;
    const fsRes = await query(fsSql);
    console.log(`- Total field_staff rows in DB: ${fsRes.rows.length}`);
    const byDept = {};
    fsRes.rows.forEach(r => {
      const code = r.dept_code || r.department_id;
      byDept[code] = (byDept[code] || 0) + 1;
    });
    console.log('- Field staff by department code:', byDept);
  } catch (err) {
    console.error('DB query error:', err.message);
  }

  // 3. Direct DB Query for Departments
  console.log('\n3. DIRECT DB QUERY: departments');
  try {
    const deptSql = `SELECT id, code, name FROM departments ORDER BY id`;
    const deptRes = await query(deptSql);
    console.log(`- Total departments in DB: ${deptRes.rows.length}`);
    deptRes.rows.forEach(r => {
      console.log(`  Dept ID: ${r.id} | Code: ${r.code} | Name: ${r.name}`);
    });
  } catch (err) {
    console.error('DB query error:', err.message);
  }

  process.exit(0);
}

testAdminApis().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
