const BASE_URL = 'https://nagarsetu-backend-api.vercel.app';

async function testLiveStaffAll() {
  console.log('================================================================');
  console.log('  NAGARSETU 3.1 — LIVE STAFF API DIAGNOSTIC TEST (VERCEL)      ');
  console.log('================================================================\n');

  try {
    // 1. ADMIN TEST
    console.log('1. Logging in as City Admin (admin@nagarsetu.gov.in)...');
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileOrEmail: 'admin@nagarsetu.gov.in', password: 'NagarSetu@Admin2026!' })
    });
    const adminLoginData = await adminLoginRes.json();
    const adminToken = adminLoginData.token;
    console.log(`   Admin Token Received: ${Boolean(adminToken)} | Role: ${adminLoginData.user?.role}`);

    const adminStaffRes = await fetch(`${BASE_URL}/api/department/staff`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const adminStaffData = await adminStaffRes.json();
    const adminStaffList = adminStaffData.staff || [];
    console.log(`   Admin Staff API Status ${adminStaffRes.status}: Summary totalStaff=${adminStaffData.summary?.totalStaff}, Returned Count=${adminStaffList.length}`);

    if (adminStaffList.length > 0) {
      console.log(`   Sample Admin Staff: ID=${adminStaffList[0].id}, Name='${adminStaffList[0].name}', Dept='${adminStaffList[0].department_name}', EmpID='${adminStaffList[0].employee_id}'`);
    }

    // 2. DEPARTMENT HEADS TEST (ALL 7 DEPARTMENTS)
    console.log('\n2. Testing Department Head Staff Isolation (All 7 Departments)...');

    const dhs = [
      { code: 'PWD', email: 'rahul.kumar@nagarsetu.gov.in' },
      { code: 'SAN', email: 'amit.sharma@nagarsetu.gov.in' },
      { code: 'WTR', email: 'vikram.patil@nagarsetu.gov.in' },
      { code: 'DRN', email: 'sanjay.more@nagarsetu.gov.in' },
      { code: 'ELE', email: 'aditya.joshi@nagarsetu.gov.in' },
      { code: 'TRF', email: 'rohan.deshmukh@nagarsetu.gov.in' },
      { code: 'MNT', email: 'kunal.kulkarni@nagarsetu.gov.in' }
    ];

    let totalDhStaffCount = 0;

    for (const dh of dhs) {
      const loginR = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileOrEmail: dh.email, password: 'nagarsetu@123' })
      });
      const loginD = await loginR.json();
      const token = loginD.token;
      const deptId = loginD.user?.department_id;
      const deptName = loginD.user?.department_name;

      const staffR = await fetch(`${BASE_URL}/api/department/staff`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const staffD = await staffR.json();
      const list = staffD.staff || [];
      totalDhStaffCount += list.length;

      console.log(`   [${dh.code}] DeptID ${deptId} (${deptName}): Returned ${list.length} staff members.`);
    }

    console.log(`\nSum of all 7 Department Head Staff: ${totalDhStaffCount}`);

  } catch (e) {
    console.error('Test Error:', e.message);
  }
}

testLiveStaffAll();
