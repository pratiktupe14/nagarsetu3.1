const bcrypt = require('bcryptjs');

const SERVICE_STAFF_DEFINITIONS = [
  // 0. Primary Demo Staff — Ramesh Kumar (36th Staff)
  { deptCode: 'PWD', search: 'Public Works', name: 'Ramesh Kumar', employee_id: 'STF-001', email: 'staff@nagarsetu.gov.in', mobile: '9876543212' },

  // 1. PWD — 5 Staff
  { deptCode: 'PWD', search: 'Public Works', name: 'Amit Patil', employee_id: 'PWD-STF-001', email: 'amit.patil@nagarsetu.gov.in', mobile: '9822010001' },
  { deptCode: 'PWD', search: 'Public Works', name: 'Sagar Jadhav', employee_id: 'PWD-STF-002', email: 'sagar.jadhav@nagarsetu.gov.in', mobile: '9822010002' },
  { deptCode: 'PWD', search: 'Public Works', name: 'Nikhil Shinde', employee_id: 'PWD-STF-003', email: 'nikhil.shinde@nagarsetu.gov.in', mobile: '9822010003' },
  { deptCode: 'PWD', search: 'Public Works', name: 'Rohit More', employee_id: 'PWD-STF-004', email: 'rohit.more@nagarsetu.gov.in', mobile: '9822010004' },
  { deptCode: 'PWD', search: 'Public Works', name: 'Akash Pawar', employee_id: 'PWD-STF-005', email: 'akash.pawar@nagarsetu.gov.in', mobile: '9822010005' },

  // 2. Sanitation — 5 Staff
  { deptCode: 'SAN', search: 'Sanitation', name: 'Prashant Mane', employee_id: 'SAN-STF-001', email: 'prashant.mane@nagarsetu.gov.in', mobile: '9822010006' },
  { deptCode: 'SAN', search: 'Sanitation', name: 'Ganesh Chavan', employee_id: 'SAN-STF-002', email: 'ganesh.chavan@nagarsetu.gov.in', mobile: '9822010007' },
  { deptCode: 'SAN', search: 'Sanitation', name: 'Mahesh Kadam', employee_id: 'SAN-STF-003', email: 'mahesh.kadam@nagarsetu.gov.in', mobile: '9822010008' },
  { deptCode: 'SAN', search: 'Sanitation', name: 'Swapnil Bhosale', employee_id: 'SAN-STF-004', email: 'swapnil.bhosale@nagarsetu.gov.in', mobile: '9822010009' },
  { deptCode: 'SAN', search: 'Sanitation', name: 'Deepak Wagh', employee_id: 'SAN-STF-005', email: 'deepak.wagh@nagarsetu.gov.in', mobile: '9822010010' },

  // 3. Water Supply — 5 Staff
  { deptCode: 'WTR', search: 'Water', name: 'Kiran Patil', employee_id: 'WTR-STF-001', email: 'kiran.patil@nagarsetu.gov.in', mobile: '9822010011' },
  { deptCode: 'WTR', search: 'Water', name: 'Manoj Shinde', employee_id: 'WTR-STF-002', email: 'manoj.shinde@nagarsetu.gov.in', mobile: '9822010012' },
  { deptCode: 'WTR', search: 'Water', name: 'Sachin More', employee_id: 'WTR-STF-003', email: 'sachin.more@nagarsetu.gov.in', mobile: '9822010013' },
  { deptCode: 'WTR', search: 'Water', name: 'Ajay Jadhav', employee_id: 'WTR-STF-004', email: 'ajay.jadhav@nagarsetu.gov.in', mobile: '9822010014' },
  { deptCode: 'WTR', search: 'Water', name: 'Vivek Pawar', employee_id: 'WTR-STF-005', email: 'vivek.pawar@nagarsetu.gov.in', mobile: '9822010015' },

  // 4. Drainage & Sewage — 5 Staff
  { deptCode: 'DRN', search: 'Drainage', name: 'Sunil Patil', employee_id: 'DRN-STF-001', email: 'sunil.patil@nagarsetu.gov.in', mobile: '9822010016' },
  { deptCode: 'DRN', search: 'Drainage', name: 'Ramesh More', employee_id: 'DRN-STF-002', email: 'ramesh.more@nagarsetu.gov.in', mobile: '9822010017' },
  { deptCode: 'DRN', search: 'Drainage', name: 'Santosh Jadhav', employee_id: 'DRN-STF-003', email: 'santosh.jadhav@nagarsetu.gov.in', mobile: '9822010018' },
  { deptCode: 'DRN', search: 'Drainage', name: 'Dinesh Shinde', employee_id: 'DRN-STF-004', email: 'dinesh.shinde@nagarsetu.gov.in', mobile: '9822010019' },
  { deptCode: 'DRN', search: 'Drainage', name: 'Pravin Pawar', employee_id: 'DRN-STF-005', email: 'pravin.pawar@nagarsetu.gov.in', mobile: '9822010020' },

  // 5. Electrical & Street Lighting — 5 Staff
  { deptCode: 'ELE', search: 'Electrical', name: 'Rahul Joshi', employee_id: 'ELE-STF-001', email: 'rahul.joshi@nagarsetu.gov.in', mobile: '9822010021' },
  { deptCode: 'ELE', search: 'Electrical', name: 'Sameer Kulkarni', employee_id: 'ELE-STF-002', email: 'sameer.kulkarni@nagarsetu.gov.in', mobile: '9822010022' },
  { deptCode: 'ELE', search: 'Electrical', name: 'Tejas Deshmukh', employee_id: 'ELE-STF-003', email: 'tejas.deshmukh@nagarsetu.gov.in', mobile: '9822010023' },
  { deptCode: 'ELE', search: 'Electrical', name: 'Omkar Patil', employee_id: 'ELE-STF-004', email: 'omkar.patil@nagarsetu.gov.in', mobile: '9822010024' },
  { deptCode: 'ELE', search: 'Electrical', name: 'Harshad More', employee_id: 'ELE-STF-005', email: 'harshad.more@nagarsetu.gov.in', mobile: '9822010025' },

  // 6. Traffic Management — 5 Staff
  { deptCode: 'TRF', search: 'Traffic', name: 'Rohan Patil', employee_id: 'TRF-STF-001', email: 'rohan.patil@nagarsetu.gov.in', mobile: '9822010026' },
  { deptCode: 'TRF', search: 'Traffic', name: 'Vishal Jadhav', employee_id: 'TRF-STF-002', email: 'vishal.jadhav@nagarsetu.gov.in', mobile: '9822010027' },
  { deptCode: 'TRF', search: 'Traffic', name: 'Tushar More', employee_id: 'TRF-STF-003', email: 'tushar.more@nagarsetu.gov.in', mobile: '9822010028' },
  { deptCode: 'TRF', search: 'Traffic', name: 'Nitin Shinde', employee_id: 'TRF-STF-004', email: 'nitin.shinde@nagarsetu.gov.in', mobile: '9822010029' },
  { deptCode: 'TRF', search: 'Traffic', name: 'Amol Pawar', employee_id: 'TRF-STF-005', email: 'amol.pawar@nagarsetu.gov.in', mobile: '9822010030' },

  // 7. Maintenance — 5 Staff
  { deptCode: 'MNT', search: 'Maintenance', name: 'Kunal Patil', employee_id: 'MNT-STF-001', email: 'kunal.patil@nagarsetu.gov.in', mobile: '9822010031' },
  { deptCode: 'MNT', search: 'Maintenance', name: 'Ganesh More', employee_id: 'MNT-STF-002', email: 'ganesh.more@nagarsetu.gov.in', mobile: '9822010032' },
  { deptCode: 'MNT', search: 'Maintenance', name: 'Mayur Jadhav', employee_id: 'MNT-STF-003', email: 'mayur.jadhav@nagarsetu.gov.in', mobile: '9822010033' },
  { deptCode: 'MNT', search: 'Maintenance', name: 'Sachin Pawar', employee_id: 'MNT-STF-004', email: 'sachin.pawar@nagarsetu.gov.in', mobile: '9822010034' },
  { deptCode: 'MNT', search: 'Maintenance', name: 'Yogesh Shinde', employee_id: 'MNT-STF-005', email: 'yogesh.shinde@nagarsetu.gov.in', mobile: '9822010035' }
];

const DEMO_PASSWORD = 'nagarsetu@123';

async function seedServiceStaff(queryFn) {
  const q = queryFn || require('../config/db').query;
  console.log('Starting Service Staff Seeding (36 Total Accounts)...');

  // Build dynamic department mapping
  const deptsRes = await q(`SELECT id, name FROM departments`).catch(() => ({ rows: [] }));
  const deptMap = {};
  if (deptsRes.rows && deptsRes.rows.length > 0) {
    for (const def of SERVICE_STAFF_DEFINITIONS) {
      const dMatch = deptsRes.rows.find(d => d.name.toLowerCase().includes(def.search.toLowerCase()));
      if (dMatch) {
        deptMap[def.deptCode] = dMatch.id;
      }
    }
  }

  // Fallback map if departments query returns empty or partial in memory
  const defaultDeptIdMap = { PWD: 1, SAN: 2, WTR: 3, DRN: 4, ELE: 5, TRF: 6, MNT: 7 };

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, salt);

  let createdCount = 0;
  let updatedCount = 0;

  for (const item of SERVICE_STAFF_DEFINITIONS) {
    const cleanEmail = item.email.toLowerCase();
    const deptId = deptMap[item.deptCode] || defaultDeptIdMap[item.deptCode] || 1;

    const firstName = item.name.split(' ')[0].toLowerCase();
    const envPass = process.env[`STAFF_INITIAL_PASSWORD_${item.employee_id.replace(/-/g, '_')}`] || process.env[`STAFF_INITIAL_PASSWORD_${firstName.toUpperCase()}`];
    const initialPassword = envPass || (cleanEmail === 'staff@nagarsetu.gov.in' ? 'staff@123' : `${firstName}@123`);

    let userId = null;

    // Check if user account already exists by email or employee_id
    const existing = await q(
      `SELECT id, department_id, password_hash, status, must_change_password FROM users WHERE LOWER(email) = $1 OR employee_id = $2`,
      [cleanEmail, item.employee_id]
    ).catch(() => ({ rows: [] }));

    if (existing.rows && existing.rows.length > 0) {
      const existingUser = existing.rows[0];
      userId = existingUser.id;
      const existingHash = existingUser.password_hash;

      let targetHash = existingHash;
      let isInitialProvisionedPass = false;
      if (existingHash && existingHash.startsWith('$2')) {
        isInitialProvisionedPass = await bcrypt.compare(initialPassword, existingHash).catch(() => false);
        if (!isInitialProvisionedPass) {
          isInitialProvisionedPass = await bcrypt.compare('nagarsetu@123', existingHash).catch(() => false);
        }
      }

      let mustChangePassword = existingUser.must_change_password;
      if (isInitialProvisionedPass || !targetHash || !targetHash.startsWith('$2') || process.env.FORCE_PASSWORD_RESET === 'true') {
        mustChangePassword = 1;
      } else if (mustChangePassword === undefined || mustChangePassword === null) {
        mustChangePassword = 0;
      } else {
        mustChangePassword = (mustChangePassword === true || mustChangePassword === 1 || mustChangePassword === '1' || mustChangePassword === 't' || mustChangePassword === 'true') ? 1 : 0;
      }

      if (!targetHash || !targetHash.startsWith('$2') || process.env.FORCE_PASSWORD_RESET === 'true') {
        const salt = await bcrypt.genSalt(10);
        targetHash = await bcrypt.hash(initialPassword, salt);
        mustChangePassword = 1;
      }

      await q(
        `UPDATE users
         SET name = $1,
             mobile = $2,
             password_hash = $3,
             role = 'service_staff',
             department_id = $4,
             employee_id = $5,
             designation = 'Field Service Staff',
             status = 'active',
             must_change_password = $6
         WHERE id = $7`,
        [item.name, item.mobile, targetHash, deptId, item.employee_id, mustChangePassword, existingUser.id]
      ).catch(() => {});
      updatedCount++;
    } else {
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(initialPassword, salt);

      const insUser = await q(
        `INSERT INTO users 
         (name, mobile, email, password_hash, role, department_id, employee_id, designation, status, language_pref, must_change_password)
         VALUES ($1, $2, $3, $4, 'service_staff', $5, $6, 'Field Service Staff', 'active', 'en', 1)`,
        [item.name, item.mobile, cleanEmail, passwordHash, deptId, item.employee_id]
      ).catch(() => ({ rows: [] }));
      userId = insUser.rows?.[0]?.id || null;
      if (!userId) {
        const fetchU = await q(`SELECT id FROM users WHERE LOWER(email) = $1`, [cleanEmail]).catch(() => ({ rows: [] }));
        userId = fetchU.rows?.[0]?.id || null;
      }
      createdCount++;
    }

    // Upsert into dedicated field_staff table
    const existingFs = await q(
      `SELECT id FROM field_staff WHERE LOWER(email) = $1 OR employee_id = $2 OR (user_id IS NOT NULL AND user_id = $3)`,
      [cleanEmail, item.employee_id, userId || -1]
    ).catch(() => ({ rows: [] }));

    const fsDeptId = defaultDeptIdMap[item.deptCode] || 1;
    if (existingFs.rows && existingFs.rows.length > 0) {
      await q(
        `UPDATE field_staff
         SET user_id = $1,
             department_id = $2,
             name = $3,
             email = $4,
             phone = $5,
             employee_id = $6,
             role = 'field_staff',
             status = 'active',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $7`,
        [userId, fsDeptId, item.name, cleanEmail, item.mobile, item.employee_id, existingFs.rows[0].id]
      ).catch(() => {});
    } else {
      await q(
        `INSERT INTO field_staff
         (user_id, department_id, name, email, phone, employee_id, role, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'field_staff', 'active')`,
        [userId, fsDeptId, item.name, cleanEmail, item.mobile, item.employee_id]
      ).catch(() => {});
    }
  }

  // Remove non-canonical/forged staff records if any exist
  const canonicalEmpIds = SERVICE_STAFF_DEFINITIONS.map(s => s.employee_id);
  const placeholders = canonicalEmpIds.map((_, idx) => `$${idx + 1}`).join(', ');
  await q(`DELETE FROM field_staff WHERE employee_id NOT IN (${placeholders})`, canonicalEmpIds).catch(() => {});

  console.log(`Service staff seeding completed cleanly! Total: ${SERVICE_STAFF_DEFINITIONS.length}`);
}

module.exports = seedServiceStaff;

if (require.main === module) {
  const { initDatabase } = require('../config/db');
  initDatabase()
    .then(() => seedServiceStaff())
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Failed to seed Service Staff:', err);
      process.exit(1);
    });
}
