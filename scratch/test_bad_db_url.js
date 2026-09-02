process.env.VERCEL = '1';
process.env.DATABASE_URL = 'database';

const { initDatabase } = require('../backend/src/config/db');

initDatabase().then(() => {
  console.log('UNEXPECTED SUCCESS');
  process.exit(1);
}).catch((err) => {
  console.log('Expected failure caught:');
  console.log(err.message);
  process.exit(err.message.includes('Invalid DATABASE_URL format') ? 0 : 1);
});
