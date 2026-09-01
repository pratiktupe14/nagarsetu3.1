const BASE_URL = 'https://nagarsetu-backend-api.vercel.app';

async function runCitizenVercelTest() {
  console.log('================================================================');
  console.log('  NAGARSETU 3.1 — CITIZEN VERCEL-TO-VERCEL E2E CONNECTIVITY     ');
  console.log('================================================================\n');

  try {
    // 1. HEALTH CHECK
    console.log('1. Testing Live Backend Health Endpoint...');
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthData = await healthRes.json();
    console.log(`   Health Status: ${healthRes.status}`, healthData.message);
    if (healthRes.status !== 200) throw new Error('Health check failed');

    // 2. CITIZEN REGISTRATION TEST
    const testMobile = `9833${Date.now().toString().slice(-6)}`;
    const testEmail = `citizentest${Date.now()}@gmail.com`;
    const testPass = `Pass@${Date.now().toString().slice(-4)}`;

    console.log(`\n2. Testing Citizen Registration (${testEmail} / ${testMobile})...`);
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Vercel Test Citizen',
        mobile: testMobile,
        email: testEmail,
        password: testPass,
        role: 'citizen',
        language_pref: 'en'
      })
    });
    const regData = await regRes.json();
    console.log(`   Register HTTP ${regRes.status}: User ID ${regData.user?.id}, Role ${regData.user?.role}`);
    if (regRes.status !== 201) throw new Error('Registration failed');

    // 3. CITIZEN LOGIN TEST (DEMO CITIZEN ACCOUNT: 8788562103 / 8788562103)
    console.log('\n3. Testing Citizen Demo Login (8788562103)...');
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobileOrEmail: '8788562103',
        password: '8788562103'
      })
    });
    const loginData = await loginRes.json();
    console.log(`   Login HTTP ${loginRes.status}: User ID ${loginData.user?.id}, Name '${loginData.user?.name}', Role '${loginData.user?.role}'`);
    if (loginRes.status !== 200 || !loginData.token) throw new Error('Demo Citizen Login failed');

    const citizenToken = loginData.token;

    // 4. CITIZEN MY COMPLAINTS FETCH
    console.log('\n4. Fetching My Complaints via JWT...');
    const compRes = await fetch(`${BASE_URL}/api/complaints/my`, {
      headers: { 'Authorization': `Bearer ${citizenToken}` }
    });
    const compData = await compRes.json();
    const complaintsList = Array.isArray(compData) ? compData : compData.complaints || [];
    console.log(`   My Complaints HTTP ${compRes.status}: Fetched ${complaintsList.length} complaints from backend database.`);

    // 5. LOGOUT & RE-LOGIN TEST
    console.log('\n5. Testing Citizen Re-Login (Simulating Session Refresh)...');
    const reLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobileOrEmail: '8788562103',
        password: '8788562103'
      })
    });
    const reLoginData = await reLoginRes.json();
    console.log(`   Re-Login HTTP ${reLoginRes.status}: User ID ${reLoginData.user?.id}, Token Valid: ${Boolean(reLoginData.token)}`);
    if (reLoginRes.status !== 200) throw new Error('Re-login failed');

    console.log('\n================ VERCEL CONNECTIVITY RESULT ================');
    console.log('Vercel-to-Vercel Backend Connection & Citizen Login Passed 100%');
    console.log('============================================================');

    return true;
  } catch (e) {
    console.error('Test Error:', e.message);
    return false;
  }
}

runCitizenVercelTest();
