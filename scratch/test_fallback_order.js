const { initDatabase, query } = require('../backend/src/config/db');
const { getCanonicalDepartmentId, isDeptMatch } = require('../backend/src/utils/departmentUtils');
const { resolveUserDepartment } = require('../backend/src/routes/department.routes');

async function testFallbackOrder() {
  await initDatabase();

  console.log('=== TESTING FALLBACK ORDER & CANONICAL RESOLUTION ===\n');

  // Fetch all department heads from users table
  const dhs = await query(`
    SELECT u.id as u_id, u.name as u_name, u.email as u_email, u.role, u.department_id as u_dept_id,
           dh.id as dh_id, dh.user_id as dh_user_id, dh.department_id as dh_dept_id
    FROM users u
    LEFT JOIN department_heads dh ON (CAST(dh.user_id AS TEXT) = CAST(u.id AS TEXT) OR LOWER(dh.email) = LOWER(u.email))
    WHERE u.role IN ('department_head', 'officer')
  `);

  for (const dh of dhs.rows) {
    console.log(`\nDH: ${dh.u_name} (email: '${dh.u_email}', user_id: ${dh.u_id}, u_dept_id: '${dh.u_dept_id}', dh_user_id: '${dh.dh_user_id}', dh_dept_id: '${dh.dh_dept_id}')`);

    // Test resolving with email vs user_id
    const resById = await getCanonicalDepartmentId(String(dh.u_id));
    const resByEmail = await getCanonicalDepartmentId(dh.u_email);
    const resByDeptId = await getCanonicalDepartmentId(dh.u_dept_id);

    console.log(`  getCanonicalDepartmentId(dh.u_id='${dh.u_id}'):`, resById);
    console.log(`  getCanonicalDepartmentId(dh.u_email='${dh.u_email}'):`, resByEmail);
    console.log(`  getCanonicalDepartmentId(dh.u_dept_id='${dh.u_dept_id}'):`, resByDeptId);

    // Test resolveUserDepartment with mockReq where req.user.department_id is null
    const mockReq = { user: { id: dh.u_id, email: dh.u_email, role: dh.role, department_id: null } };
    const resolved = await resolveUserDepartment(mockReq);
    console.log(`  resolveUserDepartment(mockReq where department_id=null):`, resolved);

    // Test actorDeptInput under OLD logic (userDeptId || req.user.department_id || req.user.id || req.user.email)
    const oldActorDeptInput = resolved.userDeptId || mockReq.user.department_id || mockReq.user.id || mockReq.user.email;
    console.log(`  OLD actorDeptInput ('${oldActorDeptInput}'):`, await getCanonicalDepartmentId(oldActorDeptInput));

    // Test actorDeptInput under NEW logic (userDeptCode || resolved.userDeptId || mockReq.user.department_id || mockReq.user.email || mockReq.user.id)
    const newActorDeptInput = resolved.userDeptCode || resolved.userDeptId || mockReq.user.department_id || mockReq.user.email || mockReq.user.id;
    console.log(`  NEW actorDeptInput ('${newActorDeptInput}'):`, await getCanonicalDepartmentId(newActorDeptInput));
  }
}

testFallbackOrder().then(() => process.exit(0)).catch(e => { console.error('TEST ERROR:', e); process.exit(1); });
