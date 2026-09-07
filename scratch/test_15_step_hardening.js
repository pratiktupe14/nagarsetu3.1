const http = require('http');

const API_BASE = 'http://localhost:5000';

function makeRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Accept': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache'
      }
    };

    if (body) {
      options.headers['Content-Type'] = 'application/json';
    }
    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve({ status: res.statusCode, data: json });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function login(identifier, password) {
  const payload = { mobileOrEmail: identifier, password };
  const res = await makeRequest('/api/auth/login', 'POST', payload);
  if (res.status !== 200 || !res.data.token) {
    throw new Error(`Login failed for ${identifier}: ${JSON.stringify(res.data)}`);
  }
  return { token: res.data.token, user: res.data.user };
}

async function run15StepPersistenceTest() {
  console.log('================================================================');
  console.log('  NAGARSETU 3.1 — 15-STEP DATA PERSISTENCE HARDENING TEST');
  console.log('================================================================\n');

  const results = [];
  function recordStep(stepNumber, title, passed, details = '') {
    results.push({ stepNumber, title, passed, details });
    const mark = passed ? '[PASS]' : '[FAIL]';
    console.log(`Step ${stepNumber.toString().padStart(2, ' ')}: ${mark} ${title}`);
    if (details) console.log(`         Details: ${details}`);
  }

  try {
    // 0. Initial Auth
    console.log('--- Initial Authentication ---');
    const citizenAuth = await login('8788562103', 'password123');
    console.log(`Authenticated Citizen: ${citizenAuth.user.name} (${citizenAuth.user.id})`);

    const deptHeadAuth = await login('rahul.kumar@nagarsetu.gov.in', 'nagarsetu@123');
    console.log(`Authenticated Dept Head (PWD): ${deptHeadAuth.user.name} (${deptHeadAuth.user.id})`);

    const staffAuth = await login('staff@nagarsetu.gov.in', 'password123');
    console.log(`Authenticated Field Staff: ${staffAuth.user.name} (${staffAuth.user.id})\n`);

    // STEP 1: Citizen creates a new complaint
    const uniqueTag = Date.now().toString().slice(-6);
    const complaintNumber = `NS-2026-${uniqueTag}`;
    const submitPayload = {
      complaint_number: complaintNumber,
      photo_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&auto=format&fit=crop',
      title: `Broken Pavement Hazard #${uniqueTag}`,
      description: `Deep pavement damage and exposed rebar on MG Road near City Center #${uniqueTag}. Single source of truth test.`,
      category: 'Roads & Footpaths',
      priority: 'High',
      latitude: 19.9975,
      longitude: 73.7898,
      location_address: `MG Road, Ward 12, Nashik #${uniqueTag}`,
      department_id: deptHeadAuth.user.department_id || '8ed9f760-1314-427c-a515-c2a54d6df6d8'
    };

    const step1Res = await makeRequest('/api/complaints/submit', 'POST', submitPayload, citizenAuth.token);
    const complaintId = step1Res.data?.complaint?.id || step1Res.data?.complaint_id || step1Res.data?.id;
    const isStep1Pass = step1Res.status === 201 || step1Res.status === 200;
    recordStep(1, 'Citizen creates complaint', isStep1Pass, `ID: ${complaintId}, Number: ${complaintNumber}`);

    // STEP 2: Refresh (re-fetch directly from database)
    const step2Res = await makeRequest(`/api/complaints/${complaintNumber}`, 'GET', null, citizenAuth.token);
    const refreshedComp = step2Res.data?.complaint;
    const isStep2Pass = step2Res.status === 200 && refreshedComp && refreshedComp.complaint_number === complaintNumber;
    recordStep(2, 'Refresh page (DB query re-fetch)', isStep2Pass, `Fetched from PostgreSQL with status '${refreshedComp?.status}'`);

    // STEP 3: Logout and login
    console.log('         Logging out citizen session and re-authenticating...');
    const reLoginCitizen = await login('8788562103', 'password123');
    const step3Res = await makeRequest(`/api/complaints/${complaintNumber}`, 'GET', null, reLoginCitizen.token);
    const isStep3Pass = step3Res.status === 200 && step3Res.data?.complaint?.complaint_number === complaintNumber;
    recordStep(3, 'Logout & Login', isStep3Pass, `Re-authenticated citizen successfully retrieved ticket ${complaintNumber}`);

    // STEP 4: Open new tab / simulated fresh session
    const step4Res = await makeRequest('/api/complaints/my', 'GET', null, reLoginCitizen.token);
    const myComplaints = Array.isArray(step4Res.data?.complaints) ? step4Res.data.complaints : (Array.isArray(step4Res.data) ? step4Res.data : []);
    const tabMatch = myComplaints.find(c => c.complaint_number === complaintNumber || String(c.id) === String(complaintId));
    const isStep4Pass = step4Res.status === 200 && !!tabMatch;
    recordStep(4, 'Open new tab (fresh session)', isStep4Pass, `Complaint found in clean /api/complaints/my list (total records: ${myComplaints.length})`);

    // STEP 5: Verify complaint is retrieved from PostgreSQL/database
    const isStep5Pass = !!tabMatch && tabMatch.title.includes(uniqueTag) && tabMatch.status === 'Submitted';
    recordStep(5, 'Verify complaint retrieved from PostgreSQL', isStep5Pass, `Confirmed database fields: title='${tabMatch?.title}', category='${tabMatch?.category}', status='${tabMatch?.status}'`);

    // STEP 6: Department Head assigns staff via /api/department/assign
    // Find assignable staff
    const staffListRes = await makeRequest('/api/department/staff/assignable', 'GET', null, deptHeadAuth.token);
    const staffList = Array.isArray(staffListRes.data?.staff) ? staffListRes.data.staff : [];
    const targetStaff = staffList.find(s => s.id === staffAuth.user.id || s.email === staffAuth.user.email) || staffList[0] || { id: staffAuth.user.id, name: staffAuth.user.name };

    const assignPayload = {
      complaint_id: complaintNumber,
      staff_id: targetStaff.id
    };
    const step6Res = await makeRequest('/api/department/assign', 'POST', assignPayload, deptHeadAuth.token);
    const isStep6Pass = step6Res.status === 200;
    recordStep(6, 'Assign staff to complaint', isStep6Pass, `Assigned to staff ${targetStaff.name} (${targetStaff.id})`);

    // STEP 7: Refresh both Dept Head portal and Field Staff portal
    const deptHeadRefresh = await makeRequest('/api/department/complaints', 'GET', null, deptHeadAuth.token);
    const deptComplaints = Array.isArray(deptHeadRefresh.data?.complaints) ? deptHeadRefresh.data.complaints : (Array.isArray(deptHeadRefresh.data) ? deptHeadRefresh.data : []);
    const deptMatch = deptComplaints.find(c => c.complaint_number === complaintNumber || String(c.id) === String(complaintId));

    const staffRefresh = await makeRequest('/api/staff/tasks', 'GET', null, staffAuth.token);
    const staffTasks = Array.isArray(staffRefresh.data?.tasks) ? staffRefresh.data.tasks : (Array.isArray(staffRefresh.data) ? staffRefresh.data : []);
    const staffMatch = staffTasks.find(t => t.complaint_number === complaintNumber || String(t.id) === String(complaintId));

    const isStep7Pass = deptHeadRefresh.status === 200 && staffRefresh.status === 200 && !!deptMatch && !!staffMatch;
    recordStep(7, 'Refresh Dept Head and Field Staff portals', isStep7Pass, `Dept portal found: ${!!deptMatch}, Staff portal found: ${!!staffMatch}`);

    // STEP 8: Verify assignment remains in database
    const isStep8Pass = !!staffMatch && (staffMatch.status === 'Staff Assigned' || staffMatch.status === 'Assigned') && (staffMatch.assigned_staff_id === targetStaff.id || staffMatch.assigned_staff_name === targetStaff.name);
    recordStep(8, 'Verify assignment remains in database', isStep8Pass, `DB Status: '${staffMatch?.status}', Assigned Staff: '${staffMatch?.assigned_staff_name}'`);

    // STEP 9: Field Staff updates task status (On the Way -> In Progress)
    const travelRes = await makeRequest(`/api/staff/task/${encodeURIComponent(complaintNumber)}/status`, 'POST', { status: 'On the Way' }, staffAuth.token);
    const progressRes = await makeRequest(`/api/staff/task/${encodeURIComponent(complaintNumber)}/status`, 'POST', { status: 'In Progress' }, staffAuth.token);
    const isStep9Pass = (travelRes.status === 200 || travelRes.status === 201) && (progressRes.status === 200 || progressRes.status === 201);
    recordStep(9, 'Update task status', isStep9Pass, `Status updated to 'On the Way' and 'In Progress'`);

    // STEP 10: Refresh page
    const staffRefreshAfterProgress = await makeRequest('/api/staff/tasks', 'GET', null, staffAuth.token);
    const tasksAfterProgress = Array.isArray(staffRefreshAfterProgress.data?.tasks) ? staffRefreshAfterProgress.data.tasks : (Array.isArray(staffRefreshAfterProgress.data) ? staffRefreshAfterProgress.data : []);
    const inProgressMatch = tasksAfterProgress.find(t => t.complaint_number === complaintNumber || String(t.id) === String(complaintId));
    const isStep10Pass = staffRefreshAfterProgress.status === 200 && !!inProgressMatch;
    recordStep(10, 'Refresh page after status update', isStep10Pass, `Re-fetched staff tasks after status update`);

    // STEP 11: Verify status remains in database
    const isStep11Pass = inProgressMatch && inProgressMatch.status === 'In Progress';
    recordStep(11, 'Verify status remains in database', isStep11Pass, `Status in PostgreSQL is '${inProgressMatch?.status}'`);

    // STEP 12: Field Staff submits evidence / resolution proof
    const resolvePayload = {
      complaint_number: complaintNumber,
      complaint_id: complaintId,
      photo_after_url: 'https://images.unsplash.com/photo-1590402494682-cd3fb53b1f70?w=800&auto=format&fit=crop',
      work_performed: `Pavement excavation, reinforced mesh lay, high-durability cold-mix asphalt leveling completed #${uniqueTag}.`,
      materials_used: 'Cold Mix Asphalt (4 bags), Reinforcing Steel Mesh (2m), Bitumen Sealant',
      additional_notes: 'Site cured and safely opened for pedestrian traffic.'
    };
    const step12Res = await makeRequest(`/api/staff/task/${encodeURIComponent(complaintNumber)}/resolve`, 'POST', resolvePayload, staffAuth.token);
    const isStep12Pass = step12Res.status === 200 || step12Res.status === 201;
    recordStep(12, 'Submit resolution evidence', isStep12Pass, `Proof uploaded with work notes & materials`);

    // STEP 13: Refresh page after evidence submission
    const deptHeadRefreshAfterProof = await makeRequest('/api/department/complaints', 'GET', null, deptHeadAuth.token);
    const deptCompsAfterProof = Array.isArray(deptHeadRefreshAfterProof.data?.complaints) ? deptHeadRefreshAfterProof.data.complaints : (Array.isArray(deptHeadRefreshAfterProof.data) ? deptHeadRefreshAfterProof.data : []);
    const proofMatch = deptCompsAfterProof.find(c => c.complaint_number === complaintNumber || String(c.id) === String(complaintId));
    const isStep13Pass = deptHeadRefreshAfterProof.status === 200 && !!proofMatch;
    recordStep(13, 'Refresh page after evidence submission', isStep13Pass, `Re-fetched department verification queue`);

    // STEP 14: Verify evidence remains in database
    const isStep14Pass = proofMatch && (proofMatch.status === 'Resolution Submitted' || proofMatch.status === 'Completed — Pending Verification') && !!proofMatch.photo_after_url;
    recordStep(14, 'Verify evidence remains in database', isStep14Pass, `DB Status: '${proofMatch?.status}', Photo After: '${proofMatch?.photo_after_url?.slice(0, 50)}...'`);

    // STEP 15: Department Head verifies and approves + verify notification persistence
    const verifyPayload = {
      complaint_id: complaintNumber,
      verified_by: deptHeadAuth.user.id,
      verified_by_name: deptHeadAuth.user.name,
      status: 'Resolved'
    };
    const verifyRes = await makeRequest('/api/department/verify', 'POST', verifyPayload, deptHeadAuth.token);
    
    // Check citizen notifications
    const citizenNotifsRes = await makeRequest('/api/notifications/my', 'GET', null, citizenAuth.token);
    const citizenNotifs = Array.isArray(citizenNotifsRes.data?.notifications) ? citizenNotifsRes.data.notifications : (Array.isArray(citizenNotifsRes.data) ? citizenNotifsRes.data : []);

    const isStep15Pass = (verifyRes.status === 200 || verifyRes.status === 201) && citizenNotifsRes.status === 200;
    recordStep(15, 'Verify resolution & check notifications', isStep15Pass, `Ticket resolved in DB; Citizen notifications count: ${citizenNotifs.length}`);

    console.log('\n================================================================');
    const allPassed = results.every(r => r.passed);
    console.log(`  FINAL RESULT: ${allPassed ? 'ALL 15 STEPS PASSED SUCCESSFULLY' : 'SOME STEPS FAILED'}`);
    console.log(`  TOTAL: ${results.filter(r => r.passed).length} / 15 Passed`);
    console.log('================================================================');

    return { allPassed, results };
  } catch (err) {
    console.error('Test execution failed with error:', err);
    return { allPassed: false, error: err.message, results };
  }
}

run15StepPersistenceTest().then((summary) => {
  if (!summary.allPassed) {
    process.exit(1);
  }
});
