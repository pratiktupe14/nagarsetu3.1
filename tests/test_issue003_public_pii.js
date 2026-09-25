const { test } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const app = require('../backend/src/app');
const { query, initDatabase } = require('../backend/src/config/db');
const { generateToken } = require('../backend/src/middleware/auth');

test('ISSUE-003 — Public Complaint PII Exposure Verification', async () => {
  await initDatabase();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    const citizenToken = generateToken({ id: 1, email: 'citizen@nagarsetu.gov.in', role: 'citizen' });

    // 1. Unauthenticated public GET /api/complaints
    const publicRes = await fetch(`${baseUrl}/api/complaints`);
    assert.strictEqual(publicRes.status, 200, `Expected 200 OK for public complaints GET, got ${publicRes.status}`);
    const publicData = await publicRes.json();
    assert.ok(Array.isArray(publicData.complaints), 'Response must include complaints array');

    if (publicData.complaints.length > 0) {
      const sample = publicData.complaints[0];

      // PII & Exact Location fields MUST NOT be exposed on public endpoint
      assert.strictEqual(sample.citizen_name, undefined, 'Public feed MUST NOT expose citizen_name');
      assert.strictEqual(sample.citizen_phone, undefined, 'Public feed MUST NOT expose citizen_phone');
      assert.strictEqual(sample.citizen_email, undefined, 'Public feed MUST NOT expose citizen_email');
      assert.strictEqual(sample.citizen_mobile, undefined, 'Public feed MUST NOT expose citizen_mobile');
      assert.strictEqual(sample.address, undefined, 'Public feed MUST NOT expose residential address');
      assert.strictEqual(sample.latitude, undefined, 'Public feed MUST NOT expose exact latitude');
      assert.strictEqual(sample.longitude, undefined, 'Public feed MUST NOT expose exact longitude');
      assert.strictEqual(sample.location_details, undefined, 'Public feed MUST NOT expose location_details');
      assert.strictEqual(sample.assigned_staff_email, undefined, 'Public feed MUST NOT expose assigned_staff_email');

      // Required civic fields MUST be present
      assert.ok(sample.id !== undefined, 'Public complaint must have id');
      assert.ok(sample.category !== undefined, 'Public complaint must have category');
      assert.ok(sample.status !== undefined, 'Public complaint must have status');
    }

    // 2. Authorized user GET /api/complaints preserves existing visibility
    const authedRes = await fetch(`${baseUrl}/api/complaints?scope=all`, {
      headers: {
        Authorization: `Bearer ${citizenToken}`
      }
    });
    assert.strictEqual(authedRes.status, 200, `Expected 200 OK for authorized complaints GET, got ${authedRes.status}`);
    const authedData = await authedRes.json();
    assert.ok(Array.isArray(authedData.complaints), 'Authorized response must include complaints array');
  } finally {
    server.close();
  }
});
