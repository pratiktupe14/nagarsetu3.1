const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { initDatabase, query } = require('../backend/src/config/db');

async function run() {
  await initDatabase();
  console.log('Updating SQLite users table to set citizen name to Pratik Dilip Tupe...');
  const res = await query(`UPDATE users SET name = 'Pratik Dilip Tupe' WHERE role = 'citizen' OR name = 'Demo Citizen' OR name = 'Citizen User' OR mobile = '8788562103'`);
  console.log('Update completed successfully.');
  process.exit(0);
}

run();
