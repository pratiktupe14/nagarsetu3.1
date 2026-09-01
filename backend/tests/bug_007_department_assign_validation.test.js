const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const app = require('../src/app');
const { generateToken } = require('../src/middleware/auth');

test('BUG-007: /api/department/assign must validate complaint_id and staff_id using schema validation', async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    const adminToken = generateToken({ id: 1, role: 'city_admin', name: 'Admin User' });

    // 1. Missing complaint_id & staff_id in request body
    const emptyPayloadRes = await fetch(`http://localhost:${port}/api/department/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({})
    });

    assert.strictEqual(emptyPayloadRes.status, 400, `Expected 400 Bad Request on empty payload, got ${emptyPayloadRes.status}`);
    const errData = await emptyPayloadRes.json();
    assert.strictEqual(Boolean(errData.error || errData.message), true);
  } finally {
    server.close();
  }
});
