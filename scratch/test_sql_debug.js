const { query } = require('../backend/src/config/db');

async function testSql() {
  const compRes = await query('SELECT id, complaint_number, department_id, category, title FROM complaints');
  console.log('COMPLAINTS IN DB:');
  compRes.rows.forEach(c => {
    console.log(`  ID: ${c.id}, Num: ${c.complaint_number}, DeptID: ${c.department_id} (type: ${typeof c.department_id}), Category: ${c.category}`);
  });

  const dhRes = await query('SELECT * FROM department_heads');
  console.log('\nDEPARTMENT HEADS IN DB:');
  dhRes.rows.forEach(dh => {
    console.log(`  ID: ${dh.id}, UserID: ${dh.user_id}, Name: ${dh.name}, Email: ${dh.email}, DeptID: ${dh.department_id} (type: ${typeof dh.department_id})`);
  });

  // Test query for PWD Head (Dept 1)
  const pwdComp1 = await query('SELECT * FROM complaints WHERE department_id = 1');
  console.log(`\nQuery "WHERE department_id = 1" count: ${pwdComp1.rows.length}`);

  const pwdComp2 = await query('SELECT * FROM complaints WHERE CAST(department_id AS TEXT) = "1" OR department_id = 1');
  console.log(`Query "WHERE CAST(department_id AS TEXT) = '1' OR department_id = 1" count: ${pwdComp2.rows.length}`);
}

testSql().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
