const { Client } = require('pg');

async function checkDbs() {
  console.log('=== CHECKING SUPABASE DATABASE REFS ===\n');

  // DB 1: botecyzkfptsrziwkkpe
  const url1 = 'postgresql://postgres:IZizhWM3KeJyHSKZ@db.botecyzkfptsrziwkkpe.supabase.co:5432/postgres';
  const client1 = new Client({ connectionString: url1, ssl: { rejectUnauthorized: false } });

  try {
    await client1.connect();
    const resDepts = await client1.query('SELECT count(*) FROM departments');
    const resDh = await client1.query('SELECT count(*) FROM department_heads');
    const resFs = await client1.query('SELECT count(*) FROM field_staff');
    const resUsers = await client1.query('SELECT count(*) FROM users');
    console.log('Ref botecyzkfptsrziwkkpe (DEV/PREVIEW):');
    console.log(`- departments: ${resDepts.rows[0].count}`);
    console.log(`- department_heads: ${resDh.rows[0].count}`);
    console.log(`- field_staff: ${resFs.rows[0].count}`);
    console.log(`- users: ${resUsers.rows[0].count}`);
    await client1.end();
  } catch (err) {
    console.error('Error connecting to botecyzkfptsrziwkkpe:', err.message);
  }

  process.exit(0);
}

checkDbs();
