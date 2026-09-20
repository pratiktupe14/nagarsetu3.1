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

function request(port, method, pathUrl, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const dataStr = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: pathUrl,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataStr),
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
    if (dataStr) req.write(dataStr);
    req.end();
  });
}

async function runMasterDataSecurityTest() {
  console.log('========================================================');
  console.log('  RUNNING PHASE 6 MASTER DATA SECURITY TEST            ');
  console.log('========================================================\n');

  await initDatabase();
  const { server, port } = await startServer();

  let totalAssertions = 0;
  let passedAssertions = 0;

  function testAssert(condition, message) {
    totalAssertions++;
    if (condition) {
      passedAssertions++;
      console.log(`✓ [PASS] ${message}`);
    } else {
      console.error(`✗ [FAIL] ${message}`);
      throw new Error(`Security Assertion Failed: ${message}`);
    }
  }

  // Login accounts for testing
  const citizenLogin = await request(port, 'POST', '/api/auth/login', {
    mobileOrEmail: '8788562103',
    password: 'password123'
  });
  const citizenToken = citizenLogin.data.token;

  const pwdDhLogin = await request(port, 'POST', '/api/auth/login', {
    mobileOrEmail: 'rahul.kumar@nagarsetu.gov.in',
    password: 'rahul@pass2026'
  });
  const pwdDhToken = pwdDhLogin.data.token;

  const sanDhLogin = await request(port, 'POST', '/api/auth/login', {
    mobileOrEmail: 'amit.sharma@nagarsetu.gov.in',
    password: 'amit@pass2026'
  });
  const sanDhToken = sanDhLogin.data.token;

  const staffLogin = await request(port, 'POST', '/api/auth/login', {
    mobileOrEmail: 'amit.patil@nagarsetu.gov.in',
    password: 'password123'
  });
  const staffToken = staffLogin.data.token;

  // 1. Citizen cannot create department
  const r1 = await request(port, 'POST', '/api/department', { name: 'Fake Dept', code: 'FKD' }, citizenToken);
  testAssert([401, 403].includes(r1.status), `Citizen rejected from creating department (HTTP ${r1.status})`);

  // 2. Citizen cannot modify Department Head
  const r2 = await request(port, 'POST', '/api/admin/department-heads', { fullName: 'Hacker', departmentId: '1' }, citizenToken);
  testAssert([401, 403].includes(r2.status), `Citizen rejected from appointing Department Head (HTTP ${r2.status})`);

  // 3. Citizen cannot create staff member
  const r3 = await request(port, 'POST', '/api/department/staff', { name: 'Rogue Staff', mobile: '9000000001', password: 'pass', department_id: '1' }, citizenToken);
  testAssert([401, 403].includes(r3.status), `Citizen rejected from creating staff (HTTP ${r3.status})`);

  // 4. Field Staff cannot create staff
  const r4 = await request(port, 'POST', '/api/department/staff', { name: 'Rogue Staff 2', mobile: '9000000002', password: 'pass', department_id: '1' }, staffToken);
  testAssert([401, 403].includes(r4.status), `Field Staff rejected from creating staff (HTTP ${r4.status})`);

  // 5. Field Staff cannot modify staff profile or department
  const r5 = await request(port, 'PUT', '/api/department/staff/2', { department_id: '2' }, staffToken);
  testAssert([401, 403].includes(r5.status), `Field Staff rejected from updating staff department (HTTP ${r5.status})`);

  // 6. Department Head (PWD) cannot edit SAN staff
  const sanStaffRes = await query(`SELECT id FROM field_staff WHERE employee_id = 'SAN-STF-001' LIMIT 1`);
  const sanStaffId = sanStaffRes.rows[0]?.id || 7;
  const r6 = await request(port, 'PUT', `/api/department/staff/${sanStaffId}`, { name: 'Hacked Name' }, pwdDhToken);
  testAssert([401, 403].includes(r6.status), `PWD Department Head forbidden from editing SAN staff (HTTP ${r6.status})`);

  // 7. Department Head cannot deactivate SAN staff
  const r7 = await request(port, 'POST', `/api/department/staff/${sanStaffId}/deactivate`, {}, pwdDhToken);
  testAssert([401, 403].includes(r7.status), `PWD Department Head forbidden from deactivating SAN staff (HTTP ${r7.status})`);

  // 8. Client-supplied forged department_id cannot bypass DH lock
  const testMobile = '9' + Date.now().toString().slice(-9);
  const r8 = await request(port, 'POST', '/api/department/staff', { name: 'Forged Dept Staff', mobile: testMobile, password: 'password123', department_id: '2' }, pwdDhToken);
  testAssert(r8.status === 201 && (r8.data.staff.department_id === '1' || r8.data.staff.department_name.includes('Public Works')), `DH department_id lock enforced (Forced to DH dept '1', ignored forged '2')`);

  // 9. Admin-only endpoints remain protected against DH
  const r9 = await request(port, 'POST', '/api/admin/department-heads', { fullName: 'Unauthorized Head' }, pwdDhToken);
  testAssert([401, 403].includes(r9.status), `Department Head rejected from Admin department-heads creation (HTTP ${r9.status})`);

  server.close();

  console.log(`\n========================================================`);
  console.log(`  PHASE 6 MASTER DATA SECURITY TEST PASSED (${passedAssertions}/${totalAssertions} Assertions)`);
  console.log(`========================================================`);
  process.exit(0);
}

runMasterDataSecurityTest().catch((err) => {
  console.error('\n✗ PHASE 6 MASTER DATA SECURITY TEST FAILED:', err.message);
  process.exit(1);
});
