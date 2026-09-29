const http = require('http');

async function loginAndCheck(email, pass) {
  return new Promise((resolve) => {
    const data = JSON.stringify({ mobileOrEmail: email, password: pass });
    const req = http.request({
      hostname: 'localhost',
      port: 5000,
      path: '/api/auth/login',
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, (res) => {
      let b = '';
      res.on('data', c => b += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(b) }); }
        catch (e) { resolve({ status: res.statusCode, raw: b }); }
      });
    });
    req.on('error', err => resolve({ error: err.message }));
    req.write(data);
    req.end();
  });
}

async function run() {
  console.log('=== STEP 7 & 8: SECURITY & DEPARTMENT HEAD PORTAL TESTING ===\n');

  const usersToTest = [
    { role: 'PWD Head', email: 'rahul.kumar@nagarsetu.gov.in', pass: 'nagarsetu@123', expectedDept: '1' },
    { role: 'ELE Head', email: 'kunal.kulkarni@nagarsetu.gov.in', pass: 'nagarsetu@123', expectedDept: '5' },
    { role: 'MNT Head', email: 'aditya.joshi@nagarsetu.gov.in', pass: 'nagarsetu@123', expectedDept: '7' }
  ];

  for (const u of usersToTest) {
    const lRes = await loginAndCheck(u.email, u.pass);
    if (lRes.data && lRes.data.user) {
      console.log(`[LOGIN SUCCESS] ${u.role} (${u.email}):`);
      console.log(`  Role: ${lRes.data.user.role} | DeptID: ${lRes.data.user.department_id} | Code: ${lRes.data.user.department_code}`);
    } else {
      console.log(`[LOGIN NOTE/STATUS] ${u.role}:`, lRes.status, lRes.data || lRes.error || lRes.raw);
    }
  }
}

run();
