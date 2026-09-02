const { parse } = require('../backend/node_modules/pg-connection-string');

const variations = [
  'database',
  'data base',
  'database url',
  'data base url',
  'DATABASE_URL',
  'DATABASE_URL=base',
  'host=base',
  'postgres database',
  'postgresql database',
  'supabase',
  'supa base',
  'postgres://postgres:password@base',
  'postgresql://postgres.ozeiymkbxtrqqdoxtmhm:[YOUR-PASSWORD]@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres'
];

for (const v of variations) {
  try {
    const c = parse(v);
    console.log(`Input: "${v}" => host: "${c.host}", port: "${c.port}", user: "${c.user}"`);
  } catch (e) {
    console.log(`Input: "${v}" => error: ${e.message}`);
  }
}
