const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const app = require('../backend/src/app');
const { query, initDatabase } = require('../backend/src/config/db');
const { generateToken } = require('../backend/src/middleware/auth');

test('ISSUE-002 — Department Head Mobile Collision Verification', async () => {
  await initDatabase();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    const adminToken = generateToken({ id: 1, email: 'admin@nagarsetu.gov.in', role: 'admin' });
    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    };

    const uniqueTag = Date.now().toString().slice(-6);
    const email1 = `dh_blank_${uniqueTag}@nagarsetu.gov.in`;
    const email2 = `dh_dup1_${uniqueTag}@nagarsetu.gov.in`;
    const email3 = `dh_dup2_${uniqueTag}@nagarsetu.gov.in`;
    const realPhone = `+91 98765 ${uniqueTag.slice(0, 5)}`;

    // 1. Blank optional phone -> succeeds with NULL in DB
    const resBlank = await fetch(`${baseUrl}/api/admin/department-heads`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'DH Blank Phone Test',
        email: email1,
        phone: '',
        password: 'nagarsetuPass2026',
        departmentId: '1',
        designation: 'Department Head'
      })
    });

    assert.strictEqual(resBlank.status, 201, `Expected 201 for blank phone DH creation, got ${resBlank.status}`);

    const userRes = await query(`SELECT mobile FROM users WHERE LOWER(email) = ?`, [email1]);
    assert.strictEqual(userRes.rows.length, 1);
    assert.strictEqual(userRes.rows[0].mobile, null, 'Blank phone must be saved as NULL in database');

    // 2. Real phone -> preserve real value
    const resReal1 = await fetch(`${baseUrl}/api/admin/department-heads`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'DH Real Phone User 1',
        email: email2,
        phone: realPhone,
        password: 'nagarsetuPass2026',
        departmentId: '2',
        designation: 'Department Head'
      })
    });

    assert.strictEqual(resReal1.status, 201, `Expected 201 for real phone DH creation, got ${resReal1.status}`);

    const userResReal = await query(`SELECT mobile FROM users WHERE LOWER(email) = ?`, [email2]);
    assert.strictEqual(userResReal.rows.length, 1);
    assert.strictEqual(userResReal.rows[0].mobile, realPhone, 'Real phone value must be preserved');

    // 3. Duplicate real phone -> return controlled validation error (4xx)
    const resReal2 = await fetch(`${baseUrl}/api/admin/department-heads`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: 'DH Real Phone User 2 Duplicate',
        email: email3,
        phone: realPhone,
        password: 'nagarsetuPass2026',
        departmentId: '3',
        designation: 'Department Head'
      })
    });

    assert.ok(resReal2.status >= 400 && resReal2.status < 500, `Expected 4xx for duplicate phone, got ${resReal2.status}`);
    const dupErr = await resReal2.json();
    assert.ok(/phone|already|in use/i.test(dupErr.error || dupErr.message || ''), 'Should return controlled validation error for duplicate phone');
  } finally {
    server.close();
  }
});
