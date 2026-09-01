const { query } = require('../backend/src/config/db');

async function clearAllComplaints() {
  console.log('========================================================================');
  console.log('  PURGING ALL COMPLAINT DATA FROM NAGARSETU DATABASE');
  console.log('========================================================================\n');

  const safeDelete = async (table) => {
    try {
      await query(`DELETE FROM ${table}`);
      console.log(`✓ Cleared table: ${table}`);
    } catch (e) {
      console.log(`- Table ${table} skipped (${e.message})`);
    }
  };

  await safeDelete('complaint_feedback');
  await safeDelete('complaint_status_history');
  await safeDelete('task_assignments');
  await safeDelete('assignments');
  await safeDelete('feedback');

  try {
    await query(`DELETE FROM notifications WHERE complaint_id IS NOT NULL`);
    console.log('✓ Cleared complaint notifications from: notifications');
  } catch (e) {
    console.log(`- Notifications cleanup notice: ${e.message}`);
  }

  await safeDelete('complaints');

  console.log('\n------------------------------------------------------------------------');
  console.log('  VERIFYING DATABASE RECORD COUNTS');
  console.log('------------------------------------------------------------------------\n');

  const cCount = await query(`SELECT COUNT(*) as cnt FROM complaints`);
  const aCount = await query(`SELECT COUNT(*) as cnt FROM assignments`);

  console.log(`- complaints remaining: ${cCount.rows[0].cnt}`);
  console.log(`- assignments remaining: ${aCount.rows[0].cnt}`);

  // Verify departments and staff intact
  const dCount = await query(`SELECT COUNT(*) as cnt FROM departments`);
  const dhCount = await query(`SELECT COUNT(*) as cnt FROM department_heads`);
  const fsCount = await query(`SELECT COUNT(*) as cnt FROM field_staff`);
  const uCount = await query(`SELECT COUNT(*) as cnt FROM users`);

  console.log('\n------------------------------------------------------------------------');
  console.log('  VERIFYING DEPARTMENTS, HEADS, & STAFF (PRESERVED)');
  console.log('------------------------------------------------------------------------\n');

  console.log(`✓ departments count: ${dCount.rows[0].cnt}`);
  console.log(`✓ department_heads count: ${dhCount.rows[0].cnt}`);
  console.log(`✓ field_staff count: ${fsCount.rows[0].cnt}`);
  console.log(`✓ users count: ${uCount.rows[0].cnt}`);

  if (parseInt(cCount.rows[0].cnt, 10) === 0) {
    console.log('\n========================================================================');
    console.log('  🎉 DATABASE COMPLAINT CLEANUP COMPLETE! 0 COMPLAINTS REMAINING.');
    console.log('========================================================================\n');
  }
}

clearAllComplaints();
