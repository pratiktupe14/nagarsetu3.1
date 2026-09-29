const { query, isPostgres } = require('../backend/src/config/db');
const seed7DemoDepartmentHeads = require('../backend/src/scripts/seedDemoDepartmentHeads');

async function run() {
  console.log('=== STEP 1 & 3: READ-ONLY CURRENT STATE & ENVIRONMENT IDENTIFICATION ===\n');

  const envType = (process.env.NODE_ENV === 'production' || process.env.VERCEL) ? 'PROD' : 'DEV';
  console.log(`Database Environment Type: ${envType}`);
  console.log(`Using Database Driver: ${isPostgres ? 'PostgreSQL' : 'SQLite'}`);

  // 1. Inspect departments table before fix
  const deptsBefore = await query(`SELECT id, name, code, description FROM departments ORDER BY code`).catch(err => ({ rows: [] }));
  console.log('\n--- DEPARTMENTS BEFORE FIX ---');
  if (deptsBefore.rows && deptsBefore.rows.length > 0) {
    deptsBefore.rows.forEach(d => console.log(`ID: ${d.id} | Code: ${d.code} | Name: ${d.name}`));
  } else {
    console.log('No departments found or query failed.');
  }

  // 2. Inspect department_heads table before fix
  const dhBefore = await query(`SELECT id, name, email, department_id, employee_id FROM department_heads ORDER BY email`).catch(err => ({ rows: [] }));
  console.log('\n--- DEPARTMENT HEADS BEFORE FIX ---');
  if (dhBefore.rows && dhBefore.rows.length > 0) {
    dhBefore.rows.forEach(h => console.log(`Name: ${h.name.padEnd(16)} | Email: ${h.email.padEnd(32)} | DeptID: ${h.department_id}`));
  } else {
    console.log('No department heads found or query failed.');
  }

  // 3. Inspect field_staff table before fix
  const staffBefore = await query(`SELECT id, name, email, department_id FROM field_staff ORDER BY id LIMIT 10`).catch(err => ({ rows: [] }));
  console.log('\n--- SAMPLE FIELD STAFF RECORDS BEFORE FIX ---');
  if (staffBefore.rows && staffBefore.rows.length > 0) {
    staffBefore.rows.forEach(s => console.log(`Staff Name: ${s.name.padEnd(16)} | DeptID: ${s.department_id}`));
  } else {
    console.log('No field staff records found or query failed.');
  }

  // STEP 4: REPAIR DATABASE MASTER DATA SAFELY FOR DEV
  console.log('\n=== STEP 4: REPAIRING DATABASE MASTER DATA SAFELY ===\n');
  
  // Run seed7DemoDepartmentHeads script to insert MNT and update Aditya Joshi idempotently
  await seed7DemoDepartmentHeads(query);

  console.log('\n=== STEP 5: VERIFYING ALL 7 DEPARTMENTS AFTER FIX ===\n');

  const deptsAfter = await query(`SELECT id, name, code, description FROM departments ORDER BY code`).catch(err => ({ rows: [] }));
  console.log('--- DEPARTMENTS AFTER FIX ---');
  const deptUuidMap = {};
  let allDeptsUnique = true;

  if (deptsAfter.rows) {
    deptsAfter.rows.forEach(d => {
      console.log(`ID: ${d.id} | Code: ${d.code} | Name: ${d.name}`);
      if (deptUuidMap[d.id]) {
        allDeptsUnique = false;
        console.error(`DUPLICATE DEPT UUID FOUND: ${d.id}`);
      }
      deptUuidMap[d.id] = d.code;
    });
  }
  console.log(`Total Departments Count: ${deptsAfter.rows?.length || 0}`);
  console.log(`All Department Primary-Key UUIDs Unique: ${allDeptsUnique}`);

  console.log('\n--- DEPARTMENT HEAD MAPPINGS AFTER FIX ---');
  const dhAfter = await query(`SELECT dh.id, dh.name, dh.email, dh.department_id, d.code as dept_code, d.name as dept_name FROM department_heads dh LEFT JOIN departments d ON CAST(dh.department_id AS TEXT) = CAST(d.id AS TEXT) ORDER BY d.code`).catch(err => ({ rows: [] }));

  if (dhAfter.rows) {
    dhAfter.rows.forEach(h => {
      console.log(`Head: ${h.name.padEnd(16)} | Email: ${h.email.padEnd(32)} | DeptID: ${h.department_id} | Code: ${h.dept_code} | DeptName: ${h.dept_name}`);
    });
  }

  console.log('\n=== STEP 6: VERIFYING MNT STAFF ===\n');
  const mntDept = deptsAfter.rows?.find(d => d.code === 'MNT');
  if (mntDept) {
    const mntStaff = await query(`SELECT id, name, email, employee_id FROM field_staff WHERE CAST(department_id AS TEXT) = ? OR CAST(department_id AS TEXT) = '7'`, [String(mntDept.id)]).catch(err => ({ rows: [] }));
    console.log(`MNT Dept ID (${mntDept.id}) Staff Count: ${mntStaff.rows?.length || 0}`);
    if (mntStaff.rows && mntStaff.rows.length > 0) {
      mntStaff.rows.forEach(s => console.log(`MNT Staff: ${s.name} (${s.email}) | EmpID: ${s.employee_id}`));
    }
  }

  process.exit(0);
}

run();
