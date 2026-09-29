const { Client } = require('pg');
const dns = require('dns').promises;

async function testPoolers() {
  console.log('=== SUPABASE POOLER / HOST RESOLUTION TEST ===\n');

  // Test direct DNS
  try {
    const ip = await dns.lookup('db.botecyzkfptsrziwkkpe.supabase.co');
    console.log('db.botecyzkfptsrziwkkpe.supabase.co IP:', ip);
  } catch (err) {
    console.error('db.botecyzkfptsrziwkkpe.supabase.co DNS lookup failed:', err.message);
  }

  // Test pooler hosts
  const poolerHosts = [
    'aws-0-ap-south-1.pooler.supabase.com',
    'aws-0-us-east-1.pooler.supabase.com',
    'aws-0-eu-central-1.pooler.supabase.com'
  ];

  for (const host of poolerHosts) {
    try {
      const ip = await dns.lookup(host);
      console.log(`Pooler host ${host} IP:`, ip);

      // Try connection with project ref in username: postgres.botecyzkfptsrziwkkpe
      const connStr = `postgresql://postgres.botecyzkfptsrziwkkpe:IZizhWM3KeJyHSKZ@${host}:6543/postgres`;
      const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
      await client.connect();
      const res = await client.query('SELECT count(*) FROM departments');
      console.log(` SUCCESS on ${host} port 6543! Departments count: ${res.rows[0].count}`);
      await client.end();
      break;
    } catch (err) {
      console.log(` Failed on ${host}: ${err.message}`);
    }
  }

  // Also test session pooler port 5432
  for (const host of poolerHosts) {
    try {
      const connStr = `postgresql://postgres.botecyzkfptsrziwkkpe:IZizhWM3KeJyHSKZ@${host}:5432/postgres`;
      const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
      await client.connect();
      const res = await client.query('SELECT count(*) FROM departments');
      console.log(` SUCCESS on ${host} port 5432! Departments count: ${res.rows[0].count}`);
      await client.end();
      break;
    } catch (err) {
      console.log(` Failed on ${host} 5432: ${err.message}`);
    }
  }

  process.exit(0);
}

testPoolers();
