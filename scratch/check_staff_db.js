const { initDatabase, query } = require('../backend/src/config/db');

async function checkStaffDB() {
  await initDatabase();

  const fsRes = await query('SELECT COUNT(*) as count FROM field_staff');
  console.log('FIELD_STAFF TABLE COUNT:', fsRes.rows[0]);

  const usersRes = await query(`SELECT COUNT(*) as count FROM users WHERE role = 'staff'`);
  console.log('USERS TABLE STAFF COUNT:', usersRes.rows[0]);

  const fsList = await query('SELECT fs.*, d.name as department_name, d.code as department_code FROM field_staff fs LEFT JOIN departments d ON fs.department_id = d.id');
  console.log('FIELD STAFF ROWS COUNT:', fsList.rows ? fsList.rows.length : 0);
  if (fsList.rows && fsList.rows.length > 0) {
    console.log('SAMPLE ROW:', fsList.rows[0]);
  }

  process.exit(0);
}

checkStaffDB().catch(e => {
  console.error(e);
  process.exit(1);
});
