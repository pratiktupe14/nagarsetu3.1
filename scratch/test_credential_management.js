const path = require('path');
const fs = require('fs');
try { require('dotenv').config({ path: path.join(__dirname, '../.env') }); } catch (e) {}
try { require(path.join(__dirname, '../backend/node_modules/dotenv')).config({ path: path.join(__dirname, '../backend/.env') }); } catch (e) {}

const http = require('http');
const { initDatabase, query } = require('../backend/src/config/db');
const seed7DemoDepartmentHeads = require('../backend/src/scripts/seedDemoDepartmentHeads');
const seedServiceStaff = require('../backend/src/scripts/seedServiceStaff');
const seedDefaultUsers = require('../backend/src/scripts/seedDefaultUsers');

const PORT = 5001; // Test server port
let server;

function request(method, pathUrl, body = null, token = null) {
  return new Promise((res, rej) => {
    const data = body ? JSON.stringify(body) : '';
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: PORT,
        path: pathUrl,
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(data),
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        }
      },
      (r) => {
        let bodyStr = '';
        r.on('data', (chunk) => (bodyStr += chunk));
        r.on('end', () => {
          let parsed;
          try {
            parsed = JSON.parse(bodyStr);
          } catch {
            parsed = bodyStr;
          }
          res({ status: r.statusCode, data: parsed });
        });
      }
    );
    req.on('error', rej);
    if (data) req.write(data);
    req.end();
  });
}

async function runTestMatrix() {
  console.log('=======================================================');
  console.log(' NAGARSETU 3.1 CREDENTIAL MANAGEMENT & FORCE CHANGE TEST MATRIX ');
  console.log('=======================================================');

  // Initialize DB & Initial Seed with FORCE_PASSWORD_RESET to ensure fresh temporary test credentials
  process.env.FORCE_PASSWORD_RESET = 'true';
  await initDatabase();
  await seedDefaultUsers(query);
  await seed7DemoDepartmentHeads(query);
  await seedServiceStaff(query);
  delete process.env.FORCE_PASSWORD_RESET;

  const app = require('../backend/src/app');
  await new Promise((res) => {
    server = app.listen(PORT, '127.0.0.1', res);
  });

  let passCount = 0;
  let failCount = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passCount++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failCount++;
    }
  }

  try {
    // ---------------------------------------------------------
    // TEST 1: New Department Head account & Force Password Change Flow
    // ---------------------------------------------------------
    console.log('\n--- TEST 1: Department Head Force Password Change Flow ---');

    const kunalLogin = await request('POST', '/api/auth/login', {
      mobileOrEmail: 'kunal.kulkarni@nagarsetu.gov.in',
      password: 'kunal@123',
      role: 'department_head'
    });
    assert(kunalLogin.status === 200 && kunalLogin.data.token, 'Kunal Kulkarni initial login succeeds with provisioned kunal@123');
    assert(kunalLogin.data.user && kunalLogin.data.user.must_change_password === true, 'Kunal Kulkarni login response returns must_change_password = true');
    const kunalTempToken = kunalLogin.data.token;

    // Portal business operation attempt blocked by backend guard
    const kunalBlocked = await request('GET', '/api/department/complaints', null, kunalTempToken);
    assert(kunalBlocked.status === 403 && kunalBlocked.data.must_change_password === true, 'Kunal Kulkarni protected portal API access is BLOCKED while must_change_password = true');

    // Change password via /api/auth/change-password
    const kunalChangeRes = await request(
      'POST',
      '/api/auth/change-password',
      { currentPassword: 'kunal@123', newPassword: 'kunal@newpass2026', confirmPassword: 'kunal@newpass2026' },
      kunalTempToken
    );
    assert(kunalChangeRes.status === 200 && kunalChangeRes.data.success, 'Kunal Kulkarni changes password -> SUCCESS');

    // Re-fetch profile via /api/auth/me to verify must_change_password = false
    const kunalNewToken = kunalChangeRes.data.token || kunalTempToken;
    const kunalMe = await request('GET', '/api/auth/me', null, kunalNewToken);
    assert(kunalMe.status === 200 && kunalMe.data.user.must_change_password === false, 'Kunal Kulkarni profile read-back confirms must_change_password = false');

    // Portal business operation attempt now allowed
    const kunalAllowed = await request('GET', '/api/department/complaints', null, kunalNewToken);
    assert(kunalAllowed.status === 200, 'Kunal Kulkarni portal API access is ALLOWED after password change');

    // Old password fails
    const kunalOldFail = await request('POST', '/api/auth/login', {
      mobileOrEmail: 'kunal.kulkarni@nagarsetu.gov.in',
      password: 'kunal@123',
      role: 'department_head'
    });
    assert(kunalOldFail.status === 401, 'Kunal Kulkarni old initial password FAILS');

    // New password succeeds
    const kunalNewSucc = await request('POST', '/api/auth/login', {
      mobileOrEmail: 'kunal.kulkarni@nagarsetu.gov.in',
      password: 'kunal@newpass2026',
      role: 'department_head'
    });
    assert(kunalNewSucc.status === 200 && kunalNewSucc.data.user.must_change_password === false, 'Kunal Kulkarni new password SUCCEEDS and must_change_password remains false');

    // ---------------------------------------------------------
    // TEST 2: New Field Staff account & Force Password Change Flow
    // ---------------------------------------------------------
    console.log('\n--- TEST 2: Field Staff Force Password Change Flow ---');

    const staffLogin = await request('POST', '/api/auth/login', {
      mobileOrEmail: 'staff@nagarsetu.gov.in',
      password: 'staff@123',
      role: 'service_staff'
    });
    assert(staffLogin.status === 200 && staffLogin.data.user.must_change_password === true, 'Field Staff initial login succeeds and indicates must_change_password = true');
    const staffTempToken = staffLogin.data.token;

    // Staff change password
    const staffChange = await request(
      'POST',
      '/api/auth/change-password',
      { currentPassword: 'staff@123', newPassword: 'staff@newpass2026', confirmPassword: 'staff@newpass2026' },
      staffTempToken
    );
    assert(staffChange.status === 200 && staffChange.data.success, 'Field Staff changes password -> SUCCESS');

    // Old staff password fails
    const staffOldFail = await request('POST', '/api/auth/login', {
      mobileOrEmail: 'staff@nagarsetu.gov.in',
      password: 'staff@123',
      role: 'service_staff'
    });
    assert(staffOldFail.status === 401, 'Field Staff old password (staff@123) FAILS');

    // New staff password succeeds with must_change_password = false
    const staffNewSucc = await request('POST', '/api/auth/login', {
      mobileOrEmail: 'staff@nagarsetu.gov.in',
      password: 'staff@newpass2026',
      role: 'service_staff'
    });
    assert(staffNewSucc.status === 200 && staffNewSucc.data.user.must_change_password === false, 'Field Staff new password SUCCEEDS and must_change_password = false');

    // ---------------------------------------------------------
    // TEST 3: Department Head Resets Staff Password (Temporary Reset)
    // ---------------------------------------------------------
    console.log('\n--- TEST 3: DH Resets Staff Password (Temporary Reset) ---');

    // Rahul Kumar (PWD Head) initial login & changes own password first to unlock portal operations
    const rahulInitialLogin = await request('POST', '/api/auth/login', {
      mobileOrEmail: 'rahul.kumar@nagarsetu.gov.in',
      password: 'rahul@123',
      role: 'department_head'
    });
    const rahulChangeSelf = await request(
      'POST',
      '/api/auth/change-password',
      { currentPassword: 'rahul@123', newPassword: 'rahul@dhpass2026', confirmPassword: 'rahul@dhpass2026' },
      rahulInitialLogin.data.token
    );
    const rahulActiveToken = rahulChangeSelf.data.token || rahulInitialLogin.data.token;

    // Rahul Kumar (PWD Head) resets PWD Staff Amit Patil's password
    const staffResetRes = await request(
      'POST',
      `/api/department/staff/PWD-STF-001/change-password`,
      { newPassword: 'temp@pwdstaff123', confirmPassword: 'temp@pwdstaff123' },
      rahulActiveToken
    );
    assert(staffResetRes.status === 200 && staffResetRes.data.success, 'Department Head resets staff password -> SUCCESS');

    // Staff logs in with DH assigned temporary password -> must_change_password = true
    const amitTempLogin = await request('POST', '/api/auth/login', {
      mobileOrEmail: 'amit.patil@nagarsetu.gov.in',
      password: 'temp@pwdstaff123',
      role: 'service_staff'
    });
    assert(amitTempLogin.status === 200 && amitTempLogin.data.user.must_change_password === true, 'Staff login with DH-assigned reset password has must_change_password = true');
    const amitTempToken = amitTempLogin.data.token;

    // Staff is forced to change password to personal choice
    const amitPersonalChange = await request(
      'POST',
      '/api/auth/change-password',
      { currentPassword: 'temp@pwdstaff123', newPassword: 'amit@personal2026', confirmPassword: 'amit@personal2026' },
      amitTempToken
    );
    assert(amitPersonalChange.status === 200 && amitPersonalChange.data.success, 'Staff changes temporary reset password to personal choice -> SUCCESS');

    // Staff personal password login succeeds with must_change_password = false
    const amitPersonalSucc = await request('POST', '/api/auth/login', {
      mobileOrEmail: 'amit.patil@nagarsetu.gov.in',
      password: 'amit@personal2026',
      role: 'service_staff'
    });
    assert(amitPersonalSucc.status === 200 && amitPersonalSucc.data.user.must_change_password === false, 'Staff personal password login SUCCEEDS with must_change_password = false');

    // ---------------------------------------------------------
    // TEST 4: Cross-Department Staff Password Reset Attack
    // ---------------------------------------------------------
    console.log('\n--- TEST 4: Cross-Department Staff Password Reset Attack ---');

    const adityaLogin = await request('POST', '/api/auth/login', {
      mobileOrEmail: 'aditya.joshi@nagarsetu.gov.in',
      password: 'aditya@123',
      role: 'department_head'
    });
    // Aditya changes self password first to get valid active token
    const adityaSelfChange = await request(
      'POST',
      '/api/auth/change-password',
      { currentPassword: 'aditya@123', newPassword: 'aditya@dhpass2026', confirmPassword: 'aditya@dhpass2026' },
      adityaLogin.data.token
    );
    const adityaActiveToken = adityaSelfChange.data.token || adityaLogin.data.token;

    const crossDeptAttack = await request(
      'POST',
      `/api/department/staff/PWD-STF-001/change-password`,
      { newPassword: 'hackedpwd123', confirmPassword: 'hackedpwd123' },
      adityaActiveToken
    );
    assert(crossDeptAttack.status === 403, 'ELE Department Head resetting PWD Staff password -> REJECTED 403');

    // ---------------------------------------------------------
    // TEST 5: Citizen Attempts Staff Reset
    // ---------------------------------------------------------
    console.log('\n--- TEST 5: Citizen Attempts Staff Reset ---');

    const citizenLogin = await request('POST', '/api/auth/login', {
      mobileOrEmail: '8788562103',
      password: '8788562103',
      role: 'citizen'
    });
    const citizenToken = citizenLogin.data.token;

    const citizenAttack = await request(
      'POST',
      `/api/department/staff/PWD-STF-001/change-password`,
      { newPassword: 'hackedpwd123' },
      citizenToken
    );
    assert(citizenAttack.status === 403, 'Citizen attempting staff password reset -> REJECTED 403');

    // ---------------------------------------------------------
    // TEST 6: Field Staff Attempts Another Staff Password Reset
    // ---------------------------------------------------------
    console.log('\n--- TEST 6: Staff Attempts Staff Password Reset ---');

    // Amit Patil (now with changed password) attempts to reset another staff member
    const amitActiveLogin = await request('POST', '/api/auth/login', {
      mobileOrEmail: 'amit.patil@nagarsetu.gov.in',
      password: 'amit@personal2026',
      role: 'service_staff'
    });
    const staffAttack = await request(
      'POST',
      `/api/department/staff/PWD-STF-002/change-password`,
      { newPassword: 'hackedpwd123' },
      amitActiveLogin.data.token
    );
    assert(staffAttack.status === 403, 'Field Staff attempting to reset another staff password -> REJECTED 403');

    // ---------------------------------------------------------
    // TEST 7: Seed Rerun Idempotency & Custom Password Preservation
    // ---------------------------------------------------------
    console.log('\n--- TEST 7: Seed Rerun Idempotency ---');

    delete process.env.FORCE_PASSWORD_RESET;
    await seed7DemoDepartmentHeads(query);
    await seedServiceStaff(query);

    const kunalPostSeed = await request('POST', '/api/auth/login', {
      mobileOrEmail: 'kunal.kulkarni@nagarsetu.gov.in',
      password: 'kunal@newpass2026',
      role: 'department_head'
    });
    assert(kunalPostSeed.status === 200 && kunalPostSeed.data.user.must_change_password === false, 'Kunal Kulkarni customized password & must_change_password=false PRESERVED across seed reruns');

    const amitPostSeed = await request('POST', '/api/auth/login', {
      mobileOrEmail: 'amit.patil@nagarsetu.gov.in',
      password: 'amit@personal2026',
      role: 'service_staff'
    });
    assert(amitPostSeed.status === 200 && amitPostSeed.data.user.must_change_password === false, 'Amit Patil customized password & must_change_password=false PRESERVED across seed reruns');

    // ---------------------------------------------------------
    // TEST 8: Duplicate Account Verification
    // ---------------------------------------------------------
    console.log('\n--- TEST 8: Zero Duplicate Accounts Verification ---');

    const countCheck = await query(`SELECT COUNT(*) as count FROM users WHERE LOWER(email) = 'kunal.kulkarni@nagarsetu.gov.in'`);
    const userCount = parseInt(countCheck.rows[0]?.count || 0, 10);
    assert(userCount === 1, `Kunal Kulkarni account count = ${userCount} (Zero duplicate users created)`);

    // ---------------------------------------------------------
    // TEST 9: Plaintext Credential Exposure Scan
    // ---------------------------------------------------------
    console.log('\n--- TEST 9: Plaintext Credential Exposure Scan ---');

    const apiUserPayloadStr = JSON.stringify(kunalPostSeed.data.user);
    const hasPlaintextInApi = apiUserPayloadStr.includes('kunal@newpass2026') || apiUserPayloadStr.includes('kunal@123') || apiUserPayloadStr.includes('$2');
    assert(!hasPlaintextInApi, 'API user payload contains ZERO passwords or password hashes');

  } catch (err) {
    console.error('Test matrix error:', err);
    failCount++;
  } finally {
    if (server) server.close();
    console.log('\n=======================================================');
    console.log(`  CREDENTIAL MANAGEMENT TEST MATRIX: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('=======================================================');
    process.exit(failCount > 0 ? 1 : 0);
  }
}

runTestMatrix();
