const app = require('../backend/src/app');
const { initDatabase } = require('../backend/src/config/db');
const jwt = require('../backend/node_modules/jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'nagarsetu_secret_key_2026_super_secure';

async function test() {
  await initDatabase();
  const server = app.listen(5008, async () => {
    try {
      const port = 5008;

      // 1. Department Head with department_id = 1
      const tokenNumeric = jwt.sign(
        { id: 128, name: 'Rahul Kumar', email: 'rahul.kumar@nagarsetu.gov.in', role: 'department_head', department_id: 1 },
        JWT_SECRET, { expiresIn: '1h' }
      );

      // 2. Department Head with department_id = 'PWD'
      const tokenCode = jwt.sign(
        { id: 128, name: 'Rahul Kumar', email: 'rahul.kumar@nagarsetu.gov.in', role: 'department_head', department_id: 'PWD' },
        JWT_SECRET, { expiresIn: '1h' }
      );

      // 3. Department Head with department_id = 'DEPT-1'
      const tokenDept1 = jwt.sign(
        { id: 128, name: 'Rahul Kumar', email: 'rahul.kumar@nagarsetu.gov.in', role: 'department_head', department_id: 'DEPT-1' },
        JWT_SECRET, { expiresIn: '1h' }
      );

      // 4. Department Head with department_id = 'Public Works Department'
      const tokenFullName = jwt.sign(
        { id: 128, name: 'Rahul Kumar', email: 'rahul.kumar@nagarsetu.gov.in', role: 'department_head', department_id: 'Public Works Department' },
        JWT_SECRET, { expiresIn: '1h' }
      );

      // 5. Admin Token
      const adminToken = jwt.sign(
        { id: 1, name: 'Admin', email: 'admin@nagarsetu.gov.in', role: 'admin' },
        JWT_SECRET, { expiresIn: '1h' }
      );

      const testTokens = [
        { label: 'Numeric (1)', token: tokenNumeric },
        { label: 'Code (PWD)', token: tokenCode },
        { label: 'DEPT-1', token: tokenDept1 },
        { label: 'Full Name (Public Works)', token: tokenFullName },
      ];

      for (const t of testTokens) {
        const res = await fetch(`http://localhost:${port}/api/department/staff?status=active`, {
          headers: { Authorization: `Bearer ${t.token}` }
        });
        const data = await res.json();
        console.log(`\nDept Head Token [${t.label}]: Status ${res.status}, Staff Count: ${data.staff ? data.staff.length : 0}`);
        console.log(`Summary:`, data.summary);
      }

      // Test Admin fetch without department_id (should return ALL staff)
      const resAdminAll = await fetch(`http://localhost:${port}/api/department/staff?status=active`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const dataAdminAll = await resAdminAll.json();
      console.log(`\nAdmin Token (All Depts): Status ${resAdminAll.status}, Staff Count: ${dataAdminAll.staff ? dataAdminAll.staff.length : 0}`);

      // Test Admin fetch WITH department_id='DEPT-1' (should return PWD staff)
      const resAdminFilter = await fetch(`http://localhost:${port}/api/department/staff?status=active&department_id=DEPT-1`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });
      const dataAdminFilter = await resAdminFilter.json();
      console.log(`\nAdmin Token (Filtered by DEPT-1): Status ${resAdminFilter.status}, Staff Count: ${dataAdminFilter.staff ? dataAdminFilter.staff.length : 0}`);

    } catch (e) {
      console.error(e);
    } finally {
      server.close();
      process.exit(0);
    }
  });
}

test().catch(console.error);
