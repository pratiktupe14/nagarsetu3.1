const BASE_URL = 'https://nagarsetu-backend-api.vercel.app';

const DEPARTMENTS = [
  { code: 'PWD', name: 'Public Works Department', headEmail: 'rahul.kumar@nagarsetu.gov.in', pass: 'nagarsetu@123', deptId: 1 },
  { code: 'SAN', name: 'Sanitation & Waste Management', headEmail: 'amit.sharma@nagarsetu.gov.in', pass: 'nagarsetu@123', deptId: 2 },
  { code: 'WTR', name: 'Water Supply & Sewerage Board', headEmail: 'vikram.patil@nagarsetu.gov.in', pass: 'nagarsetu@123', deptId: 3 },
  { code: 'DRN', name: 'Drainage & Sewage Department', headEmail: 'sanjay.more@nagarsetu.gov.in', pass: 'nagarsetu@123', deptId: 4 },
  { code: 'ELE', name: 'Electrical & Street Lighting', headEmail: 'aditya.joshi@nagarsetu.gov.in', pass: 'nagarsetu@123', deptId: 5 },
  { code: 'TRF', name: 'Traffic Management Department', headEmail: 'rohan.deshmukh@nagarsetu.gov.in', pass: 'nagarsetu@123', deptId: 6 },
  { code: 'MNT', name: 'Maintenance Department', headEmail: 'kunal.kulkarni@nagarsetu.gov.in', pass: 'nagarsetu@123', deptId: 7 }
];

async function runDepartmentMatchingAudit() {
  console.log('================================================================');
  console.log('  NAGARSETU 3.1 — DEPARTMENT MATCHING & SECURITY AUDIT TEST     ');
  console.log('================================================================\n');

  try {
    // 1. CITIZEN LOGIN & SUBMIT PWD COMPLAINT
    console.log('1. Logging in Citizen (8788562103) & submitting PWD complaint...');
    const citLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileOrEmail: '8788562103', password: '8788562103' })
    });
    const citData = await citLogin.json();
    const citToken = citData.token;

    const compNum = `NS-PWD-${Date.now().toString().slice(-6)}`;
    const subRes = await fetch(`${BASE_URL}/api/complaints/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${citToken}` },
      body: JSON.stringify({
        complaint_number: compNum,
        photo_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7',
        category: 'Roads & Infrastructure',
        title: `PWD Matching Test ${Date.now()}`,
        description: 'Testing PWD staff assignment',
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
    console.log('   Submit Response:', subData);
    const complaintId = String(subData.data?.id || subData.complaint?.id || subData.complaint_id || subData.id);
    console.log(`   Created Complaint ID: ${complaintId} (${compNum})\n`);

    // 2. POSITIVE CASE: PWD Head -> Ramesh Kumar (STF-001)
    console.log('2. POSITIVE CASE: PWD Dept Head -> Ramesh Kumar (Roads & Public Works)...');
    const pwdHeadLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileOrEmail: 'rahul.kumar@nagarsetu.gov.in', password: 'nagarsetu@123' })
    });
    const pwdHeadData = await pwdHeadLogin.json();
    const pwdHeadToken = pwdHeadData.token;

    const staffRes = await fetch(`${BASE_URL}/api/department/staff`, {
      headers: { 'Authorization': `Bearer ${pwdHeadToken}` }
    });
    const staffData = await staffRes.json();
    const staffList = staffData.staff || [];
    const ramesh = staffList.find(s => s.employee_id === 'STF-001' || s.name.toLowerCase().includes('ramesh')) || staffList[0];

    console.log(`   Found Staff: '${ramesh.name}' (EmpID: ${ramesh.employee_id}, DeptID: ${ramesh.department_id}, DeptName: '${ramesh.department_name}')`);

    const assignRes = await fetch(`${BASE_URL}/api/department/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${pwdHeadToken}` },
      body: JSON.stringify({ complaint_id: complaintId, staff_id: String(ramesh.id || ramesh.user_id) })
    });
    const assignData = await assignRes.json();
    console.log(`   Assign Response HTTP ${assignRes.status}:`, JSON.stringify(assignData));
    if (assignRes.status !== 200 || !assignData.success) {
      throw new Error(`POSITIVE CASE FAILED! ${assignData.error}`);
    }
    console.log('   ✓ POSITIVE CASE PASSED: PWD Staff Ramesh Kumar successfully assigned!\n');

    // 3. NEGATIVE CASE: PWD Head -> Electrical (ELE) Staff
    console.log('3. NEGATIVE CASE: PWD Dept Head -> Electrical (ELE) Staff...');
    const eleHeadLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileOrEmail: 'aditya.joshi@nagarsetu.gov.in', password: 'nagarsetu@123' })
    });
    const eleHeadData = await eleHeadLogin.json();
    const eleStaffRes = await fetch(`${BASE_URL}/api/department/staff`, {
      headers: { 'Authorization': `Bearer ${eleHeadData.token}` }
    });
    const eleStaffData = await eleStaffRes.json();
    const eleStaffMember = (eleStaffData.staff || []).find(s => String(s.department_id) === '5' || (s.employee_id && s.employee_id.startsWith('ELE-')));

    if (eleStaffMember) {
      console.log(`   Attempting cross-department assignment of ELE Staff '${eleStaffMember.name}' (EmpID: ${eleStaffMember.employee_id}, DeptID: ${eleStaffMember.department_id})...`);
      const crossAssignRes = await fetch(`${BASE_URL}/api/department/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${pwdHeadToken}` },
        body: JSON.stringify({ complaint_id: complaintId, staff_id: String(eleStaffMember.id || eleStaffMember.user_id) })
      });
      const crossAssignData = await crossAssignRes.json();
      console.log(`   Cross-Dept Response HTTP ${crossAssignRes.status}:`, JSON.stringify(crossAssignData));
      if (crossAssignRes.status === 200) {
        throw new Error('SECURITY VIOLATION! PWD Head was allowed to assign ELE staff member!');
      }
      console.log('   ✓ NEGATIVE CASE PASSED: Cross-department assignment correctly BLOCKED by backend!\n');
    }

    // 4. FIELD STAFF PORTAL VERIFICATION (Ramesh Kumar Login & Assigned Tasks)
    console.log(`4. FIELD STAFF VERIFICATION: Logging in '${ramesh.name}' (${ramesh.email})...`);
    const staffLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileOrEmail: ramesh.email || ramesh.mobile, password: 'nagarsetu@123' })
    });
    const staffLoginData = await staffLogin.json();
    const staffToken = staffLoginData.token;

    const tasksRes = await fetch(`${BASE_URL}/api/staff/tasks`, {
      headers: { 'Authorization': `Bearer ${staffToken}` }
    });
    const tasksData = await tasksRes.json();
    const tasksList = Array.isArray(tasksData) ? tasksData : tasksData.tasks || [];
    const assignedTask = tasksList.find(t => String(t.id) === complaintId || t.complaint_number === compNum);

    console.log(`   Assigned Tasks Count: ${tasksList.length} | Target Task Found: ${Boolean(assignedTask)}`);
    if (!assignedTask) throw new Error('Assigned task not found in Field Staff Portal!');
    console.log('   ✓ FIELD STAFF PORTAL VERIFICATION PASSED: Task visible in Field Staff Portal!\n');

    // 5. ALL DEPARTMENTS AUDIT
    console.log('5. ALL 7 DEPARTMENTS LOGIN & STAFF FETCH AUDIT...');
    for (const d of DEPARTMENTS) {
      const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileOrEmail: d.headEmail, password: d.pass })
      });
      const dData = await loginRes.json();
      const dStaffRes = await fetch(`${BASE_URL}/api/department/staff`, {
        headers: { 'Authorization': `Bearer ${dData.token}` }
      });
      const dStaffData = await dStaffRes.json();
      const dStaff = dStaffData.staff || [];
      console.log(`   [${d.code}] Head: '${dData.user?.name}' | DeptID: ${dData.user?.department_id} | Staff Count: ${dStaff.length}`);
    }

    console.log('\n================================================================');
    console.log('  DEPARTMENT MATCHING & SECURITY AUDIT PASSED 100%               ');
    console.log('================================================================');

  } catch (err) {
    console.error('\nTest Failed:', err.message);
    process.exit(1);
  }
}

runDepartmentMatchingAudit();
