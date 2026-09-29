const { query } = require('./backend/src/config/db');
const seed7DemoDepartmentHeads = require('./backend/src/scripts/seedDemoDepartmentHeads');

async function run() {
  console.log('=== RUNNING SEED 7 DEMO DEPARTMENT HEADS SCRIPT ===');
  try {
    await seed7DemoDepartmentHeads(query);
    console.log('Seeding completed successfully.');

    // Query departments
    const depts = await query('SELECT id, name, code FROM departments ORDER BY code');
    console.log('\n--- DEPARTMENTS TABLE ---');
    depts.rows.forEach(d => console.log(`ID: ${d.id} | Code: ${d.code} | Name: ${d.name}`));

    // Query department heads
    const heads = await query('SELECT dh.id, dh.name, dh.email, dh.department_id, d.code as dept_code FROM department_heads dh LEFT JOIN departments d ON dh.department_id::text = d.id::text ORDER BY d.code');
    console.log('\n--- DEPARTMENT HEADS TABLE ---');
    heads.rows.forEach(h => console.log(`Head: ${h.name} (${h.email}) | DeptID: ${h.department_id} | Code: ${h.dept_code}`));

  } catch (err) {
    console.error('Seeding Error:', err);
  }
}

run();
