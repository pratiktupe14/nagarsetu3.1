const path = require('path');
const fs = require('fs');

// Load environment from backend/.env or .env
const envPath = fs.existsSync(path.join(__dirname, '../backend/.env')) ? path.join(__dirname, '../backend/.env') : path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
        if (!process.env[key]) {
          process.env[key] = val;
        }
      }
    }
  });
}

const { query, initDatabase } = require('../backend/src/config/db');

async function debugAssignment() {
  console.log('--- DEBUG ASSIGNMENT START ---');
  try {
    await initDatabase();

    // 1. Inspect Complaint NS-2026-692436
    console.log('1. Looking up complaint NS-2026-692436...');
    let compRes = await query(`SELECT * FROM complaints WHERE complaint_number = $1 OR CAST(id AS TEXT) = $1`, ['NS-2026-692436']);
    console.log('   Complaint result count:', compRes.rows.length);
    if (compRes.rows.length > 0) {
      console.log('   Complaint:', JSON.stringify(compRes.rows[0], null, 2));
    } else {
      console.log('   Complaint NS-2026-692436 not found, fetching latest complaint...');
      compRes = await query(`SELECT * FROM complaints ORDER BY created_at DESC LIMIT 1`);
      console.log('   Latest complaint:', JSON.stringify(compRes.rows[0], null, 2));
    }

    if (compRes.rows.length === 0) {
      console.log('   No complaints in database!');
      return;
    }

    const complaint = compRes.rows[0];

    // 2. Inspect Staff PWD-STF-001
    console.log('\n2. Looking up staff PWD-STF-001 / Amit Patil...');
    const staffRes = await query(
      `SELECT fs.id, fs.user_id, fs.name, fs.email, fs.phone as mobile, fs.department_id, fs.employee_id, fs.status, d.name as department_name, d.code as department_code 
       FROM field_staff fs 
       LEFT JOIN departments d ON (
         CAST(fs.department_id AS TEXT) = CAST(d.id AS TEXT)
         OR UPPER(CAST(fs.department_id AS TEXT)) = UPPER(d.code)
       )
       WHERE CAST(fs.user_id AS TEXT) = $1 
          OR fs.employee_id = $1 
          OR CAST(fs.id AS TEXT) = $1
          OR LOWER(fs.email) = LOWER($1)
          OR LOWER(fs.name) = LOWER($1)`,
      ['PWD-STF-001']
    );
    console.log('   Staff result count:', staffRes.rows.length);
    console.log('   Staff:', JSON.stringify(staffRes.rows, null, 2));

    if (staffRes.rows.length === 0) {
      console.log('   Staff PWD-STF-001 not found!');
      return;
    }
    const staff = staffRes.rows[0];

    // 3. Inspect Department Head
    console.log('\n3. Looking up PWD Department Head...');
    const dhRes = await query(`SELECT * FROM department_heads WHERE department_id = '1' OR LOWER(email) LIKE '%pwd%' OR LOWER(email) LIKE '%rahul%' LIMIT 1`);
    console.log('   Department Head:', JSON.stringify(dhRes.rows, null, 2));

    const userRes = await query(`SELECT * FROM users WHERE role = 'department_head' LIMIT 1`);
    console.log('   User Dept Head:', JSON.stringify(userRes.rows, null, 2));

    // 4. Test actual assignment logic in isolation with detailed error logging
    console.log('\n4. Executing assignment steps step-by-step...');
    const complaint_id = String(complaint.id);

    const assignedStaffId = String(staff.id || staff.user_id);
    const assignedStaffName = staff.name;
    const assignedStaffEmail = staff.email || '';
    const canonicalId = complaint.id;

    const dummyUser = userRes.rows[0] || { id: '1', name: 'Rahul Kumar', role: 'department_head', department_id: '1' };

    const isUuid = (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val));
    const safeAssignedBy = isUuid(dummyUser.id) ? dummyUser.id : null;

    console.log('   Attempting UPDATE complaints (try 1: with safeAssignedBy)...');
    try {
      const uRes1 = await query(
        `UPDATE complaints
         SET assigned_staff_id = $1,
             assigned_staff_name = $2,
             assigned_staff_email = $3,
             assigned_by = $4,
             assigned_by_name = $5,
             status = $6,
             updated_at = CURRENT_TIMESTAMP
         WHERE CAST(id AS TEXT) = $7 OR complaint_number = $7`,
        [
          assignedStaffId,
          assignedStaffName,
          assignedStaffEmail,
          safeAssignedBy,
          dummyUser.name || 'Department Head',
          'Staff Assigned',
          String(canonicalId)
        ]
      );
      console.log('   UPDATE complaints (try 1) SUCCESS:', uRes1.rowCount || uRes1.rows);
    } catch (err1) {
      console.error('   UPDATE complaints (try 1) FAILED:', err1.message);
      console.log('   Attempting UPDATE complaints (try 2: without assigned_by)...');
      try {
        const uRes2 = await query(
          `UPDATE complaints
           SET assigned_staff_id = $1,
               assigned_staff_name = $2,
               assigned_staff_email = $3,
               assigned_by_name = $4,
               status = $5,
               updated_at = CURRENT_TIMESTAMP
           WHERE CAST(id AS TEXT) = $6 OR complaint_number = $6`,
          [
            assignedStaffId,
            assignedStaffName,
            assignedStaffEmail,
            dummyUser.name || 'Department Head',
            'Staff Assigned',
            String(canonicalId)
          ]
        );
        console.log('   UPDATE complaints (try 2) SUCCESS:', uRes2.rowCount || uRes2.rows);
      } catch (err2) {
        console.error('   UPDATE complaints (try 2) FAILED:', err2.message);
      }
    }

    console.log('\n   Attempting Read-Back SELECT (from department.routes.js line 921)...');
    try {
      const verifyRes = await query(
        `SELECT id, complaint_number, department_id, assigned_staff_id, assigned_staff_name, assigned_staff_email, assigned_by, status, updated_at
         FROM complaints
         WHERE CAST(id AS TEXT) = ? OR complaint_number = ?`,
        [String(canonicalId), String(canonicalId)]
      );
      console.log('   Read-Back SUCCESS, rows:', verifyRes.rows.length);
    } catch (vErr) {
      console.error('   Read-Back FAILED:', vErr.message);
      console.error(vErr.stack);
    }

    console.log('\n   Attempting INSERT INTO assignments...');
    try {
      await query(
        `INSERT INTO assignments (complaint_id, staff_id, assigned_by, assigned_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [complaint.id, staff.user_id || staff.id, dummyUser.id]
      );
      console.log('   INSERT assignments SUCCESS');
    } catch (aErr) {
      console.error('   INSERT assignments FAILED:', aErr.message);
      console.error(aErr.stack);
    }

    console.log('\n   Attempting INSERT INTO task_assignments...');
    try {
      await query(
        `INSERT INTO task_assignments (complaint_id, staff_id, assigned_by, created_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
        [complaint.id, staff.user_id || staff.id, dummyUser.id]
      );
      console.log('   INSERT task_assignments SUCCESS');
    } catch (taErr) {
      console.error('   INSERT task_assignments FAILED:', taErr.message);
      console.error(taErr.stack);
    }

    console.log('\n   Attempting INSERT INTO complaint_status_history...');
    try {
      await query(
        `INSERT INTO complaint_status_history (complaint_id, status, remark, department, updated_by)
         VALUES ($1, $2, $3, $4, $5)`,
        [complaint.id, 'Staff Assigned', `Task assigned to field staff ${staff.name}.`, 'Department Operations', dummyUser.name || 'Department Head']
      );
      console.log('   INSERT complaint_status_history SUCCESS');
    } catch (hErr) {
      console.error('   INSERT complaint_status_history FAILED:', hErr.message);
      console.error(hErr.stack);
    }

  } catch (err) {
    console.error('GENERAL ERROR:', err);
  }
}

debugAssignment();
