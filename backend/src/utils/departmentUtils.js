const { query } = require('../config/db');

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

    // 2. Try match via department_heads table if inputStr is a department head record identifier
    let resDh = await query(
      `SELECT d.id, d.code FROM department_heads dh 
       JOIN departments d ON (
         CAST(d.id AS TEXT) = CAST(dh.department_id AS TEXT)
         OR UPPER(d.code) = UPPER(CAST(dh.department_id AS TEXT))
         OR UPPER(d.name) = UPPER(CAST(dh.department_id AS TEXT))
       ) 
       WHERE CAST(dh.id AS TEXT) = $1 
          OR CAST(dh.department_id AS TEXT) = $1 
          OR CAST(dh.user_id AS TEXT) = $1
       LIMIT 1`,
      [inputStr]
    );
    if (resDh.rows && resDh.rows.length === 1) return { id: String(resDh.rows[0].id), code: String(resDh.rows[0].code).toUpperCase() };

    // 3. Try match via field_staff table if inputStr is a field staff record identifier
    let resFs = await query(
      `SELECT d.id, d.code FROM field_staff fs 
       JOIN departments d ON (
         CAST(d.id AS TEXT) = CAST(fs.department_id AS TEXT)
         OR UPPER(d.code) = UPPER(CAST(fs.department_id AS TEXT))
         OR UPPER(d.name) = UPPER(CAST(fs.department_id AS TEXT))
       ) 
       WHERE CAST(fs.id AS TEXT) = $1 
          OR fs.employee_id = $1 
          OR CAST(fs.department_id AS TEXT) = $1
       LIMIT 1`,
      [inputStr]
    );
    if (resFs.rows && resFs.rows.length === 1) return { id: String(resFs.rows[0].id), code: String(resFs.rows[0].code).toUpperCase() };

  } catch (e) {
    console.error('getCanonicalDepartmentId error', e);
  }
  
  return null;
}

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
  isDeptMatch
};
