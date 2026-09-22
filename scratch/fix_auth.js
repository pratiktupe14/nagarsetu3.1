const fs = require('fs');
const path = require('path');

const utilsFile = path.join(__dirname, '../backend/src/utils/departmentUtils.js');
const utilsCode = \const { query } = require('../config/db');

async function getCanonicalDepartmentId(deptInput) {
  if (!deptInput && deptInput !== 0) return null;
  const inputStr = String(deptInput).trim();
  
  try {
    let res = await query(
      "SELECT id, code FROM departments WHERE CAST(id AS TEXT) = ",
      [inputStr]
    );
    if (res.rows && res.rows.length > 0) return { id: String(res.rows[0].id), code: res.rows[0].code };

    res = await query(
      "SELECT id, code FROM departments WHERE UPPER(code) = UPPER()",
      [inputStr]
    );
    if (res.rows && res.rows.length > 0) return { id: String(res.rows[0].id), code: res.rows[0].code };

    res = await query(
      "SELECT id, code FROM departments WHERE UPPER(name) LIKE UPPER() OR UPPER(code) LIKE UPPER()",
      ['%' + inputStr + '%']
    );
    if (res.rows && res.rows.length > 0) return { id: String(res.rows[0].id), code: res.rows[0].code };
  } catch (e) {
    console.error('getCanonicalDepartmentId error', e);
  }
  
  return { id: inputStr, code: inputStr };
}

async function isDeptMatch(deptA, deptB, empId = '') {
  if (!deptA || !deptB) return true;
  if (String(deptA) === String(deptB)) return true;
  
  const objA = await getCanonicalDepartmentId(deptA);
  const objB = await getCanonicalDepartmentId(deptB || empId);
  
  return objA.id === objB.id;
}

module.exports = {
  getCanonicalDepartmentId,
  isDeptMatch
};
\;
fs.writeFileSync(utilsFile, utilsCode);

function replaceInFile(filePath, search, replace) {
  let content = fs.readFileSync(filePath, 'utf8');
  if (typeof search === 'string') {
    content = content.replace(search, replace);
  } else {
    content = content.replace(search, replace);
  }
  fs.writeFileSync(filePath, content);
}

// 1. Fix department.routes.js
const deptRoutesFile = path.join(__dirname, '../backend/src/routes/department.routes.js');
let deptContent = fs.readFileSync(deptRoutesFile, 'utf8');

// Replace normDept definition and calls
const normDeptRegex = /const normDept = \(d\) => \{[\s\S]*?return s\.toUpperCase\(\);\s*\};/g;
const normCallsRegex = /const normUserDept = normDept\(userDeptCode \|\| userDeptId\);\s*const normCompDept = normDept\(complaint\.department_id\);\s*const normStaffDept = normDept\(staff\.department_id \|\| staff\.employee_id\);/g;

deptContent = deptContent.replace(normDeptRegex, "const { getCanonicalDepartmentId } = require('../utils/departmentUtils');");

deptContent = deptContent.replace(normCallsRegex, \const userDeptObj = await getCanonicalDepartmentId(userDeptCode || userDeptId);
    const normUserDept = userDeptObj.code;
    const userCanonicalId = userDeptObj.id;

    const compDeptObj = await getCanonicalDepartmentId(complaint.department_id);
    const normCompDept = compDeptObj.code;
    const compCanonicalId = compDeptObj.id;

    const staffDeptObj = await getCanonicalDepartmentId(staff.department_id || staff.employee_id);
    const normStaffDept = staffDeptObj.code;
    const staffCanonicalId = staffDeptObj.id;\);

// Replace the condition checks in department.routes.js
deptContent = deptContent.replace(
  /normUserDept !== normCompDept/g,
  "userCanonicalId !== compCanonicalId"
);
deptContent = deptContent.replace(
  /normUserDept !== normStaffDept/g,
  "userCanonicalId !== staffCanonicalId"
);
deptContent = deptContent.replace(
  /normCompDept !== normStaffDept/g,
  "compCanonicalId !== staffCanonicalId"
);

fs.writeFileSync(deptRoutesFile, deptContent);

// 2. Fix officer.routes.js
const officerRoutesFile = path.join(__dirname, '../backend/src/routes/officer.routes.js');
let officerContent = fs.readFileSync(officerRoutesFile, 'utf8');

const isDeptMatchRegexOfficer = /\/\/ Helper: Check department matching\s*const isDeptMatch = \(deptA, deptB, empId = ''\) => \{[\s\S]*?return false;\s*\};/g;
officerContent = officerContent.replace(isDeptMatchRegexOfficer, "const { isDeptMatch } = require('../utils/departmentUtils');");

officerContent = officerContent.replace(
  /!isDeptMatch\(userDeptId, complaint\.department_id\)/g,
  "!(await isDeptMatch(userDeptId, complaint.department_id))"
);
officerContent = officerContent.replace(
  /!isDeptMatch\(userDeptId, staff\.department_id, staff\.employee_id\)/g,
  "!(await isDeptMatch(userDeptId, staff.department_id, staff.employee_id))"
);

fs.writeFileSync(officerRoutesFile, officerContent);

// 3. Fix staff.routes.js
const staffRoutesFile = path.join(__dirname, '../backend/src/routes/staff.routes.js');
let staffContent = fs.readFileSync(staffRoutesFile, 'utf8');

const isDeptMatchRegexStaff = /\/\/ Helper: Check department matching\s*const isDeptMatch = \(deptA, deptB\) => \{[\s\S]*?return false;\s*\};/g;
staffContent = staffContent.replace(isDeptMatchRegexStaff, "const { isDeptMatch } = require('../utils/departmentUtils');");

staffContent = staffContent.replace(
  /isDeptMatch\(userDeptId, complaint\.department_id\)/g,
  "(await isDeptMatch(userDeptId, complaint.department_id))"
);

fs.writeFileSync(staffRoutesFile, staffContent);

console.log('Done fixing auth');
