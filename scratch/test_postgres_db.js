const { initDatabase, query } = require('../backend/src/config/db');

async function run() {
  process.env.DB_TYPE = 'postgres'; // force checking postgres connection string
  try {
    await initDatabase();
    console.log('--- Connected to Database ---');
  } catch (e) {
    console.log('Database init error:', e.message);
    process.exit(0);
  }

  console.log('\n--- Users table for rahul.kumar@nagarsetu.gov.in ---');
  const u = await query(`SELECT * FROM users WHERE LOWER(email) = 'rahul.kumar@nagarsetu.gov.in'`).catch(err => ({ rows: err.message }));
  console.log(u.rows);

  console.log('\n--- Department_heads table for rahul.kumar@nagarsetu.gov.in ---');
  const dh = await query(`SELECT * FROM department_heads WHERE LOWER(email) = 'rahul.kumar@nagarsetu.gov.in'`).catch(err => ({ rows: err.message }));
  console.log(dh.rows);

  console.log('\n--- Departments table ---');
  const depts = await query(`SELECT * FROM departments`).catch(err => ({ rows: err.message }));
  console.log(depts.rows);

  console.log('\n--- Complaints count ---');
  const comps = await query(`SELECT id, complaint_number, department_id, category, title FROM complaints LIMIT 10`).catch(err => ({ rows: err.message }));
  console.log(comps.rows);

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
