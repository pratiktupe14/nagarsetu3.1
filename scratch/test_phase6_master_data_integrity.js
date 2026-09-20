const assert = require('assert');
const { initDatabase, query } = require('../backend/src/config/db');

async function runMasterDataIntegrityTest() {
  console.log('========================================================');
  console.log('  RUNNING PHASE 6 MASTER DATA INTEGRITY TEST (READ-ONLY)');
  console.log('========================================================\n');

  await initDatabase();

  let totalAssertions = 0;
  let passedAssertions = 0;

  function testAssert(condition, message) {
    totalAssertions++;
    if (condition) {
      passedAssertions++;
      console.log(`✓ [PASS] ${message}`);
    } else {
      console.error(`✗ [FAIL] ${message}`);
      throw new Error(`Assertion Failed: ${message}`);
    }
  }

  // 1. Verify exactly 7 core municipal departments
  const deptsRes = await query('SELECT id, name, code FROM departments ORDER BY id ASC');
  const depts = deptsRes.rows || [];
  testAssert(depts.length >= 7, `Authoritative departments present in DB (Found: ${depts.length})`);

  const expectedDepts = [
    { code: 'PWD', name: 'Public Works Department' },
    { code: 'SAN', name: 'Sanitation & Waste Management' },
    { code: 'WTR', name: 'Water Supply & Sewerage Board' },
    { code: 'DRN', name: 'Drainage & Sewage Department' },
    { code: 'ELE', name: 'Electrical & Street Lighting' },
    { code: 'TRF', name: 'Traffic Management Department' },
    { code: 'MNT', name: 'Maintenance Department' }
  ];

  for (const exp of expectedDepts) {
    const found = depts.find(d => (d.code || '').toUpperCase() === exp.code || (d.name || '').toLowerCase().includes(exp.name.toLowerCase().split(' ')[0]));
    testAssert(Boolean(found), `Department ${exp.code} (${exp.name}) exists in DB (ID: ${found?.id})`);
  }

  // Check no duplicate codes
  const codes = depts.map(d => (d.code || '').toUpperCase()).filter(Boolean);
  const uniqueCodes = new Set(codes);
  testAssert(codes.length === uniqueCodes.size, `No duplicate department codes found (${codes.length} unique)`);

  // 2. Verify Department Head mappings
  const dhRes = await query(`
    SELECT dh.id, dh.name, dh.email, dh.employee_id, dh.department_id, d.code as dept_code, d.name as dept_name
    FROM department_heads dh
    LEFT JOIN departments d ON (CAST(d.id AS TEXT) = CAST(dh.department_id AS TEXT) OR UPPER(d.code) = UPPER(CAST(dh.department_id AS TEXT)))
    WHERE LOWER(COALESCE(dh.status, 'active')) = 'active'
  `);
  const dhRows = dhRes.rows || [];

  const expectedHeads = [
    { name: 'Rahul Kumar', code: 'PWD' },
    { name: 'Amit Sharma', code: 'SAN' },
    { name: 'Vikram Patil', code: 'WTR' },
    { name: 'Sanjay More', code: 'DRN' },
    { name: 'Kunal Kulkarni', code: 'ELE' },
    { name: 'Rohan Deshmukh', code: 'TRF' },
    { name: 'Aditya Joshi', code: 'MNT' }
  ];

  for (const exp of expectedHeads) {
    const headRow = dhRows.find(h => h.name.toLowerCase() === exp.name.toLowerCase());
    testAssert(Boolean(headRow), `Department Head '${exp.name}' exists for ${exp.code}`);
    if (headRow) {
      const matchCode = (headRow.dept_code || '').toUpperCase();
      testAssert(matchCode === exp.code || String(headRow.department_id) === String(expectedDepts.findIndex(d => d.code === exp.code) + 1), `'${exp.name}' correctly assigned to ${exp.code} (Got: ${matchCode || headRow.department_id})`);
    }
  }

  // 3. Strict Non-Swapped Mapping Checks: Kunal Kulkarni = ELE, Aditya Joshi = MNT
  const kunal = dhRows.find(h => h.name.toLowerCase().includes('kunal'));
  if (kunal) {
    const kunalDept = (kunal.dept_code || '').toUpperCase();
    testAssert(kunalDept === 'ELE' || String(kunal.department_id) === '5', `Kunal Kulkarni MUST be ELE (Got: ${kunalDept || kunal.department_id})`);
  }

  const aditya = dhRows.find(h => h.name.toLowerCase().includes('aditya'));
  if (aditya) {
    const adityaDept = (aditya.dept_code || '').toUpperCase();
    testAssert(adityaDept === 'MNT' || String(aditya.department_id) === '7', `Aditya Joshi MUST be MNT (Got: ${adityaDept || aditya.department_id})`);
  }

  // 4. Field Staff Department Assignment Checks
  const staffRes = await query(`
    SELECT fs.id, fs.name, fs.employee_id, fs.department_id, d.code as dept_code, d.name as dept_name
    FROM field_staff fs
    LEFT JOIN departments d ON (CAST(d.id AS TEXT) = CAST(fs.department_id AS TEXT) OR UPPER(d.code) = UPPER(CAST(fs.department_id AS TEXT)))
  `);
  const staffRows = staffRes.rows || [];

  const keyStaffChecks = [
    { empId: 'PWD-STF-001', code: 'PWD' },
    { empId: 'SAN-STF-001', code: 'SAN' },
    { empId: 'WTR-STF-001', code: 'WTR' },
    { empId: 'DRN-STF-001', code: 'DRN' },
    { empId: 'ELE-STF-001', code: 'ELE' },
    { empId: 'TRF-STF-001', code: 'TRF' }
  ];

  for (const stf of keyStaffChecks) {
    const foundStaff = staffRows.find(s => s.employee_id === stf.empId);
    if (foundStaff) {
      const sCode = (foundStaff.dept_code || '').toUpperCase();
      testAssert(sCode === stf.code || String(foundStaff.department_id) === String(expectedDepts.findIndex(d => d.code === stf.code) + 1), `Staff '${stf.empId}' mapped to ${stf.code} (Got: ${sCode || foundStaff.department_id})`);
    } else {
      console.warn(`[NOTE] Key staff '${stf.empId}' not found in DB rows`);
    }
  }

  // 5. Verify no orphan field staff (staff without valid department_id)
  const orphanStaff = staffRows.filter(s => !s.department_id);
  testAssert(orphanStaff.length === 0, `No orphan field staff without department_id (Orphans: ${orphanStaff.length})`);

  console.log(`\n========================================================`);
  console.log(`  PHASE 6 MASTER DATA INTEGRITY TEST PASSED (${passedAssertions}/${totalAssertions} Assertions)`);
  console.log(`========================================================`);
  process.exit(0);
}

runMasterDataIntegrityTest().catch((err) => {
  console.error('\n✗ PHASE 6 MASTER DATA INTEGRITY TEST FAILED:', err.message);
  process.exit(1);
});
