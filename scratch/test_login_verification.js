const http = require('http');
const app = require('../backend/src/app');
const { initDatabase } = require('../backend/src/config/db');

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

function request(port, method, path, body = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let bodyStr = '';
      res.on('data', chunk => bodyStr += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(bodyStr) });
        } catch (e) {
          resolve({ status: res.statusCode, text: bodyStr });
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('=== VERIFYING DEPARTMENT HEAD LOGINS ===\n');
  await initDatabase();
  const { server, port } = await startServer();

  const deptHeads = [
    { name: 'Rahul Kumar (PWD)', email: 'rahul.kumar@nagarsetu.gov.in', pass: 'rahul@123' },
    { name: 'Amit Sharma (SAN)', email: 'amit.sharma@nagarsetu.gov.in', pass: 'amit@123' },
    { name: 'Vikram Patil (WTR)', email: 'vikram.patil@nagarsetu.gov.in', pass: 'vikram@123' },
    { name: 'Sanjay More (DRN)', email: 'sanjay.more@nagarsetu.gov.in', pass: 'sanjay@123' },
    { name: 'Aditya Joshi (ELE)', email: 'aditya.joshi@nagarsetu.gov.in', pass: 'aditya@123' },
    { name: 'Rohan Deshmukh (TRF)', email: 'rohan.deshmukh@nagarsetu.gov.in', pass: 'rohan@123' },
    { name: 'Kunal Kulkarni (MNT)', email: 'kunal.kulkarni@nagarsetu.gov.in', pass: 'kunal@123' }
  ];

  let success = true;

  for (const dh of deptHeads) {
    const res = await request(port, 'POST', '/api/auth/login', {
      mobileOrEmail: dh.email,
      password: dh.pass
    });

    if (res.status === 200 && res.data.token && res.data.user) {
      console.log(`✓ [PASS] ${dh.name} (${dh.email}) logged in successfully.`);
    } else {
      console.error(`✗ [FAIL] ${dh.name} (${dh.email}) failed with status ${res.status}:`, res.data);
      success = false;
    }
  }

  server.close();
  if (!success) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error during test:', err);
  process.exit(1);
});
