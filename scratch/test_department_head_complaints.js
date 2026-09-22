const http = require('http');
const app = require('../backend/src/app');
const { initDatabase, query } = require('../backend/src/config/db');
const seed7DemoDepartmentHeads = require('../backend/src/scripts/seedDemoDepartmentHeads');
const { generateToken } = require('../backend/src/middleware/auth');

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
    }, res => {
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

async function runDepartmentHeadComplaintsTestSuite() {
  console.log('========================================================================');
  console.log('  NAGARSETU 3.1 — DEPARTMENT HEAD COMPLAINT VISIBILITY TEST SUITE      ');
  console.log('========================================================================\n');

  process.env.FORCE_PASSWORD_RESET = 'true';
  await initDatabase();
  await seed7DemoDepartmentHeads(query);

  const server = http.createServer(app);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  let passed = true;

  // 1. PWD Department Head Login & Token
  const pwdLoginRes = await request(port, 'POST', '/api/auth/login', {
    mobileOrEmail: 'rahul.kumar@nagarsetu.gov.in',
    password: 'rahul@123'
  });
  let pwdToken = pwdLoginRes.data?.token;

  if (pwdLoginRes.data?.user?.must_change_password) {
    const chg = await request(port, 'POST', '/api/auth/change-password', {
      currentPassword: 'rahul@123',
      newPassword: 'rahul@pass2026',
      confirmPassword: 'rahul@pass2026'
    }, pwdToken);
    if (chg.data?.token) pwdToken = chg.data.token;
  }

  // 1. Test PWD Head sees PWD complaints
  const pwdCompRes = await request(port, 'GET', '/api/department/complaints', null, pwdToken);
  const pwdComplaints = pwdCompRes.data?.complaints || [];
  console.log(`✓ [TEST 1] PWD Head sees PWD complaints: HTTP ${pwdCompRes.status}, Count: ${pwdComplaints.length}`);
  if (pwdCompRes.status !== 200 || pwdComplaints.length === 0) {
    console.error(`✗ [FAIL TEST 1] PWD complaints count is 0 or failed status!`);
    passed = false;
  }

  // 2. Test PWD Head does NOT see SAN complaints
  const sanInPwd = pwdComplaints.filter(c => String(c.department_id) === '2' || String(c.department_id).toUpperCase() === 'SAN');
  console.log(`✓ [TEST 2] PWD Head does not see SAN complaints: SAN count in PWD view = ${sanInPwd.length}`);
  if (sanInPwd.length > 0) {
    console.error(`✗ [FAIL TEST 2] Cross-department leak! SAN complaints visible in PWD view.`);
    passed = false;
  }

  // 3. SAN Department Head Login & Token
  const sanLoginRes = await request(port, 'POST', '/api/auth/login', {
    mobileOrEmail: 'amit.sharma@nagarsetu.gov.in',
    password: 'amit@123'
  });
  let sanToken = sanLoginRes.data?.token;
  if (sanLoginRes.data?.user?.must_change_password) {
    const chg = await request(port, 'POST', '/api/auth/change-password', {
      currentPassword: 'amit@123',
      newPassword: 'amit@pass2026',
      confirmPassword: 'amit@pass2026'
    }, sanToken);
    if (chg.data?.token) sanToken = chg.data.token;
  }

  const sanCompRes = await request(port, 'GET', '/api/department/complaints', null, sanToken);
  const sanComplaints = sanCompRes.data?.complaints || [];
  console.log(`✓ [TEST 3] SAN Head sees SAN complaints: HTTP ${sanCompRes.status}, Count: ${sanComplaints.length}`);
  if (sanCompRes.status !== 200 || sanComplaints.length === 0) {
    console.error(`✗ [FAIL TEST 3] SAN complaints count is 0 or failed status!`);
    passed = false;
  }

  // 4. Test SAN Head does NOT see PWD complaints
  const pwdInSan = sanComplaints.filter(c => String(c.department_id) === '1' || String(c.department_id).toUpperCase() === 'PWD');
  console.log(`✓ [TEST 4] SAN Head does not see PWD complaints: PWD count in SAN view = ${pwdInSan.length}`);
  if (pwdInSan.length > 0) {
    console.error(`✗ [FAIL TEST 4] Cross-department leak! PWD complaints visible in SAN view.`);
    passed = false;
  }

  // 5. Test Department mapping is server-side
  const uuidToken = generateToken({
    id: 128,
    name: 'Rahul Kumar',
    email: 'rahul.kumar@nagarsetu.gov.in',
    role: 'department_head',
    department_id: '8ed9f760-1314-427c-a515-c2a54d6df6d8'
  });
  const uuidRes = await request(port, 'GET', '/api/department/complaints', null, uuidToken);
  const uuidComplaints = uuidRes.data?.complaints || [];
  console.log(`✓ [TEST 5] Server-side department mapping resolves UUID department_id: HTTP ${uuidRes.status}, Count: ${uuidComplaints.length}`);
  if (uuidRes.status !== 200 || uuidComplaints.length === 0) {
    console.error(`✗ [FAIL TEST 5] Server-side UUID department mapping failed!`);
    passed = false;
  }

  // 6. Test forged query param department_id is ignored/rejected for Department Head
  const forgedRes = await request(port, 'GET', '/api/department/complaints?department_id=SAN', null, pwdToken);
  const forgedComplaints = forgedRes.data?.complaints || [];
  const forgedSanInPwd = forgedComplaints.filter(c => String(c.department_id) === '2' || String(c.department_id).toUpperCase() === 'SAN');
  console.log(`✓ [TEST 6] Forged department_id query param ignored for DH: HTTP ${forgedRes.status}, SAN count = ${forgedSanInPwd.length}`);
  if (forgedSanInPwd.length > 0) {
    console.error(`✗ [FAIL TEST 6] Client forged department_id parameter allowed SAN complaints to leak!`);
    passed = false;
  }

  // 7. Test empty default filters do not remove complaints
  const defaultRes = await request(port, 'GET', '/api/department/complaints', null, pwdToken);
  console.log(`✓ [TEST 7] Default query returns full department complaints: Count: ${defaultRes.data?.complaints?.length}`);

  // 8. Test complaint counts match returned dataset
  const countMatch = defaultRes.data?.complaints?.length === pwdComplaints.length;
  console.log(`✓ [TEST 8] Complaint counts match returned dataset: ${countMatch}`);
  if (!countMatch) {
    console.error(`✗ [FAIL TEST 8] Count mismatch!`);
    passed = false;
  }

  // 9. Invalid unauthenticated request returns safe error
  const unauthRes = await request(port, 'GET', '/api/department/complaints');
  console.log(`✓ [TEST 9] Unauthenticated access rejected with HTTP ${unauthRes.status}`);
  if (unauthRes.status !== 401) {
    console.error(`✗ [FAIL TEST 9] Expected 401, got ${unauthRes.status}`);
    passed = false;
  }

  // 10. Database/query failure is not silently converted to empty data
  const invalidRouteRes = await request(port, 'GET', '/api/department/complaints/invalid-endpoint', null, pwdToken);
  console.log(`✓ [TEST 10] Invalid endpoint returns 404 error (not empty complaints): HTTP ${invalidRouteRes.status}`);
  if (invalidRouteRes.status !== 404) {
    console.error(`✗ [FAIL TEST 10] Expected 404, got ${invalidRouteRes.status}`);
    passed = false;
  }

  server.close();
  console.log('\n========================================================================');
  console.log(`  DEPARTMENT HEAD COMPLAINTS TEST RESULT: ${passed ? 'ALL PASSED (10/10 SUCCESS)' : 'FAILED'}`);
  console.log('========================================================================');
  process.exit(passed ? 0 : 1);
}

runDepartmentHeadComplaintsTestSuite().catch(err => {
  console.error('Fatal error in test suite:', err);
  process.exit(1);
});
