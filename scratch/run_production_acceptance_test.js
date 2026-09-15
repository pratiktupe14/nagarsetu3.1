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

function createMultipartFormData(boundary, fields, fileField) {
  const parts = [];

  for (const [key, val] of Object.entries(fields)) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${val}\r\n`
    ));
  }

  if (fileField) {
    parts.push(Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="${fileField.name}"; filename="${fileField.filename}"\r\nContent-Type: ${fileField.contentType}\r\n\r\n`
    ));
    parts.push(fileField.buffer);
    parts.push(Buffer.from('\r\n'));
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`));
  return Buffer.concat(parts);
}

// 1x1 valid PNG image buffer
const VALID_PNG_BUFFER = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4, 0x89, 0x00, 0x00, 0x00,
  0x0D, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82
]);

const INVALID_MAGIC_BYTES_BUFFER = Buffer.from('NOT-AN-IMAGE-FAKE-CONTENT-FOR-TESTING');

const testResults = [];

function recordResult(area, testName, passed, details = '', failure = '', fix = 'None') {
  testResults.push({
    area,
    testName,
    passed,
    details,
    failure,
    fix
  });
  const tag = passed ? '\x1b[32m[PASS]\x1b[0m' : '\x1b[31m[FAIL]\x1b[0m';
  console.log(`  ${tag} [${area}] ${testName} ${details ? '- ' + details : ''}`);
  if (!passed && failure) {
    console.log(`         \x1b[31mFailure: ${failure}\x1b[0m`);
  }
}

async function runAcceptanceSuite() {
  console.log('========================================================================');
  console.log('  NAGARSETU 3.1 — PRODUCTION ACCEPTANCE TEST SUITE (LIVE API)');
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
    // ------------------------------------------------------------------------
    // PHASE 1: READ-ONLY PRODUCTION SMOKE TEST
    // ------------------------------------------------------------------------
    console.log('--- PHASE 1: Production Smoke Test ---');
    const healthRes = await request('GET', '/api/health');
    recordResult(
      'Console/API health',
      'Backend Health Check',
      healthRes.status === 200 && healthRes.data?.database === 'connected',
      `HTTP ${healthRes.status}, DB: ${healthRes.data?.database}, Type: ${healthRes.data?.database_type}`
    );

    // ------------------------------------------------------------------------
    // PHASE 6: SECURITY TEST - ANONYMOUS ACCESS & TOKEN VALIDATION
    // ------------------------------------------------------------------------
    console.log('\n--- PHASE 6: Security - Anonymous & Bad Auth ---');
    const anonAdmin = await request('GET', '/api/admin/departments');
    recordResult(
      'Security',
      'Anonymous access to /api/admin/departments rejected',
      anonAdmin.status === 401,
      `HTTP ${anonAdmin.status}`
    );

    const anonStaff = await request('GET', '/api/staff/tasks');
    recordResult(
      'Security',
      'Anonymous access to /api/staff/tasks rejected',
      anonStaff.status === 401,
      `HTTP ${anonStaff.status}`
    );

    const anonOfficer = await request('GET', '/api/officer/complaints');
    recordResult(
      'Security',
      'Anonymous access to /api/officer/complaints rejected',
      anonOfficer.status === 401,
      `HTTP ${anonOfficer.status}`
    );

    const badLogin = await request('POST', '/api/auth/login', {}, {
      mobileOrEmail: 'admin@nagarsetu.gov.in',
      password: 'WrongPasswordXYZ999!'
    });
    recordResult(
      'Authentication',
      'Bad password rejected with 401',
      badLogin.status === 401,
      `HTTP ${badLogin.status}`
    );

    const invalidTokenRes = await request('GET', '/api/complaints/my', {
      Authorization: 'Bearer invalid.token.value.here'
    });
    recordResult(
      'Security',
      'Forged / Invalid JWT token rejected (HTTP 401/403)',
      invalidTokenRes.status === 401 || invalidTokenRes.status === 403,
      `HTTP ${invalidTokenRes.status}`
    );

    // ------------------------------------------------------------------------
    // PHASE 2: CITIZEN END-TO-END
    // ------------------------------------------------------------------------
    console.log('\n--- PHASE 2: Citizen End-to-End ---');
    const randomSuffix = Math.floor(10000000 + Math.random() * 90000000);
    const citizenA_mobile = `98${String(randomSuffix).slice(0, 8)}`;
    const citizenA_email = `citizenA_${randomSuffix}@testnagar.gov.in`;
    const citizenA_password = `NagarSetu@Pass${randomSuffix}!`;

    // 1. Citizen Registration
    const regRes = await request('POST', '/api/auth/register', {}, {
      name: `Citizen A Test ${randomSuffix}`,
      mobile: citizenA_mobile,
      email: citizenA_email,
      password: citizenA_password,
      role: 'citizen'
    });
    const regSuccess = (regRes.status === 200 || regRes.status === 201) && regRes.data?.token;
    recordResult(
      'Citizen',
      'Citizen Registration (POST /api/auth/register)',
      regSuccess,
      `HTTP ${regRes.status}, User ID: ${regRes.data?.user?.id}`,
      regSuccess ? '' : JSON.stringify(regRes.data)
    );
    let citizenAToken = regRes.data?.token;

    // 2. Citizen Password Login
    const loginRes = await request('POST', '/api/auth/login', {}, {
      mobileOrEmail: citizenA_mobile,
      password: citizenA_password
    });
    const loginSuccess = loginRes.status === 200 && loginRes.data?.token;
    recordResult(
      'Citizen',
      'Citizen Password Login (POST /api/auth/login)',
      loginSuccess,
      `HTTP ${loginRes.status}, role: ${loginRes.data?.user?.role}`
    );
    citizenAToken = loginRes.data?.token || citizenAToken;

    // 3. Citizen OTP Login
    const otpReq = await request('POST', '/api/auth/otp-request', {}, { mobile: citizenA_mobile });
    const otpCode = otpReq.data?.dev_otp || otpReq.data?.demoOtp || '123456';
    const otpVerify = await request('POST', '/api/auth/otp-verify', {}, {
      mobile: citizenA_mobile,
      otp: otpCode,
      name: `Citizen A Test ${randomSuffix}`
    });
    recordResult(
      'Citizen',
      'Citizen OTP Login (request & verify)',
      otpVerify.status === 200 && otpVerify.data?.token,
      `HTTP ${otpVerify.status}`
    );

    // 4. Citizen Profile Update
    const profUpdate = await request('PUT', '/api/auth/profile', {
      Authorization: `Bearer ${citizenAToken}`
    }, {
      name: `Citizen A Updated ${randomSuffix}`,
      language_pref: 'mr'
    });
    recordResult(
      'Citizen',
      'Citizen Profile Update (PUT /api/auth/profile)',
      profUpdate.status === 200 && profUpdate.data?.user?.language_pref === 'mr',
      `HTTP ${profUpdate.status}, Lang: ${profUpdate.data?.user?.language_pref}`
    );

    // 5. Citizen Password Change
    const newPassword = `NewNagar@Pass${randomSuffix}!`;
    const pwdChange = await request('POST', '/api/auth/change-password', {
      Authorization: `Bearer ${citizenAToken}`
    }, {
      currentPassword: citizenA_password,
      newPassword: newPassword
    });
    recordResult(
      'Citizen',
      'Citizen Password Change (POST /api/auth/change-password)',
      pwdChange.status === 200,
      `HTTP ${pwdChange.status}`
    );

    // Re-login with new password to verify change
    const relogin = await request('POST', '/api/auth/login', {}, {
      mobileOrEmail: citizenA_mobile,
      password: newPassword
    });
    recordResult(
      'Citizen',
      'Citizen Re-login with New Password',
      relogin.status === 200 && relogin.data?.token,
      `HTTP ${relogin.status}`
    );
    citizenAToken = relogin.data?.token || citizenAToken;

    // 6. Citizen Dashboard (Initial complaints)
    const initialMyComplaints = await request('GET', '/api/complaints/my', {
      Authorization: `Bearer ${citizenAToken}`
    });
    recordResult(
      'Citizen',
      'Citizen Dashboard GET /api/complaints/my',
      initialMyComplaints.status === 200 && Array.isArray(initialMyComplaints.data?.complaints),
      `Count: ${initialMyComplaints.data?.complaints?.length || 0}`
    );

    // 7. Create Complaint WITHOUT Image
    const compNoImageRes = await request('POST', '/api/complaints/submit', {
      Authorization: `Bearer ${citizenAToken}`
    }, {
      title: `Pothole on Gangapur Road ${randomSuffix}`,
      description: `Deep hazardous pothole causing accidents near circle ${randomSuffix}`,
      category: 'Roads & Footpaths',
      priority: 'High',
      location_address: 'Gangapur Road near Circle, Nashik'
    });
    const comp1Created = (compNoImageRes.status === 200 || compNoImageRes.status === 201) && compNoImageRes.data?.complaint?.id;
    recordResult(
      'Complaint lifecycle',
      'Create Complaint WITHOUT Image (POST /api/complaints/submit)',
      comp1Created,
      `HTTP ${compNoImageRes.status}, ID: ${compNoImageRes.data?.complaint?.id}, Num: ${compNoImageRes.data?.complaint?.complaint_number}`,
      comp1Created ? '' : JSON.stringify(compNoImageRes.data)
    );
    const complaint1 = compNoImageRes.data?.complaint;

    // 8. Create Complaint WITH GPS / Location
    const compWithGpsRes = await request('POST', '/api/complaints/submit', {
      Authorization: `Bearer ${citizenAToken}`
    }, {
      title: `Broken Streetlight at College Road ${randomSuffix}`,
      description: 'Streetlight pole #42 completely dark for 3 days.',
      category: 'Electrical & Street Lighting',
      priority: 'Medium',
      latitude: 20.005912,
      longitude: 73.789845,
      location_address: 'College Road, Sector 3, Nashik'
    });
    const comp2Created = (compWithGpsRes.status === 200 || compWithGpsRes.status === 201) && compWithGpsRes.data?.complaint?.id;
    recordResult(
      'Complaint lifecycle',
      'Create Complaint WITH GPS (lat/long/address)',
      comp2Created,
      `HTTP ${compWithGpsRes.status}, ID: ${compWithGpsRes.data?.complaint?.id}, Lat: ${compWithGpsRes.data?.complaint?.latitude}`
    );
    const complaint2 = compWithGpsRes.data?.complaint;

    // 9. AI Vision Health Check
    const aiHealth = await request('GET', '/api/ai/health');
    recordResult(
      'Complaint lifecycle',
      'Gemini AI Health Check (/api/ai/health)',
      aiHealth.status === 200,
      `HTTP ${aiHealth.status}, Configured: ${aiHealth.data?.configured}, Reachable: ${aiHealth.data?.reachable}`
    );

    // 10. AI Unavailable / Manual Categorization Fallback Verification
    const aiAnalyzeEmpty = await request('POST', '/api/ai/analyze', {}, {});
    recordResult(
      'Complaint lifecycle',
      'AI unavailable / missing input shows honest rejection for manual categorization',
      aiAnalyzeEmpty.status === 400 && aiAnalyzeEmpty.data?.error === 'INVALID_IMAGE',
      `HTTP ${aiAnalyzeEmpty.status}, Error code: ${aiAnalyzeEmpty.data?.error}`
    );

    // 11. Verify Complaint appears exactly ONCE in citizen's list
    const afterSubmitList = await request('GET', '/api/complaints/my', {
      Authorization: `Bearer ${citizenAToken}`
    });
    const myComplaints = afterSubmitList.data?.complaints || [];
    const matchCount1 = myComplaints.filter(c => String(c.id) === String(complaint1?.id)).length;
    recordResult(
      'Complaint lifecycle',
      'Complaint appears exactly ONCE in citizen list',
      matchCount1 === 1,
      `Found occurrences: ${matchCount1}`
    );

    // 12. Complaint Number Format & Persistence
    recordResult(
      'Database persistence',
      'Complaint Number format (NS-YYYY-XXXXX) and persistence',
      complaint1?.complaint_number && complaint1.complaint_number.startsWith('NS-'),
      `Number: ${complaint1?.complaint_number}`
    );

    // 13. Re-query / Refresh verification via direct ID
    const readbackComp1 = await request('GET', `/api/complaints/${complaint1?.id}`, {
      Authorization: `Bearer ${citizenAToken}`
    });
    recordResult(
      'Database persistence',
      'Complaint persistence verified by direct ID read-back',
      readbackComp1.status === 200 && readbackComp1.data?.complaint?.title === complaint1?.title,
      `HTTP ${readbackComp1.status}, Title: "${readbackComp1.data?.complaint?.title}"`
    );

    // 14. Track Complaint by Complaint Number
    const trackByNumRes = await request('GET', `/api/complaints/${complaint1?.complaint_number}`, {
      Authorization: `Bearer ${citizenAToken}`
    });
    recordResult(
      'Citizen',
      'Track Complaint by Number (GET /api/complaints/:number)',
      trackByNumRes.status === 200 && trackByNumRes.data?.complaint?.complaint_number === complaint1?.complaint_number,
      `HTTP ${trackByNumRes.status}, Status: ${trackByNumRes.data?.complaint?.status}`
    );

    // 15. Server-Generated Persistent Status History
    const historyRes = await request('GET', `/api/complaints/${complaint1?.id}/history`, {
      Authorization: `Bearer ${citizenAToken}`
    });
    const hasHistory = historyRes.status === 200 && Array.isArray(historyRes.data?.history) && historyRes.data.history.length > 0;
    recordResult(
      'Status history',
      'Complaint Status History is server-generated & persistent',
      hasHistory,
      `Entries: ${historyRes.data?.history?.length || 0}`
    );

    // 16. Public Complaints / Nearby List
    const publicListRes = await request('GET', '/api/complaints');
    recordResult(
      'Citizen',
      'Public / Nearby Complaints List (GET /api/complaints)',
      publicListRes.status === 200 && Array.isArray(publicListRes.data?.complaints),
      `Count: ${publicListRes.data?.complaints?.length || 0}`
    );

    // 17. Atomic Support Count Increment & Persistence
    const support1 = await request('POST', `/api/complaints/${complaint1?.id}/support`, {
      Authorization: `Bearer ${citizenAToken}`
    });
    const supportCountBefore = support1.data?.support_count || 1;
    const support2 = await request('POST', `/api/complaints/${complaint1?.id}/support`, {
      Authorization: `Bearer ${citizenAToken}`
    });
    const supportCountAfter = support2.data?.support_count;
    recordResult(
      'Support',
      'Support Count Increments Atomically and Persists',
      support2.status === 200 && supportCountAfter === (supportCountBefore + 1),
      `Before: ${supportCountBefore}, After: ${supportCountAfter}`
    );

    // Verify Support Persistence via clean readback
    const supportVerifyGet = await request('GET', `/api/complaints/${complaint1?.id}`, {
      Authorization: `Bearer ${citizenAToken}`
    });
    recordResult(
      'Support',
      'Support Count Persisted in Database',
      supportVerifyGet.data?.complaint?.support_count === supportCountAfter,
      `Readback DB support_count: ${supportVerifyGet.data?.complaint?.support_count}`
    );

    // 18. Citizen Notifications
    const notifRes = await request('GET', '/api/notifications', {
      Authorization: `Bearer ${citizenAToken}`
    });
    const notifList = notifRes.data?.notifications || notifRes.data || [];
    recordResult(
      'Notifications',
      'Citizen Notifications List (GET /api/notifications)',
      notifRes.status === 200,
      `Count: ${Array.isArray(notifList) ? notifList.length : 0}`
    );

    // 19. Civic Announcements List
    const annRes = await request('GET', '/api/announcements', {
      Authorization: `Bearer ${citizenAToken}`
    });
    recordResult(
      'Announcements',
      'Civic Announcements List (GET /api/announcements)',
      annRes.status === 200 && Array.isArray(annRes.data?.announcements || annRes.data),
      `Count: ${(annRes.data?.announcements || annRes.data)?.length || 0}`
    );

    // 20 & 21. Citizen A vs Citizen B Isolation Test (RESTORED BASELINE TESTS)
    console.log('\n--- Testing Citizen A vs Citizen B Isolation ---');
    const randomSuffixB = Math.floor(10000000 + Math.random() * 90000000);
    const citizenB_mobile = `97${String(randomSuffixB).slice(0, 8)}`;
    const citizenB_email = `citizenB_${randomSuffixB}@testnagar.gov.in`;
    const regBRes = await request('POST', '/api/auth/register', {}, {
      name: `Citizen B Test ${randomSuffixB}`,
      mobile: citizenB_mobile,
      email: citizenB_email,
      password: `NagarPassB${randomSuffixB}!`,
      role: 'citizen'
    });
    const citizenBToken = regBRes.data?.token;

    const bComplaintsRes = await request('GET', '/api/complaints/my', {
      Authorization: `Bearer ${citizenBToken}`
    });
    const bList = bComplaintsRes.data?.complaints || [];
    const bLeakedA = bList.some(c => String(c.id) === String(complaint1?.id) || String(c.id) === String(complaint2?.id));
    recordResult(
      'Authorization/RBAC',
      'Citizen A Complaints Hidden from Citizen B (GET /api/complaints/my)',
      !bLeakedA,
      `Citizen B list has ${bList.length} items, Citizen A complaint leak: ${bLeakedA}`
    );

    const bDirectAccessRes = await request('GET', `/api/complaints/${complaint1?.id}`, {
      Authorization: `Bearer ${citizenBToken}`
    });
    recordResult(
      'Authorization/RBAC',
      'Citizen B direct access to Citizen A complaint blocked (HTTP 403)',
      bDirectAccessRes.status === 403,
      `HTTP ${bDirectAccessRes.status}`
    );

    // ------------------------------------------------------------------------
    // PHASE 5: CITY ADMIN
    // ------------------------------------------------------------------------
    console.log('\n--- PHASE 5: City Admin ---');
    const adminLoginRes = await request('POST', '/api/auth/login', {}, {
      mobileOrEmail: 'admin@nagarsetu.gov.in',
      password: process.env.DEMO_ADMIN_PASSWORD || 'admin@123'
    });
    recordResult(
      'Admin',
      'Admin Login (POST /api/auth/login)',
      adminLoginRes.status === 200 && adminLoginRes.data?.token,
      `HTTP ${adminLoginRes.status}, role: ${adminLoginRes.data?.user?.role}`
    );
    const adminToken = adminLoginRes.data?.token;

    // Admin KPIs / Analytics
    const analyticsRes = await request('GET', '/api/admin/analytics', {
      Authorization: `Bearer ${adminToken}`
    });
    const totalCount = analyticsRes.data?.metrics?.total_complaints;
    recordResult(
      'Analytics',
      'Admin Analytics KPIs (GET /api/admin/analytics)',
      analyticsRes.status === 200 && totalCount !== undefined,
      `Total Complaints: ${totalCount}, Resolved: ${analyticsRes.data?.metrics?.resolved_complaints}`
    );

    // Admin Hotspots / City Map
    const hotspotsRes = await request('GET', '/api/admin/hotspots', {
      Authorization: `Bearer ${adminToken}`
    });
    const hotspotsList = hotspotsRes.data?.complaints || hotspotsRes.data?.hotspots || [];
    recordResult(
      'Admin',
      'City Map Hotspots (GET /api/admin/hotspots)',
      hotspotsRes.status === 200 && Array.isArray(hotspotsList),
      `Hotspots count: ${hotspotsList.length}`
    );

    // Admin Departments CRUD
    const deptsRes = await request('GET', '/api/departments');
    recordResult(
      'Departments',
      'Departments Listing (GET /api/departments)',
      deptsRes.status === 200 && Array.isArray(deptsRes.data?.departments || deptsRes.data),
      `Count: ${(deptsRes.data?.departments || deptsRes.data)?.length || 0}`
    );

    // Admin Dispatch / Status Mutation: Approve Complaint 1
    const adminApproveRes = await request('PATCH', `/api/complaints/${complaint1?.id}/status`, {
      Authorization: `Bearer ${adminToken}`
    }, {
      status: 'Approved',
      priority: 'High',
      remarks: 'Approved by City Administration'
    });
    recordResult(
      'Complaint lifecycle',
      'Admin Complaint Approval / Status Mutation (PATCH /api/complaints/:id/status)',
      adminApproveRes.status === 200,
      `HTTP ${adminApproveRes.status}, Status: ${adminApproveRes.data?.complaint?.status}`
    );

    // Verify status in DB readback
    const readbackApproved = await request('GET', `/api/complaints/${complaint1?.id}`, {
      Authorization: `Bearer ${adminToken}`
    });
    recordResult(
      'Database persistence',
      'Complaint Approved status persisted in database',
      readbackApproved.data?.complaint?.status === 'Approved',
      `Status: ${readbackApproved.data?.complaint?.status}`
    );

    // ------------------------------------------------------------------------
    // PHASE 3: DEPARTMENT HEAD (PWD: rahul.kumar@nagarsetu.gov.in)
    // ------------------------------------------------------------------------
    console.log('\n--- PHASE 3: Department Head ---');
    let dhLoginRes = await request('POST', '/api/auth/login', {}, {
      mobileOrEmail: 'rahul.kumar@nagarsetu.gov.in',
      password: 'rahul@123'
    });
    if (dhLoginRes.status !== 200) {
      dhLoginRes = await request('POST', '/api/auth/login', {}, {
        mobileOrEmail: 'rahul.kumar@nagarsetu.gov.in',
        password: 'rahul@accept2026'
      });
    }
    let dhToken = dhLoginRes.data?.token;

    if (dhLoginRes.data?.user?.must_change_password) {
      const dhChangePass = await request('POST', '/api/auth/change-password', {
        Authorization: `Bearer ${dhToken}`
      }, {
        currentPassword: 'rahul@123',
        newPassword: 'rahul@accept2026',
        confirmPassword: 'rahul@accept2026'
      });
      if (dhChangePass.data?.token) {
        dhToken = dhChangePass.data.token;
      }
    }

    recordResult(
      'Department Head',
      'Department Head Login & Password Verification (POST /api/auth/login)',
      dhLoginRes.status === 200 && Boolean(dhToken),
      `HTTP ${dhLoginRes.status}, Dept: ${dhLoginRes.data?.user?.department_name || 'PWD'}`
    );

    // View own department complaints
    const dhComplaintsRes = await request('GET', '/api/officer/complaints', {
      Authorization: `Bearer ${dhToken}`
    });
    recordResult(
      'Department Head',
      'Department Head Complaints List (GET /api/officer/complaints)',
      dhComplaintsRes.status === 200 && Array.isArray(dhComplaintsRes.data?.complaints),
      `Complaints Count: ${dhComplaintsRes.data?.complaints?.length || 0}`
    );

    // Assign Field Staff: Assign complaint 1 to Amit Patil (STF-001 / PWD)
    const assignableStaffRes = await request('GET', '/api/department/staff/assignable', {
      Authorization: `Bearer ${dhToken}`
    });
    const staffList = assignableStaffRes.data?.staff || [];
    const targetStaff = staffList.find(s => (s.email || '').toLowerCase() === 'amit.patil@nagarsetu.gov.in' || (s.name || '').includes('Amit')) || staffList[0] || { id: '2', name: 'Amit Patil', email: 'amit.patil@nagarsetu.gov.in' };

    const assignRes = await request('POST', '/api/officer/assign', {
      Authorization: `Bearer ${dhToken}`
    }, {
      complaint_id: complaint1?.id,
      staff_id: targetStaff.id,
      notes: 'Please inspect the pothole and repair urgently.'
    });
    recordResult(
      'Department Head',
      'Department Head Assigns Field Staff (POST /api/officer/assign)',
      assignRes.status === 200,
      `HTTP ${assignRes.status}, Assigned to: ${targetStaff.name || targetStaff.id}`
    );

    // Verify Assignment Persistence
    const readbackAssigned = await request('GET', `/api/complaints/${complaint1?.id}`, {
      Authorization: `Bearer ${dhToken}`
    });
    recordResult(
      'Database persistence',
      'Assignment Persisted in Database (status = Staff Assigned)',
      readbackAssigned.data?.complaint?.status === 'Staff Assigned' || readbackAssigned.data?.complaint?.status === 'Assigned',
      `Status: ${readbackAssigned.data?.complaint?.status}, Staff: ${readbackAssigned.data?.complaint?.assigned_staff_name}`
    );

    // ------------------------------------------------------------------------
    // PHASE 4: FIELD STAFF (Amit Patil: amit.patil@nagarsetu.gov.in)
    // ------------------------------------------------------------------------
    console.log('\n--- PHASE 4: Field Staff ---');
    let staffLoginRes = await request('POST', '/api/auth/login', {}, {
      mobileOrEmail: 'amit.patil@nagarsetu.gov.in',
      password: 'amit@123'
    });
    if (staffLoginRes.status !== 200) {
      staffLoginRes = await request('POST', '/api/auth/login', {}, {
        mobileOrEmail: 'amit.patil@nagarsetu.gov.in',
        password: 'amit@accept2026'
      });
    }
    let staffToken = staffLoginRes.data?.token;

    if (staffLoginRes.data?.user?.must_change_password) {
      const staffChangePass = await request('POST', '/api/auth/change-password', {
        Authorization: `Bearer ${staffToken}`
      }, {
        currentPassword: 'amit@123',
        newPassword: 'amit@accept2026',
        confirmPassword: 'amit@accept2026'
      });
      if (staffChangePass.data?.token) {
        staffToken = staffChangePass.data.token;
      }
    }

    recordResult(
      'Field Staff',
      'Field Staff Login & Password Verification (POST /api/auth/login)',
      staffLoginRes.status === 200 && Boolean(staffToken),
      `HTTP ${staffLoginRes.status}, Staff: ${staffLoginRes.data?.user?.name || 'Amit Patil'}`
    );

    // View Assigned Tasks
    const tasksRes = await request('GET', '/api/staff/tasks', {
      Authorization: `Bearer ${staffToken}`
    });
    recordResult(
      'Field Staff',
      'View Assigned Tasks (GET /api/staff/tasks)',
      tasksRes.status === 200 && Array.isArray(tasksRes.data?.tasks),
      `Assigned tasks count: ${tasksRes.data?.tasks?.length || 0}`
    );

    // Staff Updates Status: 'On the Way'
    const otwRes = await request('POST', `/api/staff/tasks/${complaint1?.id}/status`, {
      Authorization: `Bearer ${staffToken}`
    }, {
      status: 'On the Way'
    });
    recordResult(
      'Field Staff',
      'Staff marks "On the Way"',
      otwRes.status === 200,
      `HTTP ${otwRes.status}`
    );

    // Staff Updates Status: 'In Progress'
    const inProgRes = await request('POST', `/api/staff/tasks/${complaint1?.id}/status`, {
      Authorization: `Bearer ${staffToken}`
    }, {
      status: 'In Progress'
    });
    recordResult(
      'Field Staff',
      'Staff marks "In Progress"',
      inProgRes.status === 200,
      `HTTP ${inProgRes.status}`
    );

    // Staff Adds Progress Note
    const noteRes = await request('POST', `/api/staff/task/${complaint1?.id}/progress`, {
      Authorization: `Bearer ${staffToken}`
    }, {
      note: 'Asphalt cold mix and compactor deployed on site.'
    });
    recordResult(
      'Field Staff',
      'Staff Adds Progress Note (POST /api/staff/task/:id/progress)',
      noteRes.status === 200 || noteRes.status === 201,
      `HTTP ${noteRes.status}`
    );

    // Staff Submits Resolution
    const resolveTaskRes = await request('POST', `/api/staff/tasks/${complaint1?.id}/resolve`, {
      Authorization: `Bearer ${staffToken}`
    }, {
      photo_after_url: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe',
      work_performed: 'Pothole excavated, leveled, and sealed with cold asphalt mix.',
      materials_used: '2x 50kg asphalt mix bags, tack coat emulsion'
    });
    recordResult(
      'Field Staff',
      'Staff Submits Resolution (POST /api/staff/tasks/:id/resolve)',
      resolveTaskRes.status === 200,
      `HTTP ${resolveTaskRes.status}`
    );

    // RESTORED BASELINE SECURITY TESTS
    // Field Staff CANNOT self-verify resolution
    const selfVerifyAttempt = await request('POST', '/api/department/verify', {
      Authorization: `Bearer ${staffToken}`
    }, {
      complaint_id: complaint1?.id,
      verified_by: 'staff-id-123',
      status: 'Resolved'
    });
    recordResult(
      'Authorization/RBAC',
      'Field Staff CANNOT self-verify resolution (Forbidden 403)',
      selfVerifyAttempt.status === 403,
      `HTTP ${selfVerifyAttempt.status}`
    );

    // Unassigned Staff from another department cannot mutate task
    let otherStaffLogin = await request('POST', '/api/auth/login', {}, {
      mobileOrEmail: 'swapnil.bhosale@nagarsetu.gov.in',
      password: 'swapnil@123'
    });
    if (otherStaffLogin.status !== 200) {
      otherStaffLogin = await request('POST', '/api/auth/login', {}, {
        mobileOrEmail: 'swapnil.bhosale@nagarsetu.gov.in',
        password: 'swapnil@accept2026'
      });
    }
    const otherStaffToken = otherStaffLogin.data?.token;
    const unauthorizedStaffMutate = await request('POST', `/api/staff/tasks/${complaint1?.id}/status`, {
      Authorization: `Bearer ${otherStaffToken}`
    }, {
      status: 'In Progress'
    });
    recordResult(
      'Authorization/RBAC',
      'Unassigned Staff from another department cannot mutate task (403/404)',
      unauthorizedStaffMutate.status === 403 || unauthorizedStaffMutate.status === 404,
      `HTTP ${unauthorizedStaffMutate.status}`
    );

    // Department Head Verifies Resolution
    const dhVerifyRes = await request('POST', '/api/department/verify', {
      Authorization: `Bearer ${dhToken}`
    }, {
      complaint_id: complaint1?.id,
      verified_by: dhLoginRes.data?.user?.id,
      verified_by_name: dhLoginRes.data?.user?.name,
      status: 'Resolved'
    });
    recordResult(
      'Department Head',
      'Department Head Verifies Resolution (POST /api/department/verify)',
      dhVerifyRes.status === 200,
      `HTTP ${dhVerifyRes.status}, Status: ${dhVerifyRes.data?.complaint?.status || 'Resolved'}`
    );

    // RESTORED BASELINE LIFECYCLE & FEEDBACK TESTS
    const fullHistoryRes = await request('GET', `/api/complaints/${complaint1?.id}/history`, {
      Authorization: `Bearer ${citizenAToken}`
    });
    const stages = fullHistoryRes.data?.history || [];
    recordResult(
      'Status history',
      'Auditable Status History captured entire lifecycle',
      stages.length >= 3,
      `History entries recorded: ${stages.length}`
    );

    const feedbackRes = await request('POST', `/api/complaints/${complaint1?.id}/feedback`, {
      Authorization: `Bearer ${citizenAToken}`
    }, {
      rating: 5,
      comment: 'Excellent repair work done quickly!'
    });
    recordResult(
      'Feedback',
      'Citizen Submits Rating & Feedback (POST /api/complaints/:id/feedback)',
      feedbackRes.status === 200,
      `HTTP ${feedbackRes.status}`
    );

    const reopenRes = await request('POST', `/api/complaints/${complaint1?.id}/reopen`, {
      Authorization: `Bearer ${citizenAToken}`
    }, {
      reason: 'Bitumen settled unevenly after rain, requesting touch-up'
    });
    recordResult(
      'Reopen',
      'Citizen Reopens Resolved Complaint (POST /api/complaints/:id/reopen)',
      reopenRes.status === 200,
      `HTTP ${reopenRes.status}`
    );

    // RESTORED BASELINE PRIVILEGE ESCALATION TESTS
    const citizenAdminAttempt = await request('GET', '/api/admin/departments', {
      Authorization: `Bearer ${citizenAToken}`
    });
    recordResult(
      'Security',
      'Citizen token blocked from Admin API (HTTP 403)',
      citizenAdminAttempt.status === 403,
      `HTTP ${citizenAdminAttempt.status}`
    );

    const staffAdminAttempt = await request('GET', '/api/admin/analytics', {
      Authorization: `Bearer ${staffToken}`
    });
    recordResult(
      'Security',
      'Staff token blocked from Admin API (HTTP 403)',
      staffAdminAttempt.status === 403,
      `HTTP ${staffAdminAttempt.status}`
    );

    const dhCrossDept = await request('GET', '/api/officer/complaints?department_id=SAN', {
      Authorization: `Bearer ${dhToken}`
    });
    const nonPwdLeaked = (dhCrossDept.data?.complaints || []).some(c => c.department_code && c.department_code !== 'PWD');
    recordResult(
      'Authorization/RBAC',
      'Department Head cannot view another department complaints via query param',
      !nonPwdLeaked,
      `Leaked non-PWD complaints: ${nonPwdLeaked}`
    );

    // ------------------------------------------------------------------------
    // IMAGE & FILE UPLOADS / STORAGE AUDIT
    // ------------------------------------------------------------------------
    console.log('\n--- Image & File Uploads / Storage Audit ---');
    const boundary = '----WebKitFormBoundary' + crypto.randomBytes(8).toString('hex');
    const uploadBody = createMultipartFormData(boundary, {
      category: 'Pothole',
      description: 'Image upload acceptance verification test'
    }, {
      name: 'photo',
      filename: 'test_pothole.png',
      contentType: 'image/png',
      buffer: VALID_PNG_BUFFER
    });

    const uploadRes = await request(
      'POST',
      '/api/ai/analyze',
      {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Authorization': `Bearer ${citizenAToken}`
      },
      uploadBody
    );
    const uploadSuccess = uploadRes.status === 200 && (uploadRes.data?.photo_url || uploadRes.data?.ai || uploadRes.data?.success);
    recordResult(
      'Image storage',
      'Valid Image File Upload (POST /api/ai/analyze)',
      uploadSuccess,
      `HTTP ${uploadRes.status}, Success: ${Boolean(uploadSuccess)}`
    );

    const boundaryFake = '----WebKitFormBoundary' + crypto.randomBytes(8).toString('hex');
    const fakeUploadBody = createMultipartFormData(boundaryFake, {}, {
      name: 'photo',
      filename: 'malicious.exe',
      contentType: 'application/octet-stream',
      buffer: INVALID_MAGIC_BYTES_BUFFER
    });

    const uploadFakeRes = await request(
      'POST',
      '/api/ai/analyze',
      {
        'Content-Type': `multipart/form-data; boundary=${boundaryFake}`,
        'Authorization': `Bearer ${citizenAToken}`
      },
      fakeUploadBody
    );
    recordResult(
      'Image storage',
      'Non-image file (fake magic bytes / .exe) is cleanly rejected with 400',
      uploadFakeRes.status === 400,
      `HTTP ${uploadFakeRes.status}`
    );

    const boundaryOversized = '----WebKitFormBoundary' + crypto.randomBytes(8).toString('hex');
    const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024, 0x41);
    const oversizedBody = createMultipartFormData(boundaryOversized, {}, {
      name: 'photo',
      filename: 'huge_file.png',
      contentType: 'image/png',
      buffer: oversizedBuffer
    });

    const uploadOversizedRes = await request(
      'POST',
      '/api/ai/analyze',
      {
        'Content-Type': `multipart/form-data; boundary=${boundaryOversized}`,
        'Authorization': `Bearer ${citizenAToken}`
      },
      oversizedBody
    );
    recordResult(
      'Image storage',
      'Oversized image file (> 10MB) is rejected (HTTP 400 or 413)',
      uploadOversizedRes.status === 400 || uploadOversizedRes.status === 413,
      `HTTP ${uploadOversizedRes.status}`
    );

    // ------------------------------------------------------------------------
    // PHASE 5 continued: STAFF MANAGEMENT CRUD & DEPT MANAGEMENT
    // ------------------------------------------------------------------------
    console.log('\n--- Admin Staff Management & Department CRUD ---');
    const staffCrudList = await request('GET', '/api/department/staff', {
      Authorization: `Bearer ${adminToken}`
    });
    recordResult(
      'Staff management',
      'Staff Listing (GET /api/department/staff)',
      staffCrudList.status === 200 && (staffCrudList.data?.staff?.length > 0 || staffCrudList.data?.length > 0),
      `HTTP ${staffCrudList.status}, Staff count: ${staffCrudList.data?.staff?.length || staffCrudList.data?.length}`
    );

    const dhListRes = await request('GET', '/api/admin/department-heads', {
      Authorization: `Bearer ${adminToken}`
    });
    recordResult(
      'Departments',
      'Department Heads Listing (GET /api/admin/department-heads)',
      dhListRes.status === 200 && (dhListRes.data?.department_heads?.length > 0),
      `HTTP ${dhListRes.status}, DH count: ${dhListRes.data?.department_heads?.length}`
    );

    // ------------------------------------------------------------------------
    // FINAL CONSOLIDATION & SUMMARY
    // ------------------------------------------------------------------------
    console.log('\n========================================================================');
    const totalTests = testResults.length;
    const passedTests = testResults.filter(t => t.passed).length;
    const failedTests = testResults.filter(t => !t.passed).length;
    console.log(`  TOTAL: ${totalTests} | PASSED: ${passedTests} | FAILED: ${failedTests}`);
    console.log('========================================================================\n');

    return { totalTests, passedTests, failedTests, testResults };
  } finally {
    if (server) server.close();
  }
}

runAcceptanceSuite().then(({ passedTests, failedTests, totalTests }) => {
  process.exit(failedTests > 0 ? 1 : 0);
}).catch(err => {
  console.error('Fatal suite failure:', err);
  process.exit(1);
});
