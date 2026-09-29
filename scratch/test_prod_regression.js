const https = require('https');

function apiCall(method, path, body, token) {
  return new Promise((resolve) => {
    const postData = body ? JSON.stringify(body) : '';
    const req = https.request('https://nagarsetu-backend-api.vercel.app' + path, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {}),
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    }, res => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(b) });
        } catch(e) {
          resolve({ status: res.statusCode, data: b });
        }
      });
    });
    req.on('error', err => resolve({ status: 0, data: err.message }));
    if (postData) req.write(postData);
    req.end();
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function runRegression() {
  console.log('=======================================================');
  console.log('    PRODUCTION CROSS-DEPARTMENT REGRESSION AUDIT      ');
  console.log('=======================================================\n');

  // 1. Admin Login to get token for inspection
  const adminRes = await apiCall('POST', '/api/auth/login', { identifier: 'admin@nagarsetu.gov.in', password: 'admin@123' });
  const adminToken = adminRes.data.token;
  console.log('Admin login status:', adminRes.status);
  await sleep(1000);

  // 2. Fetch all complaints & staff
  const compRes = await apiCall('GET', '/api/department/complaints', null, adminToken);
  const allComplaints = compRes.data.complaints || [];
  await sleep(1000);

  const staffRes = await apiCall('GET', '/api/department/staff', null, adminToken);
  const allStaff = staffRes.data.staff || [];
  await sleep(1000);

  // Helper to find complaint and staff for department
  const getDeptData = (code) => {
    const comp = allComplaints.find(c => c.department_code === code || String(c.department_id) === code || c.category?.toLowerCase().includes(code.toLowerCase()));
    const staff = allStaff.find(s => s.department_code === code || String(s.department_id) === code || s.employee_id?.startsWith(code));
    return { comp, staff };
  };

  const pwdData = getDeptData('PWD');
  const eleData = getDeptData('ELE');
  const sanData = getDeptData('SAN');
  const wtrData = getDeptData('WTR');

  console.log('PWD Complaint:', pwdData.comp ? { id: pwdData.comp.id, num: pwdData.comp.complaint_number, dept: pwdData.comp.department_id } : 'NONE');
  console.log('PWD Staff:', pwdData.staff ? { id: pwdData.staff.id, name: pwdData.staff.name, empId: pwdData.staff.employee_id } : 'NONE');
  console.log('ELE Staff:', eleData.staff ? { id: eleData.staff.id, name: eleData.staff.name, empId: eleData.staff.employee_id } : 'NONE');
  console.log('SAN Complaint:', sanData.comp ? { id: sanData.comp.id, num: sanData.comp.complaint_number } : 'NONE');
  console.log('SAN Staff:', sanData.staff ? { id: sanData.staff.id, name: sanData.staff.name } : 'NONE');
  console.log('WTR Complaint:', wtrData.comp ? { id: wtrData.comp.id, num: wtrData.comp.complaint_number } : 'NONE');
  console.log('WTR Staff:', wtrData.staff ? { id: wtrData.staff.id, name: wtrData.staff.name } : 'NONE');

  // Test 1: PWD Head / Admin -> assign PWD staff (Same Dept) -> Expect 200
  console.log('\n-------------------------------------------------------');
  console.log('TEST 1: Assign PWD staff (Amit Patil) to PWD complaint (NS-PWD-394206)');
  console.log('-------------------------------------------------------');
  const res1 = await apiCall('POST', '/api/department/assign', {
    complaint_id: pwdData.comp?.id,
    staff_id: pwdData.staff?.id
  }, adminToken);
  console.log('Result Status:', res1.status, '| Response:', res1.data);
  await sleep(1500);

  // Test 2: Assign ELE staff (Rahul Joshi) to PWD complaint (NS-PWD-394206) -> Expect 400 (Cross Dept)
  console.log('\n-------------------------------------------------------');
  console.log('TEST 2: Assign ELE staff (Rahul Joshi) to PWD complaint (NS-PWD-394206)');
  console.log('-------------------------------------------------------');
  const res2 = await apiCall('POST', '/api/department/assign', {
    complaint_id: pwdData.comp?.id,
    staff_id: eleData.staff?.id
  }, adminToken);
  console.log('Result Status:', res2.status, '| Response:', res2.data);
  await sleep(1500);

  // Test 3: Assign SAN staff (Prashant Mane) to SAN complaint -> Expect 200
  console.log('\n-------------------------------------------------------');
  console.log('TEST 3: Assign SAN staff to SAN complaint');
  console.log('-------------------------------------------------------');
  const res3 = await apiCall('POST', '/api/department/assign', {
    complaint_id: sanData.comp?.id,
    staff_id: sanData.staff?.id
  }, adminToken);
  console.log('Result Status:', res3.status, '| Response:', res3.data);
  await sleep(1500);

  // Test 4: Assign WTR staff (Kiran Patil) to WTR complaint -> Expect 200
  console.log('\n-------------------------------------------------------');
  console.log('TEST 4: Assign WTR staff to WTR complaint');
  console.log('-------------------------------------------------------');
  const res4 = await apiCall('POST', '/api/department/assign', {
    complaint_id: wtrData.comp?.id,
    staff_id: wtrData.staff?.id
  }, adminToken);
  console.log('Result Status:', res4.status, '| Response:', res4.data);

  console.log('\n=======================================================');
  console.log('            REGRESSION AUDIT COMPLETE                  ');
  console.log('=======================================================');
}

runRegression();
