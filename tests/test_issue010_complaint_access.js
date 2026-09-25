const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const app = require('../backend/src/app');
const { query, initDatabase } = require('../backend/src/config/db');
const { generateToken } = require('../backend/src/middleware/auth');

test('ISSUE-010 — Single Complaint Retrieval Access Control', async () => {
  await initDatabase();
  await require('../backend/src/scripts/seedDemoDepartmentHeads')();
  await require('../backend/src/scripts/seedServiceStaff')();

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // Generate Auth Tokens for Admin, Dept Heads, Staff
    const adminToken = generateToken({ id: 1, email: 'admin@nagarsetu.gov.in', role: 'admin' });
    const pwdHeadToken = generateToken({ id: 128, email: 'rahul.kumar@nagarsetu.gov.in', role: 'department_head', department_id: 1 });
    const sanHeadToken = generateToken({ id: 129, email: 'amit.sharma@nagarsetu.gov.in', role: 'department_head', department_id: 2 });
    const pwdStaffToken = generateToken({ id: 998, email: 'staff.pwd@nagarsetu.gov.in', role: 'service_staff', department_id: 1 });

    // Register distinct Citizen A & Citizen B accounts to ensure isolated profile IDs
    const mobA = `91${Math.floor(10000000 + Math.random() * 90000000)}`;
    const regARes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Citizen Alpha',
        mobile: mobA,
        email: `alpha_${Date.now()}@test.com`,
        password: 'password123'
      })
    });
    const regAData = await regARes.json();
    assert.strictEqual(regARes.status, 201, `Failed to register Citizen A: ${JSON.stringify(regAData)}`);
    const citizenAToken = regAData.token;

    const mobB = `91${Math.floor(10000000 + Math.random() * 90000000)}`;
    const regBRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Citizen Beta',
        mobile: mobB,
        email: `beta_${Date.now()}@test.com`,
        password: 'password123'
      })
    });
    const regBData = await regBRes.json();
    assert.strictEqual(regBRes.status, 201, `Failed to register Citizen B: ${JSON.stringify(regBData)}`);
    const citizenBToken = regBData.token;

    // Fetch canonical department IDs for PWD and SAN
    const pwdDeptRes = await query(`SELECT id FROM departments WHERE code = 'PWD' OR UPPER(name) LIKE '%PUBLIC WORKS%' LIMIT 1`);
    const sanDeptRes = await query(`SELECT id FROM departments WHERE code = 'SAN' OR UPPER(name) LIKE '%SANITATION%' LIMIT 1`);

    assert.ok(pwdDeptRes.rows.length > 0, 'PWD department should exist');
    assert.ok(sanDeptRes.rows.length > 0, 'SAN department should exist');

    const pwdDeptId = pwdDeptRes.rows[0].id;
    const sanDeptId = sanDeptRes.rows[0].id;

    // 1. Citizen A submits a PWD complaint
    const compARes = await fetch(`${baseUrl}/api/complaints/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenAToken}`
      },
      body: JSON.stringify({
        complaint_number: `NS-010-A-${Date.now()}`,
        photo_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7',
        category: 'Roads & Footpaths',
        title: 'Citizen A PWD Issue',
        description: 'Road damage near home',
        priority: 'Medium',
        department_id: pwdDeptId,
        latitude: 18.5204,
        longitude: 73.8567
      })
    });
    const compAData = await compARes.json();
    assert.strictEqual(compARes.status, 201, `Failed to submit Citizen A complaint: ${JSON.stringify(compAData)}`);
    const compAId = compAData.complaint_id || compAData.complaint.id;

    // 2. Citizen B submits a SAN complaint
    const compBRes = await fetch(`${baseUrl}/api/complaints/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${citizenBToken}`
      },
      body: JSON.stringify({
        complaint_number: `NS-010-B-${Date.now()}`,
        photo_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7',
        category: 'Sanitation & Waste Management',
        title: 'Citizen B SAN Issue',
        description: 'Trash uncollected',
        priority: 'Medium',
        department_id: sanDeptId,
        latitude: 18.5204,
        longitude: 73.8567
      })
    });
    const compBData = await compBRes.json();
    assert.strictEqual(compBRes.status, 201, `Failed to submit Citizen B complaint: ${JSON.stringify(compBData)}`);
    const compBId = compBData.complaint_id || compBData.complaint.id;

    // --- TEST MATRIX FOR ISSUE-010 ---

    // A. PWD Head -> PWD Complaint -> Allowed
    const pwdHeadPwdComp = await fetch(`${baseUrl}/api/complaints/${compAId}`, {
      headers: { Authorization: `Bearer ${pwdHeadToken}` }
    });
    assert.strictEqual(pwdHeadPwdComp.status, 200, `Expected 200 OK for PWD Head accessing PWD complaint, got ${pwdHeadPwdComp.status}`);
    const pwdHeadPwdData = await pwdHeadPwdComp.json();
    assert.ok(pwdHeadPwdData.complaint, 'Expected complaint object returned for PWD Head');

    // B. PWD Head -> SAN Complaint -> 403 Forbidden
    const pwdHeadSanComp = await fetch(`${baseUrl}/api/complaints/${compBId}`, {
      headers: { Authorization: `Bearer ${pwdHeadToken}` }
    });
    assert.strictEqual(pwdHeadSanComp.status, 403, `Expected 403 Forbidden for PWD Head accessing SAN complaint, got ${pwdHeadSanComp.status}`);

    // C. SAN Head -> PWD Complaint -> 403 Forbidden
    const sanHeadPwdComp = await fetch(`${baseUrl}/api/complaints/${compAId}`, {
      headers: { Authorization: `Bearer ${sanHeadToken}` }
    });
    assert.strictEqual(sanHeadPwdComp.status, 403, `Expected 403 Forbidden for SAN Head accessing PWD complaint, got ${sanHeadPwdComp.status}`);

    // D. PWD Field Staff -> Unrelated SAN Complaint -> 403 Forbidden (Blocked)
    const staffSanComp = await fetch(`${baseUrl}/api/complaints/${compBId}`, {
      headers: { Authorization: `Bearer ${pwdStaffToken}` }
    });
    assert.strictEqual(staffSanComp.status, 403, `Expected 403 Forbidden for PWD Staff accessing unrelated SAN complaint, got ${staffSanComp.status}`);

    // E. PWD Field Staff -> Same Department (PWD) Complaint -> Allowed
    const staffPwdComp = await fetch(`${baseUrl}/api/complaints/${compAId}`, {
      headers: { Authorization: `Bearer ${pwdStaffToken}` }
    });
    assert.strictEqual(staffPwdComp.status, 200, `Expected 200 OK for PWD Staff accessing PWD complaint, got ${staffPwdComp.status}`);

    // F. Citizen B -> Citizen A Complaint -> 403 Forbidden (Blocked)
    const citizenBSeesA = await fetch(`${baseUrl}/api/complaints/${compAId}`, {
      headers: { Authorization: `Bearer ${citizenBToken}` }
    });
    assert.strictEqual(citizenBSeesA.status, 403, `Expected 403 Forbidden for Citizen B accessing Citizen A complaint, got ${citizenBSeesA.status}`);

    // G. Citizen A -> Citizen A Complaint -> Allowed
    const citizenASeesA = await fetch(`${baseUrl}/api/complaints/${compAId}`, {
      headers: { Authorization: `Bearer ${citizenAToken}` }
    });
    assert.strictEqual(citizenASeesA.status, 200, `Expected 200 OK for Citizen A accessing own complaint, got ${citizenASeesA.status}`);

    // H. Admin -> City-wide access -> Allowed
    const adminSeesB = await fetch(`${baseUrl}/api/complaints/${compBId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(adminSeesB.status, 200, `Expected 200 OK for Admin accessing any complaint, got ${adminSeesB.status}`);

  } finally {
    server.close();
  }
});
