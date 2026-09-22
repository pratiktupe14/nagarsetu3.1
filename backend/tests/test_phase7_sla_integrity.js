const assert = require('assert');
const { calculateSla } = require('../src/utils/slaEngine');

async function run() {
  console.log('--- Running SLA Integrity Test ---');
  
  // Test 1: valid SLA fetches from DB
  const critical = await calculateSla('Critical');
  assert.strictEqual(critical.resolveHours, 4, 'Critical resolve should be 4');
  console.log('PASS: Valid SLA policy exists in DB.');

  // Test 2: malformed/missing policy
  try {
    await calculateSla('INVALID_PRIORITY');
    assert.fail('Should have thrown an error for invalid priority');
  } catch (e) {
    assert.ok(e.message.includes('SLA policy not found'));
    console.log('PASS: No silent hardcoded fallback used (failed closed).');
  }

  console.log('--- SLA Integrity Test Complete ---');
}

run().catch(e => {
  console.error('FAIL:', e.message);
  process.exit(1);
});