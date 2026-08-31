const { query } = require('../backend/src/config/db');

async function testResolve() {
  const users = await query("SELECT id, name, email, role, department_id FROM users WHERE role = 'department_head'");
  console.log('USERS TABLE department_heads:');
  console.log(users.rows);

  const reqMock = {
    user: {
      id: users.rows[0]?.id || 5,
      email: 'rahul.kumar@nagarsetu.gov.in',
      role: 'department_head',
      department_id: 1,
      department_name: 'Public Works Department (PWD)'
    }
  };

  // Run department.routes.js query logic
  let userDeptId = reqMock.user.department_id || null;
  let userDeptName = reqMock.user.department_name || '';

  if (!userDeptId || !userDeptName) {
    const uRes = await query('SELECT department_id, role FROM users WHERE id = ? OR email = ?', [reqMock.user.id, reqMock.user.email]);
    if (uRes.rows.length > 0) {
      userDeptId = uRes.rows[0].department_id || userDeptId;
    }

    const dhRes = await query(
      `SELECT dh.department_id, d.name as department_name 
       FROM department_heads dh 
       LEFT JOIN departments d ON d.id = dh.department_id 
       WHERE (dh.user_id = ? OR LOWER(dh.email) = LOWER(?)) AND dh.status = 'active'`,
      [reqMock.user.id, reqMock.user.email || '']
    );
    if (dhRes.rows.length > 0) {
      userDeptId = dhRes.rows[0].department_id || userDeptId;
      userDeptName = dhRes.rows[0].department_name || userDeptName;
    }
  }

  console.log('Resolved userDeptId:', userDeptId, 'userDeptName:', userDeptName);

  let sql = `
    SELECT c.*, d.name as department_name, d.code as department_code, f.rating, f.comment as feedback_comment
    FROM complaints c
    LEFT JOIN departments d ON c.department_id = d.id
    LEFT JOIN feedback f ON f.complaint_id = c.id
    WHERE (c.department_id = ? OR CAST(c.department_id AS TEXT) = ?)
    ORDER BY c.created_at DESC
  `;
  const params = [String(userDeptId), String(userDeptId)];
  const result = await query(sql, params);
  console.log('Query result count:', result.rows.length);
  console.log('Query result complaints:', result.rows.map(r => ({ id: r.id, number: r.complaint_number, deptId: r.department_id })));
}

testResolve().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
