const http = require('http');
const app = require('../backend/src/app');
const { initDatabase, query } = require('../backend/src/config/db');
const seed7DemoDepartmentHeads = require('../backend/src/scripts/seedDemoDepartmentHeads');
const seedServiceStaff = require('../backend/src/scripts/seedServiceStaff');
const seedDefaultUsers = require('../backend/src/scripts/seedDefaultUsers');

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

function request(port, method, pathUrl, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: pathUrl,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
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
    if (data) req.write(data);
    req.end();
  });
}

async function runRegressionSuite() {
  console.log('========================================================');
  console.log('  RUNNING DEPARTMENT STAFF VISIBILITY REGRESSION TEST   ');
  console.log('========================================================\n');

  process.env.FORCE_PASSWORD_RESET = 'true';
  await initDatabase();
  await seedDefaultUsers(query);
  await seed7DemoDepartmentHeads(query);
  await seedServiceStaff(query);
  delete process.env.FORCE_PASSWORD_RESET;

  const { server, port } = await startServer();
  let passed = true;

  // 1. Admin login & staff fetch
  const adminLoginRes = await request(port, 'POST', '/api/auth/login', {
    mobileOrEmail: 'admin@nagarsetu.gov.in',
    password: 'admin@123'
  });
  const adminToken = adminLoginRes.data.token;

  const adminStaffRes = await request(port, 'GET', '/api/department/staff', null, adminToken);
  const adminStaffList = adminStaffRes.data.staff || [];
  console.log(`✓ [ADMIN] Total staff count returned: ${adminStaffList.length}`);
  if (adminStaffList.length !== 36) {
    console.error(`✗ [FAIL] Expected 36 staff for Admin, got ${adminStaffList.length}`);
    passed = false;
  }

  // 2. Department Heads Isolation & Count Test
  const dhLogins = [
    { code: 'PWD', name: 'Rahul Kumar', email: 'rahul.kumar@nagarsetu.gov.in', pass: 'rahul@123', expectedCount: 6 },
    { code: 'SAN', name: 'Amit Sharma', email: 'amit.sharma@nagarsetu.gov.in', pass: 'amit@123', expectedCount: 5 },
    { code: 'WTR', name: 'Vikram Patil', email: 'vikram.patil@nagarsetu.gov.in', pass: 'vikram@123', expectedCount: 5 },
    { code: 'DRN', name: 'Sanjay More', email: 'sanjay.more@nagarsetu.gov.in', pass: 'sanjay@123', expectedCount: 5 },
    { code: 'ELE', name: 'Kunal Kulkarni', email: 'kunal.kulkarni@nagarsetu.gov.in', pass: 'kunal@123', expectedCount: 5 },
    { code: 'TRF', name: 'Rohan Deshmukh', email: 'rohan.deshmukh@nagarsetu.gov.in', pass: 'rohan@123', expectedCount: 5 },
    { code: 'MNT', name: 'Aditya Joshi', email: 'aditya.joshi@nagarsetu.gov.in', pass: 'aditya@123', expectedCount: 5 }
  ];

  let sumDhStaff = 0;
  const dhStaffMap = {};

  for (const dh of dhLogins) {
    const loginRes = await request(port, 'POST', '/api/auth/login', {
      mobileOrEmail: dh.email,
      password: dh.pass
    });

    if (loginRes.status !== 200 || !loginRes.data.token) {
      console.error(`✗ [FAIL] Login failed for ${dh.name} (${dh.email}):`, loginRes.data);
      passed = false;
      continue;
    }

    let activeToken = loginRes.data.token;
    const user = loginRes.data.user;

    // Verify Department Head assignment
    if (dh.code === 'ELE') {
      if (user.department_code !== 'ELE' && String(user.department_id) !== '5') {
        console.error(`✗ [FAIL] Kunal Kulkarni department mismatch: expected ELE (5), got ${user.department_code} (${user.department_id})`);
        passed = false;
      } else {
        console.log(`✓ [DEPT CHECK] Kunal Kulkarni correctly resolved to ELE department (ID: ${user.department_id})`);
      }
    }

    // Temporary password change required flow handling
    if (user.must_change_password) {
      const firstName = dh.name.split(' ')[0].toLowerCase();
      const newPass = `${firstName}@pass2026`;
      const changeRes = await request(
        port,
        'POST',
        '/api/auth/change-password',
        { currentPassword: dh.pass, newPassword: newPass, confirmPassword: newPass },
        activeToken
      );
      if (changeRes.status === 200 && changeRes.data.token) {
        activeToken = changeRes.data.token;
      }
    }

    const staffRes = await request(port, 'GET', '/api/department/staff', null, activeToken);

    if (staffRes.status !== 200) {
      console.error(`✗ [FAIL] GET /api/department/staff failed for ${dh.name} with HTTP ${staffRes.status}:`, staffRes.data);
      passed = false;
      continue;
    }

    const staffList = staffRes.data.staff || [];
    dhStaffMap[dh.code] = staffList;
    sumDhStaff += staffList.length;

    console.log(`✓ [DH ${dh.code}] ${dh.name}: ${staffList.length} staff returned (expected ${dh.expectedCount})`);

    if (staffList.length !== dh.expectedCount) {
      console.error(`✗ [FAIL] Staff count mismatch for ${dh.code}: expected ${dh.expectedCount}, got ${staffList.length}`);
      passed = false;
    }

    // Security Isolation Check: Verify staff returned strictly belong to dh.code
    const invalidStaff = staffList.filter(s => {
      const empCode = (s.employee_id || '').toUpperCase();
      const deptCode = (s.department_code || '').toUpperCase();
      const deptId = String(s.department_id || '');
      
      if (dh.code === 'PWD' && (empCode.startsWith('PWD') || empCode === 'STF-001' || deptCode === 'PWD' || deptId === '1')) return false;
      if (dh.code === 'SAN' && (empCode.startsWith('SAN') || deptCode === 'SAN' || deptId === '2')) return false;
      if (dh.code === 'WTR' && (empCode.startsWith('WTR') || deptCode === 'WTR' || deptId === '3')) return false;
      if (dh.code === 'DRN' && (empCode.startsWith('DRN') || deptCode === 'DRN' || deptId === '4')) return false;
      if (dh.code === 'ELE' && (empCode.startsWith('ELE') || deptCode === 'ELE' || deptId === '5')) return false;
      if (dh.code === 'TRF' && (empCode.startsWith('TRF') || deptCode === 'TRF' || deptId === '6')) return false;
      if (dh.code === 'MNT' && (empCode.startsWith('MNT') || deptCode === 'MNT' || deptId === '7')) return false;
      return true;
    });

    if (invalidStaff.length > 0) {
      console.error(`✗ [SECURITY ISOLATION FAIL] Cross-department staff leaked into ${dh.code} DH view:`, invalidStaff);
      passed = false;
    }
  }

  // Verify Kunal (ELE) cannot see MNT staff
  const eleStaff = dhStaffMap['ELE'] || [];
  const mntStaffInEle = eleStaff.filter(s => (s.employee_id || '').startsWith('MNT') || s.department_code === 'MNT');
  if (mntStaffInEle.length > 0) {
    console.error(`✗ [SECURITY FAIL] Kunal/ELE can see MNT staff:`, mntStaffInEle);
    passed = false;
  } else {
    console.log(`✓ [ISOLATION PASS] Kunal/ELE cannot see MNT staff`);
  }

  // 3. Admin Consistency Check
  console.log(`\n--- Admin vs Department Heads Consistency Check ---`);
  console.log(`Admin Staff Total: ${adminStaffList.length}`);
  console.log(`Sum of DH Staff Views: ${sumDhStaff} (PWD:6, SAN:5, WTR:5, DRN:5, ELE:5, TRF:5, MNT:5)`);

  if (adminStaffList.length === sumDhStaff) {
    console.log(`✓ [CONSISTENCY PASS] Union of DH staff views matches Admin staff population exactly.`);
  } else {
    console.error(`✗ [CONSISTENCY FAIL] Admin staff count (${adminStaffList.length}) != DH sum (${sumDhStaff})`);
    passed = false;
  }

  server.close();
  console.log('\n========================================================');
  console.log(`  REGRESSION TEST RESULT: ${passed ? 'ALL PASSED (SUCCESS)' : 'FAILED'}`);
  console.log('========================================================');

  process.exit(passed ? 0 : 1);
}

runRegressionSuite().catch(err => {
  console.error('Fatal error in regression test:', err);
  process.exit(1);
});
