const BASE_URL = 'https://nagarsetu-backend-api.vercel.app';

async function runRegressionSuite() {
  console.log('==================================================');
  console.log('NAGARSETU 3.1 — MASTER PRODUCTION REGRESSION SUITE');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`✓ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`✗ FAIL: ${testName}`);
      failed++;
    }
  }

  // 1. Health check
  try {
    const res = await fetch(`${BASE_URL}/api/health`);
    const data = await res.json();
    assert(res.ok && data.status === 'ok' && data.database === 'connected', 'System Health Check (/api/health)');
  } catch (err) {
    assert(false, `System Health Check (${err.message})`);
  }

  // 2. City Admin Portal Verification
  let adminToken = null;
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@nagarsetu.gov.in', password: 'admin@123' })
    });
    const data = await res.json();
    assert(res.ok && data.token && (data.user?.role === 'city_admin' || data.user?.role === 'admin'), 'City Admin Authentication');
    adminToken = data.token;
  } catch (err) {
    assert(false, `City Admin Auth (${err.message})`);
  }

  if (adminToken) {
    const headers = { 'Authorization': `Bearer ${adminToken}` };

    // Admin Departments
    try {
      const res = await fetch(`${BASE_URL}/api/departments`, { headers });
      const data = await res.json();
      assert(res.ok && data.departments?.length === 7, 'Admin Departments API (7 official departments)');
    } catch (err) {
      assert(false, `Admin Departments (${err.message})`);
    }

    // Admin Department Heads
    try {
      const res = await fetch(`${BASE_URL}/api/admin/department-heads`, { headers });
      const data = await res.json();
      const heads = data.department_heads || [];
      const officialHeads = heads.filter(h => h.status === 'active');
      assert(res.ok && officialHeads.length >= 7, `Admin Department Heads API (${officialHeads.length} active department heads)`);

      const mappedDepts = new Set(officialHeads.map(h => String(h.department_id)));
      assert(mappedDepts.size >= 7, 'All 7 Municipal Departments have Active HODs assigned');
    } catch (err) {
      assert(false, `Admin Department Heads (${err.message})`);
    }

    // Admin Staff Management
    try {
      const res = await fetch(`${BASE_URL}/api/department/staff`, { headers });
      const data = await res.json();
      assert(res.ok && data.staff?.length === 36, `Admin Staff Management API (${data.staff?.length || 0} service staff total, expected 36)`);
      assert(data.summary?.totalStaff === 36, 'Admin Staff Summary metric totalStaff === 36');
    } catch (err) {
      assert(false, `Admin Staff Management (${err.message})`);
    }
  }

  // 3. Department Head Portal Verification (PWD Head)
  let pwdHeadToken = null;
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'rahul.kumar@nagarsetu.gov.in', password: 'head@123' })
    });
    const data = await res.json();
    assert(res.ok && data.token && data.user?.role === 'department_head', 'PWD Department Head Authentication (Rahul Kumar)');
    pwdHeadToken = data.token;
  } catch (err) {
    assert(false, `PWD Head Auth (${err.message})`);
  }

  if (pwdHeadToken) {
    const headers = { 'Authorization': `Bearer ${pwdHeadToken}` };

    // PWD Head Staff
    try {
      const res = await fetch(`${BASE_URL}/api/department/staff`, { headers });
      const data = await res.json();
      assert(res.ok && data.staff?.length === 6, `PWD Department Staff API (${data.staff?.length || 0} staff returned, expected 6)`);
    } catch (err) {
      assert(false, `PWD Staff (${err.message})`);
    }

    // PWD Head Complaints
    try {
      const res = await fetch(`${BASE_URL}/api/department/complaints`, { headers });
      assert(res.ok, 'PWD Department Complaints API access allowed');
    } catch (err) {
      assert(false, `PWD Complaints (${err.message})`);
    }
  }

  // 4. Cross-Department Security Isolation Verification
  if (pwdHeadToken) {
    try {
      // PWD head requesting Electrical staff explicitly via department_id filter
      const res = await fetch(`${BASE_URL}/api/department/staff?department_id=5`, {
        headers: { 'Authorization': `Bearer ${pwdHeadToken}` }
      });
      const data = await res.json();
      const nonPwdStaff = (data.staff || []).filter(s => String(s.department_id) !== '1' && String(s.department_id) !== 'PWD');
      assert(res.status === 403 || nonPwdStaff.length === 0, 'Security Isolation: Department Head cannot access cross-department staff data');
    } catch (err) {
      assert(false, `Security Isolation (${err.message})`);
    }
  }

  // 5. Service Staff Portal Verification
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'staff@nagarsetu.gov.in', password: 'staff@123' })
    });
    const data = await res.json();
    assert(res.ok && data.token && (data.user?.role === 'service_staff' || data.user?.role === 'staff' || data.user?.role === 'field_staff'), 'Service Staff Authentication (staff@nagarsetu.gov.in)');
  } catch (err) {
    assert(false, `Service Staff Auth (${err.message})`);
  }

  // 6. Citizen Portal Verification
  try {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'citizen8788@nagarsetu.gov.in', password: 'password123' })
    });
    const data = await res.json();
    assert(res.ok && data.token && data.user?.role === 'citizen', 'Citizen Authentication (citizen8788@nagarsetu.gov.in)');
  } catch (err) {
    assert(false, `Citizen Auth (${err.message})`);
  }

  console.log('\n==================================================');
  console.log(`REGRESSION RESULTS: ${passed} PASSED | ${failed} FAILED`);
  console.log('==================================================\n');

  if (failed > 0) process.exit(1);
  process.exit(0);
}

runRegressionSuite().catch(err => {
  console.error('Fatal regression error:', err);
  process.exit(1);
});
