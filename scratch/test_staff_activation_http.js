const http = require('http');

console.log('=======================================================');
console.log('  Testing Staff Activation & Deactivation HTTP Methods ');
console.log('=======================================================');

function makeRequest(path, method, token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'localhost',
      port: 5000,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });

    req.on('error', (err) => reject(err));
    req.end();
  });
}

async function loginAdmin() {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      mobileOrEmail: '9876543213',
      password: 'NagarSetu@Admin2026!'
    });

    const options = {
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve(parsed.token);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(payload);
    req.end();
  });
}

async function run() {
  try {
    const token = await loginAdmin();
    console.log('Obtained Admin Auth Token.');

    // Test 1: Send PATCH to /api/department/staff/1/deactivate
    console.log('Testing PATCH /api/department/staff/1/deactivate ...');
    const patchDeactivate = await makeRequest('/api/department/staff/1/deactivate', 'PATCH', token);
    console.log(`PATCH Deactivate Response Status: ${patchDeactivate.status}`);

    // Test 2: Send POST to /api/department/staff/1/deactivate
    console.log('Testing POST /api/department/staff/1/deactivate ...');
    const postDeactivate = await makeRequest('/api/department/staff/1/deactivate', 'POST', token);
    console.log(`POST Deactivate Response Status: ${postDeactivate.status}`);

    // Test 3: Send PATCH to /api/department/staff/1/activate
    console.log('Testing PATCH /api/department/staff/1/activate ...');
    const patchActivate = await makeRequest('/api/department/staff/1/activate', 'PATCH', token);
    console.log(`PATCH Activate Response Status: ${patchActivate.status}`);

    // Test 4: Send POST to /api/department/staff/1/activate
    console.log('Testing POST /api/department/staff/1/activate ...');
    const postActivate = await makeRequest('/api/department/staff/1/activate', 'POST', token);
    console.log(`POST Activate Response Status: ${postActivate.status}`);

    if (patchDeactivate.status === 200 && postDeactivate.status === 200 && patchActivate.status === 200 && postActivate.status === 200) {
      console.log('🎉 ALL TESTS PASSED: Both PATCH and POST are 100% supported for staff activate/deactivate.');
    } else {
      console.error('❌ FAILURE: Unexpected status returned.');
      process.exit(1);
    }
  } catch (err) {
    console.error('Test execution error:', err);
    process.exit(1);
  }
}

run();
