const https = require('https');

async function callApi(url, method, body, token) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const u = new URL(url);
    const headers = { 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = https.request(u, { method, headers }, (res) => {
      let b = '';
      res.on('data', chunk => b += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(b) });
        } catch (e) {
          resolve({ status: res.statusCode, raw: b });
        }
      });
    });
    req.on('error', err => resolve({ error: err.message }));
    if (data) req.write(data);
    req.end();
  });
}

async function run() {
  const baseUrl = 'https://nagarsetu-backend-api.vercel.app';
  console.log('=== STEP 13 & STEP 14: FULL ROLE & SECURITY REGRESSION ===\n');

  // 1. Citizen Login
  const citizenLogin = await callApi(`${baseUrl}/api/auth/login`, 'POST', { mobileOrEmail: '8788562103', password: 'password123' });
  console.log('Citizen Login Status:', citizenLogin.status, '| Role:', citizenLogin.data?.user?.role);

  // 2. Staff Login
  const staffLogin = await callApi(`${baseUrl}/api/auth/login`, 'POST', { mobileOrEmail: 'staff@nagarsetu.gov.in', password: 'nagarsetu@123' });
  console.log('Staff Login Status:', staffLogin.status, '| Role:', staffLogin.data?.user?.role);

  // 3. Admin Login
  const adminLogin = await callApi(`${baseUrl}/api/auth/login`, 'POST', { mobileOrEmail: 'admin@nagarsetu.gov.in', password: 'admin@123' });
  console.log('Admin Login Status:', adminLogin.status, '| Role:', adminLogin.data?.user?.role);

  // 4. Department Head Login (PWD)
  const dhLogin = await callApi(`${baseUrl}/api/auth/login`, 'POST', { mobileOrEmail: 'rahul.kumar@nagarsetu.gov.in', password: 'nagarsetu@123' });
  console.log('DH PWD Login Status:', dhLogin.status, '| Role:', dhLogin.data?.user?.role, '| Dept Code:', dhLogin.data?.user?.department_code);

  if (dhLogin.data?.token) {
    const dhToken = dhLogin.data.token;
    
    // Test PWD Head accessing PWD resource
    const pwdComplaints = await callApi(`${baseUrl}/api/department/complaints`, 'GET', null, dhToken);
    console.log('PWD Head -> PWD Complaints API Status:', pwdComplaints.status, '| Count:', Array.isArray(pwdComplaints.data) ? pwdComplaints.data.length : 'N/A');

    // Test PWD Head trying to access unauthorized admin resource or staff isolation
    const pwdStaff = await callApi(`${baseUrl}/api/department/staff`, 'GET', null, dhToken);
    console.log('PWD Head -> PWD Staff API Status:', pwdStaff.status, '| Count:', Array.isArray(pwdStaff.data) ? pwdStaff.data.length : 'N/A');
  }
}

run();
