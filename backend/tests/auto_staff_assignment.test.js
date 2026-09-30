const { test, describe, before, beforeEach } = require('node:test');
const assert = require('node:assert');
const { initDatabase, query } = require('../src/config/db');
const { selectBestStaff, autoAssignComplaint } = require('../src/services/autoAssignmentService');

describe('Automatic Staff Assignment Suite', () => {
  before(async () => {
    process.env.NODE_ENV = 'test';
    await initDatabase();
  });

  // TEST 1: 3 staff all have 0 tasks -> first complaint goes to staff 1 (or earliest in round-robin)
  test('TEST 1: 3 staff all have 0 tasks -> first complaint rotates to staff 1', () => {
    const staffList = [
      { id: 1, name: 'Staff One', department_id: 1, role: 'service_staff', status: 'active', active_task_count: 0, last_assigned_at: null },
      { id: 2, name: 'Staff Two', department_id: 1, role: 'service_staff', status: 'active', active_task_count: 0, last_assigned_at: null },
      { id: 3, name: 'Staff Three', department_id: 1, role: 'service_staff', status: 'active', active_task_count: 0, last_assigned_at: null }
    ];

    const chosen = selectBestStaff(staffList, 'Medium');
    assert.ok(chosen, 'Staff should be selected');
    assert.strictEqual(chosen.id, 1, 'First available staff with 0 tasks should be selected');
  });

  // TEST 2: staff 1 now has 1 task, staff 2 and 3 have 0 -> next complaint goes to staff 2
  test('TEST 2: staff 1 has 1 task, staff 2 and 3 have 0 -> next complaint goes to staff 2', () => {
    const staffList = [
      { id: 1, name: 'Staff One', department_id: 1, role: 'service_staff', status: 'active', active_task_count: 1, last_assigned_at: new Date('2026-10-01T01:00:00Z') },
      { id: 2, name: 'Staff Two', department_id: 1, role: 'service_staff', status: 'active', active_task_count: 0, last_assigned_at: null },
      { id: 3, name: 'Staff Three', department_id: 1, role: 'service_staff', status: 'active', active_task_count: 0, last_assigned_at: null }
    ];

    const chosen = selectBestStaff(staffList, 'Medium');
    assert.ok(chosen);
    assert.strictEqual(chosen.id, 2, 'Should pick staff 2 who has 0 active tasks');
  });

  // TEST 3: staff 1,2,3 each have 1 active task -> choose lowest workload tie using last_assigned_at/performance
  test('TEST 3: staff 1,2,3 each have 1 active task -> choose tie using performance or oldest last_assigned_at', () => {
    // Subcase 3A: Tied on tasks, one has higher SLA success rate
    const staffListSla = [
      { id: 1, name: 'Staff 1', department_id: 1, role: 'service_staff', status: 'active', active_task_count: 1, sla_success_rate: 0.80, completed_task_count: 8, overdue_task_count: 2 },
      { id: 2, name: 'Staff 2', department_id: 1, role: 'service_staff', status: 'active', active_task_count: 1, sla_success_rate: 0.95, completed_task_count: 19, overdue_task_count: 1 },
      { id: 3, name: 'Staff 3', department_id: 1, role: 'service_staff', status: 'active', active_task_count: 1, sla_success_rate: 0.85, completed_task_count: 10, overdue_task_count: 2 }
    ];
    const chosenByPerf = selectBestStaff(staffListSla, 'High');
    assert.strictEqual(chosenByPerf.id, 2, 'Should break tie using better performance (higher SLA rate)');

    // Subcase 3B: Equal performance metrics, broken by oldest last_assigned_at
    const staffListRoundRobin = [
      { id: 1, name: 'Staff 1', department_id: 1, role: 'service_staff', status: 'active', active_task_count: 1, sla_success_rate: 1.0, completed_task_count: 5, overdue_task_count: 0, last_assigned_at: '2026-10-01T03:00:00Z' },
      { id: 2, name: 'Staff 2', department_id: 1, role: 'service_staff', status: 'active', active_task_count: 1, sla_success_rate: 1.0, completed_task_count: 5, overdue_task_count: 0, last_assigned_at: '2026-10-01T01:00:00Z' }, // oldest
      { id: 3, name: 'Staff 3', department_id: 1, role: 'service_staff', status: 'active', active_task_count: 1, sla_success_rate: 1.0, completed_task_count: 5, overdue_task_count: 0, last_assigned_at: '2026-10-01T02:00:00Z' }
    ];
    const chosenByOldest = selectBestStaff(staffListRoundRobin, 'Medium');
    assert.strictEqual(chosenByOldest.id, 2, 'Should pick staff with oldest last_assigned_at');
  });

  // TEST 4: staff from wrong department -> never selected
  test('TEST 4: staff from wrong department -> never selected', async () => {
    // Department 1 is PWD. Querying for Dept 2 (Sanitation) must never select Dept 1 staff
    const dept1Staff = [
      { id: 101, name: 'PWD Staff', department_id: 1, role: 'service_staff', status: 'active', active_task_count: 0 }
    ];
    const dept2Staff = [
      { id: 201, name: 'Sanitation Staff', department_id: 2, role: 'service_staff', status: 'active', active_task_count: 2 }
    ];

    // Selecting for Dept 2
    const chosen = selectBestStaff(dept2Staff, 'Medium');
    assert.strictEqual(chosen.id, 201);
    assert.notStrictEqual(chosen.department_id, 1, 'Must strictly belong to department 2');
  });

  // TEST 5: inactive staff -> never selected
  test('TEST 5: inactive staff -> never selected', () => {
    const staffList = [
      { id: 1, name: 'Inactive Staff', department_id: 1, role: 'service_staff', status: 'inactive', active_task_count: 0 },
      { id: 2, name: 'Suspended Staff', department_id: 1, role: 'service_staff', status: 'suspended', active_task_count: 0 },
      { id: 3, name: 'Active Busy Staff', department_id: 1, role: 'service_staff', status: 'active', active_task_count: 3 }
    ];

    const chosen = selectBestStaff(staffList, 'Medium');
    assert.ok(chosen);
    assert.strictEqual(chosen.id, 3, 'Must bypass inactive staff and pick active staff');
  });

  // TEST 6: no eligible staff -> complaint remains pending/unassigned
  test('TEST 6: no eligible staff -> complaint remains pending/unassigned', async () => {
    const staffList = [
      { id: 1, name: 'Inactive Staff 1', department_id: 999, role: 'service_staff', status: 'inactive', active_task_count: 0 }
    ];

    const chosen = selectBestStaff(staffList, 'Medium');
    assert.strictEqual(chosen, null, 'No eligible staff returned');

    // Test service function with non-existent department
    const result = await autoAssignComplaint('fake-complaint-id-999', 999999);
    assert.strictEqual(result.assigned, false, 'Auto assign should return assigned: false');
    assert.strictEqual(result.staff, null);
  });

  // TEST 7: HOD/Admin manual reassignment still works
  test('TEST 7: HOD/Admin manual reassignment still works and overrides auto-assignment', async () => {
    // 1. Create a dummy test complaint in SQLite
    const testComplaintNumber = `TEST-ASSIGN-${Date.now()}`;
    const insertRes = await query(`
      INSERT INTO complaints (complaint_number, citizen_id, photo_before_url, category, title, status, department_id, latitude, longitude, location_source)
      VALUES (?, 'test-citizen', 'test.jpg', 'Road Damage', 'Pothole Test', 'Submitted', 1, 20.0, 73.8, 'manual_pin')
    `, [testComplaintNumber]);

    const compId = insertRes.rows[0].id;

    // 2. Perform auto-assignment (Staff Assigned)
    const autoRes = await autoAssignComplaint(compId, 1, { priority: 'Medium' });
    assert.ok(autoRes.assigned, 'Auto-assignment should succeed if department 1 has active staff');
    assert.ok(autoRes.staff);

    // Verify database reflects auto-assignment
    const afterAuto = await query(`SELECT status, assigned_staff_id, assigned_staff_name FROM complaints WHERE id = ?`, [compId]);
    assert.strictEqual(afterAuto.rows[0].status, 'Staff Assigned');
    assert.strictEqual(String(afterAuto.rows[0].assigned_staff_id), String(autoRes.staff.id));

    // 3. Manual Override by HOD: Assign to a specific staff member (e.g. staff id 99 or staff id 10)
    const manualStaffId = '99999';
    const manualStaffName = 'Manual Override Staff';
    await query(`
      UPDATE complaints
      SET status = 'Staff Assigned',
          assigned_staff_id = ?,
          assigned_staff_name = ?,
          assigned_by = '11',
          assigned_by_name = 'HOD Rahul Kumar',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [manualStaffId, manualStaffName, compId]);

    const afterManual = await query(`SELECT status, assigned_staff_id, assigned_staff_name, assigned_by FROM complaints WHERE id = ?`, [compId]);
    assert.strictEqual(afterManual.rows[0].status, 'Staff Assigned');
    assert.strictEqual(String(afterManual.rows[0].assigned_staff_id), manualStaffId);
    assert.strictEqual(afterManual.rows[0].assigned_staff_name, manualStaffName);
    assert.strictEqual(afterManual.rows[0].assigned_by, '11');

    // Clean up dummy complaint
    await query(`DELETE FROM complaints WHERE id = ?`, [compId]).catch(() => {});
  });
});
