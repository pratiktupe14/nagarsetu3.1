const { Client } = require('pg');

const connStr = 'postgresql://postgres.botecyzkfptsrziwkkpe:IZizhWM3KeJyHSKZ@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres';

async function inspectUsers() {
  console.log('=== INSPECTING DB USERS & ROLES ===\n');

  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();

  // 1. Rahul Kumar
  const rahulRes = await client.query("SELECT id, name, email, role, department_id, status, must_change_password FROM users WHERE email LIKE '%rahul.kumar%'");
  console.log('Rahul Kumar user record:', rahulRes.rows);

  // 2. Department heads
  const dhUserRes = await client.query("SELECT id, name, email, role, department_id, status FROM users WHERE role = 'department_head'");
  console.log('\nDepartment Head users count:', dhUserRes.rows.length);
  dhUserRes.rows.slice(0, 7).forEach(u => console.log(`  HOD User: ${u.name} (${u.email}) | Dept ID: ${u.department_id}`));

  // 3. Field staff users
  const staffUserRes = await client.query("SELECT id, name, email, role, department_id, status FROM users WHERE role IN ('field_staff', 'service_staff', 'staff') LIMIT 5");
  console.log('\nField Staff users sample:', staffUserRes.rows);

  // 4. Citizen users
  const citizenRes = await client.query("SELECT id, name, email, role, status FROM users WHERE role = 'citizen' LIMIT 5");
  console.log('\nCitizen users sample:', citizenRes.rows);

  await client.end();
  process.exit(0);
}

inspectUsers().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
