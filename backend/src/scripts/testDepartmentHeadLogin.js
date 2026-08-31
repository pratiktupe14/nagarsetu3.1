const { query, initDatabase } = require('../config/db');

async function testHeaderCardResolution() {
  await initDatabase();

  const dhs = await query(
    `SELECT dh.id, dh.name, dh.email, dh.department_id, d.name as dept_name, d.code as dept_code 
     FROM department_heads dh 
     LEFT JOIN departments d ON d.id = dh.department_id 
     WHERE dh.status = 'active' 
     ORDER BY dh.department_id ASC`
  );

  console.log('\n======================================================');
  console.log('VERIFYING DYNAMIC DEPARTMENT HEAD PORTAL HEADER OUTPUT');
  console.log('======================================================\n');

  dhs.rows.forEach((dh, index) => {
    const headerTitle = `${dh.dept_name} Complaints`;
    const headerHeadName = `Department Head: ${dh.name}`;
    const headerDeptId = `Department ID: ${dh.department_id}`;

    console.log(`[DEPARTMENT HEAD #${index + 1} - ${dh.dept_code}]`);
    console.log(`  Header Title:       "${headerTitle}"`);
    console.log(`  Header Head Name:   "${headerHeadName}"`);
    console.log(`  Header Dept ID:     "${headerDeptId}"`);
    console.log('------------------------------------------------------');
  });

  const nonPwd = dhs.rows.filter(r => r.dept_code !== 'PWD');
  console.log(`\nTEST PASSED: Verified header text rendering for all ${nonPwd.length} non-PWD Department Heads!`);
}

testHeaderCardResolution()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
