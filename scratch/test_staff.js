const path = require('path');
const { initDatabase, query } = require('../backend/src/config/db');

async function test() {
  await initDatabase();

  // Test login for Aditya Joshi (ELE Department Head)
  const loginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobileOrEmail: 'aditya.joshi@nagarsetu.gov.in', password: 'nagarsetu@123' })
  });

  const loginData = await loginRes.json();
  console.log('Login Result:', loginData);

  if (loginData.token) {
    const staffRes = await fetch('http://localhost:5000/api/department/staff', {
      headers: { Authorization: `Bearer ${loginData.token}` }
    });

    console.log('Staff API Status:', staffRes.status);
    const staffData = await staffRes.json();
    console.log('Staff API Data:', JSON.stringify(staffData, null, 2));
  }
}

test().catch(console.error);
