const fs = require('fs');
let code = fs.readFileSync('backend/src/utils/departmentUtils.js', 'utf8');

const regex1 = /async function getCanonicalDepartmentId\([\s\S]*?\}[\s]*async function isDeptMatch/m;

const replacement1 = `async function getCanonicalDepartmentId(deptInput) {
  if (deptInput === null || deptInput === undefined || deptInput === '') return null;
  const inputStr = String(deptInput).trim();
  if (!inputStr) return null;
  
  try {
    // 1. Try to match by Exact ID (integer check)
    if (!isNaN(parseInt(inputStr, 10))) {
        let res = await query(
          'SELECT id, code FROM departments WHERE id = $1',
          [parseInt(inputStr, 10)]
        );
        if (res.rows && res.rows.length > 0) return { id: String(res.rows[0].id), code: res.rows[0].code };
    }

    // 2. Try to match by exact Code (case-insensitive)
    let res = await query(
      'SELECT id, code FROM departments WHERE UPPER(code) = UPPER($1)',
      [inputStr]
    );
    if (res.rows && res.rows.length > 0) return { id: String(res.rows[0].id), code: res.rows[0].code };

    // 3. Try to match by exact Name (case-insensitive)
    res = await query(
      'SELECT id, code FROM departments WHERE UPPER(name) = UPPER($1)',
      [inputStr]
    );
    if (res.rows && res.rows.length > 0) return { id: String(res.rows[0].id), code: res.rows[0].code };

  } catch (e) {
    console.error('getCanonicalDepartmentId error', e);
  }
  
  return null;
}

async function isDeptMatch`;

code = code.replace(regex1, replacement1);

const regex2 = /async function isDeptMatch\([\s\S]*?\}[\s]*module\.exports/m;
const replacement2 = `async function isDeptMatch(deptA, deptB) {
  if (deptA === null || deptA === undefined || deptA === '') return false;
  if (deptB === null || deptB === undefined || deptB === '') return false;
  
  const objA = await getCanonicalDepartmentId(deptA);
  const objB = await getCanonicalDepartmentId(deptB);
  
  if (!objA || !objB) return false;
  
  return String(objA.id) === String(objB.id);
}

module.exports`;

code = code.replace(regex2, replacement2);

fs.writeFileSync('backend/src/utils/departmentUtils.js', code);
