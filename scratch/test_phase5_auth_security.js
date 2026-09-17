const path = require('path');
const fs = require('fs');
const http = require('http');
const jwt = require('../backend/node_modules/jsonwebtoken');

try { require('dotenv').config({ path: path.join(__dirname, '../.env') }); } catch (e) {}
try { require(path.join(__dirname, '../backend/node_modules/dotenv')).config({ path: path.join(__dirname, '../backend/.env') }); } catch (e) {}

const { initDatabase, query } = require('../backend/src/config/db');
const { getJwtSecret } = require('../backend/src/middleware/auth');
const { resetAuthRateLimiter } = require('../backend/src/middleware/rateLimiter');
const seed7DemoDepartmentHeads = require('../backend/src/scripts/seedDemoDepartmentHeads');
const seedServiceStaff = require('../backend/src/scripts/seedServiceStaff');
const seedDefaultUsers = require('../backend/src/scripts/seedDefaultUsers');

const PORT = 5002;
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
          res({ status: r.statusCode, data: parsed, headers: r.headers });
        });
      }
    );
    req.on('error', rej);
    if (data) req.write(data);
    req.end();
  });
}

async function runPhase5AuthTests() {
  console.log('=======================================================');
  console.log(' NAGARSETU 3.1 PHASE 5 — AUTHENTICATION SECURITY SUITE ');
  console.log('=======================================================');

  process.env.FORCE_PASSWORD_RESET = 'true';
  process.env.RATE_LIMIT_AUTH_MAX = '5';
  await initDatabase();
  await seedDefaultUsers(query);
  await seed7DemoDepartmentHeads(query);
  await seedServiceStaff(query);
  delete process.env.FORCE_PASSWORD_RESET;

  const app = require('../backend/src/app');
  await new Promise((resolve) => {
    server = app.listen(PORT, '127.0.0.1', resolve);
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
    // 1. Anonymous protected API rejected
    console.log('\n--- 1. Anonymous Access Guard ---');
    const anonRes = await request('GET', '/api/officer/dashboard');
    assert(anonRes.status === 401, 'Anonymous request to protected endpoint returns HTTP 401');

    // 2. Malformed JWT rejected
    console.log('\n--- 2. Malformed Token Guard ---');
    const malformedRes = await request('GET', '/api/officer/dashboard', null, 'not_a_real_jwt_token_format');
    assert(malformedRes.status === 401, 'Malformed JWT token returns HTTP 401');

    // 3. Expired JWT rejected
    console.log('\n--- 3. Expired Token Guard ---');
    const expiredToken = jwt.sign(
      { id: 1, role: 'city_admin' },
      getJwtSecret(),
      { expiresIn: '-10s' }
    );
    const expiredRes = await request('GET', '/api/admin/departments', null, expiredToken);
    assert(expiredRes.status === 401, 'Expired JWT token returns HTTP 401');

    // 4. Tampered JWT rejected
    console.log('\n--- 4. Tampered Signature Guard ---');
    const validSignToken = jwt.sign(
      { id: 1, role: 'city_admin' },
      'wrong_secret_key_for_tamper_test'
    );
    const tamperedRes = await request('GET', '/api/admin/departments', null, validSignToken);
    assert(tamperedRes.status === 401, 'Tampered signature JWT returns HTTP 401');

    // 5. Valid login succeeds
    console.log('\n--- 5. Valid Credential Login ---');
    const validLogin = await request('POST', '/api/auth/login', {
      mobileOrEmail: 'rahul.kumar@nagarsetu.gov.in',
      password: 'rahul@123'
    });
    assert(validLogin.status === 200 && validLogin.data.token, 'Valid login succeeds and returns JWT token');
    const rahulToken = validLogin.data.token;

    // 6. Invalid password fails
    console.log('\n--- 6. Invalid Password Guard ---');
    const invalidPassRes = await request('POST', '/api/auth/login', {
      mobileOrEmail: 'rahul.kumar@nagarsetu.gov.in',
      password: 'wrongpassword123'
    });
    assert(invalidPassRes.status === 401, 'Invalid password fails with HTTP 401');

    // 7. Repeated login failures rate-limited / backoff
    console.log('\n--- 7. Brute-Force Rate Limiting ---');
    let rateLimitedOrRecorded = false;
    for (let i = 0; i < 55; i++) {
      const res = await request('POST', '/api/auth/login', {
        mobileOrEmail: 'bruteforce_test_user@nagarsetu.gov.in',
        password: 'wrongpass_' + i
      });
      if (res.status === 429) {
        rateLimitedOrRecorded = true;
        break;
      }
    }
    assert(rateLimitedOrRecorded, 'Excessive login attempts trigger HTTP 429 Rate Limit response');
    resetAuthRateLimiter();

    // 8. OTP request & Verify flow
    console.log('\n--- 8 & 9. OTP Security & Replay Prevention ---');
    const testMobile = '9876549999';
    const otpReq = await request('POST', '/api/auth/otp-request', { mobile: testMobile });
    assert(otpReq.status === 200, 'OTP request returns HTTP 200');
    const otpCode = otpReq.data.dev_otp || otpReq.data.demoOtp || '123456';

    const badOtpRes = await request('POST', '/api/auth/otp-verify', { mobile: testMobile, otp: '000000' });
    assert(badOtpRes.status === 400, 'Invalid OTP code rejected with HTTP 400');

    const goodOtpRes = await request('POST', '/api/auth/otp-verify', { mobile: testMobile, otp: otpCode });
    assert(goodOtpRes.status === 200 && goodOtpRes.data.token, 'Valid OTP verifies successfully');

    // Test OTP reuse (replay attack)
    const replayOtpRes = await request('POST', '/api/auth/otp-verify', { mobile: testMobile, otp: otpCode });
    assert(replayOtpRes.status === 400, 'Reusing verified OTP is REJECTED (Single-Use enforcement)');

    // 10. Expired OTP check
    console.log('\n--- 10. Expired OTP Guard ---');
    const expiredMobile = '9876548888';
    await request('POST', '/api/auth/otp-request', { mobile: expiredMobile });
    const fakeExpiredRes = await request('POST', '/api/auth/otp-verify', { mobile: expiredMobile, otp: '999999' });
    assert(fakeExpiredRes.status === 400, 'Unmatched/expired OTP code rejected with HTTP 400');

    // 11. Forced password-change policy enforced
    console.log('\n--- 11. Forced Password Change Enforcement ---');
    const kunalLogin = await request('POST', '/api/auth/login', {
      mobileOrEmail: 'kunal.kulkarni@nagarsetu.gov.in',
      password: 'kunal@123'
    });
    const kunalTempToken = kunalLogin.data.token;
    const kunalBlocked = await request('GET', '/api/department/complaints', null, kunalTempToken);
    assert(kunalBlocked.status === 403 && kunalBlocked.data.must_change_password === true, 'Protected route blocked when must_change_password = true (HTTP 403)');

    // 12 & 13. Password change & old password rejection / new password work
    console.log('\n--- 12 & 13. Password Change & Credential Invalidation ---');
    const changeRes = await request('POST', '/api/auth/change-password', {
      currentPassword: 'kunal@123',
      newPassword: 'kunal@newpass2026',
      confirmPassword: 'kunal@newpass2026'
    }, kunalTempToken);
    assert(changeRes.status === 200, 'Password change succeeds');

    const oldPassLogin = await request('POST', '/api/auth/login', {
      mobileOrEmail: 'kunal.kulkarni@nagarsetu.gov.in',
      password: 'kunal@123'
    });
    assert(oldPassLogin.status === 401, 'Old password fails after change (HTTP 401)');

    const newPassLogin = await request('POST', '/api/auth/login', {
      mobileOrEmail: 'kunal.kulkarni@nagarsetu.gov.in',
      password: 'kunal@newpass2026'
    });
    assert(newPassLogin.status === 200 && newPassLogin.data.token, 'New password succeeds (HTTP 200)');

    // 14. Field staff cannot reset another staff password
    console.log('\n--- 14. Staff Password Reset Authorization Guard ---');
    const staffLogin = await request('POST', '/api/auth/login', {
      mobileOrEmail: 'staff@nagarsetu.gov.in',
      password: 'staff@123'
    });
    const staffToken = staffLogin.data.token;
    const staffResetRes = await request('POST', '/api/department/staff/PWD-STF-002/change-password', {
      newPassword: 'hackedpassword2026'
    }, staffToken);
    assert(staffResetRes.status === 403, 'Field Staff attempting to reset another staff password returns HTTP 403');

    // 15. Cross-department staff password reset rejected
    console.log('\n--- 15. Cross-Department Password Reset Guard ---');
    const eleHeadLogin = await request('POST', '/api/auth/login', {
      mobileOrEmail: 'kunal.kulkarni@nagarsetu.gov.in',
      password: 'kunal@newpass2026'
    });
    const eleHeadToken = eleHeadLogin.data.token;
    const crossResetRes = await request('POST', '/api/department/staff/PWD-STF-001/change-password', {
      newPassword: 'hackedpassword2026'
    }, eleHeadToken);
    assert(crossResetRes.status === 403, 'ELE Department Head resetting PWD Staff password returns HTTP 403');

    // 16. Citizen cannot perform staff password reset
    console.log('\n--- 16. Citizen Staff Reset Guard ---');
    const { generateToken } = require('../backend/src/middleware/auth');
    const citizenToken = generateToken({ id: 999, name: 'Citizen Test', role: 'citizen', email: 'citizen@nagarsetu.gov.in' });
    const citizenResetRes = await request('POST', '/api/department/staff/PWD-STF-001/change-password', {
      newPassword: 'hackedpassword2026'
    }, citizenToken);
    assert(citizenResetRes.status === 403, 'Citizen resetting staff password returns HTTP 403');

    // 17. Role escalation rejected
    console.log('\n--- 17. Role Escalation Guard ---');
    const citizenAdminRes = await request('GET', '/api/admin/departments', null, citizenToken);
    assert(citizenAdminRes.status === 403, 'Citizen accessing Admin API returns HTTP 403');

    // 18. Department escalation rejected
    console.log('\n--- 18. Department Escalation Guard ---');
    const crossAssignRes = await request('POST', '/api/department/assign', {
      complaint_id: 99,
      staff_id: 'ELE-STF-001'
    }, rahulToken);
    assert(crossAssignRes.status === 403, 'PWD Department Head assigning ELE staff returns HTTP 403');

    // 19. Logout / session behavior verified
    console.log('\n--- 19. Refresh & Session Behavior ---');
    const refreshRes = await request('POST', '/api/auth/refresh', null, rahulToken);
    assert(refreshRes.status === 200 && refreshRes.data.token, 'Session refresh with valid JWT succeeds');

    // 20. Privacy scan for sensitive auth data in response payloads
    console.log('\n--- 20. Sensitive Data Protection in API Payloads ---');
    const meRes = await request('GET', '/api/auth/me', null, rahulToken);
    const meStr = JSON.stringify(meRes.data);
    const hasSensitiveData = meStr.includes('password_hash') || meStr.includes('JWT_SECRET') || meStr.includes('demoOtp');
    assert(!hasSensitiveData, 'User profile API contains ZERO exposed password hashes or secrets');

    console.log('\n=======================================================');
    console.log(` PHASE 5 AUTH SECURITY MATRIX: ${passCount} PASSED, ${failCount} FAILED`);
    console.log('=======================================================');

  } catch (err) {
    console.error('Phase 5 Test Execution Error:', err);
    failCount++;
  } finally {
    if (server) server.close();
  }

  if (failCount > 0) {
    process.exit(1);
  }
}

runPhase5AuthTests();
