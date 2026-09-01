const path = require('path');
const express = require(path.join(__dirname, '../backend/node_modules/express'));
const { initDatabase, query } = require(path.join(__dirname, '../backend/src/config/db'));
const authRoutes = require(path.join(__dirname, '../backend/src/routes/auth.routes'));

const EXPECTED_DH_LIST = [
  { email: 'rahul.kumar@nagarsetu.gov.in', deptCode: 'PWD', deptId: 1 },
  { email: 'amit.sharma@nagarsetu.gov.in', deptCode: 'SAN', deptId: 2 },
  { email: 'vikram.patil@nagarsetu.gov.in', deptCode: 'WTR', deptId: 3 },
  { email: 'sanjay.more@nagarsetu.gov.in', deptCode: 'DRN', deptId: 4 },
  { email: 'aditya.joshi@nagarsetu.gov.in', deptCode: 'ELE', deptId: 5 },
  { email: 'rohan.deshmukh@nagarsetu.gov.in', deptCode: 'TRF', deptId: 6 },
  { email: 'kunal.kulkarni@nagarsetu.gov.in', deptCode: 'MNT', deptId: 7 }
];

async function testDhLogin() {
  await initDatabase();

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);

  const server = app.listen(5077, async () => {
    console.log('Testing Department Head Login Flow on port 5077...\n');

    try {
      let passedCount = 0;

      for (const dh of EXPECTED_DH_LIST) {
        const loginRes = await fetch('http://localhost:5077/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobileOrEmail: dh.email, password: 'nagarsetu@123' })
        });

        const status = loginRes.status;
        const data = await loginRes.json();

        if (status === 200 && data.user && data.user.role === 'department_head' && data.user.department_id == dh.deptId) {
          console.log(`[PASS] ${dh.email} -> HTTP 200 | Role: ${data.user.role} | Dept ID: ${data.user.department_id} (${data.user.department_name}) | User ID: ${data.user.id}`);
          passedCount++;
        } else {
          console.error(`[FAIL] ${dh.email} -> HTTP ${status}:`, data);
        }
      }

      // Test Wrong Password
      const wrongPwRes = await fetch('http://localhost:5077/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileOrEmail: 'rahul.kumar@nagarsetu.gov.in', password: 'WrongPassword123!' })
      });
      const wrongPwData = await wrongPwRes.json();
      const wrongPwPass = wrongPwRes.status === 401 && wrongPwData.error === 'Invalid login credentials';
      console.log(`\n[SECURITY CHECK] Wrong password returned 401 "Invalid login credentials": ${wrongPwPass}`);

      // Test Unknown Email
      const unknownRes = await fetch('http://localhost:5077/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileOrEmail: 'unknown.user@nagarsetu.gov.in', password: 'nagarsetu@123' })
      });
      const unknownData = await unknownRes.json();
      const unknownPass = unknownRes.status === 401 && unknownData.error === 'Invalid login credentials';
      console.log(`[SECURITY CHECK] Unknown email returned 401 "Invalid login credentials": ${unknownPass}`);

      console.log('\n================ FINAL TEST RESULTS ================');
      console.log(`All 7 Department Heads Logged In Successfully (7/7): ${passedCount === 7}`);
      console.log(`Security Checks Passed: ${wrongPwPass && unknownPass}`);
      console.log('====================================================');

      server.close();
      process.exit(passedCount === 7 && wrongPwPass && unknownPass ? 0 : 1);
    } catch (err) {
      console.error('DH Test Error:', err);
      server.close();
      process.exit(1);
    }
  });
}

testDhLogin();
