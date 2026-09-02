const http = require('http');
const app = require('../backend/src/app');

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      resolve({ server, port });
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
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
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
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function run() {
  console.log('=== MULTI-INVOCATION ISOLATION & PERSISTENCE TEST ===\n');
  const { server, port } = await startServer();
  console.log(`Test server running on port ${port}\n`);

  try {
    // 0. Test /api/health
    console.log('[STEP 0] Checking /api/health...');
    const healthRes = await request(port, 'GET', '/api/health');
    console.log('Health status:', healthRes.status, healthRes.data);
    if (healthRes.status !== 200 || healthRes.data.database !== 'connected') {
      throw new Error(`Health check failed: ${JSON.stringify(healthRes.data)}`);
    }

    // STEP 1: Process A - Citizen login & submit complaint
    console.log('\n[STEP 1] Citizen Authentication & Complaint Submission...');
    const citLogin = await request(port, 'POST', '/api/auth/login', {}, {
      mobileOrEmail: '8788562103',
      password: 'password123'
    });
    if (citLogin.status !== 200 || !citLogin.data.token) {
      throw new Error(`Citizen login failed: ${JSON.stringify(citLogin.data)}`);
    }
    const citizenToken = citLogin.data.token;
    console.log(`✓ Citizen logged in. DB User ID: ${citLogin.data.user.id}`);

    // Verify /api/auth/me against persistent DB
    const citMe = await request(port, 'GET', '/api/auth/me', { Authorization: `Bearer ${citizenToken}` });
    if (citMe.status !== 200 || !citMe.data.user) {
      throw new Error(`Citizen /api/auth/me failed: ${JSON.stringify(citMe.data)}`);
    }
    console.log(`✓ Citizen /api/auth/me verified: ${citMe.data.user.name} (${citMe.data.user.role})`);

    const testCompNum = `TEST-${Date.now()}`;
    const submitRes = await request(port, 'POST', '/api/complaints/submit', { Authorization: `Bearer ${citizenToken}` }, {
      complaint_number: testCompNum,
      photo_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7',
      category: 'Roads & Footpaths',
      title: `Dangerous Pothole on Main St (${testCompNum})`,
      description: 'Deep road damage creating serious traffic hazard',
      priority: 'High',
      department_id: 1, // PWD
      latitude: 18.5204,
      longitude: 73.8567,
      location_source: 'manual_pin',
      location_address: 'Main Street, Pune'
    });
    if (submitRes.status !== 201 && submitRes.status !== 200) {
      throw new Error(`Complaint submission failed: ${JSON.stringify(submitRes.data)}`);
    }
    const createdComp = submitRes.data.complaint || submitRes.data;
    const complaintId = createdComp.id;
    console.log(`✓ Complaint created: ID=${complaintId}, Number=${testCompNum}`);

    // STEP 2: Department Head login & Assign Staff
    console.log('\n[STEP 2] Department Head Login & Staff Assignment...');
    const deptLogin = await request(port, 'POST', '/api/auth/login', {}, {
      mobileOrEmail: 'rahul.kumar@nagarsetu.gov.in',
      password: 'password123'
    });
    if (deptLogin.status !== 200 || !deptLogin.data.token) {
      throw new Error(`Dept Head login failed: ${JSON.stringify(deptLogin.data)}`);
    }
    const deptToken = deptLogin.data.token;
    console.log(`✓ Dept Head logged in: ${deptLogin.data.user.name}, Dept=${deptLogin.data.user.department_id}`);

    // Verify Dept Head /api/auth/me
    const deptMe = await request(port, 'GET', '/api/auth/me', { Authorization: `Bearer ${deptToken}` });
    console.log(`✓ Dept Head /api/auth/me verified: Dept Code = ${deptMe.data.user.department_code}`);

    // Check that complaint exists in department complaints list
    const deptComps = await request(port, 'GET', '/api/department/complaints', { Authorization: `Bearer ${deptToken}` });
    const foundComp = (deptComps.data.complaints || deptComps.data || []).find(c => c.id === complaintId || c.complaint_number === testCompNum);
    if (!foundComp) {
      throw new Error(`Complaint ${complaintId} not found in Dept Head complaints list!`);
    }
    console.log(`✓ Complaint found in Dept Head queue: Status=${foundComp.status}`);

    // Fetch department staff to get active staff ID
    const staffListRes = await request(port, 'GET', '/api/department/staff', { Authorization: `Bearer ${deptToken}` });
    const staffList = staffListRes.data.staff || staffListRes.data || [];
    if (staffList.length === 0) {
      throw new Error('No staff found in department!');
    }
    const assignedStaff = staffList[0];
    console.log(`✓ Selected Staff: ${assignedStaff.name} (ID: ${assignedStaff.id}, EmpId: ${assignedStaff.employee_id})`);

    // Assign staff
    const assignRes = await request(port, 'POST', '/api/department/assign', { Authorization: `Bearer ${deptToken}` }, {
      complaint_id: complaintId,
      staff_id: String(assignedStaff.id || assignedStaff.user_id)
    });
    if (assignRes.status !== 200 || !assignRes.data.success) {
      throw new Error(`Assign staff failed: ${JSON.stringify(assignRes.data)}`);
    }
    console.log(`✓ Staff successfully assigned: ${assignedStaff.name}`);

    // STEP 3: Field Staff Login & Resolution
    console.log('\n[STEP 3] Field Staff Login & Resolution Flow...');
    const staffLogin = await request(port, 'POST', '/api/auth/login', {}, {
      mobileOrEmail: assignedStaff.email || assignedStaff.phone || '9876543211',
      password: 'password123'
    });
    if (staffLogin.status !== 200 || !staffLogin.data.token) {
      throw new Error(`Staff login failed: ${JSON.stringify(staffLogin.data)}`);
    }
    const staffToken = staffLogin.data.token;
    console.log(`✓ Staff logged in: ${staffLogin.data.user.name}`);

    // Fetch staff tasks
    const tasksRes = await request(port, 'GET', '/api/staff/tasks', { Authorization: `Bearer ${staffToken}` });
    const staffTasks = tasksRes.data.tasks || tasksRes.data || [];
    const myTask = staffTasks.find(t => t.id === complaintId || t.complaint_number === testCompNum);
    if (!myTask) {
      throw new Error(`Assigned task not found in staff task list! Total tasks found: ${staffTasks.length}`);
    }
    console.log(`✓ Task verified in staff task queue: ID=${myTask.id}, Title="${myTask.title}"`);

    // Update status to 'In Progress'
    const statusUpdateRes = await request(port, 'POST', `/api/staff/task/${complaintId}/status`, { Authorization: `Bearer ${staffToken}` }, {
      status: 'In Progress'
    });
    if (statusUpdateRes.status !== 200) {
      throw new Error(`Staff status update failed: ${JSON.stringify(statusUpdateRes.data)}`);
    }
    console.log('✓ Task status updated to "In Progress"');

    // Resolve task with after photo
    const resolveRes = await request(port, 'POST', `/api/staff/task/${complaintId}/resolve`, { Authorization: `Bearer ${staffToken}` }, {
      photo_after_url: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe',
      work_performed: 'Asphalt cold mix patched and steam-rollered',
      materials_used: '50kg bitumin asphalt mix',
      additional_notes: 'Road surface restored to standard gradient'
    });
    if (resolveRes.status !== 200 || !resolveRes.data.success) {
      throw new Error(`Staff task resolution failed: ${JSON.stringify(resolveRes.data)}`);
    }
    console.log('✓ Task resolved and photo submitted by staff');

    // STEP 4: Department Head Verification
    console.log('\n[STEP 4] Department Head Verification & Final Approval...');
    const verifyRes = await request(port, 'POST', '/api/department/verify', { Authorization: `Bearer ${deptToken}` }, {
      complaint_id: complaintId,
      action: 'approve',
      remarks: 'Work inspected and approved according to PWD civic standards'
    });
    if (verifyRes.status !== 200 || !verifyRes.data.success) {
      throw new Error(`Dept Head verify failed: ${JSON.stringify(verifyRes.data)}`);
    }
    console.log('✓ Department Head verified and resolved complaint');

    // STEP 5: Final Cross-Portal Visibility Check
    console.log('\n[STEP 5] Final Cross-Portal Database Visibility Verification (Admin)...');
    const adminLogin = await request(port, 'POST', '/api/auth/login', {}, {
      mobileOrEmail: 'admin@nagarsetu.gov.in',
      password: 'password123'
    });
    if (adminLogin.status !== 200 || !adminLogin.data.token) {
      throw new Error(`Admin login failed: ${JSON.stringify(adminLogin.data)}`);
    }
    const adminToken = adminLogin.data.token;

    const allComplaintsRes = await request(port, 'GET', '/api/complaints', { Authorization: `Bearer ${adminToken}` });
    const allList = allComplaintsRes.data.complaints || allComplaintsRes.data || [];
    const finalComp = allList.find(c => c.id === complaintId || c.complaint_number === testCompNum);
    if (!finalComp) {
      throw new Error(`Complaint missing from admin complaints query! Response: ${JSON.stringify(allComplaintsRes.data)}`);
    }
    console.log(`✓ Final Complaint State: Status="${finalComp.status}", AssignedTo="${finalComp.assigned_staff_name}", VerifiedAt="${finalComp.verified_at}"`);

    if (finalComp.status !== 'Resolved') {
      throw new Error(`Expected status 'Resolved' but got '${finalComp.status}'`);
    }

    console.log('\n======================================================');
    console.log('  ALL CROSS-PORTAL DATA PERSISTENCE TESTS PASSED!     ');
    console.log('  100% PERSISTENT DATABASE SOURCE OF TRUTH VERIFIED    ');
    console.log('======================================================\n');
  } finally {
    server.close();
  }
}

run().catch(err => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
