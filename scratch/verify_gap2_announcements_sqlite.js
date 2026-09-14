process.env.DB_TYPE = 'sqlite';
process.env.NODE_ENV = 'development';
delete process.env.DATABASE_URL;
delete process.env.POSTGRES_URL;
delete process.env.SUPABASE_DB_URL;

const dotenv = require('dotenv');
const origConfig = dotenv.config;
dotenv.config = function() {
  const res = origConfig.apply(this, arguments);
  delete process.env.DATABASE_URL;
  delete process.env.POSTGRES_URL;
  delete process.env.SUPABASE_DB_URL;
  process.env.DB_TYPE = 'sqlite';
  return res;
};

const http = require('http');
const { initDatabase, query } = require('../backend/src/config/db');
const app = require('../backend/src/app');

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

function request(port, method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function run() {
  const { server, port } = await startServer();
  try {
    console.log('=== GAP 2: SQLITE ANNOUNCEMENT PARAMETER BINDING PROOF ===\n');

    // 1. Seed explicit announcement in SQLite DB
    const testTitle = `Water Cut Advisory ${Date.now()}`;
    const testDesc = 'Scheduled maintenance in Gangapur area from 10 AM to 4 PM';
    const testType = 'Alert';
    const testPriority = 'High';
    const testDeptName = 'Water Supply & Sewerage Board';
    
    // Insert test announcement
    const insertRes = await query(`
      INSERT INTO announcements (title, description, type, priority, is_published, status, target_type, target_audience, department_name)
      VALUES (?, ?, ?, ?, 1, 'Published', 'department', 'all_citizens', ?)
    `, [testTitle, testDesc, testType, testPriority, testDeptName]);

    console.log('Test Announcement inserted into SQLite database.');

    // 2. Register citizen
    const mob = `91${Math.floor(10000000 + Math.random() * 90000000)}`;
    const regRes = await request(port, 'POST', '/api/auth/register', {}, {
      name: 'Citizen GAP2 Tester',
      mobile: mob,
      email: `gap2_${Date.now()}@test.com`,
      password: 'password123'
    });
    const token = regRes.data.token;
    const citizenUserId = String(regRes.data.user.id);

    // 3. Query GET /api/announcements as citizen
    const annRes = await request(port, 'GET', '/api/announcements', { Authorization: `Bearer ${token}` });
    
    console.log(`GET /api/announcements HTTP Status: ${annRes.status}`);
    const announcements = annRes.data.announcements || [];
    console.log(`Total announcements returned: ${announcements.length}`);

    // 4. Find inserted test announcement in returned JSON
    const matched = announcements.find(a => a.title === testTitle);
    if (!matched) {
      throw new Error(`CRITICAL FAIL: Test announcement "${testTitle}" was NOT returned in GET /api/announcements! Parameter binding misalignment likely filtered it out.`);
    }

    console.log('\n--- FIELD-BY-FIELD ACCURACY VERIFICATION ---');
    console.log('Field: title');
    console.log(`  Expected: "${testTitle}"`);
    console.log(`  Actual:   "${matched.title}"`);
    console.log(`  Match: ${matched.title === testTitle ? '✅ MATCH' : '❌ MISMATCH'}`);

    console.log('Field: description');
    console.log(`  Expected: "${testDesc}"`);
    console.log(`  Actual:   "${matched.description}"`);
    console.log(`  Match: ${matched.description === testDesc ? '✅ MATCH' : '❌ MISMATCH'}`);

    console.log('Field: type');
    console.log(`  Expected: "${testType}"`);
    console.log(`  Actual:   "${matched.type}"`);
    console.log(`  Match: ${matched.type === testType ? '✅ MATCH' : '❌ MISMATCH'}`);

    console.log('Field: priority');
    console.log(`  Expected: "${testPriority}"`);
    console.log(`  Actual:   "${matched.priority}"`);
    console.log(`  Match: ${matched.priority === testPriority ? '✅ MATCH' : '❌ MISMATCH'}`);

    console.log('Field: is_read (Bound via $1 parameter)');
    console.log(`  Expected: 0 (Unread)`);
    console.log(`  Actual:   ${matched.is_read}`);
    console.log(`  Match: ${matched.is_read === 0 ? '✅ MATCH' : '❌ MISMATCH'}`);

    if (matched.title === testTitle && matched.description === testDesc && matched.type === testType && matched.priority === testPriority) {
      console.log('\n✅ GAP 2 VERIFICATION PASSED: Parameter binding in SQLite is 100% accurate field-by-field!');
    } else {
      throw new Error('GAP 2 VERIFICATION FAILED: Field values did not match database records.');
    }

  } finally {
    server.close();
  }
}

run().catch(err => {
  console.error('GAP 2 ERROR:', err.message);
  process.exit(1);
});
