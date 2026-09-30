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

  test('4. POST /api/complaints/submit with 4-angle evidence images persists all angles to database', async () => {
    const complaintNum = `NS-ANGLE-${Date.now()}`;
    const payload = {
      complaint_number: complaintNum,
      photo_url: 'https://example.com/front-photo.jpg',
      photo_front_url: 'https://example.com/front-photo.jpg',
      photo_left_url: 'https://example.com/left-photo.jpg',
      photo_right_url: 'https://example.com/right-photo.jpg',
      photo_closeup_url: 'https://example.com/closeup-photo.jpg',
      angle_photos: [
        { angle: 'front', label: 'Front View', url: 'https://example.com/front-photo.jpg' },
        { angle: 'left', label: 'Left View', url: 'https://example.com/left-photo.jpg' },
        { angle: 'right', label: 'Right View', url: 'https://example.com/right-photo.jpg' },
        { angle: 'closeup', label: 'Close-up Detail', url: 'https://example.com/closeup-photo.jpg' }
      ],
      additional_photos: [
        'https://example.com/left-photo.jpg',
        'https://example.com/right-photo.jpg',
        'https://example.com/closeup-photo.jpg'
      ],
      category: 'Pothole & Road Damage',
      title: 'Four-angle documented crater on College Road',
      description: 'Documented with Front, Left, Right and Close-up detail angles for road repair.',
      priority: 'High',
      department_id: 1,
      latitude: 19.9975,
      longitude: 73.7898,
      location_source: 'live_gps',
      location_address: 'College Road, Nashik, Maharashtra'
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
    assert.ok(body.complaint_id, 'Must return complaint_id');

    // Query back complaint directly to verify persistence of all 4 angles
    const getRes = await fetch(`${baseUrl}/api/complaints/my`, {
      headers: {
        'Authorization': 'Bearer demo-token-citizen'
      }
    });
    assert.strictEqual(getRes.status, 200);
    const getBody = await getRes.json();
    const myComplaints = Array.isArray(getBody) ? getBody : (getBody.complaint || getBody.complaints || []);
    const saved = myComplaints.find((c) => c.complaint_number === complaintNum);
    assert.ok(saved, `Saved complaint ${complaintNum} should be returned in my complaints`);
    assert.strictEqual(saved.photo_front_url, 'https://example.com/front-photo.jpg');
    assert.strictEqual(saved.photo_left_url, 'https://example.com/left-photo.jpg');
    assert.strictEqual(saved.photo_right_url, 'https://example.com/right-photo.jpg');
    assert.strictEqual(saved.photo_closeup_url, 'https://example.com/closeup-photo.jpg');
  });

  test('5. Citizen complaint submission requires authentication', async () => {
    const res = await fetch(`${baseUrl}/api/complaints/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Unauthenticated test' })
    });
    assert.strictEqual(res.status, 401, 'Unauthenticated request must be rejected with 401');
  });

  test('6. Read queries (GET) do not deplete action rate limit quota for complaint submission', async () => {
    // Perform multiple read queries simulating browsing, map updates, and notifications
    for (let i = 0; i < 20; i++) {
      const readRes = await fetch(`${baseUrl}/api/complaints/my`, {
        headers: { 'Authorization': 'Bearer demo-token-citizen' }
      });
      assert.strictEqual(readRes.status, 200);
    }

    // Now submit a complaint - it must succeed and NOT be blocked by 429
    const complaintNum = `NS-READTEST-${Date.now()}`;
    const payload = {
      complaint_number: complaintNum,
      photo_url: 'https://example.com/front-test.jpg',
      category: 'Pothole & Road Damage',
      title: 'Road crack tested after multiple read operations',
      description: 'Checking that read queries never starve write action rate limits',
      priority: 'Medium',
      department_id: 1,
      latitude: 19.9975,
      longitude: 73.7898,
      location_source: 'live_gps'
    };

    const submitRes = await fetch(`${baseUrl}/api/complaints/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer demo-token-citizen'
      },
      body: JSON.stringify(payload)
    });

    const submitBody = await submitRes.json();
    assert.strictEqual(submitRes.status, 201, `Submission must succeed with 201, got ${submitRes.status}: ${JSON.stringify(submitBody)}`);
    assert.strictEqual(submitBody.message, 'Complaint submitted successfully');
  });

  test('7. Dedicated rate limiter isolates user and protects against excessive automated flooding', async () => {
    // Use an isolated unique token to test the complaintSubmitLimiter threshold
    const spamToken = `spam-test-token-${Date.now()}`;
    const { generateToken } = require('../src/middleware/auth');
    const token = generateToken({
      id: `spam-user-${Date.now()}`,
      name: 'Spam Tester',
      email: `spam-${Date.now()}@test.com`,
      role: 'citizen'
    });

    let rateLimited = false;
    // Attempt rapid submissions above the 30-submission threshold
    for (let i = 0; i < 35; i++) {
      const res = await fetch(`${baseUrl}/api/complaints/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          complaint_number: `NS-SPAM-${Date.now()}-${i}`,
          photo_url: 'https://example.com/test.jpg',
          category: 'Garbage & Sanitation',
          title: `Rapid submission test #${i}`,
          department_id: 2,
          latitude: 19.9975,
          longitude: 73.7898
        })
      });

      if (res.status === 429) {
        rateLimited = true;
        const errBody = await res.json();
        assert.ok(errBody.error, 'Must provide rate limit error message');
        break;
      }
    }

    assert.ok(rateLimited, 'Genuine excessive complaint flooding must trigger rate limit (429)');
  });
});
