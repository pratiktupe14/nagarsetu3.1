const https = require('https');
const http = require('http');

async function callApi(url, method, body, token) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : null;
    const u = new URL(url);
    const mod = u.protocol === 'https:' ? https : http;
    const headers = { 'Content-Type': 'application/json' };
    if (data) headers['Content-Length'] = Buffer.byteLength(data);
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const req = mod.request(u, { method, headers }, (res) => {
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
  const liveUrl = 'https://nagarsetu-backend-api.vercel.app';
  console.log('=== READ-ONLY INVESTIGATION: DEPARTMENTS & DEPARTMENT HEADS ===\n');

  // 1. Login as Admin to get Admin JWT
  const adminLogin = await callApi(`${liveUrl}/api/auth/login`, 'POST', {
    mobileOrEmail: 'admin@nagarsetu.gov.in',
    password: 'admin@123'
  });

  const adminToken = adminLogin.data?.token;
  console.log('Admin Token Acquired:', Boolean(adminToken));

  if (adminToken) {
    // 2. Fetch Departments via Admin API
    const deptsRes = await callApi(`${liveUrl}/api/admin/departments`, 'GET', null, adminToken);
    console.log('\n--- ALL DEPARTMENTS IN DATABASE ---');
    console.log('Status:', deptsRes.status);
    if (Array.isArray(deptsRes.data)) {
      deptsRes.data.forEach(d => {
        console.log(`[Dept] ID: ${d.id} | Code: ${d.code || 'N/A'} | Name: ${d.name}`);
      });
    } else {
      console.log('Data:', deptsRes.data);
    }

    // 3. Fetch Department Heads via Admin API
    const dhRes = await callApi(`${liveUrl}/api/admin/department-heads`, 'GET', null, adminToken);
    console.log('\n--- ALL DEPARTMENT HEADS IN DATABASE ---');
    console.log('Status:', dhRes.status);
    if (Array.isArray(dhRes.data)) {
      dhRes.data.forEach(dh => {
        console.log(`[Head] ID: ${dh.id} | UserID: ${dh.user_id || dh.userId} | DeptID: ${dh.department_id || dh.deptId} | DeptCode: ${dh.department_code || dh.deptCode} | Email: ${dh.email || dh.headEmail} | Name: ${dh.name || dh.headName}`);
      });
    } else {
      console.log('Data:', dhRes.data);
    }
  }

  // 4. Test direct login for all 7 Department Heads to see the exact login response returned for each
  console.log('\n--- DIRECT LOGIN FOR ALL 7 DEPARTMENT HEADS ---');
  const emails = [
    'rahul.kumar@nagarsetu.gov.in',
    'amit.sharma@nagarsetu.gov.in',
    'vikram.patil@nagarsetu.gov.in',
    'sanjay.more@nagarsetu.gov.in',
    'kunal.kulkarni@nagarsetu.gov.in',
    'rohan.deshmukh@nagarsetu.gov.in',
    'aditya.joshi@nagarsetu.gov.in'
  ];

  for (const email of emails) {
    const lRes = await callApi(`${liveUrl}/api/auth/login`, 'POST', {
      mobileOrEmail: email,
      password: 'nagarsetu@123'
    });
    const u = lRes.data?.user;
    console.log(`Email: ${email.padEnd(32)} | Status: ${lRes.status} | Role: ${u?.role || 'ERR'} | DeptId: ${u?.department_id} | Code: ${u?.department_code} | Name: ${u?.department_name}`);
  }
}

run();
