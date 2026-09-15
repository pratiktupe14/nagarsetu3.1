const http = require('http');
const app = require('../backend/src/app');
const { initDatabase, query } = require('../backend/src/config/db');

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

function request(port, method, path, token = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    }, (res) => {
      let bodyStr = '';
      res.on('data', chunk => bodyStr += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(bodyStr) });
        } catch (e) {
          resolve({ status: res.statusCode, text: bodyStr });
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function debugReproduction() {
  await initDatabase();
  const { server, port } = await startServer();

  console.log('=== REPRODUCING DH STAFF BUG ===\n');

  // 1. Admin login & GET /api/department/staff (Admin gets all staff)
  const adminLoginRes = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobileOrEmail: 'admin@nagarsetu.gov.in', password: 'admin@123' })
  });
  const adminData = await adminLoginRes.json();
  const adminToken = adminData.token;

  const adminStaffRes = await request(port, 'GET', '/api/department/staff', adminToken);
  console.log(`Admin GET /api/department/staff HTTP Status: ${adminStaffRes.status}`);
  const allStaff = adminStaffRes.data.staff || [];
  console.log(`Total staff returned to Admin: ${allStaff.length}`);

  // 2. Log in as Rahul Kumar (PWD Dept Head)
  const dhLoginRes = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobileOrEmail: 'rahul.kumar@nagarsetu.gov.in', password: 'rahul@123' })
  });
  const dhData = await dhLoginRes.json();
  const dhToken = dhData.token;
  const dhUser = dhData.user;

  console.log('\n--- Rahul Kumar (DH) Authenticated User Object ---');
  console.log('user.id:', dhUser.id);
  console.log('user.role:', dhUser.role);
  console.log('user.department_id:', dhUser.department_id);
  console.log('user.department_code:', dhUser.department_code);
  console.log('user.department_name:', dhUser.department_name);

  // 3. Call DH staff API: GET /api/department/staff as Rahul Kumar
  const dhStaffRes = await request(port, 'GET', '/api/department/staff', dhToken);
  console.log('\n--- Rahul Kumar GET /api/department/staff ---');
  console.log('HTTP status:', dhStaffRes.status);
  console.log('Raw API Response keys:', Object.keys(dhStaffRes.data));
  const dhStaffList = dhStaffRes.data.staff || [];
  console.log('dhStaffList length:', dhStaffList.length);
  console.log('dhStaffList:', dhStaffList);

  // 4. DB Inspection
  console.log('\n--- DB Inspection ---');
  const dhDbUser = await query('SELECT * FROM users WHERE email = ?', ['rahul.kumar@nagarsetu.gov.in']);
  console.log('users table for Rahul:', dhDbUser.rows);

  const dhDbHead = await query('SELECT * FROM department_heads WHERE email = ?', ['rahul.kumar@nagarsetu.gov.in']);
  console.log('department_heads table for Rahul:', dhDbHead.rows);

  const deptsDb = await query('SELECT * FROM departments ORDER BY id ASC');
  console.log('departments table:', deptsDb.rows);

  const fieldStaffDb = await query('SELECT id, user_id, name, email, employee_id, department_id, status FROM field_staff ORDER BY id ASC');
  console.log(`\nfield_staff table total rows: ${fieldStaffDb.rows.length}`);
  console.log('field_staff records:');
  fieldStaffDb.rows.forEach(s => {
    console.log(`  Staff ID: ${s.id} | User ID: ${s.user_id} | Name: ${s.name} | Dept ID in DB: ${JSON.stringify(s.department_id)} | Emp ID: ${s.employee_id} | Status: ${s.status}`);
  });

  server.close();
  process.exit(0);
}

debugReproduction().catch(err => {
  console.error(err);
  process.exit(1);
});
