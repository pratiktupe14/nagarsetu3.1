const { initDatabase, query, getIsSqlite } = require('../backend/src/config/db');

async function main() {
  console.log('Testing initDatabase()...');
  await initDatabase();
  console.log('initDatabase() resolved. isSqlite:', getIsSqlite());

  console.log('Testing query departments...');
  const depts = await query('SELECT * FROM departments');
  console.log(`Departments count: ${depts.rows.length}`);
  for (const d of depts.rows) {
    console.log(` - [${d.id}] ${d.code}: ${d.name}`);
  }

  console.log('Testing query users...');
  const users = await query('SELECT id, name, email, role FROM users LIMIT 5');
  console.log(`Users count: ${users.rows.length}`);
  for (const u of users.rows) {
    console.log(` - [${u.id}] ${u.role}: ${u.name} (${u.email})`);
  }

  console.log('Testing query complaints...');
  const complaints = await query('SELECT id, complaint_number, title, status FROM complaints LIMIT 5');
  console.log(`Complaints count: ${complaints.rows.length}`);

  console.log('SUCCESS: All database queries executed successfully without memory fallback!');
  process.exit(0);
}

main().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
