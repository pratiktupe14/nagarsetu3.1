const { initDatabase, query } = require('../backend/src/config/db');
const { normalizeDepartmentInfo } = require('../backend/src/routes/department.routes');

async function testDeptResolution(userDeptId, userDeptName, userDeptCode) {
  let norm = normalizeDepartmentInfo(userDeptId);
  if (!norm.code || !['PWD', 'SAN', 'WTR', 'DRN', 'ELE', 'TRF', 'MNT'].includes(norm.code)) {
    const compositeContext = `${userDeptId || ''} ${userDeptName || ''} ${'rahul.kumar@nagarsetu.gov.in'} ${'EMP-001'}`;
    norm = normalizeDepartmentInfo(compositeContext);
  }

  console.log('Input:', { userDeptId, userDeptName, userDeptCode });
  console.log('Final norm:', norm);

  let sql = `
    SELECT c.id, c.complaint_number, c.department_id, d.name as department_name, d.code as department_code
    FROM complaints c
    LEFT JOIN departments d ON (
      CAST(c.department_id AS TEXT) = CAST(d.id AS TEXT)
      OR UPPER(CAST(c.department_id AS TEXT)) = UPPER(d.code)
    )
    WHERE 1=1
   AND (
    CAST(c.department_id AS TEXT) = $1
    OR UPPER(CAST(c.department_id AS TEXT)) = UPPER($2)
    OR (d.id IS NOT NULL AND (CAST(d.id AS TEXT) = $1 OR UPPER(d.code) = UPPER($2)))
    OR LOWER(c.category) LIKE $3
  )
  `;
  const deptKeyword = `%${(norm.name || userDeptName || '').toLowerCase().split(' ')[0]}%`;
  const params = [String(norm.idStr || userDeptId || -1), String(norm.code || userDeptCode || ''), deptKeyword];
  console.log('Params:', params);

  const sqliteSql = sql.replace(/\$1/g, '?').replace(/\$2/g, '?').replace(/\$3/g, '?');
  const result = await query(sqliteSql, params);
  console.log('Query returned count:', result.rows.length);
}

async function run() {
  await initDatabase();

  console.log('\n--- Case 1: userDeptId is UUID, userDeptCode is null, userDeptName is null ---');
  await testDeptResolution('8ed9f760-1314-427c-a515-c2a54d6df6d8', '', '');

  console.log('\n--- Case 2: userDeptId is UUID, userDeptName is "Public Works Department", userDeptCode is null ---');
  await testDeptResolution('8ed9f760-1314-427c-a515-c2a54d6df6d8', 'Public Works Department', '');

  console.log('\n--- Case 3: userDeptId is UUID, userDeptCode is "PWD" ---');
  await testDeptResolution('8ed9f760-1314-427c-a515-c2a54d6df6d8', 'Public Works Department', 'PWD');

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
