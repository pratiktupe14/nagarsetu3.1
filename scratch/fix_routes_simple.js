const fs = require('fs');

let code = fs.readFileSync('backend/src/routes/department.routes.js', 'utf8');

if (!code.includes('isDeptMatch')) {
    code = code.replace(
        "const logger = require('../utils/logger');",
        "const logger = require('../utils/logger');\nconst { isDeptMatch } = require('../utils/departmentUtils');"
    );
}

const target1 = "if (userDeptId && complaint.department_id && userCanonicalId !== compCanonicalId) {";
const replacement1 = `const isTaskMatch = await isDeptMatch(userDeptId, complaint.department_id);
      if (userDeptId && complaint.department_id && !isTaskMatch) {`;
      
code = code.replace(target1, replacement1);

const target2 = "if (userDeptId && staff.department_id && userCanonicalId !== staffCanonicalId) {";
const replacement2 = `const isStaffMatch = await isDeptMatch(userDeptId, staff.department_id);
      if (userDeptId && staff.department_id && !isStaffMatch) {`;

code = code.replace(target2, replacement2);

fs.writeFileSync('backend/src/routes/department.routes.js', code);
console.log('Done replacement without regex!');
