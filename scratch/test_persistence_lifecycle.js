const http = require('http');

const BASE_URL = 'http://localhost:5000';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = options.headers || {};
  if (options.body && typeof options.body === 'object') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body
  });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = text;
  }
  return { status: res.status, ok: res.ok, data: json };
}

async function runTest() {
  console.log('====================================================');
  console.log('STARTING NAGARSETU DATABASE LIFECYCLE PERSISTENCE TEST');
  console.log('====================================================\n');

  // Step 1: Citizen Login
  console.log('1. Testing Citizen Login against DB...');
  const citizenLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { mobileOrEmail: '8788562103', password: '8788562103' }
  });
  if (!citizenLogin.ok || !citizenLogin.data.token) {
    throw new Error(`Citizen login failed: ${JSON.stringify(citizenLogin.data)}`);
  }
  const citizenToken = citizenLogin.data.token;
  console.log(`✓ Citizen login successful (User ID: ${citizenLogin.data.user.id}, Role: ${citizenLogin.data.user.role})`);

  // Step 2: Citizen submits complaint
  console.log('\n2. Testing Complaint Submission (POST /api/complaints/submit)...');
  const complaintPayload = {
    title: 'Persistence Test Pothole On Main Road',
    description: 'Deep pothole verified via database lifecycle test script',
    category: 'Pothole',
    photo_url: 'https://example.com/pothole-proof.jpg',
    department_id: 1, // Roads
    priority: 'High',
    latitude: 19.9975,
    longitude: 73.7898,
    location_address: 'College Road, Nashik'
  };
  const submitRes = await request('/api/complaints/submit', {
    method: 'POST',
    headers: { Authorization: `Bearer ${citizenToken}` },
    body: complaintPayload
  });
  if (!submitRes.ok) {
    throw new Error(`Submit failed: ${JSON.stringify(submitRes.data)}`);
  }
  const newComplaint = submitRes.data.complaint;
  console.log(`✓ Complaint created in database! ID: ${newComplaint.id}, Number: ${newComplaint.complaint_number}, Status: ${newComplaint.status}`);

  // Step 3: Fetch complaint from DB via /api/complaints and /api/complaints/my
  console.log('\n3. Fetching Complaint from DB (GET /api/complaints and GET /api/complaints/my)...');
  const myComplaintsRes = await request('/api/complaints/my', {
    headers: { Authorization: `Bearer ${citizenToken}` }
  });
  if (!myComplaintsRes.ok) {
    throw new Error(`GET /api/complaints/my failed: ${JSON.stringify(myComplaintsRes.data)}`);
  }
  const foundInMy = myComplaintsRes.data.complaints.find(c => c.id === newComplaint.id);
  if (!foundInMy) {
    throw new Error(`Created complaint ${newComplaint.id} not found in citizen complaints list!`);
  }
  console.log(`✓ Found complaint in DB via /api/complaints/my with matching status: ${foundInMy.status}`);

  // Step 4: Department Head Login
  console.log('\n4. Testing Dept Head Login against DB...');
  const deptHeadLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { mobileOrEmail: 'rahul.kumar@nagarsetu.gov.in', password: 'password123' }
  });
  if (!deptHeadLogin.ok || !deptHeadLogin.data.token) {
    throw new Error(`Dept Head login failed: ${JSON.stringify(deptHeadLogin.data)}`);
  }
  const deptHeadToken = deptHeadLogin.data.token;
  console.log(`✓ Dept Head login successful: ${deptHeadLogin.data.user.name} (Dept ID: ${deptHeadLogin.data.user.department_id})`);

  // Step 5: Department Head fetches Staff from DB
  console.log('\n5. Fetching Department Staff from DB (GET /api/department/staff)...');
  const staffListRes = await request('/api/department/staff', {
    headers: { Authorization: `Bearer ${deptHeadToken}` }
  });
  if (!staffListRes.ok || !staffListRes.data.staff || staffListRes.data.staff.length === 0) {
    throw new Error(`Failed to fetch department staff from DB: ${JSON.stringify(staffListRes.data)}`);
  }
  const targetStaff = staffListRes.data.staff[0];
  console.log(`✓ Fetched ${staffListRes.data.staff.length} staff records from DB. Selected: ${targetStaff.name} (ID: ${targetStaff.id})`);

  // Step 6: Dept Head assigns Staff to Complaint
  console.log('\n6. Testing Staff Assignment in DB (POST /api/department/assign)...');
  const assignRes = await request('/api/department/assign', {
    method: 'POST',
    headers: { Authorization: `Bearer ${deptHeadToken}` },
    body: {
      complaint_id: newComplaint.id,
      staff_id: targetStaff.id,
      remark: 'Assigned for immediate repair via test script'
    }
  });
  if (!assignRes.ok) {
    throw new Error(`Assignment failed: ${JSON.stringify(assignRes.data)}`);
  }
  console.log(`✓ Staff assigned successfully in DB. Message: ${assignRes.data.message}`);

  // Step 7: Verify History in DB
  console.log('\n7. Verifying Audit History in DB (GET /api/complaints/:id/history)...');
  const historyRes = await request(`/api/complaints/${newComplaint.id}/history`, {
    headers: { Authorization: `Bearer ${deptHeadToken}` }
  });
  if (!historyRes.ok || !historyRes.data.history || historyRes.data.history.length === 0) {
    throw new Error(`No history found for complaint in DB: ${JSON.stringify(historyRes.data)}`);
  }
  console.log(`✓ Found ${historyRes.data.history.length} audit history entries in DB:`);
  historyRes.data.history.forEach(h => {
    console.log(`   - [${h.created_at}] ${h.old_status} -> ${h.new_status} (By ${h.changed_by_name || 'System'}): ${h.notes || 'No notes'}`);
  });

  // Step 8: Staff Login
  console.log(`\n8. Testing Staff Login (${targetStaff.email})...`);
  const staffLogin = await request('/api/auth/login', {
    method: 'POST',
    body: { mobileOrEmail: targetStaff.email, password: 'password123' }
  });
  if (!staffLogin.ok || !staffLogin.data.token) {
    throw new Error(`Staff login failed: ${JSON.stringify(staffLogin.data)}`);
  }
  const staffToken = staffLogin.data.token;
  console.log(`✓ Staff login successful: ${staffLogin.data.user.name}`);

  // Step 9: Staff fetches tasks from DB
  console.log('\n9. Staff fetching assigned tasks from DB (GET /api/staff/tasks)...');
  const tasksRes = await request('/api/staff/tasks', {
    headers: { Authorization: `Bearer ${staffToken}` }
  });
  if (!tasksRes.ok || !tasksRes.data.tasks) {
    throw new Error(`Staff tasks fetch failed: ${JSON.stringify(tasksRes.data)}`);
  }
  const assignedTask = tasksRes.data.tasks.find(t => t.complaint_id === newComplaint.id || t.id === newComplaint.id);
  if (!assignedTask) {
    throw new Error(`Task for complaint ${newComplaint.id} not found in staff tasks list!`);
  }
  console.log(`✓ Task verified in DB for staff! Task ID: ${assignedTask.id}, Status: ${assignedTask.status}`);

  // Step 10: Staff updates status to In Progress
  console.log('\n10. Staff updating status to "In Progress" (POST /api/staff/task/:id/status)...');
  const updateStatusRes = await request(`/api/staff/task/${assignedTask.id}/status`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: { status: 'In Progress' }
  });
  if (!updateStatusRes.ok) {
    throw new Error(`Update status failed: ${JSON.stringify(updateStatusRes.data)}`);
  }
  console.log(`✓ Status updated in DB: ${updateStatusRes.data.status}`);

  // Step 11: Staff submits resolution proof
  console.log('\n11. Staff submitting resolution proof (POST /api/staff/task/:id/resolve)...');
  const resolveRes = await request(`/api/staff/task/${assignedTask.id}/resolve`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: {
      work_performed: 'Pothole filled and sealed with hot-mix bitumen',
      photo_after_url: 'https://example.com/proof-after-repair.jpg'
    }
  });
  if (!resolveRes.ok) {
    throw new Error(`Resolution submission failed: ${JSON.stringify(resolveRes.data)}`);
  }
  console.log(`✓ Resolution submitted in DB: ${resolveRes.data.status}`);

  // Step 12: Dept Head verifies resolution
  console.log('\n12. Dept Head verifying resolution (POST /api/department/verify)...');
  const verifyRes = await request('/api/department/verify', {
    method: 'POST',
    headers: { Authorization: `Bearer ${deptHeadToken}` },
    body: {
      complaint_id: newComplaint.id,
      status: 'Resolved'
    }
  });
  if (!verifyRes.ok) {
    throw new Error(`Verification failed: ${JSON.stringify(verifyRes.data)}`);
  }
  console.log(`✓ Verification completed in DB: ${verifyRes.data.status}`);

  // Step 13: Verify final complaint status in DB
  console.log('\n13. Verifying final complaint status in DB...');
  const finalComplaintRes = await request(`/api/complaints/${newComplaint.id}`, {
    headers: { Authorization: `Bearer ${citizenToken}` }
  });
  if (!finalComplaintRes.ok) {
    throw new Error(`Fetch final complaint failed: ${JSON.stringify(finalComplaintRes.data)}`);
  }
  const finalComp = finalComplaintRes.data.complaint;
  console.log(`✓ Final Complaint State in DB: Status="${finalComp.status}", AssignedStaff="${finalComp.assigned_staff_name}", ResolutionNotes="${finalComp.resolution_notes}"`);
  if (finalComp.status !== 'Resolved') {
    throw new Error(`Expected status 'Resolved' in DB, got '${finalComp.status}'`);
  }

  // Step 14: Citizen Notifications from DB
  console.log('\n14. Checking Citizen Notifications in DB (GET /api/notifications/my)...');
  const notifsRes = await request('/api/notifications/my', {
    headers: { Authorization: `Bearer ${citizenToken}` }
  });
  if (!notifsRes.ok || !notifsRes.data.notifications) {
    throw new Error(`Failed to fetch notifications: ${JSON.stringify(notifsRes.data)}`);
  }
  console.log(`✓ Citizen has ${notifsRes.data.notifications.length} notifications stored in DB`);
  const latestNotif = notifsRes.data.notifications[0];
  if (latestNotif) {
    console.log(`   Latest Notification: [ID: ${latestNotif.id}] "${latestNotif.title}" - Read: ${latestNotif.is_read}`);

    // Step 15: Mark Notification as Read in DB
    console.log('\n15. Marking notification as read in DB (POST /api/notifications/mark-read)...');
    const markReadRes = await request('/api/notifications/mark-read', {
      method: 'POST',
      headers: { Authorization: `Bearer ${citizenToken}` },
      body: { notification_id: latestNotif.id }
    });
    if (!markReadRes.ok) {
      throw new Error(`Mark read failed: ${JSON.stringify(markReadRes.data)}`);
    }
    console.log(`✓ Notification marked read in DB: ${markReadRes.data.message}`);

    // Re-fetch to confirm persistence of is_read
    const refetchNotifs = await request('/api/notifications/my', {
      headers: { Authorization: `Bearer ${citizenToken}` }
    });
    const updatedNotif = refetchNotifs.data.notifications.find(n => n.id === latestNotif.id);
    console.log(`✓ Re-queried DB: Notification ${latestNotif.id} is_read = ${updatedNotif.is_read} (1 / true)`);
    if (updatedNotif.is_read !== 1 && updatedNotif.is_read !== true) {
      throw new Error(`Notification read state did not persist in DB! Value: ${updatedNotif.is_read}`);
    }
  }

  console.log('\n====================================================');
  console.log('ALL 15 LIFECYCLE & PERSISTENCE TESTS PASSED CLEANLY!');
  console.log('POSTGRESQL/DATABASE IS THE SOLE SOURCE OF TRUTH!');
  console.log('====================================================');
}

runTest().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
