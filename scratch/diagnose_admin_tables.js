const db = require('../backend/src/config/db.js');
const fs = require('fs');

// Load environment variables
if (fs.existsSync('./backend/.env')) {
  const envText = fs.readFileSync('./backend/.env', 'utf8');
  envText.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const idx = trimmed.indexOf('=');
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) process.env[key] = val;
    }
  });
}

process.env.DB_TYPE = 'postgres';

async function diagnose() {
  console.log('=== ADMIN PORTAL DATA DIAGNOSIS (POSTGRESQL) ===\n');
  await db.initDatabase();

  // 1. Departments count
  const depts = await db.query('SELECT id, code, name FROM departments ORDER BY id');
  console.log('1. DEPARTMENTS COUNT:', (depts.rows || depts).length);
  console.table(depts.rows || depts);

  // 2. Department Heads count & records
  const dh = await db.query('SELECT id, user_id, department_id, name, email, phone, status FROM department_heads');
  console.log('\n2. DEPARTMENT_HEADS TABLE COUNT:', (dh.rows || dh).length);
  console.table(dh.rows || dh);

  // 3. Department Head users in users table
  const dhUsers = await db.query("SELECT id, name, email, role, department_id, status FROM users WHERE role = 'department_head'");
  console.log('\n3. USERS TABLE (role = department_head) COUNT:', (dhUsers.rows || dhUsers).length);
  console.table(dhUsers.rows || dhUsers);

  // 4. field_staff table count
  const fsCount = await db.query('SELECT COUNT(*) FROM field_staff').catch(e => ({ rows: [{ count: 'ERROR: ' + e.message }] }));
  console.log('\n4. FIELD_STAFF TABLE COUNT:', (fsCount.rows || fsCount)[0].count);

  // 5. service_staff table count (if exists)
  const ssCount = await db.query('SELECT COUNT(*) FROM service_staff').catch(e => ({ rows: [{ count: 'ERROR: ' + e.message }] }));
  console.log('\n5. SERVICE_STAFF TABLE COUNT:', (ssCount.rows || ssCount)[0].count);

  // 6. Users table service_staff count
  const ssUsers = await db.query("SELECT COUNT(*) FROM users WHERE role IN ('service_staff', 'staff')");
  console.log('\n6. USERS TABLE (role = service_staff) COUNT:', (ssUsers.rows || ssUsers)[0].count);

  // 7. Test Admin department-heads query
  const dhQuerySql = `
    SELECT dh.*, d.name as department_name, d.description as department_description,
           u.id as linked_user_id, u.role as user_role, u.status as user_status
    FROM department_heads dh
    LEFT JOIN departments d ON (
      CAST(d.id AS TEXT) = CAST(dh.department_id AS TEXT)
      OR UPPER(d.code) = UPPER(CAST(dh.department_id AS TEXT))
    )
    LEFT JOIN users u ON CAST(u.id AS TEXT) = CAST(dh.user_id AS TEXT) OR LOWER(u.email) = LOWER(dh.email)
    WHERE LOWER(dh.status) = 'active'
    ORDER BY COALESCE(dh.updated_at, dh.created_at) DESC, dh.id DESC
  `;
  const dhQueryRes = await db.query(dhQuerySql);
  console.log('\n7. ADMIN /api/admin/department-heads QUERY RETURNED ROWS:', (dhQueryRes.rows || dhQueryRes).length);
  console.table((dhQueryRes.rows || dhQueryRes).map(r => ({
    dh_id: r.id,
    name: r.name,
    email: r.email,
    dh_dept_id: r.department_id,
    dept_name: r.department_name,
    dh_status: r.status,
    linked_user_id: r.linked_user_id
  })));

  process.exit(0);
}

diagnose().catch(err => {
  console.error('Diagnosis error:', err);
  process.exit(1);
});
