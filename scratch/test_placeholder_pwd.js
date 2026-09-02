process.env.VERCEL = '1';
process.env.DATABASE_URL = 'postgresql://postgres.ozeiymkbxtrqqdoxtmhm:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';

const { initDatabase } = require('../backend/src/config/db');

initDatabase().then(() => {
  console.log('UNEXPECTED SUCCESS');
  process.exit(1);
}).catch((err) => {
  console.log('Expected failure caught:');
  console.log(err.message);
  process.exit(err.message.includes('placeholder') ? 0 : 1);
});
