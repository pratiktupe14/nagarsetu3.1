const { Pool } = require('../backend/node_modules/pg');

const connStr = 'postgresql://postgres.ozeiymkbxtrqqdoxtmhm:P1d2s3j4t5%40@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';
const pool = new Pool({ connectionString: connStr, ssl: { rejectUnauthorized: false } });

async function check() {
  const res = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
  console.log('Tables in public schema:', res.rows.map(r => r.table_name));
  await pool.end();
}

check().catch(console.error);
