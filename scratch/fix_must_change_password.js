const { Client } = require('pg');

const connStr = 'postgresql://postgres.botecyzkfptsrziwkkpe:IZizhWM3KeJyHSKZ@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres';

async function fixMustChangePassword() {
  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const emails = [
    'rahul.kumar@nagarsetu.gov.in',
    'amit.sharma@nagarsetu.gov.in',
    'vikram.patil@nagarsetu.gov.in',
    'sanjay.more@nagarsetu.gov.in',
    'kunal.kulkarni@nagarsetu.gov.in',
    'rohan.deshmukh@nagarsetu.gov.in',
    'aditya.joshi@nagarsetu.gov.in',
    'staff@nagarsetu.gov.in'
  ];

  const res = await client.query(
    "UPDATE users SET must_change_password = false WHERE email = ANY($1::text[])",
    [emails]
  );
  console.log(`Updated must_change_password = false for ${res.rowCount} official users.`);

  await client.end();
  process.exit(0);
}

fixMustChangePassword().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
