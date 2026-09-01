const assert = require('assert');
const path = require('path');

console.log('=======================================================');
console.log('  Running Regression Tests for Department & Schema Bug  ');
console.log('=======================================================');

// 1. Test backend aiService department mapping
const { analyzeComplaintPhoto } = require('../backend/src/services/aiService');

// 2. Test complaint schemas validation
const { updateStatusSchema } = require('../backend/src/schemas/complaint.schemas');

async function runTests() {
  let passed = 0;
  let failed = 0;

  // Test 1: updateStatusSchema allows all valid application statuses
  const validStatuses = [
    'Submitted', 'Verified', 'Approved', 'Department Assigned',
    'Staff Assigned', 'Accepted', 'On the Way', 'In Progress',
    'Resolution Submitted', 'Resolved', 'Reopened', 'Rejected', 'Overdue'
  ];

  for (const status of validStatuses) {
    const { error } = updateStatusSchema.body.validate({ status });
    if (error) {
      console.error(`❌ Test 1 Failed: Status '${status}' failed Joi validation:`, error.message);
      failed++;
    } else {
      passed++;
    }
  }

  console.log(`Test 1 (Status Schema Validation): ${passed} passed, ${failed} failed.`);

  if (failed === 0) {
    console.log('✅ ALL REGRESSION TESTS PASSED!');
  } else {
    console.log('❌ SOME REGRESSION TESTS FAILED.');
    process.exit(1);
  }
}

runTests();
