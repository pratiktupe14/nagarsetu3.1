const path = require('path');
const express = require(path.join(__dirname, '../backend/node_modules/express'));
const { initDatabase } = require(path.join(__dirname, '../backend/src/config/db'));
const authRoutes = require(path.join(__dirname, '../backend/src/routes/auth.routes'));

async function testApiLogin() {
  await initDatabase();

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);

  const server = app.listen(5099, async () => {
    console.log('Testing Express server running on port 5099...');

    try {
      // Test 1: Mobile login
      const resMobile = await fetch('http://localhost:5099/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileOrEmail: '8788562103', password: '8788562103' })
      });
      const dataMobile = await resMobile.json();
      console.log('\n--- HTTP MOBILE LOGIN TEST ---');
      console.log('HTTP Status:', resMobile.status);
      console.log('Response JSON:', dataMobile);

      // Test 2: Email login
      const resEmail = await fetch('http://localhost:5099/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileOrEmail: 'citizen8788@nagarsetu.gov.in', password: '8788562103' })
      });
      const dataEmail = await resEmail.json();
      console.log('\n--- HTTP EMAIL LOGIN TEST ---');
      console.log('HTTP Status:', resEmail.status);
      console.log('Response JSON:', dataEmail);

      console.log('\n--- ID MATCH CHECK ---');
      console.log('Mobile user.id === Email user.id:', dataMobile.user.id === dataEmail.user.id);
      console.log('User ID:', dataMobile.user.id);
      console.log('User Role:', dataMobile.user.role);

      server.close();
      process.exit(0);
    } catch (err) {
      console.error('API Test Error:', err);
      server.close();
      process.exit(1);
    }
  });
}

testApiLogin();
