const bcrypt = require('bcryptjs');
const { query } = require('../config/db');

const OFFICIAL_DEPARTMENTS = [
  {
    code: 'PWD',
    name: 'Public Works Department',
    searchTerms: ['Public Works Department', 'Public Works', 'PWD'],
    description: 'Asphalt road repairs, pothole filling, sidewalk paving, and structural civic infrastructure maintenance.',
    headName: 'Rahul Kumar',
    email: 'rahul.kumar@nagarsetu.gov.in',
    mobile: '9822000001',
    employeeId: 'EMP-PWD-001'
  },
  {
    code: 'SAN',
    name: 'Sanitation & Waste Management',
    searchTerms: ['Sanitation & Waste Management', 'Sanitation & Solid Waste Management', 'Sanitation'],
    description: 'Solid waste collection, dumpster clearing, street sweeping, market sanitation, and public hygiene.',
    headName: 'Amit Sharma',
    email: 'amit.sharma@nagarsetu.gov.in',
    mobile: '9822000002',
    employeeId: 'EMP-SAN-001'
  },
  {
    code: 'WTR',
    name: 'Water Supply & Sewerage Board',
    searchTerms: ['Water Supply & Sewerage Board', 'Water Supply'],
    description: 'Potable water mains, underground pipeline leakage sealing, valve control, and water network maintenance.',
    headName: 'Vikram Patil',
    email: 'vikram.patil@nagarsetu.gov.in',
    mobile: '9822000003',
    employeeId: 'EMP-WTR-001'
  },
  {
    code: 'DRN',
    name: 'Drainage & Sewage Department',
    searchTerms: ['Drainage & Sewage Department', 'Drainage & Sewerage Department', 'Drainage Department'],
    description: 'Drainage blockage, sewage overflow, open drains, culverts, and storm channels.',
    headName: 'Sanjay More',
    email: 'sanjay.more@nagarsetu.gov.in',
    mobile: '9822000004',
    employeeId: 'EMP-DRN-001'
  },
  {
    code: 'ELE',
    name: 'Electrical & Street Lighting',
    searchTerms: ['Electrical & Street Lighting', 'Electrical & Lighting Department', 'Electrical Department'],
    description: 'Streetlight repair, electrical poles, transformer inspection, and public lighting.',
    headName: 'Aditya Joshi',
    email: 'aditya.joshi@nagarsetu.gov.in',
    mobile: '9822000005',
    employeeId: 'EMP-ELE-001'
  },
  {
    code: 'TRF',
    name: 'Traffic Management Department',
    searchTerms: ['Traffic Management Department', 'Traffic Management'],
    description: 'Traffic signal repairs, road signage, lane markings, and junction safety.',
    headName: 'Rohan Deshmukh',
    email: 'rohan.deshmukh@nagarsetu.gov.in',
    mobile: '9822000006',
    employeeId: 'EMP-TRF-001'
  },
  {
    code: 'MNT',
    name: 'Maintenance Department',
    searchTerms: ['Maintenance Department', 'Building Maintenance'],
    description: 'General civic facility repairs, building maintenance, public park upkeep, and municipal asset management.',
    headName: 'Kunal Kulkarni',
    email: 'kunal.kulkarni@nagarsetu.gov.in',
    mobile: '9822000007',
    employeeId: 'EMP-MNT-001'
  }
];

const DEMO_PASSWORD = 'nagarsetu@123';
const OFFICIAL_EMAILS = OFFICIAL_DEPARTMENTS.map((d) => d.email.toLowerCase());

async function seed7DemoDepartmentHeads() {
  console.log('=======================================================');
  console.log('  Synchronizing 7 Active Department Heads for NAGARSETU ');
  console.log('=======================================================');

  try {
    // 1. Ensure all 7 official departments exist in DB
    const deptIdMap = {};

    for (const dMeta of OFFICIAL_DEPARTMENTS) {
      let deptId = null;

      // Search by NAME first (strict match on terms)
      for (const term of dMeta.searchTerms) {
        const findRes = await query(
          `SELECT id, name FROM departments WHERE name LIKE ? LIMIT 1`,
          [`%${term}%`]
        );
        if (findRes.rows && findRes.rows.length > 0) {
          deptId = findRes.rows[0].id;
          break;
        }
      }

      // If not found by name, insert department
      if (!deptId) {
        const insRes = await query(
          `INSERT INTO departments (name, description) VALUES (?, ?)`,
          [dMeta.name, dMeta.description]
        );
        deptId = insRes.rows[0].id;
        console.log(`Created department: '${dMeta.name}' (ID: ${deptId})`);
      } else {
        // Update department name and description to match official standard
        await query(
          `UPDATE departments SET name = ?, description = ? WHERE id = ?`,
          [dMeta.name, dMeta.description, deptId]
        );
      }

      deptIdMap[dMeta.code] = deptId;
    }

    // 2. Seed 7 official active Department Heads idempotently (preserving existing user-created heads)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, salt);

    for (const dMeta of OFFICIAL_DEPARTMENTS) {
      const cleanEmail = dMeta.email.toLowerCase();
      const targetDeptId = deptIdMap[dMeta.code];

      // Check if an active department head ALREADY exists for targetDeptId in department_heads
      const existingActiveHead = await query(
        `SELECT id, name, email FROM department_heads WHERE department_id = ? AND status = 'active' LIMIT 1`,
        [targetDeptId]
      );

      // If an active head already exists for this department in the DB, DO NOT OVERWRITE IT AT ALL!
      if (existingActiveHead.rows && existingActiveHead.rows.length > 0) {
        console.log(`✓ Preserved existing Active Head for ${dMeta.code} (${dMeta.name}) -> ${existingActiveHead.rows[0].name} (${existingActiveHead.rows[0].email})`);
        continue;
      }

      // Check users table for default account
      const userCheck = await query(`SELECT id, email FROM users WHERE LOWER(email) = ? OR mobile = ?`, [cleanEmail, dMeta.mobile]);
      let userId = null;

      if (userCheck.rows && userCheck.rows.length > 0) {
        userId = userCheck.rows[0].id;
        await query(
          `UPDATE users SET name = ?, mobile = ?, email = ?, password_hash = ?, role = 'department_head', department_id = ?, employee_id = ?, status = 'active' WHERE id = ?`,
          [dMeta.headName, dMeta.mobile, cleanEmail, passwordHash, targetDeptId, dMeta.employeeId, userId]
        );
      } else {
        const insUser = await query(
          `INSERT INTO users (name, mobile, email, password_hash, role, department_id, employee_id, status) VALUES (?, ?, ?, ?, 'department_head', ?, ?, 'active')`,
          [dMeta.headName, dMeta.mobile, cleanEmail, passwordHash, targetDeptId, dMeta.employeeId]
        );
        userId = insUser.rows[0].id;
      }

      // Upsert department_heads record as active
      const dhCheck = await query(
        `SELECT id FROM department_heads WHERE user_id = ? OR LOWER(email) = ?`,
        [userId, cleanEmail]
      );

      if (dhCheck.rows && dhCheck.rows.length > 0) {
        await query(
          `UPDATE department_heads SET user_id = ?, department_id = ?, name = ?, email = ?, phone = ?, employee_id = ?, designation = 'Department Head', status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
          [userId, targetDeptId, dMeta.headName, cleanEmail, `+91 ${dMeta.mobile}`, dMeta.employeeId, dhCheck.rows[0].id]
        );
      } else {
        await query(
          `INSERT INTO department_heads (user_id, department_id, name, email, phone, employee_id, designation, status) VALUES (?, ?, ?, ?, ?, ?, 'Department Head', 'active')`,
          [userId, targetDeptId, dMeta.headName, cleanEmail, `+91 ${dMeta.mobile}`, dMeta.employeeId]
        );
      }

      console.log(`✓ Active Head set for ${dMeta.code} (${dMeta.name}) -> ${dMeta.headName} (${dMeta.email})`);
    }

    console.log('=======================================================');
    console.log('  All 7 Active Department Heads Successfully Seeded!  ');
    console.log('=======================================================');
    return true;
  } catch (err) {
    console.error('Error seeding 7 demo department heads:', err);
    return false;
  }
}

module.exports = seed7DemoDepartmentHeads;
