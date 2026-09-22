const { initDatabase, query } = require('../backend/src/config/db');
const { resolveUserDepartment, normalizeDepartmentInfo } = require('../backend/src/routes/department.routes');

async function testCase(label, reqUser) {
  console.log(`\n--- Test Case: ${label} ---`);
  console.log('req.user:', reqUser);
  const req = { user: reqUser };
  const resolved = await resolveUserDepartment(req);
  console.log('Resolved user department:', resolved);

  // Now trace SQL query executed in GET /api/department/complaints
  const { userDeptId, userDeptName, userDeptCode } = resolved;
  const norm = normalizeDepartmentInfo(userDeptCode || userDeptId || userDeptName);
  console.log('Normalized department info:', norm);

  let sql = `
    SELECT c.id, c.complaint_number, c.department_id, d.name as department_name, d.code as department_code
    FROM complaints c
    LEFT JOIN departments d ON (
      CAST(c.department_id AS TEXT) = CAST(d.id AS TEXT)
      OR UPPER(CAST(c.department_id AS TEXT)) = UPPER(d.code)
    )
    WHERE 1=1
  `;
  const params = [];

  sql += ` AND (
    CAST(c.department_id AS TEXT) = $1
    OR UPPER(CAST(c.department_id AS TEXT)) = UPPER($2)
    OR (d.id IS NOT NULL AND (CAST(d.id AS TEXT) = $1 OR UPPER(d.code) = UPPER($2)))
    OR LOWER(c.category) LIKE $3
  )`;
  const deptKeyword = `%${(norm.name || userDeptName || '').toLowerCase().split(' ')[0]}%`;
  params.push(String(norm.idStr || userDeptId || -1), String(norm.code || userDeptCode || ''), deptKeyword);

  console.log('SQL:', sql);
  console.log('Params:', params);

  // In SQLite, convert $1, $2, $3 to ? for raw query testing
  const sqliteSql = sql.replace(/\$1/g, '?').replace(/\$2/g, '?').replace(/\$3/g, '?');
  const result = await query(sqliteSql, params);
  console.log('Query returned count:', result.rows.length);
  if (result.rows.length > 0) {
    console.log('Sample row:', result.rows[0]);
  }
}

async function run() {
  await initDatabase();

  await testCase('Standard integer ID', {
    id: 128,
    email: 'rahul.kumar@nagarsetu.gov.in',
    role: 'department_head',
    department_id: 1,
    department_code: 'PWD'
  });

  await testCase('String PWD code', {
    id: 128,
    email: 'rahul.kumar@nagarsetu.gov.in',
    role: 'department_head',
    department_id: 'PWD',
    department_code: 'PWD'
  });

  await testCase('UUID user ID and UUID department ID', {
    id: 'a0000000-0000-0000-0000-000000000128',
    email: 'rahul.kumar@nagarsetu.gov.in',
    role: 'department_head',
    department_id: 'b0000000-0000-0000-0000-000000000001',
    department_code: 'PWD'
  });

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
