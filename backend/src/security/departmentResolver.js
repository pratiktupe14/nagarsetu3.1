const { query } = require('../config/db');

/**
 * Canonical Database-Backed Department Resolver
 * Resolves department inputs (numeric ID, text ID, code, name, user_id, email, employee_id)
 * into a canonical { id, code } object.
 */
async function getCanonicalDepartmentId(deptInput) {
  if (deptInput === null || deptInput === undefined || deptInput === '') return null;
  const inputStr = String(deptInput).trim();
  if (!inputStr) return null;
  
  try {
    // 1. Try direct match in departments table by exact numeric ID, text ID, Code, or Name
    if (/^\d+$/.test(inputStr)) {
      let res = await query(
        'SELECT id, code FROM departments WHERE id = $1',
        [parseInt(inputStr, 10)]
      );
      if (res.rows && res.rows.length === 1) return { id: String(res.rows[0].id), code: String(res.rows[0].code).toUpperCase() };
    }

    let resId = await query(
      'SELECT id, code FROM departments WHERE CAST(id AS TEXT) = $1',
      [inputStr]
    );
    if (resId.rows && resId.rows.length === 1) return { id: String(resId.rows[0].id), code: String(resId.rows[0].code).toUpperCase() };

    let resCode = await query(
      'SELECT id, code FROM departments WHERE UPPER(code) = UPPER($1)',
      [inputStr]
    );
    if (resCode.rows && resCode.rows.length === 1) return { id: String(resCode.rows[0].id), code: String(resCode.rows[0].code).toUpperCase() };

    let resName = await query(
      'SELECT id, code FROM departments WHERE UPPER(name) = UPPER($1)',
      [inputStr]
    );
    if (resName.rows && resName.rows.length === 1) return { id: String(resName.rows[0].id), code: String(resName.rows[0].code).toUpperCase() };

    // 2. Try structured pattern extractions (e.g. "dept-1", "dept-PWD", "PWD-01", "Roads & Public Works (PWD)")
    let cleanVal = inputStr;
    if (cleanVal.toLowerCase().startsWith('dept-')) {
      cleanVal = cleanVal.slice(5).trim();
    }
    if (cleanVal.includes('-')) {
      cleanVal = cleanVal.split('-')[0].trim();
    }
    const matchParen = inputStr.match(/\(([^)]+)\)/);
    if (matchParen && matchParen[1]) {
      const insideParen = matchParen[1].trim();
      let resParen = await query(
        'SELECT id, code FROM departments WHERE UPPER(code) = UPPER($1) OR CAST(id AS TEXT) = $1',
        [insideParen]
      );
      if (resParen.rows && resParen.rows.length === 1) return { id: String(resParen.rows[0].id), code: String(resParen.rows[0].code).toUpperCase() };
    }

    if (cleanVal && cleanVal !== inputStr) {
      let resClean = await query(
        'SELECT id, code FROM departments WHERE UPPER(code) = UPPER($1) OR CAST(id AS TEXT) = $1 OR UPPER(name) = UPPER($1)',
        [cleanVal]
      );
      if (resClean.rows && resClean.rows.length === 1) return { id: String(resClean.rows[0].id), code: String(resClean.rows[0].code).toUpperCase() };
    }

    // 3. Try match via department_heads table if inputStr is a department head record identifier, user_id, or email
    let resDh = await query(
      `SELECT dh.department_id, d.id as d_id, d.code as d_code FROM department_heads dh 
       LEFT JOIN departments d ON (
         CAST(d.id AS TEXT) = CAST(dh.department_id AS TEXT)
         OR UPPER(d.code) = UPPER(CAST(dh.department_id AS TEXT))
         OR UPPER(d.name) = UPPER(CAST(dh.department_id AS TEXT))
       ) 
       WHERE CAST(dh.id AS TEXT) = $1 
          OR CAST(dh.user_id AS TEXT) = $1
          OR LOWER(dh.email) = LOWER($1)
          OR dh.employee_id = $1
       ORDER BY dh.id DESC LIMIT 1`,
      [inputStr]
    );
    if (resDh.rows && resDh.rows.length > 0) {
      const row = resDh.rows[0];
      if (row.d_id && row.d_code) return { id: String(row.d_id), code: String(row.d_code).toUpperCase() };
      if (row.department_id) {
        const subRes = await getCanonicalDepartmentId(row.department_id);
        if (subRes) return subRes;
      }
    }

    // 4. Try match via field_staff table if inputStr is a field staff record identifier, user_id, or email
    let resFs = await query(
      `SELECT fs.department_id, d.id as d_id, d.code as d_code FROM field_staff fs 
       LEFT JOIN departments d ON (
         CAST(d.id AS TEXT) = CAST(fs.department_id AS TEXT)
         OR UPPER(d.code) = UPPER(CAST(fs.department_id AS TEXT))
         OR UPPER(d.name) = UPPER(CAST(fs.department_id AS TEXT))
       ) 
       WHERE CAST(fs.id AS TEXT) = $1 
          OR CAST(fs.user_id AS TEXT) = $1
          OR fs.employee_id = $1
          OR LOWER(fs.email) = LOWER($1)
       ORDER BY fs.id DESC LIMIT 1`,
      [inputStr]
    );
    if (resFs.rows && resFs.rows.length > 0) {
      const row = resFs.rows[0];
      if (row.d_id && row.d_code) return { id: String(row.d_id), code: String(row.d_code).toUpperCase() };
      if (row.department_id) {
        const subRes = await getCanonicalDepartmentId(row.department_id);
        if (subRes) return subRes;
      }
    }

    // 5. Try match via users table if inputStr is a user id, email, or employee_id
    let resUsers = await query(
      `SELECT u.department_id, d.id as d_id, d.code as d_code FROM users u 
       LEFT JOIN departments d ON (
         CAST(d.id AS TEXT) = CAST(u.department_id AS TEXT)
         OR UPPER(d.code) = UPPER(CAST(u.department_id AS TEXT))
         OR UPPER(d.name) = UPPER(CAST(u.department_id AS TEXT))
       ) 
       WHERE CAST(u.id AS TEXT) = $1 
          OR LOWER(u.email) = LOWER($1)
          OR u.employee_id = $1
       ORDER BY u.id DESC LIMIT 1`,
      [inputStr]
    );
    if (resUsers.rows && resUsers.rows.length > 0) {
      const row = resUsers.rows[0];
      if (row.d_id && row.d_code) return { id: String(row.d_id), code: String(row.d_code).toUpperCase() };
      if (row.department_id) {
        const subRes = await getCanonicalDepartmentId(row.department_id);
        if (subRes) return subRes;
      }
    }

  } catch (e) {
    console.error('getCanonicalDepartmentId error', e);
  }
  
  return null;
}

/**
 * Resolves the authenticated user's department canonically from req.user context.
 */
async function resolveUserDepartment(req) {
  if (!req || !req.user) return { userDeptId: null, userDeptCode: null, canonical: null };
  const user = req.user;

  if (user.department_id) {
    const res = await getCanonicalDepartmentId(user.department_id);
    if (res) return { userDeptId: res.id, userDeptCode: res.code, canonical: res };
  }
  if (user.id) {
    const res = await getCanonicalDepartmentId(user.id);
    if (res) return { userDeptId: res.id, userDeptCode: res.code, canonical: res };
  }
  if (user.email) {
    const res = await getCanonicalDepartmentId(user.email);
    if (res) return { userDeptId: res.id, userDeptCode: res.code, canonical: res };
  }
  return { userDeptId: null, userDeptCode: null, canonical: null };
}

/**
 * Fail-closed security guard checking whether two department inputs resolve to the same canonical department.
 */
async function isDeptMatch(deptA, deptB) {
  if (deptA === null || deptA === undefined || deptA === '') return false;
  if (deptB === null || deptB === undefined || deptB === '') return false;
  
  const objA = await getCanonicalDepartmentId(deptA);
  const objB = await getCanonicalDepartmentId(deptB);
  
  if (!objA || !objB) return false;
  
  return String(objA.id) === String(objB.id) || String(objA.code).toUpperCase() === String(objB.code).toUpperCase();
}

module.exports = {
  getCanonicalDepartmentId,
  resolveUserDepartment,
  isDeptMatch
};
