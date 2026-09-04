const { Pool } = require('../backend/node_modules/pg');
const pool = new Pool({
  connectionString: 'postgresql://postgres.ozeiymkbxtrqqdoxtmhm:P1d2s3j4t5%40@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres'
});

async function main() {
  const pCols = await pool.query(`
    SELECT column_name, data_type, udt_name 
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles'
    ORDER BY ordinal_position;
  `);
  console.log('profiles columns:', pCols.rows);

  const uCols = await pool.query(`
    SELECT column_name, data_type, udt_name 
    FROM information_schema.columns 
    WHERE table_schema = 'auth' AND table_name = 'users'
    ORDER BY ordinal_position;
  `);
  console.log('auth.users columns:', uCols.rows);

  const pData = await pool.query('SELECT * FROM profiles LIMIT 5;');
  console.log('Sample profiles:', pData.rows);

  await pool.end();
}

main().catch(err => {
  console.error(err);
  pool.end();
});
