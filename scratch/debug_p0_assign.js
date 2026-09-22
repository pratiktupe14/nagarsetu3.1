const jwt = require('../backend/node_modules/jsonwebtoken');
const { initDatabase, query } = require('../backend/src/config/db');

async function run() {
  await initDatabase();

  const pwdCompRes = await query(`SELECT id, status, department_id FROM complaints WHERE department_id = '1' OR department_id = 'PWD' LIMIT 1`);
  const pwdStaffRes = await query(`SELECT id, user_id, department_id, employee_id FROM field_staff WHERE department_id = '1' OR department_id = 'PWD' LIMIT 1`);

  console.log('pwdComp:', pwdCompRes.rows);
  console.log('pwdStaff:', pwdStaffRes.rows);

  const pwdCompId = pwdCompRes.rows[0].id;
  const pwdStaffId = pwdStaffRes.rows[0].id;

  const app = require('../backend/src/app');
  const http = require('http');
  const server = http.createServer(app);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  const token = jwt.sign({
    id: 128,
    user_id: 128,
    role: 'department_head',
    email: 'rahul.kumar@nagarsetu.gov.in',
    department_id: 'PWD'
  }, process.env.JWT_SECRET || 'nagarsetu_dev_secret_key_2026_super_secure');

  const res = await fetch(`http://127.0.0.1:${port}/api/department/assign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ complaint_id: pwdCompId, staff_id: pwdStaffId })
  });

  console.log('Assign HTTP Status:', res.status);
  const data = await res.json();
  console.log('Assign Response Body:', data);

  server.close();
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
