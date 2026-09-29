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
  const accounts = [
    { name: 'Admin', ids: ['admin@nagarsetu.gov.in', '9876543213'], passes: ['admin@123', 'admin123', 'NagarSetu@Admin2026!'] },
    { name: 'Staff', ids: ['staff@nagarsetu.gov.in', '9876543212'], passes: ['staff123', 'password123', 'staff@123'] },
    { name: 'Officer/Head', ids: ['officer@nagarsetu.gov.in', 'rahul.kumar@nagarsetu.gov.in', '9876543211'], passes: ['head123', 'nagarsetu@123', 'password123'] },
    { name: 'Citizen', ids: ['8788562103'], passes: ['8788562103', 'password123'] }
  ];

  for (const acc of accounts) {
    console.log(`\n=== Testing ${acc.name} ===`);
    for (const id of acc.ids) {
      for (const pass of acc.passes) {
        const res = await testLogin(id, pass);
        if (res.status === 200) {
          console.log(`SUCCESS! ID: "${id}" | Pass: "${pass}"`);
        }
      }
    }
  }
}
run();
