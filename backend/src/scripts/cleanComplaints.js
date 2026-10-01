const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../../../frontend/.env') });
const { createClient } = require('@supabase/supabase-js');
const sqlite3 = require('sqlite3').verbose();

async function cleanComplaints() {
  console.log('--- STARTING NAGARSETU COMPLAINT DATA PURGE ---');
  let supabaseDeleted = 0;
  let supabaseHistoryDeleted = 0;
  let sqliteDeleted = 0;
  let sqliteAssignmentsDeleted = 0;
  let sqliteHistoryDeleted = 0;

  // 1. Supabase PostgreSQL Cleanup
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder')) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      console.log('Connecting to Supabase PostgreSQL at:', supabaseUrl);

      // Count existing complaints & history
      const { count: beforeCount } = await supabase.from('complaints').select('*', { count: 'exact', head: true });
      const { count: beforeHistory } = await supabase.from('complaint_status_history').select('*', { count: 'exact', head: true });
      supabaseDeleted = beforeCount || 0;
      supabaseHistoryDeleted = beforeHistory || 0;

      // Delete dependent records first (foreign keys)
      await supabase.from('feedback').delete().not('id', 'is', null);
      await supabase.from('assignments').delete().not('id', 'is', null);
      await supabase.from('complaint_status_history').delete().not('id', 'is', null);
      await supabase.from('notifications').delete().not('complaint_id', 'is', null);
      
      // Delete complaints
      const { error: compErr } = await supabase.from('complaints').delete().not('id', 'is', null);
      
      if (compErr) {
        console.warn('Supabase delete error:', compErr.message);
        // Fallback filter
        await supabase.from('complaint_status_history').delete().gte('id', 0);
        await supabase.from('complaints').delete().gte('id', 0);
      }
      
      const { count: afterCount } = await supabase.from('complaints').select('*', { count: 'exact', head: true });
      console.log(`[SUPABASE] Deleted ${supabaseDeleted} complaint record(s), ${supabaseHistoryDeleted} status history record(s). Remaining complaints: ${afterCount || 0}`);

      // Cleanup Storage Files in 'issues' bucket if any exist
      try {
        const { data: fileList } = await supabase.storage.from('issues').list('uploads');
        if (fileList && fileList.length > 0) {
          const filePaths = fileList.map(f => `uploads/${f.name}`);
          await supabase.storage.from('issues').remove(filePaths);
          console.log(`[SUPABASE STORAGE] Removed ${filePaths.length} uploaded demo image(s) from 'issues' bucket.`);
        }
      } catch (sErr) {
        console.warn('Supabase storage cleanup note:', sErr.message);
      }
    } catch (e) {
      console.warn('Supabase cleanup note:', e.message);
    }
  } else {
    console.log('Supabase URL/Key not configured or is placeholder; skipping remote Supabase DB purge.');
  }

  // 2. Local SQLite Database Cleanup if present
  const dbPath = path.join(__dirname, '../../nagarsetu.sqlite');
  if (fs.existsSync(dbPath)) {
    await new Promise((resolve) => {
      const db = new sqlite3.Database(dbPath, (err) => {
        if (err) return resolve();

        db.serialize(() => {
          db.get("SELECT COUNT(*) as count FROM complaints", (cErr, row) => {
            sqliteDeleted = row ? row.count : 0;
            db.get("SELECT COUNT(*) as count FROM assignments", (aErr, aRow) => {
              sqliteAssignmentsDeleted = aRow ? aRow.count : 0;
              db.get("SELECT COUNT(*) as count FROM complaint_status_history", (hErr, hRow) => {
                sqliteHistoryDeleted = hRow ? hRow.count : 0;
                
                db.run("DELETE FROM feedback;");
                db.run("DELETE FROM assignments;");
                db.run("DELETE FROM complaint_status_history;");
                db.run("DELETE FROM notifications WHERE complaint_id IS NOT NULL;");
                db.run("DELETE FROM complaints;", () => {
                  db.run("DELETE FROM sqlite_sequence WHERE name IN ('complaints', 'assignments', 'complaint_status_history', 'feedback');", () => {
                    console.log(`[SQLITE] Deleted ${sqliteDeleted} complaint(s), ${sqliteAssignmentsDeleted} assignment(s), ${sqliteHistoryDeleted} history record(s).`);
                    db.close();
                    resolve();
                  });
                });
              });
            });
          });
        });
      });
    });
  }

  console.log('--- NAGARSETU COMPLAINT DATA PURGE COMPLETE ---');
}

cleanComplaints();
module.exports = cleanComplaints;
