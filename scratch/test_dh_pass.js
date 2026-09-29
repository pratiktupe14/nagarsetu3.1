const https = require('https');

async function testLogin(pass) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ mobileOrEmail: 'rahul.kumar@nagarsetu.gov.in', password: pass });
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
  const passes = ['nagarsetu@123', 'head@123'];
  for (const p of passes) {
    const res = await testLogin(p);
    console.log(`STATUS FOR "${p}":`, res.status, '| BODY:', res.body);
  }
}
run();
