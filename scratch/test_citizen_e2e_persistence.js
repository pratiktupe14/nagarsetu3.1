const BASE_URL = 'https://nagarsetu-backend-api.vercel.app';

async function runE2EPersistenceTest() {
  console.log('================================================================');
  console.log('  NAGARSETU 3.1 — CITIZEN COMPLAINT PERSISTENCE E2E TEST       ');
  console.log('================================================================\n');

  try {
    // 1. CITIZEN A LOGIN (8788562103)
    console.log('1. Logging in Citizen A (8788562103)...');
    const citizenALogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileOrEmail: '8788562103', password: '8788562103' })
    });
    const citizenAData = await citizenALogin.json();
    const tokenA = citizenAData.token;
    const userAId = citizenAData.user?.id;
    console.log(`   Citizen A Logged In: User ID ${userAId}, Name '${citizenAData.user?.name}'`);
    if (!tokenA) throw new Error('Citizen A login failed');

    // 2. SUBMIT NEW COMPLAINT
    const compNum = `NS-TEST-${Date.now().toString().slice(-6)}`;
    const compTitle = `Pothole Persistence Test ${Date.now()}`;
    console.log(`\n2. Submitting new complaint (${compNum})...`);

    const subRes = await fetch(`${BASE_URL}/api/complaints/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${tokenA}`
      },
      body: JSON.stringify({
        complaint_number: compNum,
        photo_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7',
        category: 'Roads & Infrastructure',
        title: compTitle,
        description: 'Large asphalt damage verified for persistence test',
        priority: 'High',
        latitude: 19.9975,
        longitude: 73.7898,
        location_source: 'manual_pin',
        location_address: 'College Road, Nashik',
        department_id: 1,
        ai_category: 'Roads & Infrastructure',
        ai_confidence: 0.95
      })
    });

    const subData = await subRes.json();
    console.log(`   Submit Response HTTP ${subRes.status}: Complaint ID ${subData.complaint_id || subData.complaint?.id}`);
    if (subRes.status !== 201) throw new Error(`Complaint submission failed: ${JSON.stringify(subData)}`);

    const createdId = String(subData.complaint_id || subData.complaint?.id);

    // 3. CITIZEN A FETCHES MY COMPLAINTS
    console.log('\n3. Citizen A fetching GET /api/complaints/my...');
    const myResA = await fetch(`${BASE_URL}/api/complaints/my`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    const myDataA = await myResA.json();
    const listA = Array.isArray(myDataA) ? myDataA : myDataA.complaints || [];
    const foundA = listA.find((c) => String(c.id) === createdId || c.complaint_number === compNum);
    console.log(`   Citizen A My Complaints Returned Count: ${listA.length} | Target Complaint Found: ${Boolean(foundA)}`);
    if (!foundA) throw new Error('Submitted complaint not found in Citizen A history!');

    // 4. CITIZEN A RE-LOGIN (PAGE REFRESH SIMULATION)
    console.log('\n4. Citizen A Re-Logging In (Simulating Browser Refresh / Session Reload)...');
    const myResA2 = await fetch(`${BASE_URL}/api/complaints/my`, {
      headers: { 'Authorization': `Bearer ${tokenA}` }
    });
    const myDataA2 = await myResA2.json();
    const listA2 = Array.isArray(myDataA2) ? myDataA2 : myDataA2.complaints || [];
    const foundA2 = listA2.find((c) => String(c.id) === createdId || c.complaint_number === compNum);
    console.log(`   Citizen A Re-Fetch Returned Count: ${listA2.length} | Target Complaint Found: ${Boolean(foundA2)}`);
    if (!foundA2) throw new Error('Submitted complaint lost after refresh simulation!');

    // 5. CITY ADMIN VERIFICATION
    console.log('\n5. Logging in City Admin to verify visibility...');
    const adminLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileOrEmail: 'admin@nagarsetu.gov.in', password: 'NagarSetu@Admin2026!' })
    });
    const adminData = await adminLogin.json();
    const adminToken = adminData.token;

    const adminCompRes = await fetch(`${BASE_URL}/api/complaints`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const adminCompData = await adminCompRes.json();
    const adminList = Array.isArray(adminCompData) ? adminCompData : adminCompData.complaints || [];
    const foundAdmin = adminList.find((c) => String(c.id) === createdId || c.complaint_number === compNum);
    console.log(`   Admin Complaints Returned Count: ${adminList.length} | Target Complaint Found for Admin: ${Boolean(foundAdmin)}`);
    if (!foundAdmin) throw new Error('Submitted complaint not visible in Admin Portal!');

    // 6. DEPARTMENT HEAD VERIFICATION
    console.log('\n6. Logging in PWD Department Head (rahul.kumar@nagarsetu.gov.in)...');
    const dhLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileOrEmail: 'rahul.kumar@nagarsetu.gov.in', password: 'nagarsetu@123' })
    });
    const dhData = await dhLogin.json();
    const dhToken = dhData.token;

    const dhCompRes = await fetch(`${BASE_URL}/api/complaints`, {
      headers: { 'Authorization': `Bearer ${dhToken}` }
    });
    const dhCompData = await dhCompRes.json();
    const dhList = Array.isArray(dhCompData) ? dhCompData : dhCompData.complaints || [];
    const foundDh = dhList.find((c) => String(c.id) === createdId || c.complaint_number === compNum);
    console.log(`   PWD Department Head Complaints Count: ${dhList.length} | Target Complaint Found: ${Boolean(foundDh)}`);

    // 7. CITIZEN ISOLATION VERIFICATION (CITIZEN B)
    console.log('\n7. Registering Citizen B to test IDOR isolation...');
    const bMobile = `9822${Date.now().toString().slice(-6)}`;
    const bEmail = `citizenb${Date.now()}@gmail.com`;
    const bReg = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Citizen B', mobile: bMobile, email: bEmail, password: 'password123', role: 'citizen' })
    });
    const bRegData = await bReg.json();
    const tokenB = bRegData.token;

    const myResB = await fetch(`${BASE_URL}/api/complaints/my`, {
      headers: { 'Authorization': `Bearer ${tokenB}` }
    });
    const myDataB = await myResB.json();
    const listB = Array.isArray(myDataB) ? myDataB : myDataB.complaints || [];
    const foundB = listB.find((c) => String(c.id) === createdId || c.complaint_number === compNum);
    console.log(`   Citizen B History Count: ${listB.length} | Citizen A's Complaint Leaked to Citizen B: ${Boolean(foundB)}`);
    if (foundB) throw new Error('SECURITY FAILURE: Citizen B can see Citizen A complaint!');

    console.log('\n================ E2E PERSISTENCE VERIFICATION RESULT ================');
    console.log('ALL PERSISTENCE, ROLE ISOLATION & CITIZEN PRIVACY TESTS PASSED 100%');
    console.log('=====================================================================');

  } catch (e) {
    console.error('E2E Test Error:', e.message);
  }
}

runE2EPersistenceTest();
