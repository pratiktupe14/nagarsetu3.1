const { getCanonicalDepartmentId, isDeptMatch } = require('../backend/src/utils/departmentUtils');
const { query } = require('../backend/src/config/db');

async function test() {
  console.log('--- Testing getCanonicalDepartmentId ---');
  console.log('For "128" (user_id):', await getCanonicalDepartmentId('128'));
  console.log('For "rahul.kumar@nagarsetu.gov.in" (email):', await getCanonicalDepartmentId('rahul.kumar@nagarsetu.gov.in'));
  console.log('For "1" (dept_id):', await getCanonicalDepartmentId('1'));
  console.log('For "PWD" (dept_code):', await getCanonicalDepartmentId('PWD'));
  
  const dhRes = await query("SELECT id, email, user_id, department_id FROM department_heads WHERE LOWER(email) LIKE '%rahul%'");
  console.log('DH DB record:', dhRes.rows);

  const uRes = await query("SELECT id, email, department_id FROM users WHERE LOWER(email) LIKE '%rahul%'");
  console.log('Users DB record:', uRes.rows);

  process.exit(0);
}
test().catch(err => {
  console.error(err);
  process.exit(1);
});
