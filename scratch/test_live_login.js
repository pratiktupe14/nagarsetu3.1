async function testLiveLogin() {
  console.log('=== LOGGING IN AS CITY ADMIN ON LIVE PRODUCTION ===\n');

  const passwordsToTry = ['admin@123', 'AdminPassword123!', 'password123', 'admin123'];

  let loginRes = null;
  let token = null;

  for (const pwd of passwordsToTry) {
    try {
      console.log(`Trying password: ${pwd}`);
      const res = await fetch('https://nagarsetu-backend-api.vercel.app/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@nagarsetu.gov.in', password: pwd })
      });
      const data = await res.json();
      if (res.ok && data.token) {
        console.log(` SUCCESS! Logged in with password: ${pwd}`);
        console.log('User role:', data.user.role);
        token = data.token;
        break;
      } else {
        console.log(` Failed (${res.status}):`, data.error || data.message);
      }
    } catch (err) {
      console.error('Login error:', err.message);
    }
  }

  if (!token) {
    console.log('Could not log in with standard passwords.');
    process.exit(1);
  }

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // 1. GET /api/departments
  console.log('\n1. GET /api/departments');
  const dRes = await fetch('https://nagarsetu-backend-api.vercel.app/api/departments', { headers });
  const dJson = await dRes.json();
  console.log('Status:', dRes.status, '| Count:', dJson.departments?.length);

  // 2. GET /api/admin/department-heads
  console.log('\n2. GET /api/admin/department-heads');
  const dhRes = await fetch('https://nagarsetu-backend-api.vercel.app/api/admin/department-heads', { headers });
  const dhJson = await dhRes.json();
  console.log('Status:', dhRes.status, '| HOD Count:', dhJson.department_heads?.length);
  if (dhJson.department_heads) {
    dhJson.department_heads.forEach(dh => {
      console.log(`  HOD: ${dh.name || dh.full_name} | Dept: ${dh.department_id} | Status: ${dh.status} | Email: ${dh.email}`);
    });
  }

  // 3. GET /api/department/staff
  console.log('\n3. GET /api/department/staff');
  const staffRes = await fetch('https://nagarsetu-backend-api.vercel.app/api/department/staff', { headers });
  const staffJson = await staffRes.json();
  console.log('Status:', staffRes.status, '| Staff Count:', staffJson.staff?.length);
  console.log('Summary:', staffJson.summary);

  process.exit(0);
}

testLiveLogin().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
