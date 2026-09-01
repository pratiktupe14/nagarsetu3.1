const { test } = require('node:test');
const assert = require('node:assert');
const { requireRole } = require('../src/middleware/auth');

test('BUG-004: requireRole must normalize role synonyms (staff <-> service_staff, admin <-> city_admin)', () => {
  // Test 1: User with role 'staff' accessing 'service_staff' route
  let nextCalled = false;
  let statusSent = null;

  const req1 = { user: { id: 1, role: 'staff' } };
  const res1 = {
    status: (code) => {
      statusSent = code;
      return { json: () => {} };
    }
  };
  const mw1 = requireRole(['service_staff']);
  mw1(req1, res1, () => { nextCalled = true; });

  assert.strictEqual(nextCalled, true, 'User with role staff should be allowed on service_staff route');
  assert.strictEqual(statusSent, null);

  // Test 2: User with role 'admin' accessing 'city_admin' route
  nextCalled = false;
  statusSent = null;
  const req2 = { user: { id: 2, role: 'admin' } };
  const mw2 = requireRole(['city_admin']);
  mw2(req2, res1, () => { nextCalled = true; });

  assert.strictEqual(nextCalled, true, 'User with role admin should be allowed on city_admin route');

  // Test 3: Citizen accessing staff route should be rejected with 403
  nextCalled = false;
  statusSent = null;
  const req3 = { user: { id: 3, role: 'citizen' } };
  const mw3 = requireRole(['service_staff']);
  mw3(req3, res1, () => { nextCalled = true; });

  assert.strictEqual(nextCalled, false, 'Citizen should be rejected from service_staff route');
  assert.strictEqual(statusSent, 403);
});
