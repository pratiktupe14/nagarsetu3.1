const { query } = require('../backend/src/config/db');

async function check() {
  const res = await query(`SELECT u.id, u.name, u.email, u.mobile, u.role, u.department_id, fs.employee_id FROM users u LEFT JOIN field_staff fs ON fs.user_id = u.id WHERE u.role = 'service_staff' OR u.role = 'staff' LIMIT 10`);
  console.log('Staff Accounts:', res.rows);
}

check();
