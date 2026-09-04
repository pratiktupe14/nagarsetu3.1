const BASE_URL = 'https://nagarsetu-backend-api.vercel.app';

async function testPortals() {
  console.log('================================================================');
  console.log('  NAGARSETU PRODUCTION PORTALS & BACKEND VERIFICATION');
  console.log(`  Target Backend URL: ${BASE_URL}`);
  console.log('================================================================\n');

  let allPassed = true;

  // 1. Health Check
  try {
    console.log('1. Testing Root & /api/health Endpoints...');
    const rootRes = await fetch(`${BASE_URL}/`);
    const rootData = await rootRes.json();
    console.log(`   Root (/) status ${rootRes.status}:`, rootData.service || rootData.message);

    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthData = await healthRes.json();
    console.log(`   /api/health status ${healthRes.status}: DB=${healthData.database} (${healthData.database_type})`);
    if (healthRes.status !== 200 || healthData.database !== 'connected') {
      throw new Error('Health check failed or database disconnected');
    }
    console.log('   ✓ Health Check PASSED\n');
  } catch (err) {
    console.error('   ❌ Health check error:', err.message);
    allPassed = false;
  }

  // 2. Citizen Login Test (8788562103)
  let citizenToken = null;
  try {
    console.log('2. Testing Citizen Login (8788562103)...');
    const citRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileOrEmail: '8788562103', password: '8788562103' })
    });
    const citData = await citRes.json();
    console.log(`   Citizen Login HTTP ${citRes.status}: User='${citData.user?.name}', Role='${citData.user?.role}', Token=${Boolean(citData.token)}`);
    if (citRes.status !== 200 || !citData.token) {
      throw new Error(`Citizen login failed: ${citData.error || citData.message}`);
    }
    citizenToken = citData.token;
    console.log('   ✓ Citizen Portal Login PASSED\n');
  } catch (err) {
    console.error('   ❌ Citizen Login error:', err.message);
    allPassed = false;
  }

  // 3. Citizen My Complaints API Test
  if (citizenToken) {
    try {
      console.log('3. Testing Citizen My Complaints API (/api/complaints/my)...');
      const compRes = await fetch(`${BASE_URL}/api/complaints/my`, {
        headers: { Authorization: `Bearer ${citizenToken}` }
      });
      const compData = await compRes.json();
      const list = Array.isArray(compData) ? compData : compData.complaints || [];
      console.log(`   My Complaints HTTP ${compRes.status}: Received ${list.length} complaints`);
      if (compRes.status !== 200) throw new Error('Failed to fetch complaints');
      console.log('   ✓ Citizen Complaints Fetch PASSED\n');
    } catch (err) {
      console.error('   ❌ Citizen complaints error:', err.message);
      allPassed = false;
    }
  }

  // 4. City Admin Login Test (admin@nagarsetu.gov.in)
  let adminToken = null;
  try {
    console.log('4. Testing City Admin Login (admin@nagarsetu.gov.in)...');
    const admRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileOrEmail: 'admin@nagarsetu.gov.in', password: 'NagarSetu@Admin2026!' })
    });
    const admData = await admRes.json();
    console.log(`   City Admin Login HTTP ${admRes.status}: User='${admData.user?.name}', Role='${admData.user?.role}', Token=${Boolean(admData.token)}`);
    if (admRes.status !== 200 || !admData.token) {
      throw new Error(`City Admin login failed: ${admData.error || admData.message}`);
    }
    adminToken = admData.token;
    console.log('   ✓ City Admin Portal Login PASSED\n');
  } catch (err) {
    console.error('   ❌ City Admin Login error:', err.message);
    allPassed = false;
  }

  // 5. Department Head Login Test (rahul.kumar@nagarsetu.gov.in)
  let headToken = null;
  try {
    console.log('5. Testing Department Head Login (rahul.kumar@nagarsetu.gov.in)...');
    const headRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileOrEmail: 'rahul.kumar@nagarsetu.gov.in', password: 'nagarsetu@123' })
    });
    const headData = await headRes.json();
    console.log(`   Dept Head Login HTTP ${headRes.status}: User='${headData.user?.name}', Dept='${headData.user?.department_id}', Role='${headData.user?.role}', Token=${Boolean(headData.token)}`);
    if (headRes.status !== 200 || !headData.token) {
      throw new Error(`Dept Head login failed: ${headData.error || headData.message}`);
    }
    headToken = headData.token;

    // Test Department Head Staff List
    const staffRes = await fetch(`${BASE_URL}/api/department/staff`, {
      headers: { Authorization: `Bearer ${headToken}` }
    });
    const staffData = await staffRes.json();
    console.log(`   Dept Staff API HTTP ${staffRes.status}: Total Staff=${staffData.summary?.totalStaff ?? (staffData.staff || []).length}`);
    if (staffRes.status !== 200) throw new Error('Failed to fetch department staff');
    console.log('   ✓ Department Head Portal Login & Staff Fetch PASSED\n');
  } catch (err) {
    console.error('   ❌ Dept Head Login error:', err.message);
    allPassed = false;
  }

  // 6. Field Staff Login Test (staff@nagarsetu.gov.in)
  try {
    console.log('6. Testing Field Staff Login (staff@nagarsetu.gov.in)...');
    let staffRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileOrEmail: 'staff@nagarsetu.gov.in', password: 'nagarsetu@123' })
    });
    if (!staffRes.ok) {
      staffRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileOrEmail: 'staff@nagarsetu.gov.in', password: 'password123' })
      });
    }
    const staffData = await staffRes.json();
    console.log(`   Field Staff Login HTTP ${staffRes.status}: User='${staffData.user?.name}', Role='${staffData.user?.role}', Token=${Boolean(staffData.token)}`);
    if (staffRes.status !== 200 || !staffData.token) {
      throw new Error(`Field Staff login failed: ${staffData.error || staffData.message}`);
    }
    console.log('   ✓ Field Staff Portal Login PASSED\n');
  } catch (err) {
    console.error('   ❌ Field Staff Login error:', err.message);
    allPassed = false;
  }

  console.log('================================================================');
  if (allPassed) {
    console.log('  🎉 ALL PRODUCTION BACKEND CONNECTIVITY & PORTAL LOGINS PASSED!');
  } else {
    console.log('  ❌ ONE OR MORE CHECKS FAILED.');
  }
  console.log('================================================================');
}

testPortals().catch(console.error);
