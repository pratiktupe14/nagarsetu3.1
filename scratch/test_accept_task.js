const API_URL = 'https://nagarsetu-backend-api.vercel.app';

async function testAcceptTaskFlow() {
  console.log('================================================================');
  console.log('  FIELD STAFF TASK ACCEPTANCE END-TO-END TEST                   ');
  console.log('================================================================');

  // 1. Login Citizen & Submit Complaint
  const citLoginRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: '8788562103', password: 'password123' })
  });
  const citLogin = await citLoginRes.json();
  const citToken = citLogin.token;

  const compRes = await fetch(`${API_URL}/api/complaints/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${citToken}`
    },
    body: JSON.stringify({
      category: 'Road Damage / Pothole',
      specific_issue: 'road_damage_pothole',
      urgency: 'High',
      department_id: 1,
      description: 'Pothole on Main Road near City Center',
      location_address: 'Main Road, Nashik'
    })
  });
  const compData = await compRes.json();
  const complaintId = compData.complaint_id || compData.complaint?.id;
  console.log(`1. Created PWD Complaint ID: ${complaintId} (${compData.complaint?.complaint_number})`);

  // 2. Login PWD Department Head & Assign to Ramesh Kumar (STF-001)
  const headLoginRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'rahul.kumar@nagarsetu.gov.in', password: 'password123' })
  });
  const headLogin = await headLoginRes.json();
  const headToken = headLogin.token;

  const assignRes = await fetch(`${API_URL}/api/department/assign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${headToken}`
    },
    body: JSON.stringify({
      complaint_id: complaintId,
      staff_id: 1 // Ramesh Kumar
    })
  });
  const assignData = await assignRes.json();
  console.log(`2. Task Assigned status: '${assignData.status}' to Staff: '${assignData.staff_name}'`);

  // 3. Login Field Staff Ramesh Kumar
  const staffLoginRes = await fetch(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'staff@nagarsetu.gov.in', password: 'password123' })
  });
  const staffLogin = await staffLoginRes.json();
  const staffToken = staffLogin.token;

  // 4. Call POST /api/staff/task/:id/status with { status: 'Accepted' }
  const acceptRes = await fetch(`${API_URL}/api/staff/task/${complaintId}/status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${staffToken}`
    },
    body: JSON.stringify({ status: 'Accepted' })
  });
  const acceptData = await acceptRes.json();
  console.log(`4. Accept Task API Response (HTTP ${acceptRes.status}):`, JSON.stringify(acceptData));

  // 5. Verify Read-Back from /api/staff/tasks
  const tasksRes = await fetch(`${API_URL}/api/staff/tasks`, {
    headers: { Authorization: `Bearer ${staffToken}` }
  });
  const tasksData = await tasksRes.json();
  const assignedTask = (tasksData.tasks || []).find((t) => String(t.id) === String(complaintId));
  console.log(`5. Database Read-Back Status for Complaint ID ${complaintId}: '${assignedTask?.status}'`);

  if (assignedTask && assignedTask.status === 'Accepted') {
    console.log('\n✓ ACCEPT TASK FLOW PASSED 100% — Status in DB is authoritatively "Accepted"!');
  } else {
    console.error('\n❌ ACCEPT TASK FLOW FAILED — Expected status "Accepted", got:', assignedTask?.status);
    process.exit(1);
  }
}

testAcceptTaskFlow().catch((err) => {
  console.error('Test script error:', err);
  process.exit(1);
});
