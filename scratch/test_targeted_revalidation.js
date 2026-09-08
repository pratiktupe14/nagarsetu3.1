const http = require('http');
const app = require('../backend/src/app');
const { query } = require('../backend/src/config/db');

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

async function runTests() {
  console.log('================================================================');
  console.log('  NAGARSETU 3.1 — COMPREHENSIVE REVALIDATION & SECURITY SUITE');
  console.log('================================================================\n');

  const { server, port } = await startServer();
  let passed = 0;
  let failed = 0;

  function assert(condition, name, details = '') {
    if (condition) {
      console.log(`  [PASS] ${name}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${name} ${details}`);
      failed++;
    }
  }

  try {
    // 1. ANONYMOUS ESCALATION TEST
    console.log('\n--- 1. Testing Anonymous Route Protection ---');
    const anonAdmin = await request(port, 'GET', '/api/admin/departments');
    assert(anonAdmin.status === 401, 'Anonymous cannot access /api/admin/departments', `(HTTP ${anonAdmin.status})`);

    const anonTasks = await request(port, 'GET', '/api/staff/tasks');
    assert(anonTasks.status === 401, 'Anonymous cannot access /api/staff/tasks', `(HTTP ${anonTasks.status})`);

    // 2. INCORRECT CREDENTIALS REJECTION
    console.log('\n--- 2. Testing Bad Password & Arbitrary Takeover Rejection ---');
    const badLogin = await request(port, 'POST', '/api/auth/login', {}, {
      mobileOrEmail: 'admin@nagarsetu.gov.in',
      password: 'completelyWrongPassword!'
    });
    assert(badLogin.status === 401, 'Wrong password rejected on admin account', `(HTTP ${badLogin.status})`);

    const arbitraryTakeover = await request(port, 'POST', '/api/auth/login', {}, {
      mobileOrEmail: 'rahul.kumar@nagarsetu.gov.in',
      password: 'attackerChosenArbitraryPassword123'
    });
    assert(arbitraryTakeover.status === 401, 'Arbitrary first-login takeover rejected on Department Head', `(HTTP ${arbitraryTakeover.status})`);

    // 3. ADMIN AUTHENTICATION & JWT CLAIMS
    console.log('\n--- 3. Testing Valid Admin Authentication ---');
    const adminLogin = await request(port, 'POST', '/api/auth/login', {}, {
      mobileOrEmail: 'admin@nagarsetu.gov.in',
      password: process.env.DEMO_ADMIN_PASSWORD || 'NagarSetu@Admin2026!'
    });
    assert(adminLogin.status === 200 && adminLogin.data.token, 'Admin login succeeded with JWT token');
    const adminToken = adminLogin.data.token;

    // 4. CITIZEN OTP WORKFLOW
    console.log('\n--- 4. Testing Real Citizen OTP Authentication ---');
    const otpReq = await request(port, 'POST', '/api/auth/otp-request', {}, {
      mobile: '9876543210'
    });
    assert(otpReq.status === 200, 'Citizen OTP requested successfully');
    const otpCode = otpReq.data.dev_otp || '123456';

    const badOtp = await request(port, 'POST', '/api/auth/otp-verify', {}, {
      mobile: '9876543210',
      otp: '000000'
    });
    assert(badOtp.status === 400 || badOtp.status === 401, 'Invalid OTP code rejected', `(HTTP ${badOtp.status})`);

    const goodOtp = await request(port, 'POST', '/api/auth/otp-verify', {}, {
      mobile: '9876543210',
      otp: otpCode,
      name: 'Rohan Patil'
    });
    assert(goodOtp.status === 200 && goodOtp.data.token, 'Valid OTP verifies and issues citizen JWT');
    const citizenToken = goodOtp.data.token;

    // 5. ROLE PRIVILEGE SEPARATION
    console.log('\n--- 5. Testing Role Privilege Separation ---');
    const citizenAdminAccess = await request(port, 'GET', '/api/admin/departments', {
      Authorization: `Bearer ${citizenToken}`
    });
    assert(citizenAdminAccess.status === 403, 'Citizen token blocked from admin endpoints (HTTP 403)');

    const adminDeptAccess = await request(port, 'GET', '/api/admin/departments', {
      Authorization: `Bearer ${adminToken}`
    });
    assert(adminDeptAccess.status === 200, 'Admin token successfully accesses /api/admin/departments');

    // 6. SINGLE-WRITER COMPLAINT SUBMISSION
    console.log('\n--- 6. Testing Single Authoritative Complaint Submission ---');
    const complaintPayload = {
      title: 'Broken Stormwater Manhole Cover',
      description: 'Severe safety hazard on Gangapur Road near circle.',
      category: 'Drainage & Stormwater',
      priority: 'High',
      latitude: 20.0059,
      longitude: 73.7898,
      location_address: 'Gangapur Road, Nashik'
    };

    const submitRes = await request(port, 'POST', '/api/complaints/submit', {
      Authorization: `Bearer ${citizenToken}`
    }, complaintPayload);
    assert((submitRes.status === 200 || submitRes.status === 201) && submitRes.data.complaint, 'Complaint created successfully via single Express POST route (HTTP 201)');
    const createdComplaint = submitRes.data.complaint;
    const complaintId = createdComplaint.id;

    // 7. STATUS MUTATION VIA PATCH /:id/status
    console.log('\n--- 7. Testing Admin Status Mutation (PATCH /:id/status) ---');
    const statusUpdateRes = await request(port, 'PATCH', `/api/complaints/${complaintId}/status`, {
      Authorization: `Bearer ${adminToken}`
    }, {
      status: 'Approved',
      priority: 'Critical',
      remarks: 'Verified by City Admin Officer and approved for dispatch.'
    });
    assert(statusUpdateRes.status === 200, 'Admin updated status to Approved via PATCH');

    // Read back directly from database
    const dbReadback = await query('SELECT status, priority, support_count FROM complaints WHERE id = ?', [complaintId]);
    assert(
      dbReadback.rows && dbReadback.rows[0]?.status === 'Approved' && dbReadback.rows[0]?.priority === 'Critical',
      'Database verified: status is "Approved" and priority is "Critical"'
    );

    // 8. CITIZEN ATOMIC SUPPORT INCREMENT
    console.log('\n--- 8. Testing Citizen Atomic Support Upvote (POST /:id/support) ---');
    const supportRes1 = await request(port, 'POST', `/api/complaints/${complaintId}/support`, {
      Authorization: `Bearer ${citizenToken}`
    });
    assert(supportRes1.status === 200 && supportRes1.data.support_count >= 1, `Atomic support incremented to ${supportRes1.data.support_count}`);

    const supportRes2 = await request(port, 'POST', `/api/complaints/${complaintId}/support`, {
      Authorization: `Bearer ${citizenToken}`
    });
    assert(supportRes2.status === 200 && supportRes2.data.support_count === supportRes1.data.support_count + 1, `Second support incremented atomically to ${supportRes2.data.support_count}`);

    // 9. AUDITABLE STATUS HISTORY RECORDING
    console.log('\n--- 9. Testing Auditable Status History ---');
    const historyRes = await query('SELECT * FROM complaint_status_history WHERE complaint_id = ?', [complaintId]);
    assert(historyRes.rows && historyRes.rows.length > 0, `Status history audit log entry exists in database (${historyRes.rows?.length || 0} entries)`);

    console.log('\n================================================================');
    console.log(`  TEST RESULTS: ${passed} PASSED | ${failed} FAILED`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('Fatal test error:', err);
    failed++;
  } finally {
    server.close();
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
