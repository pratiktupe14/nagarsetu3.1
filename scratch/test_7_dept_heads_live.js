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
  console.log('=== VERIFYING ALL 7 OFFICIAL DEPARTMENT HEADS ===\n');

  const deptHeads = [
    { code: 'PWD', email: 'rahul.kumar@nagarsetu.gov.in', pass: 'nagarsetu@123' },
    { code: 'SAN', email: 'amit.sharma@nagarsetu.gov.in', pass: 'nagarsetu@123' },
    { code: 'WTR', email: 'vikram.patil@nagarsetu.gov.in', pass: 'nagarsetu@123' },
    { code: 'DRN', email: 'sanjay.more@nagarsetu.gov.in', pass: 'nagarsetu@123' },
    { code: 'ELE', email: 'kunal.kulkarni@nagarsetu.gov.in', pass: 'nagarsetu@123' },
    { code: 'TRF', email: 'rohan.deshmukh@nagarsetu.gov.in', pass: 'nagarsetu@123' },
    { code: 'MNT', email: 'aditya.joshi@nagarsetu.gov.in', pass: 'nagarsetu@123' }
  ];

  for (const dh of deptHeads) {
    const loginRes = await callApi(`${baseUrl}/api/auth/login`, 'POST', { mobileOrEmail: dh.email, password: dh.pass });
    const user = loginRes.data?.user;
    const token = loginRes.data?.token;

    let complaintsCount = 'N/A';
    let staffCount = 'N/A';

    if (token) {
      const cRes = await callApi(`${baseUrl}/api/department/complaints`, 'GET', null, token);
      complaintsCount = Array.isArray(cRes.data) ? cRes.data.length : 'Err';

      const sRes = await callApi(`${baseUrl}/api/department/staff`, 'GET', null, token);
      staffCount = Array.isArray(sRes.data) ? sRes.data.length : 'Err';
    }

    console.log(`Dept ${dh.code} (${dh.email}) => Login Status: ${loginRes.status} | Role: ${user?.role || 'ERR'} | DeptId: ${user?.department_id || 'NONE'} | Code: ${user?.department_code || 'NONE'} | Complaints: ${complaintsCount} | Staff: ${staffCount}`);
  }
}

run();
