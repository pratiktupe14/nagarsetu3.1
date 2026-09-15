const http = require('http');
const app = require('../backend/src/app');
const { initDatabase } = require('../backend/src/config/db');

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

async function testDhEndpoints() {
  await initDatabase();
  const { server, port } = await startServer();

  console.log('=== TESTING DEPARTMENT HEAD STAFF ENDPOINTS ===\n');

  const dhLogins = [
    { code: 'PWD', name: 'Rahul Kumar', email: 'rahul.kumar@nagarsetu.gov.in', pass: 'rahul@123' },
    { code: 'SAN', name: 'Amit Sharma', email: 'amit.sharma@nagarsetu.gov.in', pass: 'amit@123' },
    { code: 'WTR', name: 'Vikram Patil', email: 'vikram.patil@nagarsetu.gov.in', pass: 'vikram@123' },
    { code: 'DRN', name: 'Sanjay More', email: 'sanjay.more@nagarsetu.gov.in', pass: 'sanjay@123' },
    { code: 'ELE', name: 'Aditya Joshi', email: 'aditya.joshi@nagarsetu.gov.in', pass: 'aditya@123' },
    { code: 'TRF', name: 'Rohan Deshmukh', email: 'rohan.deshmukh@nagarsetu.gov.in', pass: 'rohan@123' },
    { code: 'MNT', name: 'Kunal Kulkarni', email: 'kunal.kulkarni@nagarsetu.gov.in', pass: 'kunal@123' }
  ];

  for (const dh of dhLogins) {
    const loginRes = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileOrEmail: dh.email, password: dh.pass })
    });
    const loginData = await loginRes.json();
    const token = loginData.token;

    // Test 1: GET /api/department/staff without query params
    const res1 = await request(port, 'GET', '/api/department/staff', token);
    const count1 = res1.data.staff ? res1.data.staff.length : 0;

    // Test 2: GET /api/department/staff?status=active
    const res2 = await request(port, 'GET', '/api/department/staff?status=active', token);
    const count2 = res2.data.staff ? res2.data.staff.length : 0;

    // Test 3: GET /api/department/staff?status=active&department_id=1
    const res3 = await request(port, 'GET', `/api/department/staff?status=active&department_id=${loginData.user.department_id}`, token);
    const count3 = res3.data.staff ? res3.data.staff.length : 0;

    console.log(`[${dh.code}] ${dh.name} (dept_id: ${loginData.user.department_id}):`);
    console.log(`  -> staff no params: ${count1} | summary:`, res1.data.summary);
    console.log(`  -> staff status=active: ${count2} | summary:`, res2.data.summary);
    console.log(`  -> staff with department_id param: ${count3} | summary:`, res3.data.summary);
  }

  server.close();
  process.exit(0);
}

testDhEndpoints().catch(err => {
  console.error(err);
  process.exit(1);
});
