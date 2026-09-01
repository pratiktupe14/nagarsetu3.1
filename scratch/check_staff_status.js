const { initDatabase, query } = require('../backend/src/config/db');

async function checkStatus() {
  await initDatabase();

  const stRes = await query('SELECT status, COUNT(*) as count FROM field_staff GROUP BY status');
  console.log('FIELD_STAFF STATUS GROUP BY:', stRes.rows);

  const uStRes = await query(`SELECT status, COUNT(*) as count FROM users WHERE role = 'staff' OR role = 'service_staff' GROUP BY status`);
  console.log('USERS STAFF STATUS GROUP BY:', uStRes.rows);

  const allStaff = await query(`SELECT id, name, status, department_id FROM field_staff`);
  console.log(`\nALL 36 FIELD STAFF ROWS (${allStaff.rows.length} total):`);
  allStaff.rows.forEach(r => console.log(`  [ID ${r.id}] Dept: ${r.department_id} | Name: ${r.name} | Status: '${r.status}'`));

  process.exit(0);
}

checkStatus().catch(e => {
  console.error(e);
  process.exit(1);
});
