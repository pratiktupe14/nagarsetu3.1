const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const app = require('../backend/src/app');
const { query, initDatabase } = require('../backend/src/config/db');
const { generateToken } = require('../backend/src/middleware/auth');

test('ISSUE-004 — Complaint Status IDOR & Department Isolation', async () => {
  await initDatabase();
  await require('../backend/src/scripts/seedDemoDepartmentHeads')();
  await require('../backend/src/scripts/seedServiceStaff')();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // Generate Auth Tokens
    const adminToken = generateToken({ id: 1, email: 'admin@nagarsetu.gov.in', role: 'admin' });
    const pwdHeadToken = generateToken({ id: 128, email: 'rahul.kumar@nagarsetu.gov.in', role: 'department_head', department_id: 1 });
    const sanHeadToken = generateToken({ id: 129, email: 'amit.sharma@nagarsetu.gov.in', role: 'department_head', department_id: 2 });
    const fieldStaffToken = generateToken({ id: 999, email: 'staff.pwd@nagarsetu.gov.in', role: 'service_staff', department_id: 1 });
    const citizenToken = generateToken({ id: 'citizen-test-uuid-004', email: 'citizen004@test.com', role: 'citizen' });

    // Fetch canonical department IDs for PWD and SAN
    const pwdDeptRes = await query(`SELECT id FROM departments WHERE code = 'PWD' OR UPPER(name) LIKE '%PUBLIC WORKS%' LIMIT 1`);
    const sanDeptRes = await query(`SELECT id FROM departments WHERE code = 'SAN' OR UPPER(name) LIKE '%SANITATION%' LIMIT 1`);

    assert.ok(pwdDeptRes.rows.length > 0, 'PWD department should exist');
    assert.ok(sanDeptRes.rows.length > 0, 'SAN department should exist');

    const pwdDeptId = pwdDeptRes.rows[0].id;
    const sanDeptId = sanDeptRes.rows[0].id;

    // Create PWD Complaint
    const pwdCompRes = await fetch(`${baseUrl}/api/complaints/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`
      },
      body: JSON.stringify({
        complaint_number: `NS-PWD-${Date.now()}`,
        photo_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7',
        category: 'Roads & Footpaths',
        title: 'Large Pothole on Main Road',
        description: 'Dangerous pothole affecting traffic',
        priority: 'Medium',
        department_id: pwdDeptId,
        latitude: 18.5204,
        longitude: 73.8567
      })
    });
    const pwdCompData = await pwdCompRes.json();
    assert.strictEqual(pwdCompRes.status, 201, `Failed to create PWD complaint: ${JSON.stringify(pwdCompData)}`);
    const pwdCompId = pwdCompData.complaint_id || pwdCompData.complaint.id;

    // Create SAN Complaint
    const sanCompRes = await fetch(`${baseUrl}/api/complaints/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`
      },
      body: JSON.stringify({
        complaint_number: `NS-SAN-${Date.now()}`,
        photo_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7',
        category: 'Sanitation & Waste Management',
        title: 'Garbage Dump Overflow',
        description: 'Waste bin overflowing on street market',
        priority: 'Medium',
        department_id: sanDeptId,
        latitude: 18.5204,
        longitude: 73.8567
      })
    });
    const sanCompData = await sanCompRes.json();
    assert.strictEqual(sanCompRes.status, 201, `Failed to create SAN complaint: ${JSON.stringify(sanCompData)}`);
    const sanCompId = sanCompData.complaint_id || sanCompData.complaint.id;

    // 1. PWD Head -> PWD Complaint -> Allowed (Status + Priority + SLA update)
    const pwdUpdateRes = await fetch(`${baseUrl}/api/complaints/${pwdCompId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pwdHeadToken}`
      },
      body: JSON.stringify({
        status: 'In Progress',
        priority: 'High',
        remarks: 'PWD Officer accepted and elevated priority'
      })
    });
    assert.strictEqual(pwdUpdateRes.status, 200, `Expected 200 OK for PWD Head on PWD complaint, got ${pwdUpdateRes.status}`);
    const pwdUpdateData = await pwdUpdateRes.json();
    assert.strictEqual(pwdUpdateData.success, true);
    assert.strictEqual(pwdUpdateData.complaint.status, 'In Progress');
    assert.strictEqual(pwdUpdateData.complaint.priority, 'High');
    assert.ok(pwdUpdateData.complaint.sla_deadline, 'Expected recalculated SLA deadline on priority change');

    // 2. PWD Head -> SAN Complaint -> 403 Forbidden
    const pwdCrossRes = await fetch(`${baseUrl}/api/complaints/${sanCompId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${pwdHeadToken}`
      },
      body: JSON.stringify({ status: 'In Progress' })
    });
    assert.strictEqual(pwdCrossRes.status, 403, `Expected 403 Forbidden for PWD Head on SAN complaint, got ${pwdCrossRes.status}`);

    // 3. SAN Head -> PWD Complaint -> 403 Forbidden
    const sanCrossRes = await fetch(`${baseUrl}/api/complaints/${pwdCompId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${sanHeadToken}`
      },
      body: JSON.stringify({ status: 'Resolved' })
    });
    assert.strictEqual(sanCrossRes.status, 403, `Expected 403 Forbidden for SAN Head on PWD complaint, got ${sanCrossRes.status}`);

    // 4. Field Staff -> PWD Complaint status route -> 403 Forbidden (must retain staff-specific route)
    const staffRes = await fetch(`${baseUrl}/api/complaints/${pwdCompId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${fieldStaffToken}`
      },
      body: JSON.stringify({ status: 'Resolved' })
    });
    assert.strictEqual(staffRes.status, 403, `Expected 403 Forbidden for Field Staff on status route, got ${staffRes.status}`);

    // 5. Citizen -> PWD Complaint status route -> 403 Forbidden
    const citizenRes = await fetch(`${baseUrl}/api/complaints/${pwdCompId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenToken}`
      },
      body: JSON.stringify({ status: 'Resolved' })
    });
    assert.strictEqual(citizenRes.status, 403, `Expected 403 Forbidden for Citizen on status route, got ${citizenRes.status}`);

    // 6. Admin -> SAN Complaint -> Allowed (City-wide access)
    const adminRes = await fetch(`${baseUrl}/api/complaints/${sanCompId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        status: 'In Progress',
        remarks: 'City Admin override update'
      })
    });
    assert.strictEqual(adminRes.status, 200, `Expected 200 OK for Admin on status update, got ${adminRes.status}`);
    const adminData = await adminRes.json();
    assert.strictEqual(adminData.success, true);
    assert.strictEqual(adminData.complaint.status, 'In Progress');

  } finally {
    server.close();
  }
});
