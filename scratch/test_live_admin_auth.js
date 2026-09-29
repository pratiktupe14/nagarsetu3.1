const { Client } = require('pg');
const jwt = require('jsonwebtoken');

const connStr = 'postgresql://postgres.botecyzkfptsrziwkkpe:IZizhWM3KeJyHSKZ@aws-0-ap-northeast-1.pooler.supabase.com:6543/postgres';
const JWT_SECRET = 'w40rj1T7PIiBZhbzN1wBH/NbxQK5Ix37bASKh1+zNrPFHqQsgiVR8Z+rP8tVwV/eEaj/6z9wOS4YUKdsZOPf6g==';

async function testAuthAndEndpoints() {
  console.log('=== VERIFYING CITY ADMIN AUTH AND ENDPOINTS ON LIVE PRODUCTION ===\n');

  const client = new Client({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
  await client.connect();

  const userRes = await client.query("SELECT id, name, email, role, department_id FROM users WHERE role IN ('city_admin', 'admin') LIMIT 1");
  const adminUser = userRes.rows[0];
  console.log('Found Admin User in DB:', adminUser);

  await client.end();

  // Create JWT Token using the exact production JWT_SECRET
  const token = jwt.sign(
    { id: adminUser.id, role: adminUser.role, email: adminUser.email, department_id: adminUser.department_id },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };

  // 1. GET /api/admin/department-heads
  console.log('\n1. GET https://nagarsetu-backend-api.vercel.app/api/admin/department-heads');
  const dhRes = await fetch('https://nagarsetu-backend-api.vercel.app/api/admin/department-heads', { headers });
  console.log('Status:', dhRes.status);
  const dhJson = await dhRes.json();
  console.log('Department Heads count:', dhJson.department_heads?.length || 0);
  if (dhJson.department_heads) {
    dhJson.department_heads.slice(0, 7).forEach(dh => {
      console.log(`  HOD: ${dh.name || dh.full_name} | Dept: ${dh.department_id} | Status: ${dh.status} | Email: ${dh.email}`);
    });
  }

  // 2. GET /api/department/staff
  console.log('\n2. GET https://nagarsetu-backend-api.vercel.app/api/department/staff');
  const staffRes = await fetch('https://nagarsetu-backend-api.vercel.app/api/department/staff', { headers });
  console.log('Status:', staffRes.status);
  const staffJson = await staffRes.json();
  console.log('Staff Summary:', staffJson.summary);
  console.log('Staff count:', staffJson.staff?.length || 0);

  process.exit(0);
}

testAuthAndEndpoints().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
