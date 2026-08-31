const { initDatabase } = require('../backend/src/config/db');

const DEPARTMENTS_TO_TEST = [
  { code: 'PWD', name: 'Public Works Department', email: 'rahul.kumar@nagarsetu.gov.in', expectedDeptId: 1 },
  { code: 'SAN', name: 'Sanitation & Waste Management', email: 'amit.sharma@nagarsetu.gov.in', expectedDeptId: 2 },
  { code: 'WTR', name: 'Water Supply & Sewerage Board', email: 'vikram.patil@nagarsetu.gov.in', expectedDeptId: 3 },
  { code: 'DRN', name: 'Drainage & Sewage Department', email: 'sanjay.more@nagarsetu.gov.in', expectedDeptId: 4 },
  { code: 'ELE', name: 'Electrical & Street Lighting', email: 'aditya.joshi@nagarsetu.gov.in', expectedDeptId: 5 },
  { code: 'TRF', name: 'Traffic Management Department', email: 'rohan.deshmukh@nagarsetu.gov.in', expectedDeptId: 6 },
  { code: 'MNT', name: 'Maintenance Department', email: 'kunal.kulkarni@nagarsetu.gov.in', expectedDeptId: 7 }
];

async function runTest() {
  await initDatabase();
  console.log('========================================================================');
  console.log('  TESTING DEPARTMENT STAFF ISOLATION FOR ALL 7 DEPARTMENT HEADS');
  console.log('========================================================================\n');

  let allPassed = true;

  for (const dept of DEPARTMENTS_TO_TEST) {
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileOrEmail: dept.email, password: 'nagarsetu@123' })
    });

    if (!loginRes.ok) {
      console.error(`❌ LOGIN FAILED for ${dept.code} (${dept.email})`);
      allPassed = false;
      continue;
    }

    const loginData = await loginRes.json();
    const token = loginData.token;

    const staffRes = await fetch('http://localhost:5000/api/department/staff', {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!staffRes.ok) {
      console.error(`❌ STAFF API FAILED with status ${staffRes.status} for ${dept.code}`);
      allPassed = false;
      continue;
    }

    const staffData = await staffRes.json();
    const staffList = staffData.staff || [];
    const summary = staffData.summary;

    const invalidStaff = staffList.filter((s) => String(s.department_id) !== String(dept.expectedDeptId));

    if (invalidStaff.length > 0) {
      console.error(`❌ ISOLATION BREACH for ${dept.code}! Received ${invalidStaff.length} staff from other departments:`);
      invalidStaff.forEach((s) => console.error(`   - ${s.name} (${s.employee_id}, dept_id: ${s.department_id})`));
      allPassed = false;
    } else {
      console.log(`✓ SUCCESS [${dept.code}] Department Head (${dept.email}):`);
      console.log(`   - Returned Staff Count: ${staffList.length} (Summary Total: ${summary.totalStaff}, Active: ${summary.activeStaff}, Inactive: ${summary.inactiveStaff}, Active Tasks: ${summary.activeTasks})`);
      console.log(`   - Staff Members: ${staffList.map((s) => `${s.name} [${s.employee_id}]`).join(', ')}`);
      console.log(`   - Department Isolation: STRICT & VERIFIED\n`);
    }
  }

  console.log('========================================================================');
  if (allPassed) {
    console.log('  🎉 ALL 7 DEPARTMENTS PASSED STRICT SERVER-SIDE STAFF ISOLATION!');
  } else {
    console.log('  ❌ ISOLATION TEST FAILED! CHECK ERRORS ABOVE.');
  }
  console.log('========================================================================');
}

runTest().catch(console.error);
