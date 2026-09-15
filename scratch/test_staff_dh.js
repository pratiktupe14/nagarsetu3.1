const app = require('../backend/src/app');
const { initDatabase } = require('../backend/src/config/db');

async function test() {
  await initDatabase();
  const server = app.listen(5006, async () => {
    try {
      const port = 5006;
      // Test login for Rahul Kumar (PWD Department Head)
      const loginRes = await fetch(`http://localhost:${port}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: 'rahul.kumar@nagarsetu.gov.in', password: 'nagarsetu@123' })
      });

      const loginData = await loginRes.json();
      console.log('Login Status:', loginRes.status);
      console.log('Login Result user:', loginData.user);

      if (loginData.token) {
        // Test 1: fetch with query param department_id=1
        const res1 = await fetch(`http://localhost:${port}/api/department/staff?status=active&department_id=1`, {
          headers: { Authorization: `Bearer ${loginData.token}` }
        });
        console.log('\n--- DEPT HEAD GET /api/department/staff?status=active&department_id=1 ---');
        console.log('Status:', res1.status);
        const data1 = await res1.json();
        console.log('Summary:', data1.summary);
        console.log('Staff count:', data1.staff ? data1.staff.length : 0);
        console.log('Staff items:', data1.staff);

        // Test 2: fetch with status=active (no department_id in query)
        const res2 = await fetch(`http://localhost:${port}/api/department/staff?status=active`, {
          headers: { Authorization: `Bearer ${loginData.token}` }
        });
        console.log('\n--- DEPT HEAD GET /api/department/staff?status=active ---');
        console.log('Status:', res2.status);
        const data2 = await res2.json();
        console.log('Summary:', data2.summary);
        console.log('Staff count:', data2.staff ? data2.staff.length : 0);

        // Test 3: Admin login fetch staff
        const adminLoginRes = await fetch(`http://localhost:${port}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier: 'admin@nagarsetu.gov.in', password: 'nagarsetu@123' })
        });
        const adminData = await adminLoginRes.json();
        if (adminData.token) {
          const resAdmin = await fetch(`http://localhost:${port}/api/department/staff?status=active`, {
            headers: { Authorization: `Bearer ${adminData.token}` }
          });
          const dataAdmin = await resAdmin.json();
          console.log('\n--- ADMIN GET /api/department/staff?status=active ---');
          console.log('Admin Staff count:', dataAdmin.staff ? dataAdmin.staff.length : 0);
          console.log('Admin Staff summary:', dataAdmin.summary);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      server.close();
      process.exit(0);
    }
  });
}

test().catch(console.error);
