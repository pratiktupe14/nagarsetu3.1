const http = require('http');
const app = require('../backend/src/app');

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

function request(port, method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('=== AUDITING ALL AUTHENTICATION FLOWS ===\n');
  const { server, port } = await startServer();

  try {
    // 1. Admin Login
    console.log('1. Testing Admin Login...');
    const adminRes = await request(port, 'POST', '/api/auth/login', {}, {
      mobileOrEmail: 'admin@nagarsetu.gov.in',
      password: 'password123'
    });
    if (adminRes.status !== 200 || !adminRes.data.token) {
      throw new Error(`Admin login failed: ${JSON.stringify(adminRes.data)}`);
    }
    console.log(`✓ Admin Logged In: ${adminRes.data.user.name} (${adminRes.data.user.role})`);

    // 2. All 7 Department Heads Logins & Dynamic Routing
    console.log('\n2. Testing All 7 Department Heads Logins...');
    const heads = [
      { code: 'PWD', email: 'rahul.kumar@nagarsetu.gov.in', name: 'Rahul Kumar', deptId: 1 },
      { code: 'SAN', email: 'amit.sharma@nagarsetu.gov.in', name: 'Amit Sharma', deptId: 2 },
      { code: 'WTR', email: 'vikram.patil@nagarsetu.gov.in', name: 'Vikram Patil', deptId: 3 },
      { code: 'DRN', email: 'sanjay.more@nagarsetu.gov.in', name: 'Sanjay More', deptId: 4 },
      { code: 'ELE', email: 'aditya.joshi@nagarsetu.gov.in', name: 'Aditya Joshi', deptId: 5 },
      { code: 'TRF', email: 'rohan.deshmukh@nagarsetu.gov.in', name: 'Rohan Deshmukh', deptId: 6 },
      { code: 'MNT', email: 'kunal.kulkarni@nagarsetu.gov.in', name: 'Kunal Kulkarni', deptId: 7 }
    ];

    for (const h of heads) {
      const res = await request(port, 'POST', '/api/auth/login', {}, {
        mobileOrEmail: h.email,
        password: 'password123'
      });
      if (res.status !== 200 || !res.data.token) {
        throw new Error(`Head login failed for ${h.name} (${h.email}): ${JSON.stringify(res.data)}`);
      }
      const token = res.data.token;
      const meRes = await request(port, 'GET', '/api/auth/me', { Authorization: `Bearer ${token}` });
      if (meRes.status !== 200 || !meRes.data.user) {
        throw new Error(`/api/auth/me failed for ${h.name}`);
      }
      const me = meRes.data.user;
      console.log(`✓ [${h.code}] ${h.name} Logged in: DeptId=${me.department_id}, DeptName="${me.department_name}", Code="${me.department_code}"`);
      if (String(me.department_id) !== String(h.deptId)) {
        throw new Error(`Department mismatch for ${h.name}: expected ${h.deptId}, got ${me.department_id}`);
      }
    }

    // 3. Field Staff Sample Logins across departments
    console.log('\n3. Testing Field Staff Logins & Department Assignment...');
    const staffSamples = [
      { empId: 'STF-001', email: 'staff@nagarsetu.gov.in', deptId: 1, name: 'Ramesh Kumar' },
      { empId: 'PWD-STF-001', email: 'amit.patil@nagarsetu.gov.in', deptId: 1, name: 'Amit Patil' },
      { empId: 'SAN-STF-001', email: 'prashant.mane@nagarsetu.gov.in', deptId: 2, name: 'Prashant Mane' },
      { empId: 'WTR-STF-001', email: 'kiran.patil@nagarsetu.gov.in', deptId: 3, name: 'Kiran Patil' },
      { empId: 'DRN-STF-001', email: 'sunil.patil@nagarsetu.gov.in', deptId: 4, name: 'Sunil Patil' },
      { empId: 'ELE-STF-001', email: 'rahul.joshi@nagarsetu.gov.in', deptId: 5, name: 'Rahul Joshi' },
      { empId: 'TRF-STF-001', email: 'rohan.patil@nagarsetu.gov.in', deptId: 6, name: 'Rohan Patil' },
      { empId: 'MNT-STF-001', email: 'kunal.patil@nagarsetu.gov.in', deptId: 7, name: 'Kunal Patil' }
    ];

    for (const s of staffSamples) {
      const res = await request(port, 'POST', '/api/auth/login', {}, {
        mobileOrEmail: s.email,
        password: 'password123'
      });
      if (res.status !== 200 || !res.data.token) {
        throw new Error(`Staff login failed for ${s.name} (${s.email}): ${JSON.stringify(res.data)}`);
      }
      const meRes = await request(port, 'GET', '/api/auth/me', { Authorization: `Bearer ${res.data.token}` });
      const me = meRes.data.user;
      console.log(`✓ Staff ${s.name} (${s.empId}) Logged in: DeptId=${me.department_id}, Role=${me.role}`);
      if (String(me.department_id) !== String(s.deptId)) {
        throw new Error(`Department mismatch for staff ${s.name}: expected ${s.deptId}, got ${me.department_id}`);
      }
    }

    // 4. Citizen Registration -> Login -> Re-login
    console.log('\n4. Testing Citizen Registration -> Login -> Re-login...');
    const testCitMobile = `91${Math.floor(10000000 + Math.random() * 90000000)}`;
    const testCitEmail = `citizen_${Date.now()}@test.com`;
    const regRes = await request(port, 'POST', '/api/auth/register', {}, {
      name: 'Test Citizen User',
      mobile: testCitMobile,
      email: testCitEmail,
      password: 'StrongPassword123!'
    });
    if (regRes.status !== 201 || !regRes.data.token) {
      throw new Error(`Citizen registration failed: ${JSON.stringify(regRes.data)}`);
    }
    const citizenId = regRes.data.user.id;
    console.log(`✓ Citizen Registered: ID=${citizenId}, Mobile=${testCitMobile}`);

    // Re-login
    const reloginRes = await request(port, 'POST', '/api/auth/login', {}, {
      mobileOrEmail: testCitMobile,
      password: 'StrongPassword123!'
    });
    if (reloginRes.status !== 200 || !reloginRes.data.token) {
      throw new Error(`Citizen re-login failed: ${JSON.stringify(reloginRes.data)}`);
    }
    console.log(`✓ Citizen Re-login successful: Token received for user ${reloginRes.data.user.id}`);

    // Verify /api/auth/me
    const citMe = await request(port, 'GET', '/api/auth/me', { Authorization: `Bearer ${reloginRes.data.token}` });
    if (citMe.status !== 200 || citMe.data.user.id !== citizenId) {
      throw new Error(`Citizen /api/auth/me mismatch`);
    }
    console.log(`✓ Citizen /api/auth/me verified: ${citMe.data.user.name} (${citMe.data.user.role})`);

    console.log('\n=== ALL AUTHENTICATION AUDITS PASSED ===\n');
  } finally {
    server.close();
  }
}

run().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
