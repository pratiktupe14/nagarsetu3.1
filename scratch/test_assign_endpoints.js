const { isDeptMatch, getCanonicalDepartmentId } = require('../backend/src/utils/departmentUtils');
const { query, initDatabase } = require('../backend/src/config/db');

async function testAll() {
  await initDatabase();

  console.log('=== VERIFYING ASSIGNMENT DEPT MATCH LOGIC ===\n');

  // Test 1: PWD Head assigning PWD Complaint to PWD Staff
  // PWD Head: rahul.kumar@nagarsetu.gov.in (dept PWD / 1)
  // PWD Complaint: id 85 (dept 1)
  // PWD Staff: id 2 (Amit Patil, dept 1)

  const pwdHeadEmail = 'rahul.kumar@nagarsetu.gov.in';
  const pwdHeadDeptCode = 'PWD';
  const pwdHeadDeptId = '1';

  // Test actorDeptInput resolution for PWD Head
  const actorDeptInput = pwdHeadDeptCode || pwdHeadDeptId || pwdHeadEmail;

  console.log('Actor Dept Input:', actorDeptInput);
  console.log('Task Match (PWD Complaint 1):', await isDeptMatch(actorDeptInput, '1'));
  console.log('Task Match (PWD Complaint PWD):', await isDeptMatch(actorDeptInput, 'PWD'));
  console.log('Staff Match (PWD Staff 1):', await isDeptMatch(actorDeptInput, '1'));
  console.log('Staff Match (PWD Staff PWD):', await isDeptMatch(actorDeptInput, 'PWD'));

  console.log('\n--- Cross-Department Denial Tests ---');
  console.log('Task Match (Water Complaint 3):', await isDeptMatch(actorDeptInput, '3'));
  console.log('Staff Match (Sanitation Staff 2):', await isDeptMatch(actorDeptInput, '2'));

  if (
    (await isDeptMatch(actorDeptInput, '1')) &&
    (await isDeptMatch(actorDeptInput, 'PWD')) &&
    !(await isDeptMatch(actorDeptInput, '3')) &&
    !(await isDeptMatch(actorDeptInput, '2'))
  ) {
    console.log('\nSUCCESS: All assignment checks passed correctly!');
  } else {
    console.error('\nFAILURE: One or more checks failed!');
    process.exit(1);
  }

  process.exit(0);
}

testAll().catch(err => {
  console.error(err);
  process.exit(1);
});
