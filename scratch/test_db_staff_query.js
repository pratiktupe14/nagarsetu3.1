const { initDatabase, query } = require('../backend/src/config/db.js');

async function testStaffQuery() {
  await initDatabase();

  console.log('\n--- 1. Querying raw field_staff count ---');
  const countRes = await query('SELECT COUNT(*) as count FROM field_staff');
  console.log('field_staff count:', countRes.rows[0].count);

  console.log('\n--- 2. Querying department.routes.js staff SQL ---');
  const sql = `
    SELECT fs.id, fs.user_id, fs.name, fs.email, fs.phone as mobile, fs.department_id, fs.employee_id, fs.status, d.name as department_name
    FROM field_staff fs
    LEFT JOIN departments d ON fs.department_id = d.id
    LEFT JOIN users u ON fs.user_id = u.id
    WHERE 1=1 AND LOWER(fs.status) != 'archived'
    ORDER BY fs.created_at DESC
  `;
  const res = await query(sql, []);
  console.log('Query returned rows count:', res.rows ? res.rows.length : 0);

  if (res.rows && res.rows.length > 0) {
    console.log('First 3 records:');
    res.rows.slice(0, 3).forEach((r, i) => {
      console.log(`[${i+1}] ID: ${r.id}, UserID: ${r.user_id}, Name: '${r.name}', Email: '${r.email}', Mobile: '${r.mobile}', DeptID: ${r.department_id}, DeptName: '${r.department_name}'`);
    });
  }

  process.exit(0);
}

testStaffQuery();
