const { query, initDatabase } = require('../backend/src/config/db');
const { resolveUserDepartment, normalizeDepartmentInfo } = require('../backend/src/routes/department.routes');

async function isDeptMatch(d1, d2) {
  const norm1 = normalizeDepartmentInfo(d1);
  const norm2 = normalizeDepartmentInfo(d2);

  if (norm1.code && norm2.code && norm1.code !== 'UNASSIGNED' && norm2.code !== 'UNASSIGNED') {
    return norm1.code === norm2.code;
  }
  if (norm1.id !== null && norm2.id !== null) {
    return norm1.id === norm2.id;
  }
  const s1 = String(d1 || '').trim().toLowerCase();
  const s2 = String(d2 || '').trim().toLowerCase();
  return s1 === s2 && s1 !== '';
}

async function testAssignment() {
  await initDatabase();

  // 1. Fetch DH Rahul Kumar
  const dhRes = await query("SELECT * FROM users WHERE email = 'rahul.kumar@nagarsetu.gov.in'");
  const headUser = dhRes.rows[0];
  console.log('HEAD USER:', headUser);

  const req = { user: headUser };
  const { userDeptId, userDeptCode } = await resolveUserDepartment(req);
  console.log('RESOLVED HEAD DEPT:', { userDeptId, userDeptCode });

  // 2. Fetch Complaint
  const compRes = await query("SELECT * FROM complaints ORDER BY id DESC LIMIT 1");
  const complaint = compRes.rows[0];
  console.log('COMPLAINT:', { id: complaint.id, number: complaint.complaint_number, department_id: complaint.department_id });

  // 3. Fetch Staff Member Amit Patil
  const staffRes = await query("SELECT fs.id, fs.user_id, fs.name, fs.email, fs.phone as mobile, fs.department_id, fs.employee_id, fs.status, d.name as department_name, d.code as department_code FROM field_staff fs LEFT JOIN departments d ON (CAST(fs.department_id AS TEXT) = CAST(d.id AS TEXT) OR UPPER(CAST(fs.department_id AS TEXT)) = UPPER(d.code)) WHERE fs.employee_id = 'PWD-STF-001' OR fs.id = 2 OR fs.user_id = 14");
  const staff = staffRes.rows[0];
  console.log('STAFF RECORD:', staff);

  // 4. Run the 2 assignment checks from department.routes.js:
  const actorDeptInput = userDeptCode || userDeptId || headUser?.department_id;
  const isTaskMatch = await isDeptMatch(actorDeptInput, complaint.department_id);
  console.log('1. TASK MATCH CHECK:', { actorDeptInput, complaintDept: complaint.department_id, isTaskMatch });

  const staffDeptInput = staff.department_code || staff.department_id || staff.email || staff.employee_id || staff.user_id || staff.id;
  console.log('DEBUG staffDeptInput fallback order:', {
    'staff.department_code': staff.department_code,
    'staff.department_id': staff.department_id,
    'staff.email': staff.email,
    'staff.employee_id': staff.employee_id,
    'staff.user_id': staff.user_id,
    'staff.id': staff.id,
    'CHOICE staffDeptInput': staffDeptInput
  });

  const isStaffMatch = await isDeptMatch(actorDeptInput, staffDeptInput);
  console.log('2. STAFF MATCH CHECK:', { actorDeptInput, staffDeptInput, isStaffMatch });
}

testAssignment();
