const path = require('path');
const express = require(path.join(__dirname, '../backend/node_modules/express'));
const { initDatabase, query } = require(path.join(__dirname, '../backend/src/config/db'));
const authRoutes = require(path.join(__dirname, '../backend/src/routes/auth.routes'));
const departmentRoutes = require(path.join(__dirname, '../backend/src/routes/department.routes'));

async function testAdminStaffApi() {
  await initDatabase();

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/department', departmentRoutes);

  const server = app.listen(5077, async () => {
    console.log('Testing Admin Staff API on port 5077...');

    try {
      // 1. Check DB count
      const dbCountRes = await query('SELECT COUNT(*) as count FROM field_staff');
      const dbCount = parseInt(dbCountRes.rows[0].count, 10);
      console.log(`\n1. Database SELECT COUNT(*) FROM field_staff: ${dbCount}`);

      // 2. Login Admin
      const loginRes = await fetch('http://localhost:5077/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileOrEmail: 'admin@nagarsetu.gov.in', password: 'NagarSetu@Admin2026!' })
      });
      const loginData = await loginRes.json();
      console.log(`2. Admin Login HTTP Status: ${loginRes.status}, Role: ${loginData.user ? loginData.user.role : 'N/A'}`);
      const token = loginData.token;

      // 3. Call GET /api/department/staff
      const staffRes = await fetch('http://localhost:5077/api/department/staff', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const staffData = await staffRes.json();

      console.log('\n3. GET /api/department/staff API Response:');
      console.log('   HTTP Status:', staffRes.status);
      console.log('   Response Keys:', Object.keys(staffData));
      console.log('   Staff Array Length:', staffData.staff ? staffData.staff.length : 'N/A');
      console.log('   Summary Object:', staffData.summary);

      if (staffData.staff && staffData.staff.length > 0) {
        console.log('\n4. Sample Staff Member Received:');
        console.log(staffData.staff[0]);
      }

      console.log('\n================ VERIFICATION ================');
      console.log(`DB Count: ${dbCount} | API Staff Count: ${staffData.staff ? staffData.staff.length : 0}`);
      console.log(`Match Status: ${dbCount === (staffData.staff ? staffData.staff.length : 0)}`);
      console.log('==============================================');

      server.close();
      process.exit(0);
    } catch (err) {
      console.error('Test Error:', err);
      server.close();
      process.exit(1);
    }
  });
}

testAdminStaffApi();
