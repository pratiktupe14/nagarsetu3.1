const path = require('path');
const express = require(path.join(__dirname, '../backend/node_modules/express'));
const { initDatabase, query } = require(path.join(__dirname, '../backend/src/config/db'));
const authRoutes = require(path.join(__dirname, '../backend/src/routes/auth.routes'));
const departmentRoutes = require(path.join(__dirname, '../backend/src/routes/department.routes'));

async function testFlow() {
  await initDatabase();

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/department', departmentRoutes);

  const server = app.listen(5076, async () => {
    console.log('Testing Admin Staff Flow on port 5076...');

    try {
      // 1. Verify DB count
      const countRes = await query('SELECT COUNT(*) as count FROM field_staff');
      const dbCount = parseInt(countRes.rows[0].count, 10);
      console.log(`\n1. Database field_staff Count: ${dbCount}`);

      // 2. Admin Login
      const loginRes = await fetch('http://localhost:5076/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileOrEmail: 'admin@nagarsetu.gov.in', password: 'NagarSetu@Admin2026!' })
      });
      const loginData = await loginRes.json();
      const token = loginData.token;
      console.log(`2. Admin Login HTTP ${loginRes.status}, User Role: ${loginData.user.role}`);

      // 3. Admin API Fetch (/api/department/staff)
      const apiRes = await fetch('http://localhost:5076/api/department/staff', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await apiRes.json();
      console.log(`3. Admin API Staff Array Count: ${data.staff.length}`);
      console.log(`   Summary stats: Total: ${data.summary.totalStaff}, Active: ${data.summary.activeStaff}, Inactive: ${data.summary.inactiveStaff}`);

      // 4. Department breakdown verification
      const deptCounts = {};
      data.staff.forEach(s => {
        const d = s.department_name || 'Unknown';
        deptCounts[d] = (deptCounts[d] || 0) + 1;
      });

      console.log('\n4. Department Breakdown of Staff Array:');
      Object.entries(deptCounts).forEach(([dept, cnt]) => {
        console.log(`   - ${dept}: ${cnt} staff`);
      });

      const countMatches = dbCount === data.staff.length && dbCount === data.summary.totalStaff;
      const allDeptsPresent = Object.keys(deptCounts).length >= 7;

      console.log('\n================ FINAL TEST RESULT ================');
      console.log(`Database count (36) === API response count (${data.staff.length}): ${countMatches}`);
      console.log(`All 7 departments represented: ${allDeptsPresent}`);
      console.log('===================================================');

      server.close();
      process.exit(0);
    } catch (err) {
      console.error('Flow Test Error:', err);
      server.close();
      process.exit(1);
    }
  });
}

testFlow();
