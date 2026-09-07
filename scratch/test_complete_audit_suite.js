const http = require('http');

const BASE_URL = 'http://localhost:5000';

async function req(path, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {})
  });

  const contentType = res.headers.get('content-type') || '';
  let data;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else {
    data = await res.text();
  }
  return { status: res.status, data };
}

async function runSuite() {
  console.log('===============================================================');
  console.log('  NAGARSETU 3.1 — COMPLETE PRODUCTION READINESS AUDIT SUITE    ');
  console.log('===============================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`  ✓ [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${message}`);
    }
  }

  // --- 1. HEALTH CHECK ---
  console.log('1. Verifying API Health & Configuration...');
  const healthRes = await req('/api/health');
  assert(healthRes.status === 200, 'Backend Health Endpoint returns HTTP 200');
  assert(healthRes.data?.status === 'ok' && healthRes.data?.database === 'connected', 'Database connection reported as connected');

  // --- 2. CITIZEN AUTH, PROFILE UPDATE & PERSISTENCE ---
  console.log('\n2. Verifying Citizen Authentication & Profile Persistence...');
  const citLogin = await req('/api/auth/login', 'POST', {
    mobileOrEmail: '8788562103',
    password: '8788562103'
  });
  assert(citLogin.status === 200 && citLogin.data?.token, 'Citizen logged in successfully');
  const citToken = citLogin.data.token;

  const originalName = citLogin.data.user.name;
  const testName = 'Priya Sharma Audit Verified';

  const updateProfileRes = await req('/api/auth/profile', 'PUT', {
    name: testName,
    language_pref: 'mr'
  }, citToken);
  assert(updateProfileRes.status === 200, 'PUT /api/auth/profile returns HTTP 200');
  assert(updateProfileRes.data.user?.name === testName, 'Updated name verified in response');

  // Read-back verification via /api/auth/me
  const meRes = await req('/api/auth/me', 'GET', null, citToken);
  assert(meRes.status === 200 && meRes.data.user?.name === testName, 'Read-back via /api/auth/me confirms name persistence');
  assert(meRes.data.user?.language_pref === 'mr', 'Language preference persisted to database');

  // Revert name back
  await req('/api/auth/profile', 'PUT', { name: originalName, language_pref: 'en' }, citToken);

  // --- 3. PASSWORD CHANGE & SECURITY VERIFICATION ---
  console.log('\n3. Verifying Real Password Change & Bcrypt Validation...');
  // Wrong old password rejection
  const wrongPassRes = await req('/api/auth/change-password', 'POST', {
    currentPassword: 'WrongPassword@999',
    newPassword: 'newPassword123'
  }, citToken);
  assert(wrongPassRes.status === 401, 'Incorrect old password correctly rejected with HTTP 401');

  // Valid password change
  const changePassRes = await req('/api/auth/change-password', 'POST', {
    currentPassword: '8788562103',
    newPassword: 'password123_temp'
  }, citToken);
  assert(changePassRes.status === 200, 'Password changed successfully with HTTP 200');

  // Login with old password rejected
  const oldLoginRes = await req('/api/auth/login', 'POST', {
    mobileOrEmail: '8788562103',
    password: '8788562103'
  });
  assert(oldLoginRes.status === 401, 'Login with old password rejected with HTTP 401');

  // Login with new password accepted
  const newLoginRes = await req('/api/auth/login', 'POST', {
    mobileOrEmail: '8788562103',
    password: 'password123_temp'
  });
  assert(newLoginRes.status === 200 && newLoginRes.data?.token, 'Login with new password succeeds with HTTP 200');

  // Revert password back
  await req('/api/auth/change-password', 'POST', {
    currentPassword: 'password123_temp',
    newPassword: '8788562103'
  }, newLoginRes.data.token);

  // --- 4. ADMIN LOGIN & DEPARTMENT CRUD WITH ACTIVE COMPLAINT GUARD ---
  console.log('\n4. Verifying Admin Department CRUD & Active Complaint Safety...');
  const adminLogin = await req('/api/auth/login', 'POST', {
    mobileOrEmail: 'admin@nagarsetu.gov.in',
    password: 'NagarSetu@Admin2026!'
  });
  assert(adminLogin.status === 200 && adminLogin.data?.token, 'Admin login succeeded');
  const adminToken = adminLogin.data.token;

  // Create department
  const createDeptRes = await req('/api/admin/departments', 'POST', {
    name: 'Disaster Emergency Response',
    code: 'EMG',
    description: 'Civic crisis and emergency response coordination'
  }, adminToken);
  assert(createDeptRes.status === 201 && createDeptRes.data.department?.id, 'POST /api/admin/departments created department with HTTP 201');
  const newDeptId = createDeptRes.data.department?.id;

  // Read back departments list
  const listDeptRes = await req('/api/admin/departments', 'GET', null, adminToken);
  const foundDept = (listDeptRes.data.departments || []).find(d => String(d.id) === String(newDeptId));
  assert(!!foundDept, 'Read-back verified created department in database');

  // Update department
  const updateDeptRes = await req(`/api/admin/departments/${newDeptId}`, 'PUT', {
    name: 'Disaster Management & Emergency Response',
    code: 'EMG',
    description: 'Updated disaster response division'
  }, adminToken);
  assert(updateDeptRes.status === 200 && updateDeptRes.data.department?.name.includes('Disaster Management'), 'PUT /api/admin/departments/:id updated department with HTTP 200');

  // Delete department (empty department -> should succeed)
  const deleteDeptRes = await req(`/api/admin/departments/${newDeptId}`, 'DELETE', null, adminToken);
  assert(deleteDeptRes.status === 200, 'DELETE /api/admin/departments/:id succeeded for clean department');

  // Attempt delete on department 1 (has active complaints -> should reject)
  const rejectDeleteRes = await req('/api/admin/departments/1', 'DELETE', null, adminToken);
  assert(rejectDeleteRes.status === 400 && rejectDeleteRes.data?.error?.includes('active complaint'), 'DELETE rejected on department with active complaints (Safety Guard Active)');

  // --- 5. FIELD STAFF PROGRESS NOTES PERSISTENCE ---
  console.log('\n5. Verifying Field Staff Progress Notes & Status Update...');
  const staffLogin = await req('/api/auth/login', 'POST', {
    mobileOrEmail: 'staff@nagarsetu.gov.in',
    password: 'nagarsetu@123'
  });
  assert(staffLogin.status === 200 && staffLogin.data?.token, 'Field staff login succeeded');
  const staffToken = staffLogin.data.token;

  // Fetch staff tasks
  const staffTasksRes = await req('/api/staff/tasks', 'GET', null, staffToken);
  assert(staffTasksRes.status === 200, 'GET /api/staff/tasks returned assigned tasks');
  const taskId = staffTasksRes.data.tasks?.[0]?.id || 100;

  // Add Progress Note
  const progressRes = await req(`/api/staff/task/${taskId}/progress`, 'POST', {
    note: 'Field team arrived on site. Heavy machinery positioned for pipe excavation.'
  }, staffToken);
  assert(progressRes.status === 201, 'POST /api/staff/task/:id/progress inserted note with HTTP 201');

  // Verify note in history
  const historyRes = await req(`/api/complaints/${taskId}/history`, 'GET', null, staffToken);
  const noteFound = (historyRes.data.history || []).some(h => h.remark && h.remark.includes('Heavy machinery'));
  assert(noteFound, 'Read-back from complaint_status_history confirmed progress note persisted');

  // --- 6. DEPARTMENT HEAD RESOLUTION REVIEW & CITIZEN REOPEN ---
  console.log('\n6. Verifying Department Head Resolution & Citizen Reopen Flow...');
  const dhLogin = await req('/api/auth/login', 'POST', {
    mobileOrEmail: 'rahul.kumar@nagarsetu.gov.in',
    password: 'password123'
  });
  assert(dhLogin.status === 200 && dhLogin.data?.token, 'PWD Department Head logged in');
  const dhToken = dhLogin.data.token;

  // DH verify resolution
  const verifyRes = await req('/api/department/verify', 'POST', {
    complaint_id: taskId,
    status: 'Resolved',
    verified_by_name: 'Rahul Kumar'
  }, dhToken);
  assert(verifyRes.status === 200 && verifyRes.data.complaint?.status === 'Resolved', 'POST /api/department/verify marked complaint as Resolved');

  // Citizen reopens complaint
  const reopenRes = await req(`/api/complaints/${taskId}/reopen`, 'POST', {
    reason: 'Water flow pressure remains low after valve replacement.'
  }, citToken);
  assert(reopenRes.status === 200, 'POST /api/complaints/:id/reopen successfully reopened complaint');

  // Read-back verification of reopen
  const compDetailRes = await req(`/api/complaints/${taskId}`, 'GET', null, dhToken);
  assert(compDetailRes.data.complaint?.status === 'Reopened', 'Read-back verified complaint status is Reopened');

  // --- 7. SECURITY & IDOR ISOLATION ---
  console.log('\n7. Verifying Security & Role Isolation...');
  // Citizen B cannot view Citizen A's non-public details
  const citBLogin = await req('/api/auth/register', 'POST', {
    name: 'Rohan Test Citizen',
    mobile: '9898989898',
    email: 'rohan.test@example.com',
    password: 'password123'
  });
  let citBToken = citBLogin.data?.token;
  if (!citBToken) {
    const citBLoginRetry = await req('/api/auth/login', 'POST', {
      mobileOrEmail: '9898989898',
      password: 'password123'
    });
    citBToken = citBLoginRetry.data?.token;
  }

  // Cross-citizen reopen attempt (Citizen B trying to reopen Citizen A's complaint)
  if (citBToken) {
    const crossReopen = await req(`/api/complaints/${taskId}/reopen`, 'POST', {
      reason: 'Malicious cross-user attempt'
    }, citBToken);
    assert(crossReopen.status === 403, 'IDOR Protection: Citizen B forbidden (HTTP 403) from reopening Citizen A complaint');
  }

  console.log('\n===============================================================');
  console.log(`  FINAL RESULT: ${passed} / ${total} TESTS PASSED (${Math.round((passed/total)*100)}%)`);
  console.log('===============================================================');
}

runSuite().catch(console.error);
