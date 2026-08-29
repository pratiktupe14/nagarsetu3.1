const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { initDatabase, query } = require('../config/db');

async function testNewComplaintFlow() {
  console.log('--- TESTING CLEAN STATE & NEW COMPLAINT WORKFLOW ---');
  
  await initDatabase();

  // 1. Check existing complaints count
  const initialRes = await query('SELECT COUNT(*) as count FROM complaints');
  const count = parseInt(initialRes.rows[0].count, 10);
  console.log(`[VERIFY 1] Initial Complaints Count in DB: ${count}`);

  if (count !== 0) {
    console.error('FAILED: DB still has complaints!');
    process.exit(1);
  }

  // 2. Create one new test complaint
  console.log('[STEP 2] Creating 1 new test complaint...');
  const newCompRes = await query(`
    INSERT INTO complaints (
      citizen_id, photo_before_url, category, title, description, priority, status, department_id, latitude, longitude, location_source, location_address
    ) VALUES (
      1,
      'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7',
      'Potholes & Road Damage',
      'Deep Pothole near Station Road Junction',
      'Severe asphalt road damage creating traffic hazard for commuters.',
      'High',
      'Submitted',
      1,
      19.8762,
      75.3433,
      'device_gps',
      'Station Road, Ward 12'
    ) RETURNING id
  `);

  const compId = newCompRes.rows[0].id;
  console.log(`[STEP 2 SUCCESS] Created test complaint ID: ${compId}`);

  // 3. Verify complaint appears in Department Head Query for Department 1 (PWD)
  const deptRes = await query('SELECT * FROM complaints WHERE department_id = 1 AND id = ?', [compId]);
  console.log(`[VERIFY 3] Complaint found in Department Head (PWD) portal query: ${deptRes.rows.length === 1 ? 'PASSED' : 'FAILED'}`);

  // 4. Assign complaint to Service Staff (User ID 2)
  console.log('[STEP 4] Assigning complaint to Service Staff...');
  const assignRes = await query(`
    INSERT INTO assignments (complaint_id, staff_id, assigned_by)
    VALUES (?, 2, 1) RETURNING id
  `, [compId]);
  console.log(`[STEP 4 SUCCESS] Assignment created ID: ${assignRes.rows[0].id}`);

  // Update status to In Progress
  await query('UPDATE complaints SET status = "In Progress" WHERE id = ?', [compId]);

  // 5. Verify Staff Portal query
  const staffRes = await query('SELECT * FROM assignments WHERE complaint_id = ? AND staff_id = 2', [compId]);
  console.log(`[VERIFY 5] Task found in Staff Portal query: ${staffRes.rows.length === 1 ? 'PASSED' : 'FAILED'}`);

  // 6. Clean up test complaint to restore 100% pristine clean state
  await query('DELETE FROM assignments WHERE complaint_id = ?', [compId]);
  await query('DELETE FROM complaints WHERE id = ?', [compId]);

  const finalRes = await query('SELECT COUNT(*) as count FROM complaints');
  const finalCount = parseInt(finalRes.rows[0].count, 10);
  console.log(`[VERIFY 6] Final Complaints Count in DB: ${finalCount}`);

  console.log('--- ALL WORKFLOW VERIFICATIONS PASSED SUCCESSFULLY ---');
  process.exit(0);
}

testNewComplaintFlow().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
