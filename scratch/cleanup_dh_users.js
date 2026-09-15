const { initDatabase, query } = require('../backend/src/config/db');
const seed7DemoDepartmentHeads = require('../backend/src/scripts/seedDemoDepartmentHeads');

async function cleanup() {
  process.env.FORCE_PASSWORD_RESET = 'true';
  await initDatabase();
  console.log('Cleaning up department_heads and duplicate user entries...');
  await query(`DELETE FROM department_heads`);
  await query(`DELETE FROM users WHERE role = 'department_head' OR email LIKE '%@nagarsetu.gov.in' AND email NOT IN ('admin@nagarsetu.gov.in', 'staff@nagarsetu.gov.in', 'officer@nagarsetu.gov.in')`);
  await seed7DemoDepartmentHeads(query);
  console.log('Clean seed complete!');
  process.exit(0);
}

cleanup();
