const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

/**
 * Helper: Resolve department ID and Name for current user
 */
async function resolveUserDepartment(req) {
  let userDeptId = req.user.department_id || null;
  let userDeptName = req.user.department_name || '';

  if (!userDeptId || !userDeptName) {
    const uRes = await query('SELECT department_id, role FROM users WHERE id = $1 OR email = $2', [req.user.id, req.user.email]);
    if (uRes.rows.length > 0) {
      userDeptId = uRes.rows[0].department_id || userDeptId;
    }

    const dhRes = await query(
      `SELECT dh.department_id, d.name as department_name 
       FROM department_heads dh 
       LEFT JOIN departments d ON d.id = dh.department_id 
       WHERE dh.user_id = $1 OR dh.email = $2`,
      [req.user.id, req.user.email]
    );
    if (dhRes.rows.length > 0) {
      userDeptId = dhRes.rows[0].department_id || userDeptId;
      userDeptName = dhRes.rows[0].department_name || userDeptName;
    }
  }

  return { userDeptId, userDeptName };
}

// Public or authenticated list of municipal departments
router.get('/', async (req, res) => {
  try {
    const result = await query(`SELECT * FROM departments ORDER BY id ASC`);
    return res.json({ departments: result.rows });
  } catch (err) {
    console.error('Fetch departments error:', err);
    return res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

/**
 * GET /api/department/staff
 * Fetch service staff for authenticated Department Head (or all for Admin)
 */
router.get('/staff', authenticateToken, requireRole(['department_head', 'admin', 'city_admin']), async (req, res) => {
  try {
    const { userDeptId, userDeptName } = await resolveUserDepartment(req);
    const userRole = req.user.role || 'citizen';
    const isAdmin = ['admin', 'city_admin'].includes(userRole);
    const filterStatus = (req.query.status || 'all').toLowerCase();
    const searchQuery = (req.query.search || '').toLowerCase().trim();

    let sql = `
      SELECT u.id, u.name, u.email, u.mobile, u.employee_id, u.role, u.department_id,
             COALESCE(u.designation, 'Field Service Staff') as designation,
             COALESCE(u.status, 'active') as status,
             u.language_pref, u.created_at,
             d.name as department_name,
             (
               SELECT COUNT(DISTINCT a.id)
               FROM assignments a
               JOIN complaints c ON c.id = a.complaint_id
               WHERE a.staff_id = u.id AND c.status IN ('Assigned', 'In Progress', 'Verified')
             ) as active_tasks,
             (
               SELECT COUNT(DISTINCT a.id)
               FROM assignments a
               JOIN complaints c ON c.id = a.complaint_id
               WHERE a.staff_id = u.id AND c.status = 'Resolved'
             ) as completed_tasks,
             (
               SELECT COUNT(DISTINCT a.id)
               FROM assignments a
               JOIN complaints c ON c.id = a.complaint_id
               WHERE a.staff_id = u.id AND c.status = 'Overdue'
             ) as overdue_tasks
      FROM users u
      LEFT JOIN departments d ON u.department_id = d.id
      WHERE (u.role = 'service_staff' OR u.role = 'staff')
    `;

    const params = [];

    // Department Isolation for Department Head
    if (!isAdmin) {
      sql += ` AND u.department_id = $1`;
      params.push(userDeptId || -1);
    } else if (req.query.department_id) {
      let deptFilterId = req.query.department_id;
      const codeToIdMap = {
        PWD: 1, 'DEPT-1': 1,
        SAN: 2, 'DEPT-2': 2,
        WTR: 3, 'DEPT-3': 3,
        DRN: 4, 'DEPT-4': 4,
        ELE: 5, 'DEPT-5': 5,
        TRF: 6, 'DEPT-6': 6,
        MNT: 7, 'DEPT-7': 7
      };
      if (typeof deptFilterId === 'string') {
        const cleanCode = deptFilterId.toUpperCase().split('-')[0].replace('DEPT', '').trim();
        if (codeToIdMap[cleanCode]) {
          deptFilterId = codeToIdMap[cleanCode];
        }
      }
      sql += ` AND u.department_id = $1`;
      params.push(deptFilterId);
    }

    if (filterStatus === 'active') {
      sql += ` AND LOWER(u.status) = 'active'`;
    } else if (filterStatus === 'inactive') {
      sql += ` AND LOWER(u.status) = 'inactive'`;
    } else if (filterStatus !== 'all') {
      sql += ` AND LOWER(u.status) != 'archived'`;
    }

    if (searchQuery) {
      const idx = params.length + 1;
      sql += ` AND (LOWER(u.name) LIKE $${idx} OR LOWER(u.email) LIKE $${idx} OR LOWER(u.mobile) LIKE $${idx} OR LOWER(COALESCE(u.employee_id, '')) LIKE $${idx})`;
      params.push(`%${searchQuery}%`);
    }

    sql += ` ORDER BY u.created_at DESC`;

    const result = await query(sql, params);

    const staffList = result.rows.map((row) => ({
      id: String(row.id),
      name: row.name,
      email: row.email || '',
      mobile: row.mobile || '',
      contact_number: row.mobile || '',
      employee_id: row.employee_id || `STF-${String(row.id).padStart(3, '0')}`,
      designation: row.designation || 'Field Service Staff',
      department_id: row.department_id ? String(row.department_id) : null,
      department_name: row.department_name || userDeptName || 'Municipal Department',
      status: (row.status || 'active').toLowerCase() === 'active' ? 'Active' : (row.status || 'inactive').toLowerCase() === 'inactive' ? 'Inactive' : 'Archived',
      active_tasks: parseInt(row.active_tasks || 0, 10),
      completed_tasks: parseInt(row.completed_tasks || 0, 10),
      overdue_tasks: parseInt(row.overdue_tasks || 0, 10),
      language: row.language_pref || 'en',
      joined_date: row.created_at,
      created_at: row.created_at
    }));

    // Calculate Summary Stats from DB
    let statsSql = `SELECT status, COUNT(*) as count FROM users WHERE (role = 'service_staff' OR role = 'staff')`;
    let statsParams = [];
    if (!isAdmin) {
      statsSql += ` AND department_id = $1`;
      statsParams.push(userDeptId || -1);
    }
    statsSql += ` GROUP BY status`;
    const statsRes = await query(statsSql, statsParams);

    let totalStaff = 0;
    let activeStaff = 0;
    let inactiveStaff = 0;

    statsRes.rows.forEach((r) => {
      const cnt = parseInt(r.count, 10);
      const st = (r.status || '').toLowerCase();
      if (st === 'active') activeStaff += cnt;
      if (st === 'inactive') inactiveStaff += cnt;
      if (st !== 'archived') totalStaff += cnt;
    });

    // Total Active Tasks Across Department Staff
    let taskSql = `
      SELECT COUNT(DISTINCT a.id) as active_tasks_count
      FROM assignments a
      JOIN complaints c ON c.id = a.complaint_id
      JOIN users u ON u.id = a.staff_id
      WHERE (u.role = 'service_staff' OR u.role = 'staff')
        AND c.status IN ('Assigned', 'In Progress', 'Verified')
    `;
    let taskParams = [];
    if (!isAdmin) {
      taskSql += ` AND u.department_id = $1`;
      taskParams.push(userDeptId || -1);
    }
    const taskRes = await query(taskSql, taskParams);
    const activeTasksCount = parseInt(taskRes.rows[0]?.active_tasks_count || 0, 10);

    return res.json({
      staff: staffList,
      summary: {
        totalStaff,
        activeStaff,
        inactiveStaff,
        activeTasks: activeTasksCount
      }
    });
  } catch (err) {
    console.error('Fetch staff list error:', err);
    return res.status(500).json({ error: 'Failed to fetch department staff' });
  }
});

/**
 * GET /api/department/staff/assignable
 * Fetch ONLY ACTIVE staff members for complaint task assignment dropdowns
 */
router.get('/staff/assignable', authenticateToken, requireRole(['department_head', 'admin', 'city_admin', 'officer']), async (req, res) => {
  try {
    const { userDeptId } = await resolveUserDepartment(req);
    const userRole = req.user.role || 'citizen';
    const isAdmin = ['admin', 'city_admin'].includes(userRole);

    let sql = `
      SELECT id, name, mobile, email, employee_id, department_id, designation
      FROM users
      WHERE (role = 'service_staff' OR role = 'staff')
        AND LOWER(status) = 'active'
    `;
    const params = [];

    if (!isAdmin) {
      sql += ` AND department_id = $1`;
      params.push(userDeptId || -1);
    }

    sql += ` ORDER BY name ASC`;

    const result = await query(sql, params);
    return res.json({ staff: result.rows });
  } catch (err) {
    console.error('Fetch assignable staff error:', err);
    return res.status(500).json({ error: 'Failed to fetch assignable staff' });
  }
});

/**
 * POST /api/department/staff
 * Create a new Service Staff member (Department Head locked to own department)
 */
router.post('/staff', authenticateToken, requireRole(['department_head', 'admin', 'city_admin']), async (req, res) => {
  try {
    const { name, email, mobile, password, employee_id, designation, language } = req.body;

    if (!name || !mobile || !password) {
      return res.status(400).json({ error: 'Name, mobile number, and password are required.' });
    }

    const { userDeptId, userDeptName } = await resolveUserDepartment(req);
    const userRole = req.user.role || 'citizen';
    const isAdmin = ['admin', 'city_admin'].includes(userRole);

    // SECURITY RULE: Department Head is strictly locked to their own department
    let targetDeptId = userDeptId;
    if (isAdmin && req.body.department_id) {
      targetDeptId = req.body.department_id;
    }

    if (!targetDeptId) {
      return res.status(400).json({ error: 'Department assignment could not be resolved.' });
    }

    // Check existing email or mobile
    const checkSql = `SELECT id FROM users WHERE mobile = $1 OR (email IS NOT NULL AND email = $2)`;
    const existing = await query(checkSql, [mobile, email || '']);
    if (existing.rows && existing.rows.length > 0) {
      return res.status(400).json({ error: 'A staff member or user with this mobile number or email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    const empId = employee_id || `STF-${Date.now().toString().slice(-4)}`;
    const desig = designation || 'Field Service Staff';
    const lang = language || 'en';

    const insertSql = `
      INSERT INTO users (name, mobile, email, password_hash, role, department_id, employee_id, designation, status, language_pref)
      VALUES ($1, $2, $3, $4, 'service_staff', $5, $6, $7, 'active', $8)
      RETURNING *
    `;

    const result = await query(insertSql, [name, mobile, email || null, password_hash, targetDeptId, empId, desig, lang]);
    const created = result.rows[0];

    return res.status(201).json({
      success: true,
      message: 'Staff member created successfully',
      staff: {
        id: String(created.id),
        name: created.name,
        email: created.email || '',
        mobile: created.mobile,
        employee_id: created.employee_id,
        designation: created.designation,
        department_id: String(created.department_id),
        department_name: userDeptName,
        status: 'Active',
        active_tasks: 0,
        completed_tasks: 0,
        overdue_tasks: 0,
        language: created.language_pref,
        created_at: created.created_at
      }
    });
  } catch (err) {
    console.error('Error creating staff:', err);
    return res.status(500).json({ error: 'Failed to create staff member' });
  }
});

/**
 * PUT /api/department/staff/:id
 * Update staff profile information
 */
router.put('/staff/:id', authenticateToken, requireRole(['department_head', 'admin', 'city_admin']), async (req, res) => {
  try {
    const staffId = req.params.id;
    const { name, mobile, designation, language, employee_id } = req.body;

    const { userDeptId } = await resolveUserDepartment(req);
    const isAdmin = ['admin', 'city_admin'].includes(req.user.role);

    // SECURITY CHECK: Ensure staff member belongs to Department Head's department
    if (!isAdmin) {
      const verifyRes = await query('SELECT department_id FROM users WHERE id = $1', [staffId]);
      if (verifyRes.rows.length === 0) {
        return res.status(404).json({ error: 'Staff member not found' });
      }
      if (String(verifyRes.rows[0].department_id) !== String(userDeptId)) {
        return res.status(403).json({ error: 'Forbidden: You can only edit staff members in your department' });
      }
    }

    await query(
      `UPDATE users
       SET name = COALESCE($1, name),
           mobile = COALESCE($2, mobile),
           designation = COALESCE($3, designation),
           language_pref = COALESCE($4, language_pref),
           employee_id = COALESCE($5, employee_id)
       WHERE id = $6 AND (role = 'service_staff' OR role = 'staff')`,
      [name, mobile, designation, language, employee_id, staffId]
    );

    return res.json({ success: true, message: 'Staff profile updated successfully' });
  } catch (err) {
    console.error('Error updating staff:', err);
    return res.status(500).json({ error: 'Failed to update staff member' });
  }
});

/**
 * POST /api/department/staff/:id/deactivate
 * Deactivate staff member (status -> 'inactive')
 */
router.post('/staff/:id/deactivate', authenticateToken, requireRole(['department_head', 'admin', 'city_admin']), async (req, res) => {
  try {
    const staffId = req.params.id;
    const { userDeptId } = await resolveUserDepartment(req);
    const isAdmin = ['admin', 'city_admin'].includes(req.user.role);

    if (!isAdmin) {
      const verifyRes = await query('SELECT department_id FROM users WHERE id = $1', [staffId]);
      if (verifyRes.rows.length === 0) {
        return res.status(404).json({ error: 'Staff member not found' });
      }
      if (String(verifyRes.rows[0].department_id) !== String(userDeptId)) {
        return res.status(403).json({ error: 'Forbidden: You can only deactivate staff members in your department' });
      }
    }

    await query("UPDATE users SET status = 'inactive' WHERE id = $1", [staffId]);

    return res.json({ success: true, message: 'Staff member deactivated successfully' });
  } catch (err) {
    console.error('Error deactivating staff:', err);
    return res.status(500).json({ error: 'Failed to deactivate staff member' });
  }
});

/**
 * POST /api/department/staff/:id/activate
 * Activate staff member (status -> 'active')
 */
router.post('/staff/:id/activate', authenticateToken, requireRole(['department_head', 'admin', 'city_admin']), async (req, res) => {
  try {
    const staffId = req.params.id;
    const { userDeptId } = await resolveUserDepartment(req);
    const isAdmin = ['admin', 'city_admin'].includes(req.user.role);

    if (!isAdmin) {
      const verifyRes = await query('SELECT department_id FROM users WHERE id = $1', [staffId]);
      if (verifyRes.rows.length === 0) {
        return res.status(404).json({ error: 'Staff member not found' });
      }
      if (String(verifyRes.rows[0].department_id) !== String(userDeptId)) {
        return res.status(403).json({ error: 'Forbidden: You can only activate staff members in your department' });
      }
    }

    await query("UPDATE users SET status = 'active' WHERE id = $1", [staffId]);

    return res.json({ success: true, message: 'Staff member activated successfully' });
  } catch (err) {
    console.error('Error activating staff:', err);
    return res.status(500).json({ error: 'Failed to activate staff member' });
  }
});

/**
 * DELETE /api/department/staff/:id
 * Soft delete / Archive staff member (status -> 'archived'), preserving all historical data
 */
router.delete('/staff/:id', authenticateToken, requireRole(['department_head', 'admin', 'city_admin']), async (req, res) => {
  try {
    const staffId = req.params.id;
    const { userDeptId } = await resolveUserDepartment(req);
    const isAdmin = ['admin', 'city_admin'].includes(req.user.role);

    if (!isAdmin) {
      const verifyRes = await query('SELECT department_id FROM users WHERE id = $1', [staffId]);
      if (verifyRes.rows.length === 0) {
        return res.status(404).json({ error: 'Staff member not found' });
      }
      if (String(verifyRes.rows[0].department_id) !== String(userDeptId)) {
        return res.status(403).json({ error: 'Forbidden: You can only remove staff members in your department' });
      }
    }

    // Soft delete -> Set status = 'archived'
    await query("UPDATE users SET status = 'archived' WHERE id = $1", [staffId]);

    return res.json({ success: true, message: 'Staff member removed successfully (Historical records preserved)' });
  } catch (err) {
    console.error('Error removing staff:', err);
    return res.status(500).json({ error: 'Failed to remove staff member' });
  }
});

/**
 * POST /api/department/assign
 * Assign complaint to active service staff member with department isolation authorization
 */
router.post('/assign', authenticateToken, requireRole(['department_head', 'admin', 'city_admin', 'officer']), async (req, res) => {
  try {
    const { complaint_id, staff_id } = req.body;
    if (!complaint_id || !staff_id) {
      return res.status(400).json({ error: 'Complaint ID and Staff ID are required.' });
    }

    const { userDeptId } = await resolveUserDepartment(req);
    const userRole = req.user.role || 'citizen';
    const isAdmin = ['admin', 'city_admin'].includes(userRole);

    // 1. Fetch Complaint by ID or Complaint Number
    const compRes = await query(`SELECT * FROM complaints WHERE id = $1 OR complaint_number = $1`, [complaint_id]);
    if (!compRes.rows || compRes.rows.length === 0) {
      return res.status(404).json({ error: 'Complaint record not found.' });
    }
    const complaint = compRes.rows[0];

    // 2. Fetch Selected Staff Member by ID, Employee ID or Email
    const staffRes = await query(`SELECT id, name, email, mobile, department_id, status FROM users WHERE (id = $1 OR employee_id = $1 OR email = $1) AND (role = 'service_staff' OR role = 'staff')`, [staff_id]);
    if (!staffRes.rows || staffRes.rows.length === 0) {
      return res.status(404).json({ error: 'Selected service staff member not found.' });
    }
    const staff = staffRes.rows[0];

    // 3. Status Check: Staff must be active
    if ((staff.status || 'active').toLowerCase() !== 'active') {
      return res.status(400).json({ error: `Cannot assign task: Staff member '${staff.name}' is currently inactive.` });
    }

    // Helper: Normalize department code/id for secure isolation check
    const normDept = (d) => {
      const s = String(d || '').trim().toLowerCase();
      if (s === '1' || s.includes('pwd')) return 'PWD';
      if (s === '2' || s.includes('san')) return 'SAN';
      if (s === '3' || s.includes('wtr')) return 'WTR';
      if (s === '4' || s.includes('ele')) return 'ELE';
      if (s === '5' || s.includes('trf')) return 'TRF';
      if (s === '6' || s.includes('mnt')) return 'MNT';
      if (s === '7' || s.includes('drn')) return 'DRN';
      return s.toUpperCase();
    };

    // 4. Department Isolation Security Check
    if (!isAdmin) {
      if (userDeptId && complaint.department_id && normDept(userDeptId) !== normDept(complaint.department_id)) {
        return res.status(403).json({ error: 'Forbidden: You cannot assign complaints outside your department.' });
      }
      if (userDeptId && staff.department_id && normDept(userDeptId) !== normDept(staff.department_id)) {
        return res.status(403).json({ error: 'Forbidden: You cannot assign staff members belonging to another department.' });
      }
    } else {
      if (complaint.department_id && staff.department_id && normDept(complaint.department_id) !== normDept(staff.department_id)) {
        return res.status(400).json({ error: 'Invalid assignment: Selected staff member does not belong to the complaint department.' });
      }
    }

    // 5. Update Complaint in Database
    await query(
      `UPDATE complaints
       SET assigned_staff_id = $1,
           assigned_staff_name = $2,
           assigned_staff_email = $3,
           assigned_by = $4,
           assigned_by_name = $5,
           status = 'Staff Assigned',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6`,
      [staff.id, staff.name, staff.email || '', req.user.id, req.user.name || 'Department Head', complaint.id]
    );

    // 6. Record Assignment History
    await query(
      `INSERT INTO assignments (complaint_id, staff_id, assigned_by, assigned_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [complaint.id, staff.id, req.user.id]
    ).catch(() => {});

    // 7. Record Status History
    await query(
      `INSERT INTO complaint_status_history (complaint_id, status, remark, department, updated_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [complaint.id, 'Staff Assigned', `Task assigned to field staff ${staff.name}.`, 'Department Operations', req.user.name || 'Department Head']
    ).catch(() => {});

    return res.json({
      success: true,
      message: `Task successfully assigned to ${staff.name}`,
      complaint_id: complaint.id,
      staff_id: staff.id,
      staff_name: staff.name
    });
  } catch (err) {
    console.error('Error assigning staff in department route:', err);
    return res.status(500).json({ error: 'Server error assigning staff to task.' });
  }
});

module.exports = router;
