const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const app = require('../src/app');

test('BUG-005: login endpoint must sanitize formatted mobile numbers (+91, spaces, dashes)', async () => {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;

  try {
    // Attempt login with +91 prefixed mobile for admin account
    const res = await fetch(`http://localhost:${port}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobileOrEmail: '+91 98765 43213',
        password: 'NagarSetu@Admin2026!'
      })
    });

    assert.strictEqual(res.status, 200, `Expected 200 OK for formatted mobile login, got ${res.status}`);
    const data = await res.json();
    assert.strictEqual(Boolean(data.token), true, 'Expected valid JWT token');
    assert.strictEqual(data.user.role === 'admin' || data.user.role === 'city_admin', true, 'Expected admin user role');
  } finally {
    server.close();
  }
});
