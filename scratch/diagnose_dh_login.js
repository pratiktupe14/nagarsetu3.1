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
  console.log('=== STEP 3: TESTING LOGIN API DIRECTLY ===');
  const liveUrl = 'https://nagarsetu-backend-api.vercel.app/api/auth/login';
  
  const loginRes = await callApi(liveUrl, 'POST', {
    mobileOrEmail: 'rahul.kumar@nagarsetu.gov.in',
    password: 'nagarsetu@123'
  });

  console.log('HTTP Status:', loginRes.status);
  if (loginRes.data) {
    const { user, token } = loginRes.data;
    console.log('Message:', loginRes.data.message);
    console.log('Returned Token Present:', Boolean(token));
    if (user) {
      console.log('Sanitized User Object:');
      console.log({
        id: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        department_id: user.department_id,
        department_code: user.department_code,
        department_name: user.department_name,
        employee_id: user.employee_id,
        status: user.status
      });
    }

    if (token) {
      console.log('\n=== STEP 9: TESTING DEPARTMENT PORTAL APIS WITH TOKEN ===');
      const complaintsRes = await callApi('https://nagarsetu-backend-api.vercel.app/api/department/complaints', 'GET', null, token);
      console.log('GET /api/department/complaints Status:', complaintsRes.status);
      if (complaintsRes.data) {
        console.log('Complaints Count:', Array.isArray(complaintsRes.data) ? complaintsRes.data.length : (complaintsRes.data.complaints?.length || 'Not Array'));
        if (!Array.isArray(complaintsRes.data) && complaintsRes.data.error) {
          console.log('Error:', complaintsRes.data.error);
        }
      } else {
        console.log('Raw Complaints Response:', String(complaintsRes.raw).slice(0, 200));
      }

      const staffRes = await callApi('https://nagarsetu-backend-api.vercel.app/api/department/staff', 'GET', null, token);
      console.log('GET /api/department/staff Status:', staffRes.status);
      if (staffRes.data) {
        console.log('Staff Count:', Array.isArray(staffRes.data) ? staffRes.data.length : (staffRes.data.staff?.length || 'Not Array'));
        if (!Array.isArray(staffRes.data) && staffRes.data.error) {
          console.log('Error:', staffRes.data.error);
        }
      } else {
        console.log('Raw Staff Response:', String(staffRes.raw).slice(0, 200));
      }
    }
  } else {
    console.log('Raw Body:', loginRes.raw);
  }
}

run();
