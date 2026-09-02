const http = require('http');
const app = require('../backend/src/app');

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

async function run() {
  console.log('=== STRICT SECURITY & ISOLATION AUDIT ===\n');
  const { server, port } = await startServer();

  try {
    // 1. Citizen A vs Citizen B Isolation
    console.log('1. Testing Citizen A vs Citizen B Isolation...');
    // Create Citizen A
    const mobA = `91${Math.floor(10000000 + Math.random() * 90000000)}`;
    const regA = await request(port, 'POST', '/api/auth/register', {}, {
      name: 'Citizen Alpha',
      mobile: mobA,
      email: `alpha_${Date.now()}@test.com`,
      password: 'password123'
    });
    const tokenA = regA.data.token;

    // Create Citizen B
    const mobB = `91${Math.floor(10000000 + Math.random() * 90000000)}`;
    const regB = await request(port, 'POST', '/api/auth/register', {}, {
      name: 'Citizen Beta',
      mobile: mobB,
      email: `beta_${Date.now()}@test.com`,
      password: 'password123'
    });
    const tokenB = regB.data.token;

    // Citizen A submits a private complaint
    const compA = await request(port, 'POST', '/api/complaints/submit', { Authorization: `Bearer ${tokenA}` }, {
      complaint_number: `A-PRIV-${Date.now()}`,
      photo_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7',
      category: 'Roads & Footpaths',
      title: 'Citizen A Private Issue',
      description: 'Private citizen complaint description',
      priority: 'Low',
      department_id: 1,
      latitude: 18.5204,
      longitude: 73.8567,
      location_source: 'manual_pin'
    });
    const compAId = (compA.data.complaint || compA.data).id;
    console.log(`✓ Citizen A submitted Complaint ID: ${compAId}`);

    // Citizen B tries to fetch Citizen A's complaint directly via GET /api/complaints/:id
    const bFetchA = await request(port, 'GET', `/api/complaints/${compAId}`, { Authorization: `Bearer ${tokenB}` });
    console.log(`Citizen B accessing Citizen A complaint: HTTP ${bFetchA.status}`);
    if (bFetchA.status !== 403) {
      throw new Error(`SECURITY BREACH: Citizen B was able to view Citizen A complaint (HTTP ${bFetchA.status})`);
    }
    console.log('✓ PASS: Citizen B blocked with HTTP 403 Access Denied');

    // Citizen B checks their list GET /api/complaints/my
    const bList = await request(port, 'GET', '/api/complaints/my', { Authorization: `Bearer ${tokenB}` });
    const bFoundA = (bList.data.complaints || []).some(c => c.id === compAId);
    if (bFoundA) {
      throw new Error('SECURITY BREACH: Citizen A complaint appeared in Citizen B /api/complaints/my list');
    }
    console.log('✓ PASS: Citizen A complaint does not appear in Citizen B complaint list');

    // 2. PWD Head vs Electrical (ELE) Complaints Isolation
    console.log('\n2. Testing PWD Head vs ELE Complaints Isolation...');
    // Log in PWD Head
    const pwdLogin = await request(port, 'POST', '/api/auth/login', {}, {
      mobileOrEmail: 'rahul.kumar@nagarsetu.gov.in',
      password: 'password123'
    });
    const pwdToken = pwdLogin.data.token;

    // Log in ELE Head
    const eleLogin = await request(port, 'POST', '/api/auth/login', {}, {
      mobileOrEmail: 'aditya.joshi@nagarsetu.gov.in',
      password: 'password123'
    });
    const eleToken = eleLogin.data.token;

    // Submit an ELE complaint
    const eleComp = await request(port, 'POST', '/api/complaints/submit', { Authorization: `Bearer ${tokenA}` }, {
      complaint_number: `ELE-TEST-${Date.now()}`,
      photo_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7',
      category: 'Street Lighting & Electricity',
      title: 'Broken Streetlight on 5th Avenue',
      description: 'Streetlight pole damaged and flickering',
      priority: 'Medium',
      department_id: 5, // ELE
      latitude: 18.5204,
      longitude: 73.8567,
      location_source: 'manual_pin'
    });
    const eleCompId = (eleComp.data.complaint || eleComp.data).id;
    console.log(`✓ ELE Complaint created: ID=${eleCompId}`);

    // PWD Head queries /api/department/complaints
    const pwdComplaints = await request(port, 'GET', '/api/department/complaints', { Authorization: `Bearer ${pwdToken}` });
    const pwdList = pwdComplaints.data.complaints || [];
    const pwdSeesEle = pwdList.some(c => c.id === eleCompId || c.department_id === 5);
    if (pwdSeesEle) {
      throw new Error('SECURITY BREACH: PWD Head was able to view ELE department complaint in queue');
    }
    console.log('✓ PASS: PWD Head cannot see ELE complaints in department queue');

    // 3. Department Head cannot see another department's staff
    console.log('\n3. Testing Department Staff Isolation...');
    const pwdStaffRes = await request(port, 'GET', '/api/department/staff', { Authorization: `Bearer ${pwdToken}` });
    const pwdStaffList = pwdStaffRes.data.staff || [];
    const hasNonPwdStaff = pwdStaffList.some(s => s.department_id !== 1 && s.department_id !== '1');
    if (hasNonPwdStaff) {
      throw new Error('SECURITY BREACH: PWD Head was able to view non-PWD staff in /api/department/staff');
    }
    console.log(`✓ PASS: PWD Head only sees PWD staff (${pwdStaffList.length} staff returned, all Dept 1)`);

    // 4. PWD Head cannot assign ELE staff
    console.log('\n4. Testing Cross-Department Staff Assignment Prevention...');
    // Fetch ELE staff member
    const eleStaffRes = await request(port, 'GET', '/api/department/staff', { Authorization: `Bearer ${eleToken}` });
    const eleStaffList = eleStaffRes.data.staff || [];
    if (eleStaffList.length === 0) throw new Error('No ELE staff found');
    const eleStaff = eleStaffList[0];

    // PWD Head tries to assign ELE staff to PWD complaint (compAId)
    const crossAssignRes = await request(port, 'POST', '/api/department/assign', { Authorization: `Bearer ${pwdToken}` }, {
      complaint_id: compAId,
      staff_id: String(eleStaff.id || eleStaff.user_id)
    });
    console.log(`PWD Head assigning ELE staff: HTTP ${crossAssignRes.status}`);
    if (crossAssignRes.status !== 400 && crossAssignRes.status !== 403) {
      throw new Error(`SECURITY BREACH: PWD Head was able to assign ELE staff (HTTP ${crossAssignRes.status})`);
    }
    console.log(`✓ PASS: Cross-department assignment blocked (${crossAssignRes.data.error})`);

    // PWD Head tries to assign PWD staff to ELE complaint (eleCompId)
    const pwdStaff = pwdStaffList[0];
    const assignToEleRes = await request(port, 'POST', '/api/department/assign', { Authorization: `Bearer ${pwdToken}` }, {
      complaint_id: eleCompId,
      staff_id: String(pwdStaff.id || pwdStaff.user_id)
    });
    console.log(`PWD Head assigning to ELE complaint: HTTP ${assignToEleRes.status}`);
    if (assignToEleRes.status !== 400 && assignToEleRes.status !== 403) {
      throw new Error(`SECURITY BREACH: PWD Head was able to assign to ELE complaint (HTTP ${assignToEleRes.status})`);
    }
    console.log(`✓ PASS: Assignment outside department blocked (${assignToEleRes.data.error})`);

    // 5. Field Staff cannot access or update another staff member's tasks
    console.log("\n5. Testing Field Staff Task Isolation & Update Guard...");
    // Log in Staff 1 (PWD)
    const staff1Login = await request(port, 'POST', '/api/auth/login', {}, {
      mobileOrEmail: 'staff@nagarsetu.gov.in', // Ramesh Kumar (PWD)
      password: 'password123'
    });
    const staff1Token = staff1Login.data.token;

    // Log in Staff 2 (ELE)
    const staff2Login = await request(port, 'POST', '/api/auth/login', {}, {
      mobileOrEmail: eleStaff.email,
      password: 'password123'
    });
    const staff2Token = staff2Login.data.token;

    // Assign compAId to Staff 1
    await request(port, 'POST', '/api/department/assign', { Authorization: `Bearer ${pwdToken}` }, {
      complaint_id: compAId,
      staff_id: '1' // Ramesh Kumar
    });

    // Staff 2 (ELE) queries their tasks - should NOT see compAId
    const staff2Tasks = await request(port, 'GET', '/api/staff/tasks', { Authorization: `Bearer ${staff2Token}` });
    const staff2SeesTask = (staff2Tasks.data.tasks || []).some(t => t.id === compAId);
    if (staff2SeesTask) {
      throw new Error("SECURITY BREACH: Staff 2 saw Staff 1's task in /api/staff/tasks");
    }
    console.log("✓ PASS: Staff 2 cannot see Staff 1's tasks in task queue");

    // Staff 2 tries to resolve Staff 1's task
    const hijackResolve = await request(port, 'POST', `/api/staff/task/${compAId}/resolve`, { Authorization: `Bearer ${staff2Token}` }, {
      photo_after_url: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe',
      work_performed: 'Unauthorized attempt'
    });
    console.log(`Staff 2 attempting to resolve Staff 1's task: HTTP ${hijackResolve.status}`);
    if (hijackResolve.status !== 403 && hijackResolve.status !== 404) {
      throw new Error(`SECURITY BREACH: Staff 2 was able to resolve Staff 1's task (HTTP ${hijackResolve.status})`);
    }
    console.log(`✓ PASS: Staff 2 blocked from resolving Staff 1's task (${hijackResolve.data.error})`);

    // Staff 2 tries to update status of Staff 1's task via /api/staff/task/:id/status
    const hijackStatus = await request(port, 'POST', `/api/staff/task/${compAId}/status`, { Authorization: `Bearer ${staff2Token}` }, {
      status: 'In Progress'
    });
    console.log(`Staff 2 attempting to update status of Staff 1's task: HTTP ${hijackStatus.status}`);
    if (hijackStatus.status !== 403 && hijackStatus.status !== 404) {
      throw new Error(`SECURITY BREACH: Staff 2 was able to update status of Staff 1 task (HTTP ${hijackStatus.status})`);
    }
    console.log(`✓ PASS: Staff 2 blocked from updating status (${hijackStatus.data.error})`);

    console.log('\n=== SECURITY AUDIT COMPLETE ===\n');
  } finally {
    server.close();
  }
}

run().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
});
