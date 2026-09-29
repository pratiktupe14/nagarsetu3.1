const { query, initDatabase } = require('../backend/src/config/db');
const { getCanonicalDepartmentId } = require('../backend/src/security/departmentResolver');

async function check() {
  await initDatabase();
  console.log('--- DEPARTMENTS TABLE ---');
  const d = await query('SELECT id, name, code FROM departments');
  console.log(d.rows);

  console.log('--- CANONICAL RESOLVER TESTS ---');
  console.log('1:', await getCanonicalDepartmentId('1'));
  console.log('PWD:', await getCanonicalDepartmentId('PWD'));
  console.log('Public Works Department:', await getCanonicalDepartmentId('Public Works Department'));
  console.log('PWD-STF-001:', await getCanonicalDepartmentId('PWD-STF-001'));
  console.log('amit.patil@nagarsetu.gov.in:', await getCanonicalDepartmentId('amit.patil@nagarsetu.gov.in'));
}
check();
