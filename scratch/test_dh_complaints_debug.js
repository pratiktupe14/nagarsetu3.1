const http = require('http');
const app = require('../backend/src/app');
const { initDatabase, query } = require('../backend/src/config/db');
const seed7DemoDepartmentHeads = require('../backend/src/scripts/seedDemoDepartmentHeads');

async function test() {
  process.env.FORCE_PASSWORD_RESET = 'true';
  await initDatabase();
  await seed7DemoDepartmentHeads(query);

  const server = http.createServer(app);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  // 1. Login as Rahul Kumar
  const loginRes = await new Promise(resolve => {
    const data = JSON.stringify({ mobileOrEmail: 'rahul.kumar@nagarsetu.gov.in', password: 'rahul@123' });
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body) }));
    });
    req.write(data);
    req.end();
  });

  let token = loginRes.data.token;
  console.log('Login status:', loginRes.status, 'Must change pass:', loginRes.data.user?.must_change_password);

  // 2. If password change required, execute change password
  if (loginRes.data.user?.must_change_password) {
    const changeRes = await new Promise(resolve => {
      const data = JSON.stringify({ currentPassword: 'rahul@123', newPassword: 'rahul@pass2026', confirmPassword: 'rahul@pass2026' });
      const req = http.request({
        hostname: '127.0.0.1',
        port,
        path: '/api/auth/change-password',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data), 'Authorization': `Bearer ${token}` }
      }, res => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body) }));
      });
      req.write(data);
      req.end();
    });
    console.log('Change password status:', changeRes.status);
    if (changeRes.data.token) token = changeRes.data.token;
  }

  // 3. Call GET /api/department/complaints
  const compRes = await new Promise(resolve => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: '/api/department/complaints',
      method: 'GET',
      headers: { 'Authorization': `Bearer ${token}` }
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body) }));
    });
    req.end();
  });

  console.log('\n--- GET /api/department/complaints RESULT ---');
  console.log('HTTP Status:', compRes.status);
  console.log('Returned Dept ID:', compRes.data.department_id);
  console.log('Returned Dept Name:', compRes.data.department_name);
  console.log('Complaints array length:', compRes.data.complaints ? compRes.data.complaints.length : 'N/A');

  if (compRes.data.complaints && compRes.data.complaints.length > 0) {
    console.log('Sample 3 complaints:');
    compRes.data.complaints.slice(0, 3).forEach(c => {
      console.log(`  - ID: ${c.id}, Num: ${c.complaint_number}, DeptID: ${c.department_id}, Category: ${c.category}, Title: ${c.title}`);
    });
  }

  server.close();
}

test().catch(console.error);
