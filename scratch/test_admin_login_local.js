const https = require('https');

async function testLogin(bodyObj) {
  return new Promise((resolve) => {
    const data = JSON.stringify(bodyObj);
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
  const tests = [
    { mobileOrEmail: 'admin@nagarsetu.gov.in', password: 'admin@123' },
    { identifier: 'admin@nagarsetu.gov.in', password: 'admin@123' },
    { mobileOrEmail: '9876543213', password: 'admin@123' },
    { identifier: '9876543213', password: 'admin@123' },
    { mobileOrEmail: 'admin@nagarsetu.gov.in', password: 'NagarSetu@Admin2026!' },
    { identifier: 'admin@nagarsetu.gov.in', password: 'NagarSetu@Admin2026!' }
  ];

  for (const t of tests) {
    const res = await testLogin(t);
    console.log(`Payload: ${JSON.stringify(t)} => ${res.status}: ${res.body}`);
  }
}
run();
