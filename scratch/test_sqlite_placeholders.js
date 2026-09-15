const { initDatabase, query } = require('../backend/src/config/db');

async function test() {
  await initDatabase();

  console.log('Testing query with $1 placeholder in SQLite:');
  try {
    const res1 = await query('SELECT department_id, role FROM users WHERE id = $1 OR email = $2', [128, 'rahul.kumar@nagarsetu.gov.in']);
    console.log('res1.rows with $1:', res1.rows);
  } catch (e) {
    console.error('res1 error:', e.message);
  }

  console.log('Testing query with ? placeholder in SQLite:');
  try {
    const res2 = await query('SELECT department_id, role FROM users WHERE id = ? OR email = ?', [128, 'rahul.kumar@nagarsetu.gov.in']);
    console.log('res2.rows with ?:', res2.rows);
  } catch (e) {
    console.error('res2 error:', e.message);
  }
}

test().catch(console.error);
