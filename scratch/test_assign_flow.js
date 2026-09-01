const BASE_URL = 'https://nagarsetu-backend-api.vercel.app';

async function testAssignFlow() {
  console.log('================================================================');
  console.log('  NAGARSETU 3.1 — DEPARTMENT HEAD ASSIGNMENT READ-BACK TEST     ');
  console.log('================================================================\n');

  try {
    // 1. CITIZEN CREATES PWD COMPLAINT
    console.log('1. Submitting test PWD complaint as Citizen (8788562103)...');
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
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${citToken}`
      },
      body: JSON.stringify({
        complaint_number: compNum,
        photo_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7',
        category: 'Roads & Infrastructure',
        title: `Assign Readback Test ${Date.now()}`,
        description: 'Road damage for assignment testing',
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
    const complaintId = String(subData.complaint_id || subData.complaint?.id);
    console.log(`   Created Complaint ID: ${complaintId} | Status: ${subData.complaint?.status || 'Submitted'}`);

    // 2. DEPARTMENT HEAD LOGS IN
    console.log('\n2. Logging in PWD Department Head (rahul.kumar@nagarsetu.gov.in)...');
    const dhLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileOrEmail: 'rahul.kumar@nagarsetu.gov.in', password: 'nagarsetu@123' })
    });
    const dhData = await dhLogin.json();
    const dhToken = dhData.token;
    console.log(`   PWD Head Logged In: Dept ID ${dhData.user?.department_id}, Name '${dhData.user?.name}'`);

    // 3. FETCH PWD FIELD STAFF
    console.log('\n3. Fetching PWD Department Staff...');
    const staffRes = await fetch(`${BASE_URL}/api/department/staff`, {
      headers: { 'Authorization': `Bearer ${dhToken}` }
    });
    const staffData = await staffRes.json();
    const staffList = staffData.staff || [];
    console.log(`   PWD Staff Returned Count: ${staffList.length}`);
    if (staffList.length === 0) throw new Error('No PWD staff found to assign!');

    const targetStaff = staffList[0];
    console.log(`   Selected Staff: ID=${targetStaff.id}, UserID=${targetStaff.user_id}, Name='${targetStaff.name}', EmpID='${targetStaff.employee_id}'`);

    // 4. ASSIGN TASK TO FIELD STAFF
    console.log('\n4. Executing POST /api/department/assign...');
    const assignRes = await fetch(`${BASE_URL}/api/department/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${dhToken}`
      },
      body: JSON.stringify({
        complaint_id: complaintId,
        staff_id: String(targetStaff.id || targetStaff.user_id)
      })
    });

    const assignData = await assignRes.json();
    console.log(`   Assign Response HTTP ${assignRes.status}:`, JSON.stringify(assignData));
    if (assignRes.status !== 200) throw new Error(`Assign API failed: ${assignData.error}`);

    // 5. READ-BACK VERIFICATION (DEPARTMENT HEAD GET /api/complaints)
    console.log('\n5. Performing Read-Back Query (GET /api/complaints for PWD Head)...');
    const readBackRes = await fetch(`${BASE_URL}/api/complaints`, {
      headers: { 'Authorization': `Bearer ${dhToken}` }
    });
    const readBackData = await readBackRes.json();
    const readBackList = Array.isArray(readBackData) ? readBackData : readBackData.complaints || [];
    const updatedComp = readBackList.find((c) => String(c.id) === complaintId || c.complaint_number === compNum);

    console.log(`   Read-Back Status: '${updatedComp?.status}', Assigned Staff ID: '${updatedComp?.assigned_staff_id}', Name: '${updatedComp?.assigned_staff_name}'`);

    if (!updatedComp || (updatedComp.status !== 'Staff Assigned' && updatedComp.status !== 'Assigned' && updatedComp.status !== 'In Progress' && updatedComp.status !== 'Accepted')) {
      throw new Error(`ASSIGNMENT READ-BACK MISMATCH! Read-back status was '${updatedComp?.status}'`);
    }

    // 6. FIELD STAFF LOGIN & ASSIGNED TASKS VERIFICATION
    console.log(`\n6. Logging in Field Staff member (${targetStaff.email} / ${targetStaff.mobile})...`);
    const staffLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileOrEmail: targetStaff.email || targetStaff.mobile, password: 'nagarsetu@123' })
    });
    const staffLoginData = await staffLogin.json();
    const staffToken = staffLoginData.token;
    console.log(`   Field Staff Logged In: User ID ${staffLoginData.user?.id}, Role '${staffLoginData.user?.role}'`);

    const staffTasksRes = await fetch(`${BASE_URL}/api/staff/tasks`, {
      headers: { 'Authorization': `Bearer ${staffToken}` }
    });
    const staffTasksData = await staffTasksRes.json();
    const staffTasksList = Array.isArray(staffTasksData) ? staffTasksData : staffTasksData.tasks || staffTasksData.complaints || [];
    const assignedTaskFound = staffTasksList.find((c) => String(c.id) === complaintId || c.complaint_number === compNum);

    console.log(`   Staff Assigned Tasks Count: ${staffTasksList.length} | Target Task Found: ${Boolean(assignedTaskFound)}`);
    if (!assignedTaskFound) throw new Error('Assigned complaint not visible in Field Staff portal tasks!');

    console.log('\n================ ASSIGNMENT FLOW VERIFICATION RESULT ================');
    console.log('DEPARTMENT HEAD -> FIELD STAFF ASSIGNMENT FLOW PASSED 100%');
    console.log('=====================================================================');

  } catch (e) {
    console.error('Test Error:', e.message);
  }
}

testAssignFlow();
