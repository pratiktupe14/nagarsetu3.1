const { Client } = require('pg');
const dns = require('dns').promises;

async function findPooler() {
  console.log('=== FINDING SUPABASE IPV4 POOLER ===\n');

  // List of regions to test
  const regions = [
    'ap-south-1',
    'us-east-1',
    'us-west-1',
    'us-west-2',
    'eu-west-1',
    'eu-central-1',
    'ap-southeast-1',
    'ap-northeast-1',
    'sa-east-1'
  ];

  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    try {
      const connStr = `postgresql://postgres.botecyzkfptsrziwkkpe:IZizhWM3KeJyHSKZ@${host}:6543/postgres`;
      const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 3000 });
      await client.connect();
      const res = await client.query('SELECT count(*) FROM departments');
      console.log(`\n🎉 FOUND POOLER! Host: ${host}:6543 | Departments count: ${res.rows[0].count}`);
      await client.end();
      return host;
    } catch (err) {
      if (!err.message.includes('ENOTFOUND tenant') && !err.message.includes('getaddrinfo')) {
        console.log(`Region ${region} error:`, err.message);
      }
    }
  }

  // Also try port 5432 (Session pooler)
  for (const region of regions) {
    const host = `aws-0-${region}.pooler.supabase.com`;
    try {
      const connStr = `postgresql://postgres.botecyzkfptsrziwkkpe:IZizhWM3KeJyHSKZ@${host}:5432/postgres`;
      const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 3000 });
      await client.connect();
      const res = await client.query('SELECT count(*) FROM departments');
      console.log(`\n🎉 FOUND SESSION POOLER! Host: ${host}:5432 | Departments count: ${res.rows[0].count}`);
      await client.end();
      return host;
    } catch (err) {
      if (!err.message.includes('ENOTFOUND tenant') && !err.message.includes('getaddrinfo')) {
        console.log(`Region ${region} (5432) error:`, err.message);
      }
    }
  }

  console.log('Pooler search complete.');
  process.exit(0);
}

findPooler();
