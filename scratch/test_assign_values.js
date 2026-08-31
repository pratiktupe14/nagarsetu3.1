const { query } = require('../backend/src/config/db');

async function testQuery() {
  const staff_id = 32;
  let staffRes = await query(
    `SELECT fs.id, fs.user_id, fs.name, fs.email, fs.phone as mobile, fs.department_id, fs.status 
     FROM field_staff fs 
     WHERE CAST(fs.user_id AS TEXT) = $1 OR fs.employee_id = $1 OR LOWER(fs.email) = LOWER($1)`,
    [staff_id]
  );
  console.log('Staff Query result:', staffRes.rows);
}

testQuery();
