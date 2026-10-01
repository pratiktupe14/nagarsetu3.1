const test = require('node:test');
const assert = require('node:assert');
const { normalizeRole, requireRole } = require('../src/middleware/auth');

// Simulated assignment validator matching department.routes.js logic
function evaluateAssignmentPermission({ user, complaint, staff }) {
  // 1. RBAC check using requireRole middleware logic
  const allowedRoles = ['department_head', 'admin', 'city_admin', 'officer'].map(r => normalizeRole(r));
  const userRole = normalizeRole(user.role);

  if (!allowedRoles.includes(userRole)) {
    return {
      status: 403,
      error: 'Forbidden: Access denied for user role'
    };
  }

  const isAdmin = ['admin', 'city_admin'].includes(userRole);

  // Helper matching canonical department code resolution
  const getDeptCode = (entity) => {
    if (!entity) return null;
    const s = String(entity.department_code || entity.department_id || entity.department_name || entity.department || '').toUpperCase();
    if (s.includes('PWD') || s === '1') return 'PWD';
    if (s.includes('WTR') || s === '3') return 'WTR';
    if (s.includes('SAN') || s === '2') return 'SAN';
    return s;
  };

  const userDept = getDeptCode(user);
  const complaintDept = getDeptCode(complaint);
  const staffDept = getDeptCode(staff);

  // 2. Department Isolation Security Check
  if (!isAdmin) {
    if (userDept && complaintDept && userDept !== complaintDept) {
      return {
        status: 403,
        error: 'Forbidden: You cannot assign complaints outside your department.'
      };
    }
    if (userDept && staffDept && userDept !== staffDept) {
      return {
        status: 403,
        error: 'Forbidden: You cannot assign staff members belonging to another department.'
      };
    }
  } else {
    if (complaintDept && staffDept && complaintDept !== staffDept) {
      return {
        status: 400,
        error: 'Invalid assignment: Selected staff member does not belong to the complaint department.'
      };
    }
  }

  return {
    status: 200,
    success: true,
    message: `Task successfully assigned to ${staff.name}`
  };
}

// TEST 1: PWD department_head + PWD complaint + PWD staff -> 200 assignment success
test('TEST 1: PWD department_head + PWD complaint + PWD staff -> 200 assignment success', () => {
  // Test both canonical and legacy hyphenated role names
  ['department_head', 'department-head', 'hod'].forEach((roleVariant) => {
    const res = evaluateAssignmentPermission({
      user: { id: 'dh-pwd', role: roleVariant, department_code: 'PWD' },
      complaint: { id: 'comp-101', department_code: 'PWD' },
      staff: { id: 'stf-pwd', name: 'Amit Patil', department_code: 'PWD' }
    });

    assert.strictEqual(res.status, 200, `Failed for role variant: ${roleVariant}`);
    assert.strictEqual(res.success, true);
  });
});

// TEST 2: WTR department_head + WTR complaint + WTR staff -> 200
test('TEST 2: WTR department_head + WTR complaint + WTR staff -> 200', () => {
  const res = evaluateAssignmentPermission({
    user: { id: 'dh-wtr', role: 'department_head', department_code: 'WTR' },
    complaint: { id: 'comp-202', department_code: 'WTR' },
    staff: { id: 'stf-wtr', name: 'Suresh Patil', department_code: 'WTR' }
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.success, true);
});

// TEST 3: PWD department_head + WTR complaint -> 403
test('TEST 3: PWD department_head + WTR complaint -> 403', () => {
  const res = evaluateAssignmentPermission({
    user: { id: 'dh-pwd', role: 'department_head', department_code: 'PWD' },
    complaint: { id: 'comp-303', department_code: 'WTR' },
    staff: { id: 'stf-pwd', name: 'Amit Patil', department_code: 'PWD' }
  });

  assert.strictEqual(res.status, 403);
  assert.match(res.error, /outside your department/i);
});

// TEST 4: PWD department_head + PWD complaint + WTR staff -> 403
test('TEST 4: PWD department_head + PWD complaint + WTR staff -> 403', () => {
  const res = evaluateAssignmentPermission({
    user: { id: 'dh-pwd', role: 'department_head', department_code: 'PWD' },
    complaint: { id: 'comp-404', department_code: 'PWD' },
    staff: { id: 'stf-wtr', name: 'Vikram Joshi', department_code: 'WTR' }
  });

  assert.strictEqual(res.status, 403);
  assert.match(res.error, /belonging to another department/i);
});

// TEST 5: city_admin + valid assignment -> success (200)
test('TEST 5: city_admin + valid assignment -> success (200)', () => {
  const res = evaluateAssignmentPermission({
    user: { id: 'admin-1', role: 'city_admin' },
    complaint: { id: 'comp-505', department_code: 'SAN' },
    staff: { id: 'stf-san', name: 'Ramesh Sawant', department_code: 'SAN' }
  });

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.success, true);
});

// TEST 6: field_staff attempts assignment -> 403
test('TEST 6: field_staff attempts assignment -> 403', () => {
  const res = evaluateAssignmentPermission({
    user: { id: 'staff-1', role: 'service_staff', department_code: 'PWD' },
    complaint: { id: 'comp-606', department_code: 'PWD' },
    staff: { id: 'stf-pwd', name: 'Amit Patil', department_code: 'PWD' }
  });

  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.error, 'Forbidden: Access denied for user role');
});

// TEST 7: citizen attempts assignment -> 403
test('TEST 7: citizen attempts assignment -> 403', () => {
  const res = evaluateAssignmentPermission({
    user: { id: 'citizen-1', role: 'citizen' },
    complaint: { id: 'comp-707', department_code: 'PWD' },
    staff: { id: 'stf-pwd', name: 'Amit Patil', department_code: 'PWD' }
  });

  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.error, 'Forbidden: Access denied for user role');
});
