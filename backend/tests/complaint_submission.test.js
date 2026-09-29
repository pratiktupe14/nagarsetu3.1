const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const app = require('../src/app');
const { initDatabase } = require('../src/config/db');

describe('Citizen Complaint Submission Flow with Demo & JWT Auth', () => {
  let server;
  let baseUrl;

  before(async () => {
    await initDatabase();
    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('1. POST /api/complaints/submit with demo-token-citizen succeeds with 201 Created', async () => {
    const payload = {
      complaint_number: `NS-${Date.now()}`,
      photo_url: '/uploads/test-pothole.jpg',
      category: 'Pothole & Road Damage',
      title: 'Deep pothole on MG Road near City Hospital',
      description: 'Severe road surface damage causing traffic hazard',
      priority: 'High',
      department_id: 1,
      latitude: 18.5204,
      longitude: 73.8567,
      location_source: 'live_gps',
      location_address: 'MG Road, Pune, Maharashtra'
    };

    const res = await fetch(`${baseUrl}/api/complaints/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer demo-token-citizen'
      },
      body: JSON.stringify(payload)
    });

    const body = await res.json();
    assert.strictEqual(res.status, 201, `Expected HTTP 201, got ${res.status}: ${JSON.stringify(body)}`);
    assert.strictEqual(body.message, 'Complaint submitted successfully');
    assert.ok(body.complaint_id, 'Must return complaint_id');
  });

  test('2. POST /api/auth/demo-token returns signed JWT and valid citizen profile', async () => {
    const res = await fetch(`${baseUrl}/api/auth/demo-token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'citizen' })
    });

    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.ok(body.token, 'Must return JWT token');
    assert.strictEqual(body.user?.role, 'citizen');
    assert.strictEqual(body.user?.name, 'Pratik Dilip Tupe');
  });

  test('3. GET /api/auth/me accepts demo-token-citizen and returns Pratik Dilip Tupe', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { 'Authorization': 'Bearer demo-token-citizen' }
    });

    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.strictEqual(body.user?.name, 'Pratik Dilip Tupe');
    assert.strictEqual(body.user?.role, 'citizen');
  });
});
