const { initDb } = require('../backend/src/config/db.js');
const { isDeptMatch, getCanonicalDepartmentId } = require('../backend/src/utils/departmentUtils.js');

async function testSecurity() {
  let dbInitialized = false;
  try {
    if (typeof initDb === 'function') {
        await initDb();
        dbInitialized = true;
    }
  } catch (e) {
    // ignore
  }

  console.log('--- TEST: Department Resolution Hardening ---');

  const cases = [
    [null, 'PWD', false],
    [undefined, 'PWD', false],
    ['unknown', 'PWD', false],
    ['SAN', 'PWD', false],
    ['PWD', 'PWD', true],
    ['1abc', 'PWD', false],
    ['PWDxyz', 'PWD', false]
  ];
  
  let passed = 0;
  for (const [a, b, expected] of cases) {
    const res = await isDeptMatch(a, b);
    if (res === expected) {
      console.log(`[PASS] ${a} vs ${b} -> ${res}`);
      passed++;
    } else {
      console.log(`[FAIL] ${a} vs ${b} -> expected ${expected}, got ${res}`);
    }
  }
  
  const unknownObj = await getCanonicalDepartmentId('unknown');
  if (unknownObj === null) {
      console.log('[PASS] getCanonicalDepartmentId(unknown) -> null');
      passed++;
  } else {
      console.log('[FAIL] getCanonicalDepartmentId(unknown) -> ', unknownObj);
  }
  
  if (passed === cases.length + 1) {
      console.log('--- ALL SECURITY CHECKS PASSED ---');
  } else {
      console.log('--- SECURITY CHECKS FAILED ---');
  }
}

testSecurity().then(() => {
    process.exit(0);
}).catch(e => {
    console.error(e);
    process.exit(1);
});
