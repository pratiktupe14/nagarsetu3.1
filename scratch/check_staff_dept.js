const { query, initDatabase } = require('../backend/src/config/db');

async function test() {
  try {
    await initDatabase();
    
    console.log('--- COMPLAINTS ---');
    const comp = await query("SELECT id, complaint_number, category, department_id FROM complaints ORDER BY id DESC LIMIT 5");
    console.log(comp.rows);

    console.log('--- FIELD STAFF TABLE ---');
    const fs = await query("SELECT id, user_id, name, email, department_id, employee_id FROM field_staff LIMIT 10");
    console.log(fs.rows);

    console.log('--- USERS TABLE (STAFF) ---');
    const users = await query("SELECT id, name, email, role, department_id, employee_id FROM users WHERE role IN ('service_staff', 'staff', 'field_staff') LIMIT 10");
    console.log(users.rows);

    console.log('--- DEPARTMENT HEADS TABLE ---');
    const dh = await query("SELECT id, user_id, name, email, department_id FROM department_heads LIMIT 10");
    console.log(dh.rows);
  } catch(e) {
    console.error('ERROR:', e);
  }
}
test();
