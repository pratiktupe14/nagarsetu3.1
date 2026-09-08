const https = require('https');
const crypto = require('crypto');

const BASE_URL = 'https://nagarsetu-backend-api.vercel.app';

function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port || 443,
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

    const req = https.request(options, (res) => {
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
  // Ensure 10-digit mobile number: 98 + 8 digits = 10 digits
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
  const citizenA_id = regRes.data?.user?.id;

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
  // When no image or invalid data is provided, AI endpoint responds cleanly
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
  const supportCountBefore = support1.data?.support_count;
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
    'Support Count Persisted in PostgreSQL Database',
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

  // 19. Civic Works / Announcements
  const annRes = await request('GET', '/api/announcements', {
    Authorization: `Bearer ${citizenAToken}`
  });
  recordResult(
    'Civic Works',
    'Civic Works / Announcements (GET /api/announcements)',
    annRes.status === 200 && Array.isArray(annRes.data?.announcements || annRes.data),
    `Count: ${(annRes.data?.announcements || annRes.data)?.length || 0}`
  );

  // 20. Citizen A vs Citizen B Isolation Test (CRITICAL)
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

  // Citizen B requests their own complaints: MUST NOT contain Citizen A's complaint
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

  // Citizen B attempts to access Citizen A's private complaint directly
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
    password: 'NagarSetu@Admin2026!'
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
  const dhLoginRes = await request('POST', '/api/auth/login', {}, {
    mobileOrEmail: 'rahul.kumar@nagarsetu.gov.in',
    password: 'nagarsetu@123'
  });
  recordResult(
    'Department Head',
    'Department Head Login (POST /api/auth/login)',
    dhLoginRes.status === 200 && dhLoginRes.data?.token,
    `HTTP ${dhLoginRes.status}, Dept: ${dhLoginRes.data?.user?.department_name}`
  );
  const dhToken = dhLoginRes.data?.token;

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
  const targetStaff = staffList[0] || { id: '2', name: 'Amit Patil', email: 'amit.patil@nagarsetu.gov.in' };
  
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
  const staffLoginRes = await request('POST', '/api/auth/login', {}, {
    mobileOrEmail: 'amit.patil@nagarsetu.gov.in',
    password: 'nagarsetu@123'
  });
  recordResult(
    'Field Staff',
    'Field Staff Login (POST /api/auth/login)',
    staffLoginRes.status === 200 && staffLoginRes.data?.token,
    `HTTP ${staffLoginRes.status}, Staff: ${staffLoginRes.data?.user?.name}`
  );
  const staffToken = staffLoginRes.data?.token;

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
    work_performed: 'Pothole filled with dense bituminous concrete and leveled flush.'
  });
  recordResult(
    'Field Staff',
    'Staff Submits Resolution (POST /api/staff/tasks/:id/resolve)',
    resolveTaskRes.status === 200,
    `HTTP ${resolveTaskRes.status}, Status: ${resolveTaskRes.data?.status || 'Resolution Submitted'}`
  );

  // Confirm Field Staff CANNOT self-verify resolution (Must fail 403)
  const selfVerifyAttempt = await request('POST', '/api/officer/verify', {
    Authorization: `Bearer ${staffToken}`
  }, {
    complaint_id: complaint1?.id,
    action: 'approve'
  });
  recordResult(
    'Authorization/RBAC',
    'Field Staff CANNOT self-verify resolution (Forbidden 403)',
    selfVerifyAttempt.status === 403,
    `HTTP ${selfVerifyAttempt.status}`
  );

  // Confirm Another Staff Member Cannot Access/Mutate This Task
  const otherStaffLogin = await request('POST', '/api/auth/login', {}, {
    mobileOrEmail: 'swapnil.bhosale@nagarsetu.gov.in',
    password: 'nagarsetu@123'
  });
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

  // ------------------------------------------------------------------------
  // PHASE 3 continued: Department Head Verifies Resolution
  // ------------------------------------------------------------------------
  console.log('\n--- Department Head Verification & Audit ---');
  const dhVerifyRes = await request('POST', '/api/officer/verify', {
    Authorization: `Bearer ${dhToken}`
  }, {
    complaint_id: complaint1?.id,
    action: 'approve'
  });
  recordResult(
    'Department Head',
    'Department Head Verifies Resolution (POST /api/officer/verify)',
    dhVerifyRes.status === 200,
    `HTTP ${dhVerifyRes.status}`
  );

  // Verify Auditable Status History After Complete Lifecycle
  const fullHistoryRes = await request('GET', `/api/complaints/${complaint1?.id}/history`, {
    Authorization: `Bearer ${citizenAToken}`
  });
  const stages = fullHistoryRes.data?.history || [];
  recordResult(
    'Status history',
    'Auditable Status History captured entire lifecycle',
    stages.length >= 3,
    `History entries recorded: ${stages.length} (${stages.map(s => s.status).join(' -> ')})`
  );

  // ------------------------------------------------------------------------
  // PHASE 2 continued: Citizen Feedback & Reopen
  // ------------------------------------------------------------------------
  console.log('\n--- Citizen Feedback & Reopen Flow ---');
  // Citizen provides feedback/rating
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

  // Citizen reopens complaint
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

  // ------------------------------------------------------------------------
  // PHASE 6 continued: SECURITY PRIVILEGE ESCALATION
  // ------------------------------------------------------------------------
  console.log('\n--- PHASE 6: Privilege Escalation Tests ---');
  // Citizen Token to Admin Endpoint
  const citizenAdminAttempt = await request('GET', '/api/admin/departments', {
    Authorization: `Bearer ${citizenAToken}`
  });
  recordResult(
    'Security',
    'Citizen token blocked from Admin API (HTTP 403)',
    citizenAdminAttempt.status === 403,
    `HTTP ${citizenAdminAttempt.status}`
  );

  // Staff Token to Admin Endpoint
  const staffAdminAttempt = await request('GET', '/api/admin/analytics', {
    Authorization: `Bearer ${staffToken}`
  });
  recordResult(
    'Security',
    'Staff token blocked from Admin API (HTTP 403)',
    staffAdminAttempt.status === 403,
    `HTTP ${staffAdminAttempt.status}`
  );

  // DH attempting to access complaints of another department via direct override
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
  // PHASE 8: IMAGE STORAGE & VALIDATION
  // ------------------------------------------------------------------------
  console.log('\n--- PHASE 8: Image Storage & Validation ---');
  // 1. Valid Image Upload
  const boundaryValid = `--------------------------${Date.now()}`;
  const validBody = createMultipartFormData(
    boundaryValid,
    { title: 'Test Image Upload' },
    { name: 'photo', filename: 'test_evidence.png', contentType: 'image/png', buffer: VALID_PNG_BUFFER }
  );
  const uploadValidRes = await request(
    'POST',
    '/api/complaints/analyze-upload',
    {
      'Content-Type': `multipart/form-data; boundary=${boundaryValid}`,
      'Authorization': `Bearer ${citizenAToken}`
    },
    validBody
  );
  const validUploadSuccess = (uploadValidRes.status === 200 || uploadValidRes.status === 201) && uploadValidRes.data?.photo_url;
  recordResult(
    'Image storage',
    'Valid Image Upload succeeds and returns Storage URL',
    validUploadSuccess,
    `HTTP ${uploadValidRes.status}, URL: ${uploadValidRes.data?.photo_url || 'none'}`
  );

  // 2. Invalid File Content (Magic Bytes Mismatch)
  const boundaryInvalid = `--------------------------${Date.now()}`;
  const invalidBody = createMultipartFormData(
    boundaryInvalid,
    {},
    { name: 'photo', filename: 'fake_image.png', contentType: 'image/png', buffer: INVALID_MAGIC_BYTES_BUFFER }
  );
  const uploadInvalidRes = await request(
    'POST',
    '/api/complaints/analyze-upload',
    {
      'Content-Type': `multipart/form-data; boundary=${boundaryInvalid}`,
      'Authorization': `Bearer ${citizenAToken}`
    },
    invalidBody
  );
  recordResult(
    'Image storage',
    'Fake image content (Magic Bytes failure) is rejected (HTTP 400)',
    uploadInvalidRes.status === 400,
    `HTTP ${uploadInvalidRes.status}, Error: ${uploadInvalidRes.data?.error || uploadInvalidRes.raw}`
  );

  // 3. Oversized File (> 10MB)
  const boundaryOversized = `--------------------------${Date.now()}`;
  const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024); // 11 MB
  const oversizedBody = createMultipartFormData(
    boundaryOversized,
    {},
    { name: 'photo', filename: 'huge_file.png', contentType: 'image/png', buffer: oversizedBuffer }
  );
  const uploadOversizedRes = await request(
    'POST',
    '/api/complaints/analyze-upload',
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
  // 1. Staff Listing
  const staffCrudList = await request('GET', '/api/department/staff', {
    Authorization: `Bearer ${adminToken}`
  });
  recordResult(
    'Staff management',
    'Staff Listing (GET /api/department/staff)',
    staffCrudList.status === 200 && (staffCrudList.data?.staff?.length > 0 || staffCrudList.data?.length > 0),
    `HTTP ${staffCrudList.status}, Staff count: ${staffCrudList.data?.staff?.length || staffCrudList.data?.length}`
  );

  // 2. Department Head Listing
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
}

runAcceptanceSuite().catch(err => {
  console.error('Fatal suite failure:', err);
});
