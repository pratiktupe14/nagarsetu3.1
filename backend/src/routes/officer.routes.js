const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const validateInput = require('../middleware/validateInput');
const { officerDashboardSchema, verifyComplaintSchema, assignStaffSchema } = require('../schemas/officer.schemas');
const { query } = require('../config/db');
const { notifyStatusChange } = require('../services/notificationService');

// Officer Auth Guard
router.use(authenticateToken);
router.use(requireRole(['officer', 'admin', 'city_admin', 'department_head']));

// Command Center Dashboard Complaints list with filters
router.get(['/dashboard', '/complaints'], validateInput(officerDashboardSchema), async (req, res) => {
  try {
    const { department_id, priority, status, search } = req.query;

    let sql = `
      SELECT c.*, d.name as department_name,
             COALESCE(p.full_name, u.name) as citizen_name,
             COALESCE(p.mobile, u.mobile) as citizen_mobile
       FROM complaints c
       LEFT JOIN departments d ON (CAST(c.department_id AS TEXT) = CAST(d.id AS TEXT) OR CAST(c.department_id AS TEXT) = d.code)
       LEFT JOIN profiles p ON CAST(c.citizen_id AS TEXT) = CAST(p.id AS TEXT)
       LEFT JOIN users u ON CAST(c.citizen_id AS TEXT) = CAST(u.id AS TEXT) OR (p.mobile IS NOT NULL AND u.mobile = p.mobile)
       WHERE 1=1
    `;
    const params = [];

    let targetDeptId = department_id;

    if (req.user.role === 'department_head') {
      if (req.user.department_id) {
        targetDeptId = req.user.department_id;
      } else {
        const dhRes = await query(
          `SELECT department_id FROM department_heads WHERE (user_id = ? OR LOWER(email) = ?) AND status = 'active' ORDER BY id DESC LIMIT 1`,
          [req.user.id, (req.user.email || '').toLowerCase()]
        );
        if (dhRes.rows && dhRes.rows.length > 0) {
          targetDeptId = dhRes.rows[0].department_id;
        }
      }
    }

    if (targetDeptId) {
      sql += ` AND (
        CAST(c.department_id AS TEXT) = ? 
        OR UPPER(d.code) = UPPER(?)
      )`;
      params.push(String(targetDeptId), String(targetDeptId));
    }
    if (priority) {
      sql += ` AND c.priority = ?`;
      params.push(priority);
    }
    if (status) {
      sql += ` AND c.status = ?`;
      params.push(status);
    }
    if (search) {
      sql += ` AND (c.title LIKE ? OR c.category LIKE ? OR c.description LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY c.created_at DESC`;

    const result = await query(sql, params);
    return res.json({ complaints: result.rows });
  } catch (err) {
    console.error('Officer dashboard error:', err);
    return res.status(500).json({ error: 'Failed to fetch dashboard complaints' });
  }
});


// Get available field staff for assignment (Only Active staff of user's department)
router.get('/staff-list', async (req, res) => {
  try {
    let sql = `
      SELECT fs.id, fs.user_id, fs.name, fs.phone as mobile, fs.email, fs.employee_id, fs.department_id, d.name as department_name, d.code as department_code
      FROM field_staff fs
      LEFT JOIN departments d ON (
        CAST(fs.department_id AS TEXT) = CAST(d.id AS TEXT) 
        OR UPPER(CAST(fs.department_id AS TEXT)) = UPPER(d.code)
      )
      WHERE LOWER(COALESCE(fs.status, 'active')) = 'active'
    `;
    const params = [];

    if (req.user.role === 'department_head') {
      let targetDeptId = req.user.department_id;
      if (!targetDeptId) {
        const dhRes = await query(
          `SELECT department_id FROM department_heads WHERE (user_id = ? OR LOWER(email) = ?) AND status = 'active' ORDER BY id DESC LIMIT 1`,
          [req.user.id, (req.user.email || '').toLowerCase()]
        );
        if (dhRes.rows && dhRes.rows.length > 0) {
          targetDeptId = dhRes.rows[0].department_id;
        }
      }
      if (targetDeptId) {
        sql += ` AND (
          CAST(fs.department_id AS TEXT) = ?
          OR (d.id IS NOT NULL AND CAST(d.id AS TEXT) = ?)
          OR (d.code IS NOT NULL AND UPPER(d.code) = UPPER(?))
        )`;
        params.push(String(targetDeptId), String(targetDeptId), String(targetDeptId));
      }
    }

    sql += ` ORDER BY fs.name ASC`;

    const result = await query(sql, params);
    return res.json({ staff: result.rows });
  } catch (err) {
    console.error('Fetch staff list error:', err);
    return res.status(500).json({ error: 'Failed to fetch staff members' });
  }
});

// Helper: Check department matching
const isDeptMatch = (deptA, deptB, empId = '') => {
  if (!deptA || !deptB) return true;
  if (String(deptA) === String(deptB)) return true;
  const pwdGroup = ['1', 'PWD'];
  const sanGroup = ['2', 'SAN'];
  const wtrGroup = ['3', 'WTR'];
  const drnGroup = ['4', 'DRN'];
  const eleGroup = ['5', 'ELE'];
  const trfGroup = ['6', 'TRF'];
  const mntGroup = ['7', 'MNT'];
  for (const g of [pwdGroup, sanGroup, wtrGroup, drnGroup, eleGroup, trfGroup, mntGroup]) {
    if (g.includes(String(deptA)) && (g.includes(String(deptB)) || (empId && empId.startsWith(g[2])))) return true;
  }
  return false;
};

// Verify & Approve / Reject Complaint
router.post('/verify', validateInput(verifyComplaintSchema), async (req, res) => {
  try {
    const { complaint_id, action, rejection_reason, corrected_category, corrected_department_id } = req.body;

    const compRes = await query(`SELECT id, citizen_id, category, department_id FROM complaints WHERE CAST(id AS TEXT) = ? OR complaint_number = ?`, [String(complaint_id), String(complaint_id)]);
    if (!compRes.rows || compRes.rows.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }
    const complaint = compRes.rows[0];
    const citizenId = complaint.citizen_id;
    const canonicalId = String(complaint.id);

    // Department Authorization check
    const userRole = req.user.role || 'citizen';
    const isAdmin = ['admin', 'city_admin'].includes(userRole);
    if (!isAdmin) {
      let userDeptId = req.user.department_id;
      if (userRole === 'department_head' && !userDeptId) {
        const dhRes = await query(
          `SELECT department_id FROM department_heads WHERE (CAST(user_id AS TEXT) = ? OR LOWER(email) = ?) AND status = 'active' ORDER BY id DESC LIMIT 1`,
          [String(req.user.id || ''), (req.user.email || '').toLowerCase()]
        );
        if (dhRes.rows && dhRes.rows.length > 0) userDeptId = dhRes.rows[0].department_id;
      }
      if (userDeptId && complaint.department_id && !isDeptMatch(userDeptId, complaint.department_id)) {
        return res.status(403).json({ error: 'Forbidden: You cannot verify complaints outside your department.' });
      }
    }

    if (action === 'approve') {
      let updateSql = `UPDATE complaints SET status = 'Verified', needs_manual_verification = 0, updated_at = CURRENT_TIMESTAMP`;
      const updateParams = [];

      if (corrected_category) {
        updateSql += `, category = ?`;
        updateParams.push(corrected_category);
      }
      if (corrected_department_id) {
        updateSql += `, department_id = ?`;
        updateParams.push(corrected_department_id);
      }

      updateSql += ` WHERE CAST(id AS TEXT) = ? OR complaint_number = ?`;
      updateParams.push(canonicalId, canonicalId);

      await query(updateSql, updateParams);

      const remarkText = (corrected_category || corrected_department_id)
        ? `Complaint verified and approved with officer corrections (Category: ${corrected_category || complaint.category}).`
        : 'Complaint verified and approved by municipal officer.';

      await query(
        `INSERT INTO complaint_status_history (complaint_id, status, remark, department, updated_by) VALUES (?, ?, ?, ?, ?)`,
        [canonicalId, 'Verified', remarkText, 'Municipal Review', req.user.name || 'Municipal Officer']
      ).catch(() => {});

      await notifyStatusChange(canonicalId, 'Verified', citizenId);
      return res.json({ message: 'Complaint verified and approved', verified: true });
    } else if (action === 'reject') {
      await query(`UPDATE complaints SET status = 'Rejected', updated_at = CURRENT_TIMESTAMP WHERE CAST(id AS TEXT) = ? OR complaint_number = ?`, [canonicalId, canonicalId]);
      await query(
        `INSERT INTO complaint_status_history (complaint_id, status, remark, department, updated_by) VALUES (?, ?, ?, ?, ?)`,
        [canonicalId, 'Rejected', rejection_reason || 'Does not meet municipal criteria.', 'Municipal Review', req.user.name || 'Municipal Officer']
      ).catch(() => {});
      await notifyStatusChange(canonicalId, 'Rejected', citizenId, rejection_reason);
      return res.json({ message: 'Complaint rejected' });
    }

    return res.status(400).json({ error: 'Invalid action type' });
  } catch (err) {
    console.error('Officer verify error:', err);
    return res.status(500).json({ error: 'Failed to process verification' });
  }
});

// Assign complaint to staff member
router.post('/assign', validateInput(assignStaffSchema), async (req, res) => {
  try {
    const { complaint_id, staff_id } = req.body;

    const compRes = await query(`SELECT id, citizen_id, department_id FROM complaints WHERE CAST(id AS TEXT) = ? OR complaint_number = ?`, [String(complaint_id), String(complaint_id)]);
    if (!compRes.rows || compRes.rows.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }
    const complaint = compRes.rows[0];

    const staffRes = await query(
      `SELECT fs.id, fs.user_id, fs.name, fs.email, fs.phone as mobile, fs.department_id, fs.employee_id, fs.status 
       FROM field_staff fs 
       WHERE CAST(fs.id AS TEXT) = ? OR CAST(fs.user_id AS TEXT) = ? OR fs.employee_id = ? OR LOWER(fs.email) = LOWER(?)`,
      [String(staff_id), String(staff_id), String(staff_id), String(staff_id)]
    );
    let staff = staffRes.rows && staffRes.rows.length > 0 ? staffRes.rows[0] : null;
    if (!staff) {
      const uRes = await query(
        `SELECT id, name, email, mobile, department_id, employee_id, status 
         FROM users 
         WHERE (CAST(id AS TEXT) = ? OR employee_id = ? OR LOWER(email) = LOWER(?) OR LOWER(name) = LOWER(?)) 
           AND (role = 'service_staff' OR role = 'staff' OR role = 'field_staff')`,
        [String(staff_id), String(staff_id), String(staff_id), String(staff_id)]
      );
      if (uRes.rows && uRes.rows.length > 0) staff = uRes.rows[0];
    }

    if (!staff) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    if ((staff.status || 'active').toLowerCase() !== 'active') {
      return res.status(400).json({ error: `Cannot assign task: Staff member '${staff.name}' is currently inactive.` });
    }

    // Department Authorization check
    const userRole = req.user.role || 'citizen';
    const isAdmin = ['admin', 'city_admin'].includes(userRole);

    if (!isAdmin) {
      let userDeptId = req.user.department_id;
      if (userRole === 'department_head' && !userDeptId) {
        const dhRes = await query(`SELECT department_id FROM department_heads WHERE (user_id = ? OR LOWER(email) = ?) AND status = 'active' ORDER BY id DESC LIMIT 1`, [req.user.id, (req.user.email || '').toLowerCase()]);
        if (dhRes.rows && dhRes.rows.length > 0) userDeptId = dhRes.rows[0].department_id;
      }
      if (userDeptId && complaint.department_id && !isDeptMatch(userDeptId, complaint.department_id)) {
        return res.status(403).json({ error: 'Forbidden: You cannot assign complaints outside your department.' });
      }
      if (userDeptId && staff.department_id && !isDeptMatch(userDeptId, staff.department_id, staff.employee_id)) {
        return res.status(403).json({ error: 'Forbidden: You cannot assign staff members belonging to another department.' });
      }
    }

    const assignedStaffId = String(staff.id || staff.user_id);
    const assignedStaffEmail = staff.email || '';

    // Record assignment
    try {
      const assignSql = `
        INSERT INTO assignments (complaint_id, staff_id, assigned_by, assigned_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      `;
      await query(assignSql, [String(complaint_id), String(staff.user_id || staff.id), String(req.user.id)]);
    } catch (aErr) {
      console.warn('[OFFICER ASSIGNMENTS INSERT WARN]', aErr.message);
    }

    // Update complaint status & assigned staff fields
    const isUuid = (val) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(val));
    const safeAssignedBy = isUuid(req.user.id) ? req.user.id : null;

    let updateSql = `
      UPDATE complaints 
      SET status = 'Staff Assigned',
          assigned_staff_id = ?,
          assigned_staff_name = ?,
          assigned_staff_email = ?,
          assigned_by = ?,
          assigned_by_name = ?,
          updated_at = CURRENT_TIMESTAMP 
      WHERE CAST(id AS TEXT) = ? OR complaint_number = ?
    `;
    try {
      await query(updateSql, [assignedStaffId, staff.name, assignedStaffEmail, safeAssignedBy, req.user.name || 'Municipal Officer', String(complaint_id), String(complaint_id)]);
    } catch (uErr) {
      const fallbackSql = `
        UPDATE complaints 
        SET status = 'Staff Assigned',
            assigned_staff_id = ?,
            assigned_staff_name = ?,
            assigned_staff_email = ?,
            assigned_by_name = ?,
            updated_at = CURRENT_TIMESTAMP 
        WHERE CAST(id AS TEXT) = ? OR complaint_number = ?
      `;
      await query(fallbackSql, [assignedStaffId, staff.name, assignedStaffEmail, req.user.name || 'Municipal Officer', String(complaint_id), String(complaint_id)]);
    }

    // Record status history
    try {
      await query(
        `INSERT INTO complaint_status_history (complaint_id, status, remark, department, updated_by) VALUES (?, ?, ?, ?, ?)`,
        [String(complaint_id), 'Staff Assigned', `Assigned to field staff ${staff.name}.`, 'Department Operations', req.user.name || 'Municipal Officer']
      );
    } catch (hErr) {}

    // Trigger Notification
    await notifyStatusChange(complaint.id || complaint_id, 'Staff Assigned', complaint.citizen_id).catch(nErr => console.warn('[NOTIF WARN]', nErr.message));

    return res.json({ success: true, message: 'Complaint assigned to field staff successfully' });
  } catch (err) {
    console.error('Officer assign error:', err);
    return res.status(500).json({ error: 'Failed to assign complaint', details: err?.message || String(err) });
  }
});

// List duplicate complaints
router.get('/duplicates', async (req, res) => {
  try {
    const sql = `
      SELECT c.*, d.name as department_name, orig.title as original_title
      FROM complaints c
      LEFT JOIN departments d ON (CAST(c.department_id AS TEXT) = CAST(d.id AS TEXT) OR CAST(c.department_id AS TEXT) = d.code)
      INNER JOIN complaints orig ON CAST(c.duplicate_of_id AS TEXT) = CAST(orig.id AS TEXT)
      ORDER BY c.created_at DESC
    `;
    const result = await query(sql);
    return res.json({ duplicates: result.rows });
  } catch (err) {
    console.error('Duplicates list error:', err);
    return res.status(500).json({ error: 'Failed to fetch duplicates' });
  }
});

module.exports = router;
