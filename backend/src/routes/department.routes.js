const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');
const validateInput = require('../middleware/validateInput');
const { assignStaffSchema } = require('../schemas/admin.schemas');

// No-cache middleware for dynamic department data
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

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
 * GET /api/department/complaints
 * Fetch complaints for authenticated Department Head (or all for Admin)
 */
router.get('/complaints', authenticateToken, requireRole(['department_head', 'admin', 'city_admin']), async (req, res) => {
  try {
    const { userDeptId, userDeptName } = await resolveUserDepartment(req);
    const userRole = req.user.role || 'citizen';
    const isAdmin = ['admin', 'city_admin'].includes(userRole);

    let sql = `
      SELECT c.*, d.name as department_name, d.code as department_code, f.rating, f.comment as feedback_comment
      FROM complaints c
      LEFT JOIN departments d ON c.department_id = d.id
      LEFT JOIN feedback f ON f.complaint_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (!isAdmin) {
      sql += ` AND (c.department_id = $1 OR CAST(c.department_id AS TEXT) = $2)`;
      params.push(userDeptId || -1, String(userDeptId || -1));
    } else if (req.query.department_id) {
      sql += ` AND (c.department_id = $1 OR CAST(c.department_id AS TEXT) = $2)`;
      params.push(req.query.department_id, String(req.query.department_id));
    }

    sql += ` ORDER BY c.created_at DESC`;

    const result = await query(sql, params);
    return res.json({ complaints: result.rows, department_id: userDeptId, department_name: userDeptName });
  } catch (err) {
    console.error('Fetch department complaints error:', err);
    return res.status(500).json({ error: 'Failed to fetch department complaints' });
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
      SELECT fs.id, fs.user_id, fs.name, fs.email, fs.phone as mobile, fs.employee_id, fs.role, fs.department_id,
             COALESCE(u.designation, 'Field Service Staff') as designation,
             COALESCE(fs.status, 'active') as status,
             u.language_pref, fs.created_at,
             d.name as department_name,
             (
               SELECT COUNT(DISTINCT c.id)
               FROM complaints c
               WHERE (
                 c.assigned_staff_id = CAST(fs.id AS TEXT) 
                 OR c.assigned_staff_id = CAST(fs.user_id AS TEXT) 
                 OR c.assigned_staff_id = fs.employee_id 
                 OR (c.assigned_staff_email IS NOT NULL AND LOWER(c.assigned_staff_email) = LOWER(fs.email)) 
                 OR (c.assigned_staff_name IS NOT NULL AND c.assigned_staff_name = fs.name)
               )
                AND CAST(c.status AS TEXT) IN ('Staff Assigned', 'Department Assigned', 'In Progress', 'Accepted', 'On the Way', 'Resolution Submitted', 'Verified', 'Assigned')
              ) AS active_tasks,
              (
                SELECT COUNT(DISTINCT c.id)
                FROM complaints c
                WHERE (
                  c.assigned_staff_id = CAST(fs.id AS TEXT) 
                  OR c.assigned_staff_id = CAST(fs.user_id AS TEXT) 
                  OR c.assigned_staff_id = fs.employee_id 
                  OR (c.assigned_staff_email IS NOT NULL AND LOWER(c.assigned_staff_email) = LOWER(fs.email)) 
                  OR (c.assigned_staff_name IS NOT NULL AND c.assigned_staff_name = fs.name)
                )
                AND CAST(c.status AS TEXT) = 'Resolved'
              ) AS completed_tasks,
              (
                SELECT COUNT(DISTINCT c.id)
                FROM complaints c
                WHERE (
                  c.assigned_staff_id = CAST(fs.id AS TEXT) 
                  OR c.assigned_staff_id = CAST(fs.user_id AS TEXT) 
                  OR c.assigned_staff_id = fs.employee_id 
                  OR (c.assigned_staff_email IS NOT NULL AND LOWER(c.assigned_staff_email) = LOWER(fs.email)) 
                  OR (c.assigned_staff_name IS NOT NULL AND c.assigned_staff_name = fs.name)
                )
                AND (CAST(c.status AS TEXT) = 'Overdue' OR (CAST(c.status AS TEXT) NOT IN ('Resolved', 'Rejected') AND c.sla_deadline IS NOT NULL AND c.sla_deadline < CURRENT_TIMESTAMP))
              ) AS overdue_tasks
      FROM field_staff fs
      LEFT JOIN departments d ON fs.department_id = d.id
      LEFT JOIN users u ON fs.user_id = u.id
      WHERE 1=1
    `;

    const params = [];

    // Department Isolation for Department Head
    if (!isAdmin) {
      sql += ` AND fs.department_id = $1`;
      params.push(userDeptId || -1);
    } else if (req.query.department_id) {
      let deptFilterId = req.query.department_id;
      const codeToIdMap = {
        PWD: 1, 'DEPT-1': 1, 'DEPT-PWD': 1,
        SAN: 2, 'DEPT-2': 2, 'DEPT-SAN': 2,
        WTR: 3, 'DEPT-3': 3, 'DEPT-WTR': 3,
        DRN: 4, 'DEPT-4': 4, 'DEPT-DRN': 4,
        ELE: 5, 'DEPT-5': 5, 'DEPT-ELE': 5,
        TRF: 6, 'DEPT-6': 6, 'DEPT-TRF': 6,
        MNT: 7, 'DEPT-7': 7, 'DEPT-MNT': 7
      };
      if (typeof deptFilterId === 'string') {
        const cleanCode = deptFilterId.toUpperCase().split('-')[0].replace('DEPT', '').trim();
        if (codeToIdMap[cleanCode]) {
          deptFilterId = codeToIdMap[cleanCode];
        } else if (codeToIdMap[deptFilterId.toUpperCase()]) {
          deptFilterId = codeToIdMap[deptFilterId.toUpperCase()];
        }
      }
      sql += ` AND fs.department_id = $1`;
      params.push(deptFilterId);
    }

    if (filterStatus === 'active') {
      sql += ` AND LOWER(fs.status) = 'active'`;
    } else if (filterStatus === 'inactive') {
      sql += ` AND LOWER(fs.status) = 'inactive'`;
    } else if (filterStatus !== 'all') {
      sql += ` AND LOWER(fs.status) != 'archived'`;
    }

    if (searchQuery) {
      const idx = params.length + 1;
      sql += ` AND (LOWER(fs.name) LIKE $${idx} OR LOWER(fs.email) LIKE $${idx} OR LOWER(fs.phone) LIKE $${idx} OR LOWER(COALESCE(fs.employee_id, '')) LIKE $${idx})`;
      params.push(`%${searchQuery}%`);
    }

    sql += ` ORDER BY fs.created_at DESC`;

    const result = await query(sql, params);

    const staffList = result.rows.map((row) => ({
      id: String(row.id),
      user_id: row.user_id ? String(row.user_id) : String(row.id),
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

    // Calculate Summary Stats from staffList array directly for 100% accuracy
    const totalStaff = staffList.filter(s => (s.status || '').toLowerCase() !== 'archived').length;
    const activeStaff = staffList.filter(s => (s.status || '').toLowerCase() === 'active').length;
    const inactiveStaff = staffList.filter(s => (s.status || '').toLowerCase() === 'inactive').length;

    // Total Active Tasks Across Department Staff
    let taskSql = `
      SELECT COUNT(DISTINCT a.id) as active_tasks_count
      FROM assignments a
      JOIN complaints c ON c.id = a.complaint_id
      JOIN field_staff fs ON (a.staff_id = fs.id OR a.staff_id = fs.user_id)
      WHERE c.status IN ('Assigned', 'In Progress', 'Verified')
    `;
    let taskParams = [];
    if (!isAdmin) {
      taskSql += ` AND fs.department_id = $1`;
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
      SELECT fs.id, fs.user_id, fs.name, fs.phone as mobile, fs.email, fs.employee_id, fs.department_id, d.name as department_name
      FROM field_staff fs
      LEFT JOIN departments d ON fs.department_id = d.id
      WHERE LOWER(COALESCE(fs.status, 'active')) = 'active'
    `;
    const params = [];

    if (!isAdmin) {
      sql += ` AND fs.department_id = $1`;
      params.push(userDeptId || -1);
    }

    sql += ` ORDER BY fs.name ASC`;

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

    let targetDeptId = userDeptId;
    if (isAdmin && req.body.department_id) {
      targetDeptId = req.body.department_id;
    }

    if (!targetDeptId) {
      return res.status(400).json({ error: 'Department assignment could not be resolved.' });
    }

    // Check existing email or mobile in users & field_staff
    const checkSql = `SELECT id FROM users WHERE mobile = $1 OR (email IS NOT NULL AND LOWER(email) = LOWER($2))`;
    const existing = await query(checkSql, [mobile, email || '']);
    if (existing.rows && existing.rows.length > 0) {
      return res.status(400).json({ error: 'A staff member or user with this mobile number or email already exists.' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);
    const empId = employee_id || `STF-${Date.now().toString().slice(-4)}`;
    const desig = designation || 'Field Service Staff';
    const lang = language || 'en';
    const cleanEmail = email ? email.toLowerCase() : `${empId.toLowerCase()}@nagarsetu.gov.in`;

    const insertSql = `
      INSERT INTO users (name, mobile, email, password_hash, role, department_id, employee_id, designation, status, language_pref)
      VALUES ($1, $2, $3, $4, 'service_staff', $5, $6, $7, 'active', $8)
      RETURNING *
    `;

    const result = await query(insertSql, [name, mobile, cleanEmail, password_hash, targetDeptId, empId, desig, lang]);
    const created = result.rows[0];

    // Also insert into field_staff table
    await query(
      `INSERT INTO field_staff (user_id, department_id, name, email, phone, employee_id, role, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'field_staff', 'active')`,
      [created.id, targetDeptId, name, cleanEmail, mobile, empId]
    ).catch(() => {});

    return res.status(201).json({
      success: true,
      message: 'Staff member created successfully',
      staff: {
        id: String(created.id),
        user_id: String(created.id),
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
      const verifyRes = await query('SELECT department_id FROM field_staff WHERE id = $1 OR user_id = $1', [staffId]);
      if (verifyRes.rows.length === 0) {
        return res.status(404).json({ error: 'Staff member not found' });
      }
      if (String(verifyRes.rows[0].department_id) !== String(userDeptId)) {
        return res.status(403).json({ error: 'Forbidden: You can only edit staff members in your department' });
      }
    }

    await query(
      `UPDATE field_staff
       SET name = COALESCE($1, name),
           phone = COALESCE($2, phone),
           employee_id = COALESCE($3, employee_id),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 OR user_id = $4`,
      [name, mobile, employee_id, staffId]
    );

    await query(
      `UPDATE users
       SET name = COALESCE($1, name),
           mobile = COALESCE($2, mobile),
           designation = COALESCE($3, designation),
           language_pref = COALESCE($4, language_pref),
           employee_id = COALESCE($5, employee_id)
       WHERE id = $6 OR id IN (SELECT user_id FROM field_staff WHERE id = $6)`,
      [name, mobile, designation, language, employee_id, staffId]
    );

    return res.json({ success: true, message: 'Staff profile updated successfully' });
  } catch (err) {
    console.error('Error updating staff:', err);
    return res.status(500).json({ error: 'Failed to update staff member' });
  }
});

const handleStaffDeactivate = async (req, res) => {
  try {
    const staffId = req.params.id;
    const { userDeptId } = await resolveUserDepartment(req);
    const isAdmin = ['admin', 'city_admin'].includes(req.user.role);

    if (!isAdmin) {
      const verifyRes = await query('SELECT department_id FROM field_staff WHERE id = $1 OR user_id = $1', [staffId]);
      if (verifyRes.rows.length === 0) {
        return res.status(404).json({ error: 'Staff member not found' });
      }
      if (String(verifyRes.rows[0].department_id) !== String(userDeptId)) {
        return res.status(403).json({ error: 'Forbidden: You can only deactivate staff members in your department' });
      }
    }

    await query("UPDATE field_staff SET status = 'inactive', updated_at = CURRENT_TIMESTAMP WHERE id = $1 OR user_id = $1", [staffId]);
    await query("UPDATE users SET status = 'inactive' WHERE id = $1 OR id IN (SELECT user_id FROM field_staff WHERE id = $1)", [staffId]);

    return res.json({ success: true, message: 'Staff member deactivated successfully' });
  } catch (err) {
    console.error('Error deactivating staff:', err);
    return res.status(500).json({ error: 'Failed to deactivate staff member' });
  }
};

router.post('/staff/:id/deactivate', authenticateToken, requireRole(['department_head', 'admin', 'city_admin']), handleStaffDeactivate);
router.patch('/staff/:id/deactivate', authenticateToken, requireRole(['department_head', 'admin', 'city_admin']), handleStaffDeactivate);

const handleStaffActivate = async (req, res) => {
  try {
    const staffId = req.params.id;
    const { userDeptId } = await resolveUserDepartment(req);
    const isAdmin = ['admin', 'city_admin'].includes(req.user.role);

    if (!isAdmin) {
      const verifyRes = await query('SELECT department_id FROM field_staff WHERE id = $1 OR user_id = $1', [staffId]);
      if (verifyRes.rows.length === 0) {
        return res.status(404).json({ error: 'Staff member not found' });
      }
      if (String(verifyRes.rows[0].department_id) !== String(userDeptId)) {
        return res.status(403).json({ error: 'Forbidden: You can only activate staff members in your department' });
      }
    }

    await query("UPDATE field_staff SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = $1 OR user_id = $1", [staffId]);
    await query("UPDATE users SET status = 'active' WHERE id = $1 OR id IN (SELECT user_id FROM field_staff WHERE id = $1)", [staffId]);

    return res.json({ success: true, message: 'Staff member activated successfully' });
  } catch (err) {
    console.error('Error activating staff:', err);
    return res.status(500).json({ error: 'Failed to activate staff member' });
  }
};

router.post('/staff/:id/activate', authenticateToken, requireRole(['department_head', 'admin', 'city_admin']), handleStaffActivate);
router.patch('/staff/:id/activate', authenticateToken, requireRole(['department_head', 'admin', 'city_admin']), handleStaffActivate);

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
      const verifyRes = await query('SELECT department_id FROM field_staff WHERE id = $1 OR user_id = $1', [staffId]);
      if (verifyRes.rows.length === 0) {
        return res.status(404).json({ error: 'Staff member not found' });
      }
      if (String(verifyRes.rows[0].department_id) !== String(userDeptId)) {
        return res.status(403).json({ error: 'Forbidden: You can only remove staff members in your department' });
      }
    }

    await query("UPDATE field_staff SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = $1 OR user_id = $1", [staffId]);
    await query("UPDATE users SET status = 'archived' WHERE id = $1 OR id IN (SELECT user_id FROM field_staff WHERE id = $1)", [staffId]);

    return res.json({ success: true, message: 'Staff member removed successfully (Historical records preserved)' });
  } catch (err) {
    console.error('Error removing staff:', err);
    return res.status(500).json({ error: 'Failed to remove staff member' });
  }
});

/**
 * POST /api/department/assign
 * Assign complaint to active field staff member with database verification
 */
router.post('/assign', authenticateToken, requireRole(['department_head', 'admin', 'city_admin', 'officer']), validateInput(assignStaffSchema), async (req, res) => {
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

    // 2. Fetch Selected Staff Member from field_staff (or users fallback)
    let staffRes = await query(
      `SELECT fs.id, fs.user_id, fs.name, fs.email, fs.phone as mobile, fs.department_id, fs.employee_id, fs.status 
       FROM field_staff fs 
       WHERE CAST(fs.user_id AS TEXT) = $1 
          OR fs.employee_id = $1 
          OR CAST(fs.id AS TEXT) = $1
          OR LOWER(fs.email) = LOWER($1)
          OR LOWER(fs.name) = LOWER($1)`,
      [staff_id]
    );

    let staff = staffRes.rows && staffRes.rows.length > 0 ? staffRes.rows[0] : null;
    if (!staff) {
      const uRes = await query(
        `SELECT id, name, email, mobile, department_id, employee_id, status FROM users WHERE (id = $1 OR employee_id = $1 OR LOWER(email) = LOWER($1) OR LOWER(name) = LOWER($1)) AND (role = 'service_staff' OR role = 'staff')`,
        [staff_id]
      );
      if (uRes.rows && uRes.rows.length > 0) staff = uRes.rows[0];
    }

    if (!staff) {
      return res.status(404).json({ error: 'Selected field staff member not found in database.' });
    }

    // 3. Status Check: Staff must be active
    if ((staff.status || 'active').toLowerCase() !== 'active') {
      return res.status(400).json({ error: `Cannot assign task: Staff member '${staff.name}' is currently inactive.` });
    }

    const normDept = (d) => {
      const s = String(d || '').trim().toLowerCase();
      if (s === '1' || s.includes('pwd') || s.includes('road')) return 'PWD';
      if (s === '2' || s.includes('san') || s.includes('waste')) return 'SAN';
      if (s === '3' || s.includes('wtr') || s.includes('water')) return 'WTR';
      if (s === '4' || s.includes('drn') || s.includes('drain')) return 'DRN';
      if (s === '5' || s.includes('ele') || s.includes('electric')) return 'ELE';
      if (s === '6' || s.includes('trf') || s.includes('traffic')) return 'TRF';
      if (s === '7' || s.includes('mnt') || s.includes('maint')) return 'MNT';
      return s.toUpperCase();
    };

    // 4. Department Isolation Security Check: Complaint and staff must belong to the same department
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

    const assignedStaffId = String(staff.id || staff.user_id);
    const assignedStaffName = staff.name;
    const assignedStaffEmail = staff.email || '';

    // 5. Update Complaint in Database with affected row verification
    const updateRes = await query(
      `UPDATE complaints
       SET assigned_staff_id = $1,
           assigned_staff_name = $2,
           assigned_staff_email = $3,
           assigned_by = $4,
           assigned_by_name = $5,
           status = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 OR complaint_number = $7`,
      [assignedStaffId, assignedStaffName, assignedStaffEmail, req.user.id, req.user.name || 'Department Head', 'Staff Assigned', complaint.id]
    );

    if (updateRes && updateRes.rowCount !== undefined && updateRes.rowCount === 0) {
      return res.status(500).json({ error: 'Assignment failed: Database UPDATE affected 0 rows.' });
    }

    // 6. Database Read-back Verification
    const verifyRes = await query(
      `SELECT id, complaint_number, assigned_staff_id, assigned_staff_name, assigned_staff_email, status, updated_at FROM complaints WHERE id = $1`,
      [complaint.id]
    );

    if (!verifyRes.rows || verifyRes.rows.length === 0 || verifyRes.rows[0].status !== 'Staff Assigned') {
      return res.status(500).json({ error: 'Assignment failed: Database read-back verification failed.' });
    }

    const verifiedRecord = verifyRes.rows[0];

    // 7. Record Assignment History (into assignments & task_assignments tables)
    await query(
      `INSERT INTO assignments (complaint_id, staff_id, assigned_by, assigned_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [complaint.id, staff.user_id || staff.id, req.user.id]
    ).catch(() => {});

    await query(
      `INSERT INTO task_assignments (complaint_id, staff_id, assigned_by, created_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [complaint.id, staff.user_id || staff.id, req.user.id]
    ).catch(() => {});

    // 8. Record Status History
    await query(
      `INSERT INTO complaint_status_history (complaint_id, status, remark, department, updated_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [complaint.id, 'Staff Assigned', `Task assigned to field staff ${staff.name}.`, 'Department Operations', req.user.name || 'Department Head']
    ).catch(() => {});

    return res.json({
      success: true,
      message: `Task successfully assigned to ${staff.name}`,
      complaint_id: verifiedRecord.id,
      complaint_number: verifiedRecord.complaint_number,
      staff_id: assignedStaffId,
      staff_name: assignedStaffName,
      staff_email: assignedStaffEmail,
      status: verifiedRecord.status,
      updated_at: verifiedRecord.updated_at
    });
  } catch (err) {
    console.error('Error assigning staff in department route:', err);
    return res.status(500).json({ error: 'Server error assigning staff to task.' });
  }
});

/**
 * POST /api/department/verify
 * Department Head verifies & approves completion -> status = 'Resolved'
 */
router.post('/verify', authenticateToken, requireRole(['department_head', 'admin', 'city_admin']), async (req, res) => {
  try {
    const { complaint_id, verified_by, verified_by_name, status } = req.body;
    const targetStatus = status || 'Resolved';

    if (!complaint_id) {
      return res.status(400).json({ error: 'Complaint ID is required' });
    }

    // 1. Authoritative Complaint Lookup from Database
    const compRes = await query(
      `SELECT id, complaint_number, citizen_id, department_id, status FROM complaints WHERE CAST(id AS TEXT) = $1 OR complaint_number = $2`,
      [String(complaint_id), String(complaint_id)]
    );

    if (!compRes.rows || compRes.rows.length === 0) {
      return res.status(404).json({ error: 'Complaint record not found.' });
    }
    const complaint = compRes.rows[0];

    // 2. Resolve Authenticated User's Department
    const { userDeptId } = await resolveUserDepartment(req);
    const userRole = req.user.role || 'citizen';
    const isAdmin = ['admin', 'city_admin'].includes(userRole);

    const normDept = (d) => {
      const s = String(d || '').trim().toLowerCase();
      if (s === '1' || s.includes('pwd') || s.includes('road') || s.includes('public works')) return '1';
      if (s === '2' || s.includes('san') || s.includes('waste') || s.includes('garbage')) return '2';
      if (s === '3' || s.includes('wtr') || s.includes('water') || s.includes('sewerage board')) return '3';
      if (s === '4' || s.includes('drn') || s.includes('drain') || s.includes('sewage')) return '4';
      if (s === '5' || s.includes('ele') || s.includes('electric') || s.includes('light')) return '5';
      if (s === '6' || s.includes('trf') || s.includes('traffic')) return '6';
      if (s === '7' || s.includes('mnt') || s.includes('maint')) return '7';
      return s.toUpperCase();
    };

    // 3. Department Security Guard: Ensure Department Head can only verify complaints in their department
    if (!isAdmin) {
      if (!userDeptId || !complaint.department_id || normDept(userDeptId) !== normDept(complaint.department_id)) {
        return res.status(403).json({ error: 'Forbidden: You cannot verify a complaint belonging to another department.' });
      }
    }

    const reworkReason = req.body?.rework_reason || req.body?.reason || '';
    if (targetStatus === 'Reopened' && reworkReason) {
      await query(
        `UPDATE complaints 
         SET status = $1, 
             rework_reason = $2, 
             admin_rejection_reason = $3, 
             updated_at = CURRENT_TIMESTAMP 
         WHERE CAST(id AS TEXT) = $4 OR complaint_number = $5`,
        [targetStatus, reworkReason, reworkReason, String(complaint_id), String(complaint_id)]
      );
    } else {
      await query(
        `UPDATE complaints 
         SET status = $1, 
             verified_by = $2, 
             verified_by_name = $3, 
             verified_at = CURRENT_TIMESTAMP, 
             updated_at = CURRENT_TIMESTAMP 
         WHERE CAST(id AS TEXT) = $4 OR complaint_number = $5`,
        [targetStatus, verified_by || req.user.id, verified_by_name || req.user.name || 'Department Head', String(complaint_id), String(complaint_id)]
      );
    }

    const verifyRes = await query(
      `SELECT id, complaint_number, status, verified_by_name, updated_at FROM complaints WHERE CAST(id AS TEXT) = $1 OR complaint_number = $2`,
      [String(complaint_id), String(complaint_id)]
    );

    if (!verifyRes.rows || verifyRes.rows.length === 0 || verifyRes.rows[0].status !== targetStatus) {
      return res.status(500).json({ error: 'Verification failed: Database read-back failed' });
    }

    const statusRemark = targetStatus === 'Reopened' 
      ? `Department Head requested rework: ${reworkReason}` 
      : `Department Head verified repair proof and resolved ticket.`;

    await query(
      `INSERT INTO complaint_status_history (complaint_id, status, remark, department, updated_by) VALUES ($1, $2, $3, $4, $5)`,
      [complaint_id, targetStatus, statusRemark, 'Department Operations', req.user.name || 'Department Head']
    ).catch(() => {});

    return res.json({
      success: true,
      message: `Complaint verified and updated to ${targetStatus}`,
      complaint: verifyRes.rows[0]
    });
  } catch (err) {
    console.error('Verify complaint error:', err);
    return res.status(500).json({ error: 'Failed to verify complaint' });
  }
});

module.exports = router;
