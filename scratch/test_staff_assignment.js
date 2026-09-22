const http = require('http');
const path = require('path');
const jwt = require(path.join(__dirname, '../backend/node_modules/jsonwebtoken'));
const app = require('../backend/src/app');
const { query, initDatabase } = require('../backend/src/config/db');

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

function request(port, method, reqPath, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port,
      path: reqPath,
      method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runStaffAssignmentTests() {
  console.log('================================================================');
  console.log('         NAGARSETU 3.1 — STAFF ASSIGNMENT AUTHORIZATION TEST    ');
  console.log('================================================================\n');

  await initDatabase();

  // Clear must_change_password flag for test department heads so auth guard passes
  await query("UPDATE users SET must_change_password = 0 WHERE role = 'department_head'").catch(() => {});

  const { server, port } = await startServer();
  let passed = 0;
  let total = 0;

  function assert(condition, message) {
    total++;
    if (condition) {
      console.log(`[PASS ${total}] ${message}`);
      passed++;
    } else {
      console.error(`[FAIL ${total}] ${message}`);
    }
  }

  try {
    const jwtSecret = process.env.JWT_SECRET || 'nagarsetu_dev_secret_key_2026_super_secure';

    const pwdDhRes = await query("SELECT id, name, email, department_id FROM users WHERE role = 'department_head' AND (department_id = '1' OR LOWER(email) LIKE '%pwd%' OR LOWER(email) LIKE '%rahul%') LIMIT 1");
    const pwdDhUser = pwdDhRes.rows[0] || { id: 128, name: 'Rahul Kumar', email: 'rahul.kumar@nagarsetu.gov.in', department_id: '1' };

    const sanDhRes = await query("SELECT id, name, email, department_id FROM users WHERE role = 'department_head' AND (department_id = '2' OR LOWER(email) LIKE '%san%' OR LOWER(email) LIKE '%sharma%') LIMIT 1");
    const sanDhUser = sanDhRes.rows[0] || { id: 129, name: 'Amit Sharma', email: 'amit.sharma@nagarsetu.gov.in', department_id: '2' };

    const pwdDhToken = jwt.sign(
      { id: pwdDhUser.id, name: pwdDhUser.name, email: pwdDhUser.email, role: 'department_head', department_id: pwdDhUser.department_id || '1' },
      jwtSecret,
      { expiresIn: '1h' }
    );

    const sanDhToken = jwt.sign(
      { id: sanDhUser.id, name: sanDhUser.name, email: sanDhUser.email, role: 'department_head', department_id: sanDhUser.department_id || '2' },
      jwtSecret,
      { expiresIn: '1h' }
    );

    const citizenToken = jwt.sign(
      { id: 101, name: 'Citizen User', role: 'citizen' },
      jwtSecret,
      { expiresIn: '1h' }
    );

    // Ensure PWD complaint exists
    let compRes = await query("SELECT id, complaint_number FROM complaints WHERE CAST(department_id AS TEXT) = '1' LIMIT 1");
    let pwdCompId = compRes.rows[0] ? String(compRes.rows[0].id) : '247';

    // Create unique SAN complaint specifically for Test 4
    const insSan = await query(
      `INSERT INTO complaints (complaint_number, citizen_id, photo_before_url, category, title, description, priority, status, department_id, latitude, longitude, location_source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [`NS-SAN-${Date.now()}`, '1', 'https://example.com/photo.jpg', 'Sanitation', 'Garbage dump', 'Dumpster overflow', 'Medium', 'Submitted', '2', 19.99, 73.78, 'manual_pin']
    );
    let sanCompId = String(insSan.rows[0].id);

    // 1. PWD actor + PWD task + PWD staff = PASS (200)
    console.log('Test 1: PWD actor + PWD task + PWD staff (Amit Patil - PWD-STF-001)');
    const res1 = await request(port, 'POST', '/api/department/assign', { Authorization: `Bearer ${pwdDhToken}` }, {
      complaint_id: pwdCompId,
      staff_id: 'PWD-STF-001'
    });
    assert(res1.status === 200 && res1.body.success === true, `Assignment allowed (HTTP ${res1.status})`);

    // 2. Cross-department assignment (PWD actor + SAN staff) = DENY (403)
    console.log('\nTest 2: Cross-department (PWD actor assigning SAN staff: SAN-STF-001)');
    const res2 = await request(port, 'POST', '/api/department/assign', { Authorization: `Bearer ${pwdDhToken}` }, {
      complaint_id: pwdCompId,
      staff_id: 'SAN-STF-001'
    });
    assert(res2.status === 403, `Cross-department staff assignment blocked (HTTP ${res2.status})`);

    // 3. Cross-department assignment (PWD actor + WTR staff) = DENY (403)
    console.log('\nTest 3: Cross-department (PWD actor assigning WTR staff: WTR-STF-001)');
    const res3 = await request(port, 'POST', '/api/department/assign', { Authorization: `Bearer ${pwdDhToken}` }, {
      complaint_id: pwdCompId,
      staff_id: 'WTR-STF-001'
    });
    assert(res3.status === 403, `Cross-department staff assignment blocked (HTTP ${res3.status})`);

    // 4. SAN actor + SAN task + SAN staff = PASS (200)
    console.log('\nTest 4: SAN actor + SAN task + SAN staff (SAN-STF-001)');
    const res4 = await request(port, 'POST', '/api/department/assign', { Authorization: `Bearer ${sanDhToken}` }, {
      complaint_id: sanCompId,
      staff_id: 'SAN-STF-001'
    });
    assert(res4.status === 200 && res4.body.success === true, `SAN assignment allowed (HTTP ${res4.status})`);

    // 5. SAN actor + PWD staff = DENY (403)
    console.log('\nTest 5: Cross-department (SAN actor assigning PWD staff: PWD-STF-001)');
    const res5 = await request(port, 'POST', '/api/department/assign', { Authorization: `Bearer ${sanDhToken}` }, {
      complaint_id: sanCompId,
      staff_id: 'PWD-STF-001'
    });
    assert(res5.status === 403, `SAN actor assigning PWD staff blocked (HTTP ${res5.status})`);

    // 6. Unauthorized role (Citizen) = DENY (403)
    console.log('\nTest 6: Citizen role attempting assignment');
    const res6 = await request(port, 'POST', '/api/department/assign', { Authorization: `Bearer ${citizenToken}` }, {
      complaint_id: pwdCompId,
      staff_id: 'PWD-STF-001'
    });
    assert(res6.status === 403, `Citizen assignment attempt blocked (HTTP ${res6.status})`);

    // 7. Invalid staff = safe 404
    console.log('\nTest 7: Invalid staff member ID');
    const res7 = await request(port, 'POST', '/api/department/assign', { Authorization: `Bearer ${pwdDhToken}` }, {
      complaint_id: pwdCompId,
      staff_id: 'NON-EXISTENT-STAFF-9999'
    });
    assert(res7.status === 404, `Invalid staff member returns 404 (HTTP ${res7.status})`);

    // 8. Invalid task = safe 404
    console.log('\nTest 8: Invalid complaint task ID');
    const res8 = await request(port, 'POST', '/api/department/assign', { Authorization: `Bearer ${pwdDhToken}` }, {
      complaint_id: 'NON-EXISTENT-COMPLAINT-9999',
      staff_id: 'PWD-STF-001'
    });
    assert(res8.status === 404, `Invalid complaint returns 404 (HTTP ${res8.status})`);

    // 9. Assignment persistence in database
    console.log('\nTest 9: Database persistence check');
    const dbCheck = await query("SELECT assigned_staff_id, status FROM complaints WHERE CAST(id AS TEXT) = $1 OR complaint_number = $1", [pwdCompId]);
    assert(dbCheck.rows.length > 0 && dbCheck.rows[0].status === 'Staff Assigned', 'Assignment state persisted in primary storage');

    console.log(`\n----------------------------------------------------------------`);
    console.log(`RESULTS: ${passed}/${total} TESTS PASSED`);
    console.log(`----------------------------------------------------------------\n`);

  } catch (err) {
    console.error('Test Suite Error:', err);
  } finally {
    server.close();
  }
}

runStaffAssignmentTests();
