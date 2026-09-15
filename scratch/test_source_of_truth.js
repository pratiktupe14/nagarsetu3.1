const app = require('../backend/src/app');
const { initDatabase, query } = require('../backend/src/config/db');
const jwt = require('../backend/node_modules/jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'nagarsetu_secret_key_2026_super_secure';

function makeToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

async function runTests() {
  await initDatabase();
  const server = app.listen(5098, async () => {
    try {
      const port = 5098;
      const baseUrl = `http://localhost:${port}`;
      let passed = 0;
      let total = 0;

      function assert(condition, message) {
        total++;
        if (condition) {
          console.log(`[PASS] ${message}`);
          passed++;
        } else {
          console.error(`[FAIL] ${message}`);
        }
      }

      console.log('--- STARTING SOURCE OF TRUTH TEST SUITE ---');

      const dhToken = makeToken({ id: 128, role: 'department_head', email: 'rahul.kumar@nagarsetu.gov.in', department_id: 'PWD' });

      // 1. Verify /api/department/staff returns real DB records
      const staffRes = await fetch(`${baseUrl}/api/department/staff`, {
        headers: { Authorization: `Bearer ${dhToken}` }
      });
      const staffData = await staffRes.json();
      assert(staffRes.status === 200 && Array.isArray(staffData.staff) && staffData.staff.length > 0, 'GET /api/department/staff returns authoritative DB staff records');

      // 2. Invalid assignment fails loudly with 404 (non-existent staff)
      const invalidAssignRes = await fetch(`${baseUrl}/api/department/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dhToken}` },
        body: JSON.stringify({ complaint_id: 1, staff_id: 'NON_EXISTENT_STAFF_9999' })
      });
      const invalidData = await invalidAssignRes.json();
      assert(invalidAssignRes.status === 404 && invalidData.error, 'Assigning non-existent staff fails loudly with 404 error');

      // 3. Invalid verification fails loudly with 404 (non-existent complaint)
      const invalidVerifyRes = await fetch(`${baseUrl}/api/officer/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dhToken}` },
        body: JSON.stringify({ complaint_id: 999999, action: 'approve' })
      });
      const invalidVerifyData = await invalidVerifyRes.json();
      assert(invalidVerifyRes.status === 404 && invalidVerifyData.error, 'Verifying non-existent complaint fails loudly with 404 error');

      // 4. Persistence verification: verify DB query reflects actual database state
      const dbStaff = await query(`SELECT COUNT(*) as count FROM field_staff`);
      const dbCount = parseInt(dbStaff.rows[0].count, 10);
      assert(dbCount >= 36, `Database field_staff table contains ${dbCount} active staff records (>= 36)`);

      console.log(`\n=== SOURCE OF TRUTH TEST SUMMARY: ${passed}/${total} PASSED ===`);
      server.close();
    } catch (err) {
      console.error('Test execution error:', err);
      if (server) server.close();
    }
  });
}

runTests();
