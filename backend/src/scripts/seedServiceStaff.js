const bcrypt = require('bcryptjs');
const { query, initDatabase } = require('../config/db');

const SERVICE_STAFF_DEFINITIONS = [
  // 1. PWD — 5 Staff
  { deptId: 1, name: 'Amit Patil', employee_id: 'PWD-STF-001', email: 'amit.patil@nagarsetu.gov.in', mobile: '9822010001' },
  { deptId: 1, name: 'Sagar Jadhav', employee_id: 'PWD-STF-002', email: 'sagar.jadhav@nagarsetu.gov.in', mobile: '9822010002' },
  { deptId: 1, name: 'Nikhil Shinde', employee_id: 'PWD-STF-003', email: 'nikhil.shinde@nagarsetu.gov.in', mobile: '9822010003' },
  { deptId: 1, name: 'Rohit More', employee_id: 'PWD-STF-004', email: 'rohit.more@nagarsetu.gov.in', mobile: '9822010004' },
  { deptId: 1, name: 'Akash Pawar', employee_id: 'PWD-STF-005', email: 'akash.pawar@nagarsetu.gov.in', mobile: '9822010005' },

  // 2. Sanitation — 5 Staff
  { deptId: 2, name: 'Prashant Mane', employee_id: 'SAN-STF-001', email: 'prashant.mane@nagarsetu.gov.in', mobile: '9822010006' },
  { deptId: 2, name: 'Ganesh Chavan', employee_id: 'SAN-STF-002', email: 'ganesh.chavan@nagarsetu.gov.in', mobile: '9822010007' },
  { deptId: 2, name: 'Mahesh Kadam', employee_id: 'SAN-STF-003', email: 'mahesh.kadam@nagarsetu.gov.in', mobile: '9822010008' },
  { deptId: 2, name: 'Swapnil Bhosale', employee_id: 'SAN-STF-004', email: 'swapnil.bhosale@nagarsetu.gov.in', mobile: '9822010009' },
  { deptId: 2, name: 'Deepak Wagh', employee_id: 'SAN-STF-005', email: 'deepak.wagh@nagarsetu.gov.in', mobile: '9822010010' },

  // 3. Water Supply — 5 Staff
  { deptId: 3, name: 'Kiran Patil', employee_id: 'WTR-STF-001', email: 'kiran.patil@nagarsetu.gov.in', mobile: '9822010011' },
  { deptId: 3, name: 'Manoj Shinde', employee_id: 'WTR-STF-002', email: 'manoj.shinde@nagarsetu.gov.in', mobile: '9822010012' },
  { deptId: 3, name: 'Sachin More', employee_id: 'WTR-STF-003', email: 'sachin.more@nagarsetu.gov.in', mobile: '9822010013' },
  { deptId: 3, name: 'Ajay Jadhav', employee_id: 'WTR-STF-004', email: 'ajay.jadhav@nagarsetu.gov.in', mobile: '9822010014' },
  { deptId: 3, name: 'Vivek Pawar', employee_id: 'WTR-STF-005', email: 'vivek.pawar@nagarsetu.gov.in', mobile: '9822010015' },

  // 4. Drainage & Sewage — 5 Staff
  { deptId: 4, name: 'Sunil Patil', employee_id: 'DRN-STF-001', email: 'sunil.patil@nagarsetu.gov.in', mobile: '9822010016' },
  { deptId: 4, name: 'Ramesh More', employee_id: 'DRN-STF-002', email: 'ramesh.more@nagarsetu.gov.in', mobile: '9822010017' },
  { deptId: 4, name: 'Santosh Jadhav', employee_id: 'DRN-STF-003', email: 'santosh.jadhav@nagarsetu.gov.in', mobile: '9822010018' },
  { deptId: 4, name: 'Dinesh Shinde', employee_id: 'DRN-STF-004', email: 'dinesh.shinde@nagarsetu.gov.in', mobile: '9822010019' },
  { deptId: 4, name: 'Pravin Pawar', employee_id: 'DRN-STF-005', email: 'pravin.pawar@nagarsetu.gov.in', mobile: '9822010020' },

  // 5. Electrical & Street Lighting — 5 Staff
  { deptId: 5, name: 'Rahul Joshi', employee_id: 'ELE-STF-001', email: 'rahul.joshi@nagarsetu.gov.in', mobile: '9822010021' },
  { deptId: 5, name: 'Sameer Kulkarni', employee_id: 'ELE-STF-002', email: 'sameer.kulkarni@nagarsetu.gov.in', mobile: '9822010022' },
  { deptId: 5, name: 'Tejas Deshmukh', employee_id: 'ELE-STF-003', email: 'tejas.deshmukh@nagarsetu.gov.in', mobile: '9822010023' },
  { deptId: 5, name: 'Omkar Patil', employee_id: 'ELE-STF-004', email: 'omkar.patil@nagarsetu.gov.in', mobile: '9822010024' },
  { deptId: 5, name: 'Harshad More', employee_id: 'ELE-STF-005', email: 'harshad.more@nagarsetu.gov.in', mobile: '9822010025' },

  // 6. Traffic Management — 5 Staff
  { deptId: 6, name: 'Rohan Patil', employee_id: 'TRF-STF-001', email: 'rohan.patil@nagarsetu.gov.in', mobile: '9822010026' },
  { deptId: 6, name: 'Vishal Jadhav', employee_id: 'TRF-STF-002', email: 'vishal.jadhav@nagarsetu.gov.in', mobile: '9822010027' },
  { deptId: 6, name: 'Tushar More', employee_id: 'TRF-STF-003', email: 'tushar.more@nagarsetu.gov.in', mobile: '9822010028' },
  { deptId: 6, name: 'Nitin Shinde', employee_id: 'TRF-STF-004', email: 'nitin.shinde@nagarsetu.gov.in', mobile: '9822010029' },
  { deptId: 6, name: 'Amol Pawar', employee_id: 'TRF-STF-005', email: 'amol.pawar@nagarsetu.gov.in', mobile: '9822010030' },

  // 7. Maintenance — 5 Staff
  { deptId: 7, name: 'Kunal Patil', employee_id: 'MNT-STF-001', email: 'kunal.patil@nagarsetu.gov.in', mobile: '9822010031' },
  { deptId: 7, name: 'Ganesh More', employee_id: 'MNT-STF-002', email: 'ganesh.more@nagarsetu.gov.in', mobile: '9822010032' },
  { deptId: 7, name: 'Mayur Jadhav', employee_id: 'MNT-STF-003', email: 'mayur.jadhav@nagarsetu.gov.in', mobile: '9822010033' },
  { deptId: 7, name: 'Sachin Pawar', employee_id: 'MNT-STF-004', email: 'sachin.pawar@nagarsetu.gov.in', mobile: '9822010034' },
  { deptId: 7, name: 'Yogesh Shinde', employee_id: 'MNT-STF-005', email: 'yogesh.shinde@nagarsetu.gov.in', mobile: '9822010035' }
];

const DEMO_PASSWORD = 'nagarsetu@123';

async function seedServiceStaff() {
  await initDatabase();
  console.log('Starting Service Staff Seeding (35 Total Accounts)...');

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, salt);

  let createdCount = 0;
  let updatedCount = 0;

  for (const item of SERVICE_STAFF_DEFINITIONS) {
    const cleanEmail = item.email.toLowerCase();

    // Check if account already exists by email or employee_id
    const existing = await query(
      `SELECT id, department_id, status FROM users WHERE LOWER(email) = $1 OR employee_id = $2`,
      [cleanEmail, item.employee_id]
    );

    if (existing.rows && existing.rows.length > 0) {
      const existingUser = existing.rows[0];
      // Update department, password, role, status to active
      await query(
        `UPDATE users
         SET name = $1,
             mobile = $2,
             password_hash = $3,
             role = 'service_staff',
             department_id = $4,
             employee_id = $5,
             designation = 'Field Service Staff',
             status = 'active'
         WHERE id = $6`,
        [item.name, item.mobile, passwordHash, item.deptId, item.employee_id, existingUser.id]
      );
      updatedCount++;
      console.log(`Updated staff: ${item.name} (${item.employee_id}) -> Dept ${item.deptId}`);
    } else {
      // Insert new user
      await query(
        `INSERT INTO users 
         (name, mobile, email, password_hash, role, department_id, employee_id, designation, status, language_pref)
         VALUES ($1, $2, $3, $4, 'service_staff', $5, $6, 'Field Service Staff', 'active', 'en')`,
        [item.name, item.mobile, cleanEmail, passwordHash, item.deptId, item.employee_id]
      );
      createdCount++;
      console.log(`Created staff: ${item.name} (${item.employee_id}) -> Dept ${item.deptId}`);
    }
  }

  // Summary per department verification
  console.log('\n--- VERIFICATION OF SERVICE STAFF COUNTS PER DEPARTMENT ---');
  for (let d = 1; d <= 7; d++) {
    const res = await query(
      `SELECT COUNT(*) as count FROM users WHERE (role = 'service_staff' OR role = 'staff') AND department_id = $1 AND LOWER(COALESCE(status, 'active')) = 'active'`,
      [d]
    );
    const deptNameRes = await query(`SELECT name FROM departments WHERE id = $1`, [d]);
    const deptName = deptNameRes.rows[0]?.name || `Dept ${d}`;
    console.log(`Dept ${d} (${deptName}): ${res.rows[0].count} Active Staff`);
  }

  console.log(`\nSeeding completed cleanly! Created: ${createdCount}, Updated: ${updatedCount}`);
  process.exit(0);
}

seedServiceStaff().catch((err) => {
  console.error('Failed to seed Service Staff:', err);
  process.exit(1);
});
