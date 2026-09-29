const https = require('https');

async function testLiveVercelBackend() {
  console.log('=== TESTING LIVE VERCEL BACKEND: https://nagarsetu-backend-api.vercel.app ===\n');

  // 1. Health check
  console.log('1. GET /api/health');
  try {
    const healthRes = await fetch('https://nagarsetu-backend-api.vercel.app/api/health');
    console.log('Health status:', healthRes.status);
    const healthJson = await healthRes.json();
    console.log('Health response:', JSON.stringify(healthJson, null, 2));
  } catch (err) {
    console.error('Health check error:', err.message);
  }

  // 2. City Admin Login
  console.log('\n2. POST /api/auth/login (City Admin)');
  let token = null;
  try {
    const loginRes = await fetch('https://nagarsetu-backend-api.vercel.app/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@nagarsetu.gov.in', password: 'AdminPassword123!' })
    });
    console.log('Login status:', loginRes.status);
    const loginJson = await loginRes.json();
    console.log('Login user role:', loginJson.user?.role);
    console.log('Login token present:', Boolean(loginJson.token));
    token = loginJson.token;
  } catch (err) {
    console.error('Login error:', err.message);
  }

  if (!token) {
    console.log('No token obtained, testing with mock city_admin token...');
  }

  const headers = token ? { 'Authorization': `Bearer ${token}` } : {};

  // 3. Departments API
  console.log('\n3. GET /api/departments');
  try {
    const deptRes = await fetch('https://nagarsetu-backend-api.vercel.app/api/departments', { headers });
    console.log('Departments status:', deptRes.status);
    const deptJson = await deptRes.json();
    console.log('Departments count:', deptJson.departments?.length || 0);
    console.log('Departments list:', deptJson.departments?.map(d => `${d.id}:${d.code}:${d.name}`));
  } catch (err) {
    console.error('Departments API error:', err.message);
  }

  // 4. Admin Department Heads API
  console.log('\n4. GET /api/admin/department-heads');
  try {
    const dhRes = await fetch('https://nagarsetu-backend-api.vercel.app/api/admin/department-heads', { headers });
    console.log('Department heads status:', dhRes.status);
    const dhJson = await dhRes.json();
    console.log('Department heads count:', dhJson.department_heads?.length || 0);
    if (dhJson.department_heads) {
      dhJson.department_heads.forEach(dh => {
        console.log(`  HOD: ${dh.name || dh.full_name} | DeptID: ${dh.department_id} | Status: ${dh.status} | Email: ${dh.email}`);
      });
    }
  } catch (err) {
    console.error('Department heads API error:', err.message);
  }

  // 5. Department Staff API
  console.log('\n5. GET /api/department/staff');
  try {
    const staffRes = await fetch('https://nagarsetu-backend-api.vercel.app/api/department/staff', { headers });
    console.log('Staff status:', staffRes.status);
    const staffJson = await staffRes.json();
    console.log('Staff summary:', staffJson.summary);
    console.log('Staff count:', staffJson.staff?.length || 0);
  } catch (err) {
    console.error('Staff API error:', err.message);
  }

  process.exit(0);
}

testLiveVercelBackend().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
