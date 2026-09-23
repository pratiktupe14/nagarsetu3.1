const { query } = require('../config/db');

async function getCanonicalDepartmentId(deptInput) {
  if (deptInput === null || deptInput === undefined || deptInput === '') return null;
  const inputStr = String(deptInput).trim();
  if (!inputStr) return null;
  
  try {
    // 1. Try to match by Exact ID (numeric or string/UUID CAST)
    if (/^\d+$/.test(inputStr)) {
        let res = await query(
          'SELECT id, code FROM departments WHERE id = $1',
          [parseInt(inputStr, 10)]
        );
        if (res.rows && res.rows.length === 1) return { id: String(res.rows[0].id), code: res.rows[0].code };
    }

    let resUuid = await query(
      'SELECT id, code FROM departments WHERE CAST(id AS TEXT) = $1',
      [inputStr]
    );
    if (resUuid.rows && resUuid.rows.length === 1) return { id: String(resUuid.rows[0].id), code: resUuid.rows[0].code };

    // 2. Try to match by exact Code (case-insensitive)
    let res = await query(
      'SELECT id, code FROM departments WHERE UPPER(code) = UPPER($1)',
      [inputStr]
    );
    if (res.rows && res.rows.length === 1) return { id: String(res.rows[0].id), code: res.rows[0].code };

    // 3. Try to match by exact Name (case-insensitive)
    res = await query(
      'SELECT id, code FROM departments WHERE UPPER(name) = UPPER($1)',
      [inputStr]
    );
    if (res.rows && res.rows.length === 1) return { id: String(res.rows[0].id), code: res.rows[0].code };

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
  
  return String(objA.id) === String(objB.id);
}

module.exports = {
  getCanonicalDepartmentId,
  isDeptMatch
};
