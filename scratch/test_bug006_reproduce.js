const { query } = require('../backend/src/config/db');

async function testQueries() {
  console.log('Testing SQL parameter binding consistency...');
  try {
    const res1 = await query(`SELECT id FROM departments WHERE UPPER(code) = UPPER(?) LIMIT 1`, ['PWD']);
    console.log(`QUERY 1 SUCCESS: Found ${res1.rows.length} rows`);

    const res2 = await query(`SELECT c.* FROM complaints c WHERE (c.citizen_id = ? OR CAST(c.citizen_id AS TEXT) = ?) ORDER BY c.created_at DESC`, [1, '1']);
    console.log(`QUERY 2 SUCCESS: Found ${res2.rows.length} rows`);

    console.log('BUG-006 PASSED: Query parameter binding standardized');
    process.exit(0);
  } catch (err) {
    console.error('QUERY FAILURE:', err);
    process.exit(1);
  }
}

testQueries();
