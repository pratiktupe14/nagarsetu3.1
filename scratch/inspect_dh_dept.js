const { initDatabase, query } = require('../backend/src/config/db');

async function inspectDh() {
  await initDatabase();
  const dhList = await query('SELECT * FROM department_heads ORDER BY id ASC');
  console.log('--- department_heads table ---');
  dhList.rows.forEach(dh => console.log(`ID: ${dh.id} | User ID: ${dh.user_id} | Name: ${dh.name} | Dept ID: ${JSON.stringify(dh.department_id)} | Email: ${dh.email}`));

  const usersList = await query("SELECT id, name, email, role, department_id FROM users WHERE role = 'department_head' ORDER BY id ASC");
  console.log('\n--- users table for department_head role ---');
  usersList.rows.forEach(u => console.log(`User ID: ${u.id} | Name: ${u.name} | Dept ID: ${JSON.stringify(u.department_id)} | Email: ${u.email}`));

  const depts = await query("SELECT * FROM departments ORDER BY id ASC");
  console.log('\n--- departments table ---');
  depts.rows.forEach(d => console.log(`Dept ID: ${d.id} | Code: ${d.code} | Name: ${d.name}`));

  process.exit(0);
}

inspectDh().catch(err => { console.error(err); process.exit(1); });
