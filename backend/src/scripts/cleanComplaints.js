const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { createClient } = require('@supabase/supabase-js');
const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

async function cleanComplaints() {
  console.log('--- STARTING NAGARSETU COMPLAINT DATA PURGE ---');
  let supabaseDeleted = 0;
  let sqliteDeleted = 0;

  // 1. Supabase PostgreSQL Cleanup
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder')) {
    try {
      const supabase = createClient(supabaseUrl, supabaseKey);
      console.log('Connecting to Supabase PostgreSQL at:', supabaseUrl);

      // Count existing complaints
      const { data: beforeCount } = await supabase.from('complaints').select('id');
      supabaseDeleted = beforeCount ? beforeCount.length : 0;

      // Delete dependent records first (foreign keys)
      await supabase.from('feedback').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('assignments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('complaint_status_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      // Delete complaints
      const { error: compErr } = await supabase.from('complaints').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (compErr) {
        console.warn('Supabase delete error:', compErr.message);
      } else {
        console.log(`[SUPABASE] Cleaned ${supabaseDeleted} complaint record(s) and all associated history/feedback/assignments/notifications.`);
      }

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
            db.run("DELETE FROM feedback;");
            db.run("DELETE FROM assignments;");
            db.run("DELETE FROM complaint_status_history;");
            db.run("DELETE FROM notifications;");
            db.run("DELETE FROM complaints;", () => {
              console.log(`[SQLITE] Cleaned ${sqliteDeleted} local complaint record(s) and related tables.`);
              db.close();
              resolve();
            });
          });
        });
      });
    });
  }

  console.log('--- NAGARSETU COMPLAINT DATA PURGE COMPLETE ---');
}

cleanComplaints();
