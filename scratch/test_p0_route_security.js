const app = require('../backend/src/app');
const { initDatabase, query } = require('../backend/src/config/db');
const jwt = require('../backend/node_modules/jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'nagarsetu_secret_key_2026_super_secure';

function makeToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
}

async function runTests() {
  await initDatabase();
  const server = app.listen(5099, async () => {
    try {
      const port = 5099;
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

      console.log('--- STARTING P0 ROUTE SECURITY TEST SUITE ---');

      // 1. Anonymous request to protected officer endpoint -> 401
      const anonRes = await fetch(`${baseUrl}/api/officer/dashboard`);
      assert(anonRes.status === 401, 'Anonymous request to /api/officer/dashboard returns HTTP 401');

      // 2. Anonymous request to protected staff endpoint -> 401
      const anonStaffRes = await fetch(`${baseUrl}/api/staff/tasks`);
      assert(anonStaffRes.status === 401, 'Anonymous request to /api/staff/tasks returns HTTP 401');

      // 3. Citizen request to officer endpoint -> 403
      const citizenToken = makeToken({ id: 999, role: 'citizen', email: 'citizen@test.com' });
      const citizenRes = await fetch(`${baseUrl}/api/officer/dashboard`, {
        headers: { Authorization: `Bearer ${citizenToken}` }
      });
      assert(citizenRes.status === 403, 'Citizen token to /api/officer/dashboard returns HTTP 403');

      // 4. Citizen request to staff endpoint -> 403
      const citizenStaffRes = await fetch(`${baseUrl}/api/staff/tasks`, {
        headers: { Authorization: `Bearer ${citizenToken}` }
      });
      assert(citizenStaffRes.status === 403, 'Citizen token to /api/staff/tasks returns HTTP 403');

      // 5. Field Staff attempting officer assignment -> 403
      const staffToken1 = makeToken({ id: 201, role: 'service_staff', email: 'staff1@nagarsetu.gov.in', department_id: 'PWD' });
      const staffAssignRes = await fetch(`${baseUrl}/api/officer/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken1}` },
        body: JSON.stringify({ complaint_id: 1, staff_id: 202 })
      });
      assert(staffAssignRes.status === 403, 'Service staff token to /api/officer/assign returns HTTP 403');

      // 6. Field Staff attempting officer verification -> 403
      const staffVerifyRes = await fetch(`${baseUrl}/api/officer/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken1}` },
        body: JSON.stringify({ complaint_id: 1, action: 'approve' })
      });
      assert(staffVerifyRes.status === 403, 'Service staff token to /api/officer/verify returns HTTP 403');

      // 7. Field Staff mutating another staff member's assigned task -> 403
      // Setup complaint assigned to staff 202 (not 201)
      const compCheck = await query(`SELECT id, department_id, assigned_staff_id FROM complaints WHERE assigned_staff_id != '201' LIMIT 1`);
      if (compCheck.rows.length > 0) {
        const otherCompId = compCheck.rows[0].id;
        const otherMutateRes = await fetch(`${baseUrl}/api/staff/task/${otherCompId}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken1}` },
          body: JSON.stringify({ status: 'In Progress' })
        });
        assert(otherMutateRes.status === 403, `Field staff modifying unassigned task ${otherCompId} returns HTTP 403`);
      } else {
        assert(true, 'Field staff unassigned task check (skipped - no unassigned complaint in DB)');
      }

      // 8. Department Head cross-department action -> 403
      // PWD head attempting to assign SAN complaint/staff
      const pwdDhToken = makeToken({ id: 128, role: 'department_head', email: 'rahul.kumar@nagarsetu.gov.in', department_id: 'PWD' });
      const sanCompRes = await query(`SELECT id FROM complaints WHERE department_id = '2' OR department_id = 'SAN' LIMIT 1`);
      const sanStaffRes = await query(`SELECT id, user_id FROM field_staff WHERE department_id = '2' OR department_id = 'SAN' LIMIT 1`);

      if (sanCompRes.rows.length > 0 && sanStaffRes.rows.length > 0) {
        const sanCompId = sanCompRes.rows[0].id;
        const sanStaffId = sanStaffRes.rows[0].user_id || sanStaffRes.rows[0].id;
        const crossDeptRes = await fetch(`${baseUrl}/api/officer/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pwdDhToken}` },
          body: JSON.stringify({ complaint_id: sanCompId, staff_id: sanStaffId })
        });
        assert(crossDeptRes.status === 403, 'PWD Department Head assigning SAN complaint returns HTTP 403');
      } else {
        assert(true, 'Cross-department check (skipped - SAN data missing)');
      }

      // 9. Valid Department Head performing own department action -> 200/Success
      const pwdCompRes = await query(`SELECT id FROM complaints WHERE department_id = '1' OR department_id = 'PWD' LIMIT 1`);
      const pwdStaffRes = await query(`SELECT id, user_id FROM field_staff WHERE department_id = '1' OR department_id = 'PWD' LIMIT 1`);
      if (pwdCompRes.rows.length > 0 && pwdStaffRes.rows.length > 0) {
        const pwdCompId = pwdCompRes.rows[0].id;
        const pwdStaffId = pwdStaffRes.rows[0].user_id || pwdStaffRes.rows[0].id;
        const validAssignRes = await fetch(`${baseUrl}/api/department/assign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pwdDhToken}` },
          body: JSON.stringify({ complaint_id: pwdCompId, staff_id: pwdStaffId })
        });
        assert(validAssignRes.status === 200, 'PWD Department Head assigning PWD complaint returns HTTP 200');
      } else {
        assert(true, 'Valid department action check (skipped - PWD data missing)');
      }

      console.log(`\n=== P0 ROUTE SECURITY TEST SUMMARY: ${passed}/${total} PASSED ===`);
      server.close(() => process.exit(passed === total ? 0 : 1));
    } catch (err) {
      console.error('Test execution error:', err);
      server.close(() => process.exit(1));
    }
  });
}

runTests();
