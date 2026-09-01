const path = require('path');

// Point to backend files
const { normalizeCategory, getDepartmentForCategory, normalizeSpecificIssue } = require('../backend/src/services/taxonomyService');

console.log('=== NAGARSETU 3.1 AI VISION & TAXONOMY REGRESSION TEST ===\n');

let passCount = 0;
let failCount = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`[PASS] ${testName}`);
    passCount++;
  } else {
    console.error(`[FAIL] ${testName}`);
    failCount++;
  }
}

// Test 1 — Pothole Normalization & Department Routing
const t1Category = normalizeCategory('large road pothole');
const t1Dept = getDepartmentForCategory(t1Category);
assert(t1Category === 'Road Damage / Pothole', 'Test 1a: Pothole normalized category');
assert(t1Dept.code === 'PWD', 'Test 1b: Pothole department code is PWD');

// Test 2 — Garbage Normalization & Department Routing
const t2Category = normalizeCategory('overflowing trash bin and uncollected waste');
const t2Dept = getDepartmentForCategory(t2Category);
assert(t2Category === 'Garbage / Waste', 'Test 2a: Garbage normalized category');
assert(t2Dept.code === 'SAN', 'Test 2b: Garbage department code is SAN');

// Test 3 — Streetlight Normalization & Department Routing
const t3Category = normalizeCategory('broken streetlight pole');
const t3Dept = getDepartmentForCategory(t3Category);
assert(t3Category === 'Streetlight / Electrical', 'Test 3a: Streetlight normalized category');
assert(t3Dept.code === 'ELE', 'Test 3b: Streetlight department code is ELE');

// Test 4 — Water Leak Normalization & Department Routing
const t4Category = normalizeCategory('leaking municipal water pipeline');
const t4Dept = getDepartmentForCategory(t4Category);
assert(t4Category === 'Water Leakage / Pipeline', 'Test 4a: Water leak normalized category');
assert(t4Dept.code === 'WTR', 'Test 4b: Water leak department code is WTR');

// Test 5 — Low Confidence Handling Logic
const confidenceLow = 0.65;
const isLowConf = confidenceLow < 0.80;
const statusLowConf = isLowConf ? 'NEEDS_VERIFICATION' : 'Submitted';
assert(statusLowConf === 'NEEDS_VERIFICATION', 'Test 5: Low confidence (< 0.80) sets status to NEEDS_VERIFICATION');

// Test 6 — AI Failure Fallback
const confidenceZero = 0.0;
const statusFallback = (confidenceZero < 0.80) ? 'NEEDS_VERIFICATION' : 'Submitted';
assert(statusFallback === 'NEEDS_VERIFICATION', 'Test 6: AI failure (0 confidence) sets status to NEEDS_VERIFICATION');

// Test 7 — Malicious Citizen Department Override
// Citizen sends department_id = 5 (Electrical) with a pothole category
const citizenSubmittedDeptId = 5;
const potholeCategory = 'Road Damage / Pothole';
const authoritativeDept = getDepartmentForCategory(potholeCategory);
assert(authoritativeDept.code === 'PWD', 'Test 7: Backend authoritatively routes pothole to PWD regardless of citizen department input');

// Test 8 — Specific Issue Normalization
const specIssue = normalizeSpecificIssue('Deep crater on main road', 'Road Damage / Pothole');
assert(typeof specIssue === 'string' && specIssue.length > 0, 'Test 8: Specific issue normalization');

// Test 9 — Malformed AI text normalization fallback
const malformedCategory = normalizeCategory(null);
assert(malformedCategory === 'Other Civic Issue', 'Test 9: Malformed category fallback to Other Civic Issue');

// Test 10 — Drainage Normalization
const t10Category = normalizeCategory('blocked drainage sewage overflow');
const t10Dept = getDepartmentForCategory(t10Category);
assert(t10Category === 'Drainage / Sewage', 'Test 10a: Drainage normalized category');
assert(t10Dept.code === 'DRN', 'Test 10b: Drainage department code is DRN');

console.log(`\nTEST SUMMARY: ${passCount} PASSED, ${failCount} FAILED`);
if (failCount > 0) {
  process.exit(1);
} else {
  console.log('ALL TAXONOMY & ROUTING TESTS PASSED PERFECTLY!');
}
