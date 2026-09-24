const { getCanonicalDepartmentId, isDeptMatch } = require('../backend/src/utils/departmentUtils');
const { query, initDatabase } = require('../backend/src/config/db');

async function debug() {
  await initDatabase();
  
  const inputStr = '128';
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
  console.log('resDh rows:', resDh.rows);

  const direct = await getCanonicalDepartmentId('128');
  console.log('getCanonicalDepartmentId("128"):', direct);

  const byEmail = await getCanonicalDepartmentId('rahul.kumar@nagarsetu.gov.in');
  console.log('getCanonicalDepartmentId("rahul.kumar@nagarsetu.gov.in"):', byEmail);

  const byPwd = await getCanonicalDepartmentId('PWD');
  console.log('getCanonicalDepartmentId("PWD"):', byPwd);

  const by1 = await getCanonicalDepartmentId('1');
  console.log('getCanonicalDepartmentId("1"):', by1);

  // Test isDeptMatch for various scenarios
  console.log('\n--- Testing isDeptMatch ---');
  console.log('isDeptMatch("128", "1"):', await isDeptMatch('128', '1'));
  console.log('isDeptMatch("128", "PWD"):', await isDeptMatch('128', 'PWD'));
  console.log('isDeptMatch("PWD", "1"):', await isDeptMatch('PWD', '1'));
  console.log('isDeptMatch("rahul.kumar@nagarsetu.gov.in", "1"):', await isDeptMatch('rahul.kumar@nagarsetu.gov.in', '1'));

  process.exit(0);
}

debug().catch(err => {
  console.error(err);
  process.exit(1);
});
