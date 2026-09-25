const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const app = require('../backend/src/app');
const { query, initDatabase } = require('../backend/src/config/db');
const { generateToken } = require('../backend/src/middleware/auth');

test('ISSUE-001 — Department CRUD API Prefix Verification', async () => {
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

    const testCode = 'TCR' + Math.floor(Math.random() * 899 + 100);

    // 1. Department Create -> POST /api/admin/departments
    const createRes = await fetch(`${baseUrl}/api/admin/departments`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: `Test Dept ${testCode}`,
        code: testCode,
        description: 'Test Department for CRUD Prefix verification'
      })
    });

    assert.strictEqual(createRes.status, 201, `Expected 201 Created, got ${createRes.status}`);
    const createData = await createRes.json();
    assert.strictEqual(createData.success, true);
    assert.ok(createData.department && createData.department.id, 'Expected created department object with id');
    const createdId = String(createData.department.id);

    // Verify DB persistence after Create
    const dbCheckCreate = await query(`SELECT * FROM departments WHERE CAST(id AS TEXT) = ? OR code = ?`, [createdId, testCode]);
    assert.strictEqual(dbCheckCreate.rows.length > 0, true, 'Department should exist in database after create');

    // 2. Department Edit -> PUT /api/admin/departments/:id
    const updatedName = `Updated Dept ${testCode}`;
    const updateRes = await fetch(`${baseUrl}/api/admin/departments/${createdId}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        name: updatedName,
        code: testCode,
        description: 'Updated description'
      })
    });

    assert.strictEqual(updateRes.status, 200, `Expected 200 OK on update, got ${updateRes.status}`);
    const updateData = await updateRes.json();
    assert.strictEqual(updateData.success, true);
    assert.strictEqual(updateData.department.name, updatedName);

    // Verify DB persistence after Edit
    const dbCheckUpdate = await query(`SELECT name FROM departments WHERE CAST(id AS TEXT) = ?`, [createdId]);
    assert.strictEqual(dbCheckUpdate.rows[0].name, updatedName, 'Department name should be updated in database');

    // 3. Department Delete -> DELETE /api/admin/departments/:id
    const deleteRes = await fetch(`${baseUrl}/api/admin/departments/${createdId}`, {
      method: 'DELETE',
      headers
    });

    assert.strictEqual(deleteRes.status, 200, `Expected 200 OK on delete, got ${deleteRes.status}`);

    // Verify DB persistence after Delete
    const dbCheckDelete = await query(`SELECT * FROM departments WHERE CAST(id AS TEXT) = ?`, [createdId]);
    assert.strictEqual(dbCheckDelete.rows.length, 0, 'Department should be deleted from database');
  } finally {
    server.close();
  }
});
