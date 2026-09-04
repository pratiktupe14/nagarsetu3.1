process.env.NODE_ENV = 'production';
process.env.DATABASE_URL = 'postgresql://postgres.ozeiymkbxtrqqdoxtmhm:P1d2s3j4t5%40@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres';
process.env.DB_TYPE = 'postgres';

const { initDatabase, query } = require('../backend/src/config/db');

async function testInit() {
  console.log('Testing initDatabase()...');
  await initDatabase();
  console.log('initDatabase() succeeded!');
  
  console.log('\nTesting queries on tables:');
  const dRes = await query('SELECT count(*) FROM departments');
  console.log('Departments count:', dRes.rows[0]);
  
  const uRes = await query('SELECT count(*) FROM users');
  console.log('Users count:', uRes.rows[0]);
  
  const cRes = await query('SELECT count(*) FROM complaints');
  console.log('Complaints count:', cRes.rows[0]);
  
  const dhRes = await query('SELECT count(*) FROM department_heads');
  console.log('Department heads count:', dhRes.rows[0]);
  
  const fsRes = await query('SELECT count(*) FROM field_staff');
  console.log('Field staff count:', fsRes.rows[0]);
}

testInit().then(() => {
  console.log('\nAll queries passed!');
  process.exit(0);
}).catch(err => {
  console.error('Test init error:', err);
  process.exit(1);
});
