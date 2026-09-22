const fs = require('fs');

let code = fs.readFileSync('backend/src/routes/department.routes.js', 'utf8');

// 1. Add require if missing
if (!code.includes('isDeptMatch')) {
    code = code.replace(
        /const logger = require\('\\.\\.\/utils\/logger'\);/,
        "const logger = require('../utils/logger');\nconst { isDeptMatch } = require('../utils/departmentUtils');"
    );
}

// 2. Replace the broken checks
const brokenCheck = /if \\(userDeptId && complaint\\.department_id && userCanonicalId !== compCanonicalId\\) \\{[\\s\\S]*?result: 'DENY'[\\s\\S]*?\\}\\);\\s*return res\\.status\\(403\\)\\.json\\(\\{ error: 'Forbidden: You cannot assign complaints outside your department\\.' \\}\\);\\s*\\}\\s*if \\(userDeptId && staff\\.department_id && userCanonicalId !== staffCanonicalId\\) \\{[\\s\\S]*?result: 'DENY'[\\s\\S]*?\\}\\);\\s*return res\\.status\\(403\\)\\.json\\(\\{ error: 'Forbidden: You cannot assign complaints outside your department\\.' \\}\\);\\s*\\}/m;

const replacement = `const isTaskMatch = await isDeptMatch(userDeptId, complaint.department_id);
      if (userDeptId && complaint.department_id && !isTaskMatch) {
        logger.warn('ASSIGNMENT_AUTH_CHECK', {
          requestId: req.requestId || logger.generateRequestId(),
          actorUserId: req.user?.id,
          actorRole: userRole,
          actorDepartmentId: userDeptId,
          actorDepartmentCode: normUserDept,
          taskId: complaint_id,
          taskDepartmentId: complaint.department_id,
          taskDepartmentCode: normCompDept,
          staffId: staff_id,
          staffDepartmentId: staff.department_id,
          staffDepartmentCode: normStaffDept,
          result: 'DENY'
        });
        return res.status(403).json({ error: 'Forbidden: You cannot assign complaints outside your department.' });
      }
      
      const isStaffMatch = await isDeptMatch(userDeptId, staff.department_id);
      if (userDeptId && staff.department_id && !isStaffMatch) {
        logger.warn('ASSIGNMENT_AUTH_CHECK', {
          requestId: req.requestId || logger.generateRequestId(),
          actorUserId: req.user?.id,
          actorRole: userRole,
          actorDepartmentId: userDeptId,
          actorDepartmentCode: normUserDept,
          taskId: complaint_id,
          taskDepartmentId: complaint.department_id,
          taskDepartmentCode: normCompDept,
          staffId: staff_id,
          staffDepartmentId: staff.department_id,
          staffDepartmentCode: normStaffDept,
          result: 'DENY'
        });
        return res.status(403).json({ error: 'Forbidden: You cannot assign complaints outside your department.' });
      }`;

if (brokenCheck.test(code)) {
    code = code.replace(brokenCheck, replacement);
    fs.writeFileSync('backend/src/routes/department.routes.js', code);
    console.log('Successfully fixed department.routes.js');
} else {
    console.log('Regex did not match.');
}
