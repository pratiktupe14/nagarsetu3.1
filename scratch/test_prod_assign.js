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
    if (postData) req.write(postData);
    req.end();
  });
}

async function run() {
  console.log('1. Login as Admin to inspect PROD DB complaints & staff...');
  const adminLogin = await apiCall('POST', '/api/auth/login', { identifier: 'admin@nagarsetu.gov.in', password: 'admin@123' });
  const adminToken = adminLogin.data.token;
  console.log('Admin login status:', adminLogin.status);

  // Login as PWD Head Rahul Kumar (user id 3)
  const headLogin = await apiCall('POST', '/api/auth/login', { identifier: 'rahul.kumar@nagarsetu.gov.in', password: 'head@123' });
  let headToken = headLogin.data.token;
  console.log('Head login status:', headLogin.status);

  // Fetch complaints
  const compRes = await apiCall('GET', '/api/department/complaints', null, adminToken);
  console.log('Total PROD complaints:', Array.isArray(compRes.data.complaints) ? compRes.data.complaints.length : compRes.data);

  const pwdComp = (compRes.data.complaints || []).find(c => String(c.department_id) === '1' || c.department_code === 'PWD' || c.department_name?.includes('Public Works'));
  console.log('Sample PWD Complaint:', pwdComp ? { id: pwdComp.id, complaint_number: pwdComp.complaint_number, department_id: pwdComp.department_id } : 'NONE');

  // Fetch staff
  const staffRes = await apiCall('GET', '/api/department/staff', null, adminToken);
  const pwdStaff = (staffRes.data.staff || []).find(s => String(s.department_id) === '1' || s.department_code === 'PWD' || s.employee_id?.startsWith('PWD'));
  console.log('Sample PWD Staff:', pwdStaff ? { id: pwdStaff.id, user_id: pwdStaff.user_id, name: pwdStaff.name, employee_id: pwdStaff.employee_id, department_id: pwdStaff.department_id } : 'NONE');

  if (pwdComp && pwdStaff && headToken) {
    console.log('\nTesting Assign Call with PWD Head token:');
    const assignRes = await apiCall('POST', '/api/department/assign', {
      complaint_id: pwdComp.id,
      staff_id: pwdStaff.id
    }, headToken);
    console.log('ASSIGN RESULT STATUS:', assignRes.status, 'BODY:', assignRes.data);
  }
}
run();
