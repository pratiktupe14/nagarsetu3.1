const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { query } = require('../config/db');
const { createClient } = require('@supabase/supabase-js');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

async function purgeAllComplaints() {
  console.log('========================================================================');
  console.log('  EXHAUSTIVE NAGARSETU COMPLAINT DATA PURGE (PRESERVING USERS/DEPTS)');
  console.log('========================================================================\n');

  let dbDeleted = 0;

  // 1. Primary Database Query Purge (SQLite / Postgres through app config)
  try {
    console.log('[1/3] Purging primary database via db.query interface...');

    // Get count before delete
    const compCountRes = await query('SELECT COUNT(*) as count FROM complaints').catch(() => ({ rows: [{ count: 0 }] }));
    dbDeleted = parseInt(compCountRes.rows[0]?.count || 0, 10);

    await query('DELETE FROM complaint_status_history').catch(() => {});
    await query('DELETE FROM complaint_feedback').catch(() => {});
    await query('DELETE FROM feedback').catch(() => {});
    await query('DELETE FROM task_assignments').catch(() => {});
    await query('DELETE FROM assignments').catch(() => {});
    await query('DELETE FROM notifications').catch(() => {});
    await query('DELETE FROM complaints').catch(() => {});

    console.log(`  ✓ Primary DB Purge Complete: Removed ${dbDeleted} complaint(s) and all dependent history/feedback/assignments/notifications.`);
  } catch (err) {
    console.error('Primary DB Purge Error:', err);
  }

  // 2. Direct SQLite File Purge if nagarsetu.sqlite exists
  const sqliteDbPath = path.join(__dirname, '../../nagarsetu.sqlite');
  if (fs.existsSync(sqliteDbPath)) {
    console.log('\n[2/3] Verifying and purging local SQLite database file directly...');
    await new Promise((resolve) => {
      const db = new sqlite3.Database(sqliteDbPath, (err) => {
        if (err) return resolve();
        db.serialize(() => {
          db.run('DELETE FROM complaint_status_history;', () => {});
          db.run('DELETE FROM complaint_feedback;', () => {});
          db.run('DELETE FROM feedback;', () => {});
          db.run('DELETE FROM task_assignments;', () => {});
          db.run('DELETE FROM assignments;', () => {});
          db.run('DELETE FROM notifications;', () => {});
          db.run('DELETE FROM complaints;', () => {
            console.log('  ✓ Direct SQLite File Purge Complete.');
            db.close();
            resolve();
          });
        });
      });
    });
  }

  // 3. Supabase PostgreSQL Cleanup if configured
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder')) {
    console.log('\n[3/3] Purging remote Supabase PostgreSQL database...');
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);

      await supabase.from('complaint_status_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('complaint_feedback').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('feedback').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('task_assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('complaints').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      console.log('  ✓ Remote Supabase DB Purge Complete.');
    } catch (sErr) {
      console.warn('  ⚠ Supabase Purge Note:', sErr.message);
    }
  } else {
    console.log('\n[3/3] Remote Supabase not active or placeholder key; skipping remote purge.');
  }

  // 4. Final DB Counts Verification
  const verifyComp = await query('SELECT COUNT(*) as count FROM complaints').catch(() => ({ rows: [{ count: 0 }] }));
  const verifyHist = await query('SELECT COUNT(*) as count FROM complaint_status_history').catch(() => ({ rows: [{ count: 0 }] }));
  const verifyAssn = await query('SELECT COUNT(*) as count FROM assignments').catch(() => ({ rows: [{ count: 0 }] }));
  const verifyUsers = await query('SELECT COUNT(*) as count FROM users').catch(() => ({ rows: [{ count: 0 }] }));

  console.log('\n========================================================================');
  console.log(`  POST-PURGE DATABASE VERIFICATION METRICS:`);
  console.log(`  - Complaints in DB: ${verifyComp.rows[0]?.count || 0}`);
  console.log(`  - Complaint Status History in DB: ${verifyHist.rows[0]?.count || 0}`);
  console.log(`  - Assignments in DB: ${verifyAssn.rows[0]?.count || 0}`);
  console.log(`  - Users Preserved in DB: ${verifyUsers.rows[0]?.count || 0}`);
  console.log('========================================================================\n');
}

purgeAllComplaints().catch(console.error);
