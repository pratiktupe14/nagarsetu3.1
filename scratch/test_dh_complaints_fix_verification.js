const http = require('http');
const app = require('../backend/src/app');
const { initDatabase, query } = require('../backend/src/config/db');
const seed7DemoDepartmentHeads = require('../backend/src/scripts/seedDemoDepartmentHeads');
const { generateToken } = require('../backend/src/middleware/auth');

function request(port, method, pathUrl, token = null) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: '127.0.0.1',
      port,
      path: pathUrl,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      }
    }, res => {
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
    req.end();
  });
}

async function runTest() {
  console.log('========================================================');
  console.log('  TESTING DEPARTMENT HEAD COMPLAINT VISIBILITY FIX     ');
  console.log('========================================================\n');

  process.env.FORCE_PASSWORD_RESET = 'true';
  await initDatabase();
  await seed7DemoDepartmentHeads(query);

  const server = http.createServer(app);
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;

  let passed = true;

  const dhs = [
    { code: 'PWD', email: 'rahul.kumar@nagarsetu.gov.in', name: 'Rahul Kumar', deptId: '1', uuidDeptId: '8ed9f760-1314-427c-a515-c2a54d6df6d8' },
    { code: 'SAN', email: 'amit.sharma@nagarsetu.gov.in', name: 'Amit Sharma', deptId: '2', uuidDeptId: '7fd9f760-1314-427c-a515-c2a54d6df6d7' },
    { code: 'WTR', email: 'vikram.patil@nagarsetu.gov.in', name: 'Vikram Patil', deptId: '3', uuidDeptId: '6fd9f760-1314-427c-a515-c2a54d6df6d6' },
    { code: 'DRN', email: 'sanjay.more@nagarsetu.gov.in', name: 'Sanjay More', deptId: '4', uuidDeptId: '5fd9f760-1314-427c-a515-c2a54d6df6d5' },
    { code: 'ELE', email: 'kunal.kulkarni@nagarsetu.gov.in', name: 'Kunal Kulkarni', deptId: '5', uuidDeptId: '4fd9f760-1314-427c-a515-c2a54d6df6d4' },
    { code: 'TRF', email: 'rohan.deshmukh@nagarsetu.gov.in', name: 'Rohan Deshmukh', deptId: '6', uuidDeptId: '3fd9f760-1314-427c-a515-c2a54d6df6d3' },
    { code: 'MNT', email: 'aditya.joshi@nagarsetu.gov.in', name: 'Aditya Joshi', deptId: '7', uuidDeptId: '2fd9f760-1314-427c-a515-c2a54d6df6d2' }
  ];

  for (const dh of dhs) {
    // Test with UUID token
    const token = generateToken({
      id: 100 + parseInt(dh.deptId),
      name: dh.name,
      email: dh.email,
      role: 'department_head',
      department_id: dh.uuidDeptId,
      department_code: dh.code
    });

    const res1 = await request(port, 'GET', '/api/department/complaints', token);
    const complaints1 = res1.data?.complaints || [];

    const res2 = await request(port, 'GET', '/api/officer/complaints', token);
    const complaints2 = res2.data?.complaints || [];

    console.log(`[DH ${dh.code}] ${dh.name}:`);
    console.log(`  GET /api/department/complaints: Status ${res1.status}, Returned ${complaints1.length} complaints`);
    console.log(`  GET /api/officer/complaints:     Status ${res2.status}, Returned ${complaints2.length} complaints`);

    if (res1.status !== 200 || complaints1.length === 0) {
      console.error(`✗ [FAIL] ${dh.name} (${dh.code}) returned 0 complaints from /api/department/complaints!`);
      passed = false;
    }

    if (res2.status !== 200 || complaints2.length === 0) {
      console.error(`✗ [FAIL] ${dh.name} (${dh.code}) returned 0 complaints from /api/officer/complaints!`);
      passed = false;
    }

    // Security check: verify all returned complaints belong to dh.code
    const leaked1 = complaints1.filter(c => {
      const cDept = String(c.department_id || '');
      if (dh.code === 'PWD' && (cDept === '1' || cDept === 'PWD')) return false;
      if (dh.code === 'SAN' && (cDept === '2' || cDept === 'SAN')) return false;
      if (dh.code === 'WTR' && (cDept === '3' || cDept === 'WTR')) return false;
      if (dh.code === 'DRN' && (cDept === '4' || cDept === 'DRN')) return false;
      if (dh.code === 'ELE' && (cDept === '5' || cDept === 'ELE')) return false;
      if (dh.code === 'TRF' && (cDept === '6' || cDept === 'TRF')) return false;
      if (dh.code === 'MNT' && (cDept === '7' || cDept === 'MNT')) return false;
      return true;
    });

    if (leaked1.length > 0) {
      console.error(`✗ [SECURITY FAIL] Cross-department complaints leaked into ${dh.code} view:`, leaked1.length);
      passed = false;
    } else {
      console.log(`  ✓ Security Isolation PASS: 0 non-${dh.code} complaints leaked.`);
    }
    console.log('');
  }

  server.close();
  console.log('========================================================');
  console.log(`RESULT: ${passed ? 'ALL PASSED (SUCCESS)' : 'FAILED'}`);
  console.log('========================================================');
  process.exit(passed ? 0 : 1);
}

runTest().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
