const { Client } = require('pg');

async function testPooler() {
  console.log('=== TESTING NORTHEAST-1 POOLER FOR NAGARSETU BACKEND ===\n');

  const connStr = 'postgresql://postgres.botecyzkfptsrziwkkpe:IZizhWM3KeJyHSKZ@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres';
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

  await client.connect();
  console.log('Connected to pooler!');

  const depts = await client.query('SELECT id, code, name FROM departments ORDER BY id');
  console.log('Departments (7 expected):', depts.rows.length);
  depts.rows.forEach(d => console.log(`  Dept ${d.id}: ${d.code} - ${d.name}`));

  const dhs = await client.query(`
    SELECT dh.id, dh.department_id, u.name, u.email, dh.status
    FROM department_heads dh
    JOIN users u ON CAST(dh.user_id AS TEXT) = CAST(u.id AS TEXT)
    ORDER BY dh.id ASC
  `);
  console.log('\nDepartment Heads (7+ expected):', dhs.rows.length);
  dhs.rows.forEach(dh => console.log(`  HOD ID ${dh.id}: ${dh.name} (${dh.email}) | Dept: ${dh.department_id} | Status: ${dh.status}`));

  const staff = await client.query('SELECT count(*) FROM field_staff');
  console.log('\nField Staff count (36 expected):', staff.rows[0].count);

  await client.end();
  process.exit(0);
}

testPooler().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
