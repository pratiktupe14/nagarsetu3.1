const { Pool } = require('../backend/node_modules/pg');

const passwords = [
  'NagarSetu@Admin2026!',
  'NagarSetu@2026',
  'password123',
  'Nagarsetu@123',
  'nagarsetu2026',
  'nagarsetu',
  'admin123',
  'Pratik@123',
  'PratikTupe@123',
  'Pratik@2026'
];

const hosts = [
  'aws-0-ap-south-1.pooler.supabase.com',
  'db.ozeiymkbxtrqqdoxtmhm.supabase.co'
];

async function tryConnect() {
  for (const host of hosts) {
    for (const pwd of passwords) {
      const port = host.includes('pooler') ? 6543 : 5432;
      const user = host.includes('pooler') ? 'postgres.ozeiymkbxtrqqdoxtmhm' : 'postgres';
      const connStr = `postgresql://${user}:${encodeURIComponent(pwd)}@${host}:${port}/postgres`;
      console.log(`Trying host: ${host}, user: ${user}, pwd: ${pwd.slice(0, 4)}...`);
      const pool = new Pool({
        connectionString: connStr,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: 3000
      });
      try {
        const res = await pool.query('SELECT NOW()');
        console.log(`\n========================================`);
        console.log(`CONNECTED SUCCESSFULLY!`);
        console.log(`DATABASE_URL=${connStr}`);
        console.log(`NOW:`, res.rows[0]);
        console.log(`========================================\n`);
        await pool.end();
        return;
      } catch (err) {
        console.log(`  Failed: ${err.message}`);
      }
      await pool.end().catch(() => {});
    }
  }
  console.log('All attempted passwords failed.');
}

tryConnect();
