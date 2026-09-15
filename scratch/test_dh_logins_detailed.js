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

async function run() {
  await initDatabase();
  const { server, port } = await startServer();

  const heads = [
    { name: 'Rahul Kumar (PWD)', email: 'rahul.kumar@nagarsetu.gov.in', pass: 'rahul@123' },
    { name: 'Amit Sharma (SAN)', email: 'amit.sharma@nagarsetu.gov.in', pass: 'amit@123' },
    { name: 'Vikram Patil (WTR)', email: 'vikram.patil@nagarsetu.gov.in', pass: 'vikram@123' },
    { name: 'Sanjay More (DRN)', email: 'sanjay.more@nagarsetu.gov.in', pass: 'sanjay@123' },
    { name: 'Aditya Joshi (ELE)', email: 'aditya.joshi@nagarsetu.gov.in', pass: 'aditya@123' },
    { name: 'Rohan Deshmukh (TRF)', email: 'rohan.deshmukh@nagarsetu.gov.in', pass: 'rohan@123' },
    { name: 'Kunal Kulkarni (MNT)', email: 'kunal.kulkarni@nagarsetu.gov.in', pass: 'kunal@123' }
  ];

  for (const h of heads) {
    const loginRes = await fetch(`http://127.0.0.1:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileOrEmail: h.email, password: h.pass })
    });
    const loginData = await loginRes.json();
    console.log(`Login ${h.name} -> HTTP ${loginRes.status}:`, loginData.user ? { id: loginData.user.id, role: loginData.user.role, deptId: loginData.user.department_id, deptCode: loginData.user.department_code, deptName: loginData.user.department_name } : loginData);

    if (loginData.token) {
      const staffRes = await request(port, 'GET', '/api/department/staff', loginData.token);
      console.log(`  Staff API HTTP ${staffRes.status} -> count:`, staffRes.data.staff ? staffRes.data.staff.length : staffRes.data);
    }
  }

  server.close();
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
