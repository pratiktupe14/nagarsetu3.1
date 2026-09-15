const { initDatabase, query } = require('../backend/src/config/db');

async function main() {
  try {
    await initDatabase();

    console.log('\n--- RAHUL KUMAR & DEPT HEAD USERS ---');
    const users = await query("SELECT id, name, email, role, department_id, designation FROM users WHERE name LIKE '%Rahul%' OR role = 'department_head'");
    console.table(users.rows);

    console.log('\n--- DEPARTMENT HEADS TABLE ---');
    const dhs = await query("SELECT * FROM department_heads");
    console.table(dhs.rows);

    process.exit(0);
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

main();
