const http = require('http');

console.log('=======================================================');
console.log('  BUG-002 Reproduction Test: String ID Validation      ');
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

function testAssignStaff(token, complaintId, staffId) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      complaint_id: complaintId,
      staff_id: staffId,
      remark: 'Test assignment'
    });

    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/officer/assign',
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
    console.log('Obtained Admin Auth Token.');

    console.log('Testing string complaint_id ("NS-2026-999999") and string staff_id ("MNT-STF-001")...');
    const res = await testAssignStaff(token, 'NS-2026-999999', 'MNT-STF-001');
    console.log(`Response Status: ${res.status}`);
    console.log(`Response Body: ${res.body}`);

    if (res.status === 400 && (res.body.includes('must be a number') || res.body.includes('Validation Error'))) {
      console.log('❌ BUG REPRODUCED: Joi validation rejected string IDs with 400 Bad Request.');
      process.exit(1);
    } else {
      console.log('✅ PASS: String IDs accepted by validation schema.');
    }
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

run();
