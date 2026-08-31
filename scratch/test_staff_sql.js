const { initDatabase, query } = require('../backend/src/config/db');

async function test() {
  await initDatabase();

  const reqUser = { id: 9, email: 'aditya.joshi@nagarsetu.gov.in', role: 'department_head' };

  // 1. resolveUserDepartment
  let userDeptId = reqUser.department_id || null;
  let userDeptName = reqUser.department_name || '';

  if (!userDeptId || !userDeptName) {
    const uRes = await query('SELECT department_id, role FROM users WHERE id = $1 OR email = $2', [reqUser.id, reqUser.email]);
    console.log('uRes rows:', uRes.rows);
    if (uRes.rows.length > 0) {
      userDeptId = uRes.rows[0].department_id || userDeptId;
    }

    const dhRes = await query(
      `SELECT dh.department_id, d.name as department_name 
       FROM department_heads dh 
       LEFT JOIN departments d ON d.id = dh.department_id 
       WHERE dh.user_id = $1 OR dh.email = $2`,
      [reqUser.id, reqUser.email]
    );
    console.log('dhRes rows:', dhRes.rows);
    if (dhRes.rows.length > 0) {
      userDeptId = dhRes.rows[0].department_id || userDeptId;
      userDeptName = dhRes.rows[0].department_name || userDeptName;
    }
  }

  console.log('Resolved userDeptId:', userDeptId, 'userDeptName:', userDeptName);

  const filterStatus = 'all';
  const searchQuery = '';
  const isAdmin = false;

  let sql = `
    SELECT fs.id, fs.user_id, fs.name, fs.email, fs.phone as mobile, fs.employee_id, fs.role, fs.department_id,
           COALESCE(u.designation, 'Field Service Staff') as designation,
           COALESCE(fs.status, 'active') as status,
           u.language_pref, fs.created_at,
           d.name as department_name,
           (
             SELECT COUNT(DISTINCT c.id)
             FROM complaints c
             WHERE (c.assigned_staff_id = CAST(fs.id AS TEXT) OR c.assigned_staff_id = CAST(fs.user_id AS TEXT) OR LOWER(c.assigned_staff_email) = LOWER(fs.email) OR c.assigned_staff_name = fs.name)
               AND c.status IN ('Assigned', 'Staff Assigned', 'Department Assigned', 'In Progress', 'Accepted', 'On the Way', 'Resolution Submitted', 'Verified')
           ) as active_tasks,
           (
             SELECT COUNT(DISTINCT c.id)
             FROM complaints c
             WHERE (c.assigned_staff_id = CAST(fs.id AS TEXT) OR c.assigned_staff_id = CAST(fs.user_id AS TEXT) OR LOWER(c.assigned_staff_email) = LOWER(fs.email) OR c.assigned_staff_name = fs.name)
               AND c.status = 'Resolved'
           ) as completed_tasks,
           (
             SELECT COUNT(DISTINCT c.id)
             FROM complaints c
             WHERE (c.assigned_staff_id = CAST(fs.id AS TEXT) OR c.assigned_staff_id = CAST(fs.user_id AS TEXT) OR LOWER(c.assigned_staff_email) = LOWER(fs.email) OR c.assigned_staff_name = fs.name)
               AND (c.status = 'Overdue' OR (c.status NOT IN ('Resolved', 'Rejected') AND c.sla_deadline IS NOT NULL AND c.sla_deadline < CURRENT_TIMESTAMP))
           ) as overdue_tasks
    FROM field_staff fs
    LEFT JOIN departments d ON fs.department_id = d.id
    LEFT JOIN users u ON fs.user_id = u.id
    WHERE 1=1
  `;

  const params = [];

  if (!isAdmin) {
    sql += ` AND fs.department_id = $1`;
    params.push(userDeptId || -1);
  }

  sql += ` ORDER BY fs.created_at DESC`;

  console.log('Running SQL 1...');
  try {
    const result = await query(sql, params);
    console.log('Result 1 rows:', result.rows.length);
  } catch (err) {
    console.error('SQL 1 ERROR:', err);
  }

  let statsSql = `SELECT status, COUNT(*) as count FROM field_staff WHERE 1=1`;
  let statsParams = [];
  if (!isAdmin) {
    statsSql += ` AND department_id = $1`;
    statsParams.push(userDeptId || -1);
  }
  statsSql += ` GROUP BY status`;
  console.log('Running SQL 2...');
  try {
    const statsRes = await query(statsSql, statsParams);
    console.log('Result 2 rows:', statsRes.rows);
  } catch (err) {
    console.error('SQL 2 ERROR:', err);
  }

  let taskSql = `
    SELECT COUNT(DISTINCT a.id) as active_tasks_count
    FROM assignments a
    JOIN complaints c ON c.id = a.complaint_id
    JOIN field_staff fs ON (a.staff_id = fs.id OR a.staff_id = fs.user_id)
    WHERE c.status IN ('Assigned', 'In Progress', 'Verified')
  `;
  let taskParams = [];
  if (!isAdmin) {
    taskSql += ` AND fs.department_id = $1`;
    taskParams.push(userDeptId || -1);
  }
  console.log('Running SQL 3...');
  try {
    const taskRes = await query(taskSql, taskParams);
    console.log('Result 3 rows:', taskRes.rows);
  } catch (err) {
    console.error('SQL 3 ERROR:', err);
  }
}

test().catch(console.error);
