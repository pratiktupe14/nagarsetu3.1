const { query, db } = require('../backend/src/config/db');

async function runFreshValidation() {
  console.log('================================================================');
  console.log('    NAGARSETU 3.1 — CLEAN DATABASE END-TO-END VALIDATION        ');
  console.log('================================================================');

  // PHASE 1: Purge all complaints/tasks/assignments for a clean baseline
  console.log('\n[PHASE 1] Purging old complaints/tasks/assignments...');
  await query(`DELETE FROM complaints`);
  try { await query(`DELETE FROM assignments`); } catch (e) {}
  try { await query(`DELETE FROM task_updates`); } catch (e) {}

  const compCountRes = await query(`SELECT COUNT(*) as count FROM complaints`);
  const initialCompCount = parseInt(compCountRes.rows[0].count, 10);
  console.log(`✓ Clean database verified: ${initialCompCount} complaints in DB.`);

  // Verify Manoj Shinde (WTR-STF-002) & Water Department exist
  const staffRes = await query(`SELECT * FROM field_staff WHERE employee_id = 'WTR-STF-002' OR name = 'Manoj Shinde'`);
  if (staffRes.rows.length === 0) {
    throw new Error('Manoj Shinde (WTR-STF-002) not found in field_staff table!');
  }
  const manoj = staffRes.rows[0];
  console.log(`✓ Manoj Shinde verified in DB: ID=${manoj.id}, UserID=${manoj.user_id}, EmployeeID=${manoj.employee_id}, Email=${manoj.email}`);

  const sachinRes = await query(`SELECT * FROM field_staff WHERE employee_id = 'WTR-STF-003' OR name = 'Sachin More'`);
  const sachin = sachinRes.rows[0];

  const kiranRes = await query(`SELECT * FROM field_staff WHERE employee_id = 'WTR-STF-001' OR name = 'Kiran Patil'`);
  const kiran = kiranRes.rows[0];

  // PHASE 2 & 3: Create a real test complaint & verify department routing (Water Leak -> Dept 3)
  console.log('\n[PHASE 2 & 3] Creating real test complaint (Water Pipeline Leak)...');
  const compNo = `NS-${Date.now()}`;
  const insertSql = `
    INSERT INTO complaints (
      complaint_number, citizen_id, title, description, category, priority, status,
      department_id, photo_before_url, latitude, longitude, location_source, location_address
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
    ) RETURNING *
  `;
  const compParams = [
    compNo, 1, 'Water Pipeline Burst near College Road', 'Severe water leakage from main supply pipeline.',
    'Water Supply', 'High', 'Submitted', 3, 'https://images.unsplash.com/photo-1542013936693-884638332954',
    20.0059, 73.7798, 'manual_pin', 'College Road, Nashik'
  ];
  const newCompRes = await query(insertSql, compParams);
  const createdId = newCompRes.rows[0].id;
  const createdCompRes = await query(`SELECT * FROM complaints WHERE id = $1`, [createdId]);
  const createdComp = createdCompRes.rows[0];
  console.log(`✓ Test complaint created: ID=${createdComp.id}, Number=${createdComp.complaint_number}, Status=${createdComp.status}, DeptID=${createdComp.department_id}`);

  // PHASE 4 & 5: Assign complaint to Manoj Shinde (WTR-STF-002)
  console.log('\n[PHASE 4 & 5] Assigning complaint to Manoj Shinde (WTR-STF-002)...');
  const assignSql = `
    UPDATE complaints 
    SET status = 'Staff Assigned',
        assigned_staff_id = $1,
        assigned_staff_name = $2,
        assigned_staff_email = $3,
        assigned_by = 1,
        assigned_by_name = 'Department Head',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $4
  `;
  await query(assignSql, [manoj.employee_id, manoj.name, manoj.email, createdComp.id]);
  const assignedCompRes = await query(`SELECT * FROM complaints WHERE id = $1`, [createdComp.id]);
  const assignedComp = assignedCompRes.rows[0];
  console.log(`✓ DB Assignment persisted: AssignedStaffID=${assignedComp.assigned_staff_id}, Status=${assignedComp.status}`);

  // PHASE 6: Verify Manoj Shinde's Active Tasks metric
  console.log('\n[PHASE 6] Verifying Staff Management metric for Manoj Shinde...');
  const manojTasksRes = await query(`
    SELECT COUNT(DISTINCT c.id) as active_tasks
    FROM complaints c
    WHERE (c.assigned_staff_id = $1 OR c.assigned_staff_id = $2 OR LOWER(c.assigned_staff_email) = LOWER($3) OR c.assigned_staff_name = $4)
      AND c.status IN ('Assigned', 'Staff Assigned', 'Department Assigned', 'In Progress', 'Accepted', 'On the Way', 'Resolution Submitted', 'Verified')
  `, [String(manoj.id), manoj.employee_id, manoj.email, manoj.name]);
  const manojActiveCount = parseInt(manojTasksRes.rows[0].active_tasks, 10);
  console.log(`✓ Manoj Active Tasks Count: ${manojActiveCount} (Expected: 1)`);
  if (manojActiveCount !== 1) throw new Error(`Manoj active count mismatch! Expected 1, got ${manojActiveCount}`);

  // PHASE 7 & 9: Verify Staff Isolation for Kiran Patil
  console.log('\n[PHASE 7 & 9] Verifying Staff Isolation for Kiran Patil...');
  const kiranTasksRes = await query(`
    SELECT COUNT(DISTINCT c.id) as active_tasks
    FROM complaints c
    WHERE (c.assigned_staff_id = $1 OR c.assigned_staff_id = $2 OR LOWER(c.assigned_staff_email) = LOWER($3) OR c.assigned_staff_name = $4)
      AND c.status IN ('Assigned', 'Staff Assigned', 'Department Assigned', 'In Progress', 'Accepted', 'On the Way', 'Resolution Submitted', 'Verified')
  `, [String(kiran.id), kiran.employee_id, kiran.email, kiran.name]);
  const kiranActiveCount = parseInt(kiranTasksRes.rows[0].active_tasks, 10);
  console.log(`✓ Kiran Patil Active Tasks Count: ${kiranActiveCount} (Expected: 0)`);
  if (kiranActiveCount !== 0) throw new Error(`Kiran active count mismatch! Expected 0, got ${kiranActiveCount}`);

  // PHASE 11: Reassignment Test (Manoj -> Sachin)
  console.log('\n[PHASE 11] Testing Reassignment from Manoj to Sachin More (WTR-STF-003)...');
  await query(`
    UPDATE complaints 
    SET assigned_staff_id = $1,
        assigned_staff_name = $2,
        assigned_staff_email = $3,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $4
  `, [sachin.employee_id, sachin.name, sachin.email, createdComp.id]);

  const manojAfterReassign = await query(`
    SELECT COUNT(DISTINCT c.id) as active_tasks FROM complaints c
    WHERE (c.assigned_staff_id = $1 OR c.assigned_staff_id = $2 OR LOWER(c.assigned_staff_email) = LOWER($3) OR c.assigned_staff_name = $4)
      AND c.status IN ('Assigned', 'Staff Assigned', 'Department Assigned', 'In Progress', 'Accepted', 'On the Way', 'Resolution Submitted', 'Verified')
  `, [String(manoj.id), manoj.employee_id, manoj.email, manoj.name]);
  
  const sachinAfterReassign = await query(`
    SELECT COUNT(DISTINCT c.id) as active_tasks FROM complaints c
    WHERE (c.assigned_staff_id = $1 OR c.assigned_staff_id = $2 OR LOWER(c.assigned_staff_email) = LOWER($3) OR c.assigned_staff_name = $4)
      AND c.status IN ('Assigned', 'Staff Assigned', 'Department Assigned', 'In Progress', 'Accepted', 'On the Way', 'Resolution Submitted', 'Verified')
  `, [String(sachin.id), sachin.employee_id, sachin.email, sachin.name]);

  const manojReassignCount = parseInt(manojAfterReassign.rows[0].active_tasks, 10);
  const sachinReassignCount = parseInt(sachinAfterReassign.rows[0].active_tasks, 10);

  console.log(`✓ Manoj Active Tasks after reassignment: ${manojReassignCount} (Expected: 0)`);
  console.log(`✓ Sachin Active Tasks after reassignment: ${sachinReassignCount} (Expected: 1)`);
  if (manojReassignCount !== 0 || sachinReassignCount !== 1) {
    throw new Error('Reassignment metric error!');
  }

  // PHASE 12: Completion Test (Sachin completes task)
  console.log('\n[PHASE 12] Testing Task Completion by Sachin More...');
  await query(`
    UPDATE complaints 
    SET status = 'Resolved',
        photo_after_url = 'https://images.unsplash.com/photo-1581092160607-ee22621dd758',
        work_performed = 'Replaced damaged main valve seal and restored normal pressure.',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
  `, [createdComp.id]);

  const sachinActiveAfterComplete = await query(`
    SELECT COUNT(DISTINCT c.id) as active_tasks FROM complaints c
    WHERE (c.assigned_staff_id = $1 OR c.assigned_staff_id = $2 OR LOWER(c.assigned_staff_email) = LOWER($3) OR c.assigned_staff_name = $4)
      AND c.status IN ('Assigned', 'Staff Assigned', 'Department Assigned', 'In Progress', 'Accepted', 'On the Way', 'Resolution Submitted', 'Verified')
  `, [String(sachin.id), sachin.employee_id, sachin.email, sachin.name]);

  const sachinCompletedAfterComplete = await query(`
    SELECT COUNT(DISTINCT c.id) as completed_tasks FROM complaints c
    WHERE (c.assigned_staff_id = $1 OR c.assigned_staff_id = $2 OR LOWER(c.assigned_staff_email) = LOWER($3) OR c.assigned_staff_name = $4)
      AND c.status = 'Resolved'
  `, [String(sachin.id), sachin.employee_id, sachin.email, sachin.name]);

  const sachinActiveFinal = parseInt(sachinActiveAfterComplete.rows[0].active_tasks, 10);
  const sachinCompletedFinal = parseInt(sachinCompletedAfterComplete.rows[0].completed_tasks, 10);

  console.log(`✓ Sachin Active Tasks after completion: ${sachinActiveFinal} (Expected: 0)`);
  console.log(`✓ Sachin Completed Tasks after completion: ${sachinCompletedFinal} (Expected: 1)`);
  if (sachinActiveFinal !== 0 || sachinCompletedFinal !== 1) {
    throw new Error('Task completion metric error!');
  }

  console.log('\n================================================================');
  console.log('    ✅ FRESH DATABASE END-TO-END VALIDATION PASSED FULLY!        ');
  console.log('================================================================\n');
}

runFreshValidation().catch((err) => {
  console.error('❌ Validation Failed:', err);
  process.exit(1);
});
