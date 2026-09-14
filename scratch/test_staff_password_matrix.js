const http = require('http');
const https = require('https');
const crypto = require('crypto');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:5002';
let server;

function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const lib = url.protocol === 'https:' ? https : http;
    const options = {
      method,
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      headers: {
        'Accept': 'application/json',
        ...headers
      }
    };

    let payload = null;
    if (body) {
      if (Buffer.isBuffer(body) || typeof body === 'string') {
        payload = body;
      } else {
        payload = JSON.stringify(body);
        if (!options.headers['Content-Type']) {
          options.headers['Content-Type'] = 'application/json';
        }
      }
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (e) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json,
          raw: data
        });
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

const testResults = [];

function recordResult(testName, passed, details = '', failure = '') {
  testResults.push({ testName, passed, details, failure });
  const tag = passed ? '\x1b[32m[PASS]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m';
  console.log(`  ${tag} ${testName} ${details ? '- ' + details : ''}`);
  if (!passed && failure) {
    console.log(`         \x1b[31mFailure: ${failure}\x1b[0m`);
  }
}

async function runPasswordMatrixTests() {
  console.log('========================================================================');
  console.log('  NAGARSETU 3.1 — FIELD STAFF & DEPT HEAD PASSWORD TEST MATRIX');
  console.log(`  Target: ${BASE_URL}`);
  console.log('========================================================================\n');

  if (BASE_URL.includes('127.0.0.1') || BASE_URL.includes('localhost')) {
    const { initDatabase, query } = require('../backend/src/config/db');
    process.env.FORCE_PASSWORD_RESET = 'true';
    await initDatabase();
    await require('../backend/src/scripts/seedDefaultUsers')(query);
    await require('../backend/src/scripts/seedDemoDepartmentHeads')(query);
    await require('../backend/src/scripts/seedServiceStaff')(query);
    delete process.env.FORCE_PASSWORD_RESET;

    const app = require('../backend/src/app');
    const u = new URL(BASE_URL);
    await new Promise((res) => {
      server = app.listen(parseInt(u.port || 5002, 10), u.hostname, res);
    });
  }

  try {
    const { query } = require('../backend/src/config/db');

    // ------------------------------------------------------------------------
    // SETUP: ACCOUNTS INITIALIZATION
    // ------------------------------------------------------------------------
    console.log('--- INITIALIZING TEST ACCOUNTS ---');

    // 1. Staff A (Amit Patil - PWD)
    let staffALogin = await request('POST', '/api/auth/login', {}, {
      mobileOrEmail: 'amit.patil@nagarsetu.gov.in',
      password: 'amit@123'
    });
    if (staffALogin.status !== 200) {
      staffALogin = await request('POST', '/api/auth/login', {}, {
        mobileOrEmail: 'amit.patil@nagarsetu.gov.in',
        password: 'amit@accept2026'
      });
    }
    let staffAToken = staffALogin.data?.token;
    let staffAUser = staffALogin.data?.user;

    // Perform initial password change if required
    if (staffAUser?.must_change_password) {
      const initChange = await request('POST', '/api/auth/change-password', {
        Authorization: `Bearer ${staffAToken}`
      }, {
        currentPassword: 'amit@123',
        newPassword: 'AmitInitialPass@2026!',
        confirmPassword: 'AmitInitialPass@2026!'
      });
      staffAToken = initChange.data?.token || staffAToken;
      staffAUser = initChange.data?.user || staffAUser;
    }
    const staffACurrentPass = 'AmitInitialPass@2026!';
    console.log(`✓ Staff A initialized (ID: ${staffAUser?.id}, Dept: PWD)`);

    // 2. Staff B (Sagar Jadhav - PWD)
    let staffBLogin = await request('POST', '/api/auth/login', {}, {
      mobileOrEmail: 'sagar.jadhav@nagarsetu.gov.in',
      password: 'sagar@123'
    });
    if (staffBLogin.status !== 200) {
      staffBLogin = await request('POST', '/api/auth/login', {}, {
        mobileOrEmail: 'sagar.jadhav@nagarsetu.gov.in',
        password: 'sagar@accept2026'
      });
    }
    let staffBUser = staffBLogin.data?.user;
    console.log(`✓ Staff B initialized (ID: ${staffBUser?.id}, Dept: PWD)`);

    // 3. Department Head PWD (Rahul Kumar)
    let dhPwdLogin = await request('POST', '/api/auth/login', {}, {
      mobileOrEmail: 'rahul.kumar@nagarsetu.gov.in',
      password: 'rahul@123'
    });
    if (dhPwdLogin.status !== 200) {
      dhPwdLogin = await request('POST', '/api/auth/login', {}, {
        mobileOrEmail: 'rahul.kumar@nagarsetu.gov.in',
        password: 'rahul@accept2026'
      });
    }
    let dhPwdToken = dhPwdLogin.data?.token;
    let dhPwdUser = dhPwdLogin.data?.user;
    if (dhPwdUser?.must_change_password) {
      const initDhChange = await request('POST', '/api/auth/change-password', {
        Authorization: `Bearer ${dhPwdToken}`
      }, {
        currentPassword: 'rahul@123',
        newPassword: 'RahulDhPass@2026!',
        confirmPassword: 'RahulDhPass@2026!'
      });
      dhPwdToken = initDhChange.data?.token || dhPwdToken;
    }
    console.log(`✓ PWD Department Head initialized (ID: ${dhPwdUser?.id})`);

    // 4. Department Head ELE (Aditya Joshi)
    let dhEleLogin = await request('POST', '/api/auth/login', {}, {
      mobileOrEmail: 'aditya.joshi@nagarsetu.gov.in',
      password: 'aditya@123'
    });
    if (dhEleLogin.status !== 200) {
      dhEleLogin = await request('POST', '/api/auth/login', {}, {
        mobileOrEmail: 'aditya.joshi@nagarsetu.gov.in',
        password: 'aditya@accept2026'
      });
    }
    let dhEleToken = dhEleLogin.data?.token;
    let dhEleUser = dhEleLogin.data?.user;
    if (dhEleUser?.must_change_password) {
      const initEleDhChange = await request('POST', '/api/auth/change-password', {
        Authorization: `Bearer ${dhEleToken}`
      }, {
        currentPassword: 'aditya@123',
        newPassword: 'AdityaElePass@2026!',
        confirmPassword: 'AdityaElePass@2026!'
      });
      dhEleToken = initEleDhChange.data?.token || dhEleToken;
    }
    console.log(`✓ ELE Department Head initialized (ID: ${dhEleUser?.id})\n`);

    // 5. Citizen Account
    const randomSuffix = Math.floor(100000 + Math.random() * 900000);
    const citizenReg = await request('POST', '/api/auth/register', {}, {
      name: `Test Citizen ${randomSuffix}`,
      mobile: `99${String(randomSuffix).slice(0, 8)}`,
      email: `citizen${randomSuffix}@nagarsetu.gov.in`,
      password: `CitizenPass${randomSuffix}!`,
      role: 'citizen'
    });
    const citizenToken = citizenReg.data?.token;
    console.log(`✓ Citizen Account initialized\n`);

    // ------------------------------------------------------------------------
    // TEST 1: STAFF A CHANGES OWN PASSWORD
    // ------------------------------------------------------------------------
    console.log('--- TEST 1: Staff A changes own password ---');
    const staffASelfNewPass = `AmitSelfNew@Pass${randomSuffix}!`;

    const selfChangeRes = await request('POST', '/api/auth/change-password', {
      Authorization: `Bearer ${staffAToken}`
    }, {
      currentPassword: staffACurrentPass,
      newPassword: staffASelfNewPass,
      confirmPassword: staffASelfNewPass
    });

    const selfChangeSuccess = selfChangeRes.status === 200 && selfChangeRes.data?.success;
    recordResult(
      'Staff A self password change (POST /api/auth/change-password)',
      selfChangeSuccess,
      `HTTP ${selfChangeRes.status}, Message: ${selfChangeRes.data?.message}`
    );

    // Verify response does NOT contain plaintext password or password_hash
    const hasPasswordInResp = Boolean(selfChangeRes.data?.password || selfChangeRes.data?.password_hash || selfChangeRes.data?.user?.password_hash);
    recordResult(
      'API response contains NO plaintext password or password_hash',
      !hasPasswordInResp,
      `Exposed: ${hasPasswordInResp}`
    );

    // Verify OLD password fails
    const oldLoginFail = await request('POST', '/api/auth/login', {}, {
      mobileOrEmail: 'amit.patil@nagarsetu.gov.in',
      password: staffACurrentPass
    });
    recordResult(
      'Staff A OLD password login MUST FAIL',
      oldLoginFail.status === 401,
      `HTTP ${oldLoginFail.status}`
    );

    // Verify NEW password succeeds
    const newLoginSuccess = await request('POST', '/api/auth/login', {}, {
      mobileOrEmail: 'amit.patil@nagarsetu.gov.in',
      password: staffASelfNewPass
    });
    recordResult(
      'Staff A NEW password login MUST SUCCEED',
      newLoginSuccess.status === 200 && Boolean(newLoginSuccess.data?.token),
      `HTTP ${newLoginSuccess.status}, Role: ${newLoginSuccess.data?.user?.role}`
    );
    staffAToken = newLoginSuccess.data?.token || staffAToken;

    // Verify Staff A identity attributes remain unchanged
    const updatedA = newLoginSuccess.data?.user;
    const staffAUnchanged = updatedA?.id === staffAUser.id &&
                            (updatedA?.role === 'service_staff' || updatedA?.role === 'staff' || updatedA?.role === 'field_staff') &&
                            String(updatedA?.department_id) === String(staffAUser.department_id);
    recordResult(
      'Staff A identity attributes unchanged (User ID, Role, Department)',
      staffAUnchanged,
      `ID: ${updatedA?.id}, Role: ${updatedA?.role}, Dept: ${updatedA?.department_id}`
    );

    // ------------------------------------------------------------------------
    // TEST 2: DEPARTMENT HEAD PWD CHANGES STAFF A PASSWORD
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 2: Department Head PWD changes Staff A password ---');
    const dhSetStaffAPass = `AmitDhReset@Pass${randomSuffix}!`;

    const dhChangeRes = await request('POST', `/api/department/staff/${staffAUser.id}/change-password`, {
      Authorization: `Bearer ${dhPwdToken}`
    }, {
      newPassword: dhSetStaffAPass,
      confirmPassword: dhSetStaffAPass
    });

    recordResult(
      'Department Head PWD changes Staff A password (POST /api/department/staff/:id/change-password)',
      dhChangeRes.status === 200 && dhChangeRes.data?.success,
      `HTTP ${dhChangeRes.status}, Message: ${dhChangeRes.data?.message}`
    );

    // Verify Staff A OLD password fails
    const oldDhLoginFail = await request('POST', '/api/auth/login', {}, {
      mobileOrEmail: 'amit.patil@nagarsetu.gov.in',
      password: staffASelfNewPass
    });
    recordResult(
      'Staff A previous password login MUST FAIL',
      oldDhLoginFail.status === 401,
      `HTTP ${oldDhLoginFail.status}`
    );

    // Verify Staff A NEW DH-set password succeeds
    const newDhLoginSuccess = await request('POST', '/api/auth/login', {}, {
      mobileOrEmail: 'amit.patil@nagarsetu.gov.in',
      password: dhSetStaffAPass
    });
    recordResult(
      'Staff A DH-set password login MUST SUCCEED',
      newDhLoginSuccess.status === 200 && Boolean(newDhLoginSuccess.data?.token),
      `HTTP ${newDhLoginSuccess.status}`
    );

    // ------------------------------------------------------------------------
    // TEST 3: STAFF A ATTEMPTS TO CHANGE STAFF B PASSWORD (MUST FAIL 403)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 3: Staff A attempts to change Staff B password ---');
    const staffBPassHack = await request('POST', `/api/department/staff/${staffBUser.id}/change-password`, {
      Authorization: `Bearer ${staffAToken}`
    }, {
      newPassword: 'HackedStaffBPass123!'
    });

    recordResult(
      'Staff A attempting to change Staff B password rejected with HTTP 403',
      staffBPassHack.status === 403,
      `HTTP ${staffBPassHack.status}, Error: ${staffBPassHack.data?.error}`
    );

    // ------------------------------------------------------------------------
    // TEST 4: ELE DEPARTMENT HEAD ATTEMPTS TO CHANGE PWD STAFF A PASSWORD (MUST FAIL 403)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 4: ELE Department Head attempts to change PWD staff password ---');
    const crossDeptChangeRes = await request('POST', `/api/department/staff/${staffAUser.id}/change-password`, {
      Authorization: `Bearer ${dhEleToken}`
    }, {
      newPassword: 'CrossDeptHackedPass123!'
    });

    recordResult(
      'ELE Department Head attempting to change PWD staff password rejected with HTTP 403',
      crossDeptChangeRes.status === 403,
      `HTTP ${crossDeptChangeRes.status}, Error: ${crossDeptChangeRes.data?.error}`
    );

    // ------------------------------------------------------------------------
    // TEST 5: CITIZEN ATTEMPTS STAFF PASSWORD ENDPOINT (MUST FAIL 403)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 5: Citizen attempts staff password-management endpoint ---');
    const citizenHackRes = await request('POST', `/api/department/staff/${staffAUser.id}/change-password`, {
      Authorization: `Bearer ${citizenToken}`
    }, {
      newPassword: 'CitizenHackPass123!'
    });

    recordResult(
      'Citizen attempting staff password-management endpoint rejected with HTTP 403',
      citizenHackRes.status === 403,
      `HTTP ${citizenHackRes.status}`
    );

    // ------------------------------------------------------------------------
    // TEST 6: ANONYMOUS REQUEST (MUST FAIL 401)
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 6: Anonymous request ---');
    const anonRes = await request('POST', `/api/department/staff/${staffAUser.id}/change-password`, {}, {
      newPassword: 'AnonHackPass123!'
    });

    recordResult(
      'Anonymous staff password change request rejected with HTTP 401',
      anonRes.status === 401,
      `HTTP ${anonRes.status}`
    );

    // ------------------------------------------------------------------------
    // TEST 7: DATABASE PERSISTENCE & BCRYPT AUDIT
    // ------------------------------------------------------------------------
    console.log('\n--- TEST 7: Database Persistence & Bcrypt Audit ---');
    const dbCheck = await query(`SELECT id, name, email, password_hash FROM users WHERE CAST(id AS TEXT) = ?`, [String(staffAUser.id)]);
    const dbUser = dbCheck.rows[0];
    const isBcrypt = Boolean(dbUser?.password_hash && dbUser.password_hash.startsWith('$2'));

    recordResult(
      'Password in database is bcrypt hashed (starts with $2a/$2b)',
      isBcrypt,
      `Hash prefix: ${dbUser?.password_hash?.slice(0, 7)}`
    );

    const isPlaintext = Boolean(dbUser?.password_hash && (dbUser.password_hash === dhSetStaffAPass || dbUser.password_hash === staffASelfNewPass));
    recordResult(
      'NO plaintext password stored in database',
      !isPlaintext,
      `Plaintext stored: ${isPlaintext}`
    );

    // ------------------------------------------------------------------------
    // SUMMARY
    // ------------------------------------------------------------------------
    console.log('\n========================================================================');
    const totalTests = testResults.length;
    const passedTests = testResults.filter(t => t.passed).length;
    const failedTests = testResults.filter(t => !t.passed).length;
    console.log(`  TOTAL: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
    console.log('========================================================================\n');

    return { totalTests, passedTests, failedTests };
  } finally {
    if (server) server.close();
  }
}

runPasswordMatrixTests().then(({ passedTests, failedTests, totalTests }) => {
  process.exit(failedTests > 0 ? 1 : 0);
}).catch(err => {
  console.error('Fatal test failure:', err);
  process.exit(1);
});
