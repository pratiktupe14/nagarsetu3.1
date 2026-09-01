const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const app = require('../src/app');
const { generateToken } = require('../src/middleware/auth');

test('BUG-002: /api/complaints/purge-all must reject unauthenticated requests', async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    // 1. Unauthenticated DELETE request
    const unauthDeleteRes = await fetch(`http://localhost:${port}/api/complaints/purge-all`, {
      method: 'DELETE'
    });
    assert.strictEqual(
      unauthDeleteRes.status === 401 || unauthDeleteRes.status === 403,
      true,
      `Expected unauthenticated DELETE to return 401/403, got ${unauthDeleteRes.status}`
    );

    // 2. Unauthenticated POST request
    const unauthPostRes = await fetch(`http://localhost:${port}/api/complaints/purge-all`, {
      method: 'POST'
    });
    assert.strictEqual(
      unauthPostRes.status === 401 || unauthPostRes.status === 403,
      true,
      `Expected unauthenticated POST to return 401/403, got ${unauthPostRes.status}`
    );

    // 3. Citizen token (non-admin) should receive 403 Forbidden
    const citizenToken = generateToken({ id: 1, role: 'citizen', name: 'Citizen User' });
    const citizenRes = await fetch(`http://localhost:${port}/api/complaints/purge-all`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${citizenToken}` }
    });
    assert.strictEqual(
      citizenRes.status,
      403,
      `Expected non-admin citizen token to return 403, got ${citizenRes.status}`
    );
  } finally {
    server.close();
  }
});
