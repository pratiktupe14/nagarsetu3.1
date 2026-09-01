const http = require('http');

async function debugAssign() {
  // Login ELE Head
  const eleHeadRes = await new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
    });
    req.write(JSON.stringify({ mobileOrEmail: 'aditya.joshi@nagarsetu.gov.in', password: 'password123' }));
    req.end();
  });

  console.log('ELE Head Login User:', eleHeadRes.user);

  // Call GET /api/department/staff/assignable as ELE Head
  const staffRes = await new Promise((resolve) => {
    const req = http.request({
      hostname: 'localhost', port: 5000, path: '/api/department/staff/assignable', method: 'GET',
      headers: { 'Authorization': `Bearer ${eleHeadRes.token}` }
    }, res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
    });
    req.end();
  });

  console.log('Assignable Staff for ELE Head:', staffRes.staff);
}

debugAssign();
