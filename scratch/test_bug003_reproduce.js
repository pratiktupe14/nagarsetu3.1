const http = require('http');

console.log('=======================================================');
console.log('  BUG-003 Regression Test: Task Status Validation      ');
console.log('=======================================================');

function loginAdmin() {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      mobileOrEmail: '9876543213',
      password: 'NagarSetu@Admin2026!'
    });

    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data).token));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function testUpdateStatus(token, statusValue) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ status: statusValue });

    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/staff/task/1/status',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function run() {
  try {
    const token = await loginAdmin();
    console.log('Obtained Auth Token.');

    const statusesToTest = ['Accepted', 'On the Way', 'In Progress', 'Resolution Submitted', 'Resolved'];
    let allPassed = true;

    for (const st of statusesToTest) {
      console.log(`Testing task status: "${st}" ...`);
      const res = await testUpdateStatus(token, st);
      console.log(`Status "${st}" Response Code: ${res.status}`);

      if (res.status === 400 && res.body.includes('must be one of')) {
        console.error(`❌ FAILURE: Status "${st}" was rejected by validation.`);
        allPassed = false;
      }
    }

    if (allPassed) {
      console.log('🎉 BUG-003 PASSED: All valid task statuses accepted by schema validation.');
    } else {
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

run();
