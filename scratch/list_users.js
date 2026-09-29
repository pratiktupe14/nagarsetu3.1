const { Client } = require('pg');

const connStr = 'postgresql://postgres.botecyzkfptsrziwkkpe:IZizhWM3KeJyHSKZ@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres';

async function listUsers() {
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const res = await client.query("SELECT id, name, email, role, must_change_password FROM users WHERE email LIKE '%nagarsetu.gov.in%' OR role = 'citizen' ORDER BY id ASC LIMIT 20");
  console.log('Users:', res.rows);

  await client.end();
  process.exit(0);
}

listUsers();
