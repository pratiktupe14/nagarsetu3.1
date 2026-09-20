const http = require('http');
const app = require('../backend/src/app');
const { initDatabase, query } = require('../backend/src/config/db');
const seed7DemoDepartmentHeads = require('../backend/src/scripts/seedDemoDepartmentHeads');

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

function request(port, method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const dataStr = body ? JSON.stringify(body) : '';
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(dataStr),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    }, (res) => {
      let bodyStr = '';
      res.on('data', chunk => bodyStr += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(bodyStr) });
        } catch (e) {
          resolve({ status: res.statusCode, text: bodyStr });
        }
      });
    });
    req.on('error', reject);
    if (dataStr) req.write(dataStr);
    req.end();
  });
}

async function runTest() {
  process.env.FORCE_PASSWORD_RESET = 'true';
  await initDatabase();
  await seed7DemoDepartmentHeads(query);
  delete process.env.FORCE_PASSWORD_RESET;

  const { server, port } = await startServer();

  console.log('--- 1. Login as Admin ---');
  const adminLogin = await request(port, 'POST', '/api/auth/login', {
    mobileOrEmail: 'admin@nagarsetu.gov.in',
    password: 'admin@123'
  });
  const adminToken = adminLogin.data.token;

  console.log('\n--- 2. Login as Rahul Kumar (PWD Dept Head) ---');
  const dhLogin = await request(port, 'POST', '/api/auth/login', {
    mobileOrEmail: 'rahul.kumar@nagarsetu.gov.in',
    password: 'rahul@123'
  });
  let dhToken = dhLogin.data.token;

  if (dhLogin.data.user?.must_change_password) {
    console.log('DH must change password. Changing password...');
    const changePass = await request(port, 'POST', '/api/auth/change-password', {
      currentPassword: 'rahul@123',
      newPassword: 'rahul@pass2026',
      confirmPassword: 'rahul@pass2026'
    }, dhToken);
    dhToken = changePass.data.token;
  }

  console.log('\n--- 3. Admin adds staff with department_id: "Public Works Department" (Full Name) ---');
  const addStaffFullName = await request(port, 'POST', '/api/department/staff', {
    name: 'Staff Full Name Test',
    mobile: '9988776611',
    email: 'fullname.test@nagarsetu.gov.in',
    password: 'password123',
    department_id: 'Public Works Department'
  }, adminToken);
  console.log('Add with Full Name status:', addStaffFullName.status, addStaffFullName.data);

  console.log('\n--- 4. Admin adds staff with department_id: "PWD" (Code) ---');
  const addStaffCode = await request(port, 'POST', '/api/department/staff', {
    name: 'Staff Code Test',
    mobile: '9988776622',
    email: 'code.test@nagarsetu.gov.in',
    password: 'password123',
    department_id: 'PWD'
  }, adminToken);
  console.log('Add with Code status:', addStaffCode.status, addStaffCode.data);

  console.log('\n--- 5. Admin adds staff with department_id: 1 (Numeric) ---');
  const addStaffNum = await request(port, 'POST', '/api/department/staff', {
    name: 'Staff Numeric Test',
    mobile: '9988776633',
    email: 'num.test@nagarsetu.gov.in',
    password: 'password123',
    department_id: 1
  }, adminToken);
  console.log('Add with Numeric status:', addStaffNum.status, addStaffNum.data);

  console.log('\n--- 6. DH adds staff directly from Dept Head Portal ---');
  const addStaffDh = await request(port, 'POST', '/api/department/staff', {
    name: 'Staff Created By DH',
    mobile: '9988776644',
    email: 'createdbydh@nagarsetu.gov.in',
    password: 'password123'
  }, dhToken);
  console.log('Add by DH status:', addStaffDh.status, addStaffDh.data);

  console.log('\n--- 7. Admin GET /api/department/staff (All Staff) ---');
  const adminGetStaff = await request(port, 'GET', '/api/department/staff', null, adminToken);
  console.log('Admin Total Staff returned:', adminGetStaff.data.staff?.length);

  console.log('\n--- 8. Department Head GET /api/department/staff ---');
  const dhGetStaff = await request(port, 'GET', '/api/department/staff', null, dhToken);
  console.log('DH Staff returned length:', dhGetStaff.data.staff?.length);
  const dhStaffNames = dhGetStaff.data.staff?.map(s => s.name);
  console.log('DH Staff List names:', dhStaffNames);

  console.log('\nCheck if newly added staff members appear in DH list:');
  console.log('  "Staff Full Name Test":', dhStaffNames?.includes('Staff Full Name Test') ? '✓ VISIBLE' : '✗ NOT SHOWING (BUG!)');
  console.log('  "Staff Code Test":', dhStaffNames?.includes('Staff Code Test') ? '✓ VISIBLE' : '✗ NOT SHOWING (BUG!)');
  console.log('  "Staff Numeric Test":', dhStaffNames?.includes('Staff Numeric Test') ? '✓ VISIBLE' : '✗ NOT SHOWING (BUG!)');
  console.log('  "Staff Created By DH":', dhStaffNames?.includes('Staff Created By DH') ? '✓ VISIBLE' : '✗ NOT SHOWING (BUG!)');

  server.close();
  process.exit(0);
}

runTest().catch(console.error);
