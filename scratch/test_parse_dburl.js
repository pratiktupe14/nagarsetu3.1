const { parse } = require('../backend/node_modules/pg-connection-string');

const testStrings = [
  'data base',
  'postgresql://postgres:password@base:5432/postgres',
  'postgresql://postgres:password@base',
  'postgresql://postgres:NagarSetu@2026@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',
  'postgresql://postgres:NagarSetu@Admin2026!@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres',
  'postgresql://postgres:password@db.ozeiymkbxtrqqdoxtmhm.supa base.co:5432/postgres',
  'postgresql://postgres:password@supa base:5432/postgres',
  'postgresql://postgres:password@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgre base',
  'DATABASE_URL=postgresql://... base',
  'base'
];

for (const s of testStrings) {
  try {
    const config = parse(s);
    console.log(`Parsed "${s}": host = "${config.host}", port = "${config.port}", user = "${config.user}", db = "${config.database}"`);
  } catch (e) {
    console.log(`Error parsing "${s}":`, e.message);
  }
}
