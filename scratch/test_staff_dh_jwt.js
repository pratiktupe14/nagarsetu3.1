const app = require('../backend/src/app');
const { initDatabase } = require('../backend/src/config/db');
const jwt = require('../backend/node_modules/jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'nagarsetu_secret_key_2026_super_secure';

async function test() {
  await initDatabase();
  const server = app.listen(5007, async () => {
    try {
      const port = 5007;

      // 1. JWT for Department Head with department_id = 1
      const dhToken1 = jwt.sign(
        { id: 128, name: 'Rahul Kumar', email: 'rahul.kumar@nagarsetu.gov.in', role: 'department_head', department_id: 1, department_name: 'Public Works Department (PWD)' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      // 2. JWT for Department Head with department_id = 'PWD'
      const dhTokenPWD = jwt.sign(
        { id: 128, name: 'Rahul Kumar', email: 'rahul.kumar@nagarsetu.gov.in', role: 'department_head', department_id: 'PWD', department_name: 'Public Works Department (PWD)' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      // 3. JWT for Admin
      const adminToken = jwt.sign(
        { id: 1, name: 'Admin', email: 'admin@nagarsetu.gov.in', role: 'admin' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      console.log('\n--- 1. DEPT HEAD (department_id=1) GET /api/department/staff?status=active ---');
      const r1 = await fetch(`http://localhost:${port}/api/department/staff?status=active`, {
        headers: { Authorization: `Bearer ${dhToken1}` }
      });
      const d1 = await r1.json();
      console.log('Status:', r1.status);
      console.log('Summary:', d1.summary);
      console.log('Staff count:', d1.staff ? d1.staff.length : 0);

      console.log('\n--- 2. DEPT HEAD (department_id=1) GET /api/department/staff?status=active&department_id=1 ---');
      const r2 = await fetch(`http://localhost:${port}/api/department/staff?status=active&department_id=1`, {
        headers: { Authorization: `Bearer ${dhToken1}` }
      });
      const d2 = await r2.json();
      console.log('Status:', r2.status);
      console.log('Summary:', d2.summary);
      console.log('Staff count:', d2.staff ? d2.staff.length : 0);

      console.log('\n--- 3. DEPT HEAD (department_id="PWD") GET /api/department/staff?status=active ---');
      const r3 = await fetch(`http://localhost:${port}/api/department/staff?status=active`, {
        headers: { Authorization: `Bearer ${dhTokenPWD}` }
      });
      const d3 = await r3.json();
      console.log('Status:', r3.status);
      console.log('Summary:', d3.summary);
      console.log('Staff count:', d3.staff ? d3.staff.length : 0);

      console.log('\n--- 4. ADMIN GET /api/department/staff?status=active ---');
      const r4 = await fetch(`http://localhost:${port}/api/department/staff?status=active`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const d4 = await r4.json();
      console.log('Status:', r4.status);
      console.log('Summary:', d4.summary);
      console.log('Staff count:', d4.staff ? d4.staff.length : 0);

    } catch (e) {
      console.error(e);
    } finally {
      server.close();
      process.exit(0);
    }
  });
}

test().catch(console.error);
