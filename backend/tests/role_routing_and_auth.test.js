const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const http = require('http');
const { initDatabase } = require('../src/config/db');
const { seedAll } = require('../src/server');
const authRoutes = require('../src/routes/auth.routes');
const adminRoutes = require('../src/routes/admin.routes');

describe('Role-Routing and Authentication Verification Suite', () => {
  let server;
  let baseUrl;

  before(async () => {
    await initDatabase();
    if (seedAll) {
      await seedAll();
    }
    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRoutes);
    app.use('/api/admin', adminRoutes);

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        baseUrl = `http://127.0.0.1:${addr.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('1. Citizen login with actual credentials returns role: citizen and valid JWT', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobileOrEmail: '8788562103',
        password: '8788562103'
      })
    });

    assert.strictEqual(res.status, 200, 'Citizen login must return HTTP 200');
    const data = await res.json();
    assert.ok(data.token, 'Must return signed token');
    assert.strictEqual(data.user.role, 'citizen', 'Citizen server role must be citizen');
    assert.strictEqual(data.user.mobile, '8788562103');
  });

  test('2. Citizen login with wrong password must be rejected with 401', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobileOrEmail: '8788562103',
        password: 'wrong_password_123'
      })
    });

    assert.strictEqual(res.status, 401, 'Citizen login with wrong password must be rejected with HTTP 401');
    const data = await res.json();
    assert.strictEqual(data.error, 'Invalid login credentials');
  });

  test('3. Admin login with actual credentials returns role: city_admin and valid JWT', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobileOrEmail: 'admin@nagarsetu.gov.in',
        password: 'admin@123'
      })
    });

    assert.strictEqual(res.status, 200, 'Admin login must return HTTP 200');
    const data = await res.json();
    assert.ok(data.token, 'Must return signed token');
    assert.strictEqual(data.user.role, 'city_admin', 'Admin server role must be city_admin');
    assert.strictEqual(data.user.email, 'admin@nagarsetu.gov.in');
  });

  test('4. Admin login with wrong password must be rejected with 401', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobileOrEmail: 'admin@nagarsetu.gov.in',
        password: 'unauthorized_password'
      })
    });

    assert.strictEqual(res.status, 401, 'Admin login with wrong password must be rejected with HTTP 401');
    const data = await res.json();
    assert.strictEqual(data.error, 'Invalid login credentials');
  });

  test('5. Citizen token accessing Admin API /api/admin/analytics must be rejected with HTTP 403 Forbidden', async () => {
    // Obtain legitimate citizen token
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobileOrEmail: '8788562103',
        password: '8788562103'
      })
    });
    const { token: citizenToken } = await loginRes.json();

    // Attempt to access admin analytics
    const adminRes = await fetch(`${baseUrl}/api/admin/analytics`, {
      headers: {
        'Authorization': `Bearer ${citizenToken}`
      }
    });

    assert.strictEqual(adminRes.status, 403, 'Citizen token accessing Admin API must return HTTP 403 Forbidden');
    const body = await adminRes.json();
    assert.strictEqual(body.error, 'Forbidden: Access denied for user role');
  });

  test('6. City Admin token accessing Admin API /api/admin/analytics succeeds with 200 and loads admin data', async () => {
    // Obtain legitimate admin token
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobileOrEmail: 'admin@nagarsetu.gov.in',
        password: 'admin@123'
      })
    });
    const { token: adminToken } = await loginRes.json();

    // Access admin analytics
    const adminRes = await fetch(`${baseUrl}/api/admin/analytics`, {
      headers: {
        'Authorization': `Bearer ${adminToken}`
      }
    });

    assert.strictEqual(adminRes.status, 200, 'Admin token accessing Admin API must return HTTP 200');
    const data = await adminRes.json();
    assert.ok(data.metrics, 'Must return metrics object');
    assert.ok(data.metrics.total_complaints !== undefined, 'Must return total_complaints metric');
  });

  test('7. Database user with citizen role strictly resolves to citizen server role', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        mobileOrEmail: '9876543210',
        password: 'password123'
      })
    });

    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.user.role, 'citizen', 'Database citizen user must have citizen role');
  });

  test('8. Public registration with role: "admin" cannot create an admin account', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Malicious Actor',
        mobile: '9999888877',
        email: 'attacker@example.com',
        password: 'Password@123',
        role: 'admin'
      })
    });

    // Joi schema validation with allowUnknown: false rejects unpermitted 'role' field
    assert.strictEqual(res.status, 400, 'Public registration attempting role: admin must be rejected with HTTP 400');
    const data = await res.json();
    assert.strictEqual(data.details?.some(d => d.includes('role')), true, 'Validation error must mention role');
    assert.strictEqual(data.user, undefined, 'Admin user must never be created');
  });

  test('9. Public registration with only { role: "admin" } cannot create an admin account', async () => {
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: 'admin'
      })
    });

    assert.strictEqual(res.status, 400, 'Public registration payload { role: "admin" } must return HTTP 400');
    const data = await res.json();
    assert.strictEqual(data.user, undefined, 'No user should be created');
  });

  test('10. Public registration creates strictly citizen role accounts', async () => {
    const uniqueMobile = '9199' + Math.floor(100000 + Math.random() * 900000);
    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Honest Citizen',
        mobile: uniqueMobile,
        email: `citizen_${uniqueMobile}@example.com`,
        password: 'Password@123'
      })
    });

    assert.strictEqual(res.status, 201, 'Public registration must succeed with HTTP 201');
    const data = await res.json();
    assert.ok(data.token, 'Must return signed token');
    assert.strictEqual(data.user.role, 'citizen', 'Created account must strictly have citizen role');
  });
});
