const { initDatabase, query } = require('../backend/src/config/db');

async function resolveDeptFromDb(deptInput) {
  if (!deptInput && deptInput !== 0) return null;
  const str = String(deptInput).trim();

  // Query authoritative departments table from database
  const res = await query(
    `SELECT id, code, name, description FROM departments 
     WHERE CAST(id AS TEXT) = CAST($1 AS TEXT)
        OR (code IS NOT NULL AND UPPER(code) = UPPER(CAST($1 AS TEXT)))
        OR (name IS NOT NULL AND LOWER(name) = LOWER(CAST($1 AS TEXT)))
        OR (name IS NOT NULL AND LOWER(name) LIKE LOWER($2))
     ORDER BY id ASC LIMIT 1`,
    [str, `%${str}%`]
  ).catch(() => ({ rows: [] }));

  if (res.rows && res.rows.length > 0) {
    const row = res.rows[0];
    return {
      id: row.id,
      idStr: String(row.id),
      code: row.code || '',
      name: row.name || ''
    };
  }

  return null;
}

async function run() {
  await initDatabase();

  console.log('=== TESTING DATABASE-DRIVEN DEPARTMENT RESOLUTION ===\n');

  const testInputs = [1, '1', 'PWD', 'Public Works Department', 'Public Works', 'pwd'];
  for (const input of testInputs) {
    const resolved = await resolveDeptFromDb(input);
    console.log(`Input: ${JSON.stringify(input)} => Resolved:`, resolved);
  }

  // Now test complaints query with database-resolved department
  const pwdDept = await resolveDeptFromDb('PWD');
  console.log('\nResolved PWD department from DB:', pwdDept);

  const compRes = await query(
    `SELECT c.id, c.complaint_number, c.department_id, d.name as department_name, d.code as department_code
     FROM complaints c
     LEFT JOIN departments d ON (
       CAST(c.department_id AS TEXT) = CAST(d.id AS TEXT)
       OR UPPER(CAST(c.department_id AS TEXT)) = UPPER(d.code)
     )
     WHERE CAST(c.department_id AS TEXT) = CAST($1 AS TEXT)
        OR UPPER(CAST(c.department_id AS TEXT)) = UPPER($2)
        OR (d.id IS NOT NULL AND (CAST(d.id AS TEXT) = CAST($1 AS TEXT) OR UPPER(d.code) = UPPER($2)))`,
    [String(pwdDept.id), String(pwdDept.code)]
  );

  console.log('Complaints returned count for PWD:', compRes.rows.length);
  if (compRes.rows.length > 0) {
    console.log('Sample complaint:', compRes.rows[0]);
  }

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
