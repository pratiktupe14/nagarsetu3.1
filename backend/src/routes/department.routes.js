const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { authenticateToken, requireRole } = require('../middleware/auth');

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
 * Fetch complaints belonging to authenticated Department Head's department (or specified department_id)
 */
router.get('/complaints', authenticateToken, async (req, res) => {
  try {
    const { userDeptId, userDeptName } = await resolveUserDepartment(req);
    const userRole = req.user.role || 'citizen';
    const isAdmin = ['admin', 'city_admin'].includes(userRole);

    let targetDeptId = req.query.department_id || userDeptId;
    let targetDeptName = req.query.department_name || userDeptName;

    if (!targetDeptId && !targetDeptName) {
      if (req.user.email && (req.user.email.includes('pwd') || req.user.email.includes('rahul'))) {
        targetDeptId = 1;
        targetDeptName = 'Public Works Department (PWD)';
      }
    }

    let sql = `
      SELECT c.*, d.name as department_name, f.rating, f.comment as feedback_comment,
             u.name as citizen_name, u.mobile as citizen_mobile
      FROM complaints c
      LEFT JOIN departments d ON c.department_id = d.id
      LEFT JOIN feedback f ON f.complaint_id = c.id
      LEFT JOIN users u ON c.citizen_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (targetDeptId) {
      sql += ` AND c.department_id = $1`;
      params.push(targetDeptId);
    }

    sql += ` ORDER BY c.created_at DESC`;

    const result = await query(sql, params);
    if (result.rows && result.rows.length > 0) {
      return res.json({ complaints: result.rows });
    }

    // Fallback to Supabase if local DB has 0 rows
    try {
      const { getSupabaseClient } = require('../middleware/auth');
      const supabase = getSupabaseClient();
      if (supabase) {
        let sbQuery = supabase.from('complaints').select('*, departments(name)').order('created_at', { ascending: false });
        if (targetDeptId) {
          sbQuery = sbQuery.eq('department_id', targetDeptId);
        }
        const { data, error } = await sbQuery;
        if (!error && Array.isArray(data) && data.length > 0) {
          const formatted = data.map((c) => ({
            ...c,
            department_name: c.departments?.name || c.department_name || targetDeptName || 'Public Works Department (PWD)'
          }));
          return res.json({ complaints: formatted });
        }
      }
    } catch (sbErr) {
      console.warn('Supabase fallback in GET /api/department/complaints note:', sbErr.message);
    }

    return res.json({ complaints: result.rows || [] });
  } catch (err) {
    console.error('Fetch department complaints error:', err);
    return res.status(500).json({ error: 'Failed to fetch department complaints', complaints: [] });
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
               SELECT COUNT(DISTINCT c.id)
               FROM complaints c
               WHERE (c.assigned_staff_id = CAST(u.id AS TEXT) OR LOWER(c.assigned_staff_email) = LOWER(u.email) OR c.assigned_staff_name = u.name)
                 AND c.status IN ('Assigned', 'Staff Assigned', 'Department Assigned', 'In Progress', 'Accepted', 'On the Way', 'Resolution Submitted', 'Verified')
             ) as active_tasks,
             (
               SELECT COUNT(DISTINCT c.id)
               FROM complaints c
               WHERE (c.assigned_staff_id = CAST(u.id AS TEXT) OR LOWER(c.assigned_staff_email) = LOWER(u.email) OR c.assigned_staff_name = u.name)
                 AND c.status = 'Resolved'
             ) as completed_tasks,
             (
               SELECT COUNT(DISTINCT c.id)
               FROM complaints c
               WHERE (c.assigned_staff_id = CAST(u.id AS TEXT) OR LOWER(c.assigned_staff_email) = LOWER(u.email) OR c.assigned_staff_name = u.name)
                 AND (c.status = 'Overdue' OR (c.status NOT IN ('Resolved', 'Rejected') AND c.sla_deadline IS NOT NULL AND c.sla_deadline < CURRENT_TIMESTAMP))
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
        PWD: 1, 'DEPT-1': 1, 'DEPT-PWD': 1,
        SAN: 2, 'DEPT-2': 2, 'DEPT-SAN': 2,
        WTR: 3, 'DEPT-3': 3, 'DEPT-WTR': 3,
        DRN: 4, 'DEPT-4': 4, 'DEPT-DRN': 4,
        ELE: 5, 'DEPT-5': 5, 'DEPT-ELE': 5,
        TRF: 6, 'DEPT-6': 6, 'DEPT-TRF': 6,
        MNT: 7, 'DEPT-7': 7, 'DEPT-MNT': 7,
        '8ED9F760-1314-427C-A515-C2A54D6DF6D8': 1,
        '9CABC1F2-FD10-48DD-A5CB-01D05197DE22': 2,
        'EAD370CC-459C-44F0-899F-8A97F0928BEB': 3,
        'EE73CB82-CC47-4333-B7D6-4491353C1354': 4,
        '31842723-23AC-490B-912B-9F6D9AFBDFB3': 5,
        'AE5E4D0C-996F-4D81-9528-D642664C93AE': 6,
        '71542723-23AC-490B-912B-9F6D9AFBDFB7': 7
      };
      if (typeof deptFilterId === 'string') {
        const cleanUpper = deptFilterId.toUpperCase().trim();
        if (codeToIdMap[cleanUpper]) {
          deptFilterId = codeToIdMap[cleanUpper];
        } else {
          const cleanCode = cleanUpper.split('-')[0].replace('DEPT', '').trim();
          if (codeToIdMap[cleanCode]) {
            deptFilterId = codeToIdMap[cleanCode];
          }
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
    let staffRows = result.rows;

    if (staffRows.length === 0) {
      try {
        const { getSupabaseClient } = require('../middleware/auth');
        const sb = getSupabaseClient();
        if (sb) {
          const { data: sbProfiles } = await sb.from('profiles').select('*').eq('role', 'service_staff');
          if (sbProfiles && sbProfiles.length > 0) {
            staffRows = sbProfiles.map((p) => {
              let deptId = null;
              let deptName = 'Municipal Department';
              const empId = p.employee_id || '';
              if (empId.startsWith('PWD') || p.department_id === '8ed9f760-1314-427c-a515-c2a54d6df6d8') { deptId = 1; deptName = 'Roads & Public Works (PWD)'; }
              else if (empId.startsWith('SAN') || p.department_id === '9cabc1f2-fd10-48dd-a5cb-01d05197de22') { deptId = 2; deptName = 'Sanitation & Waste Management'; }
              else if (empId.startsWith('WTR') || p.department_id === 'ead370cc-459c-44f0-899f-8a97f0928beb') { deptId = 3; deptName = 'Water Supply & Sewerage Board'; }
              else if (empId.startsWith('DRN') || p.department_id === 'ee73cb82-cc47-4333-b7d6-4491353c1354') { deptId = 4; deptName = 'Drainage & Sewage Department'; }
              else if (empId.startsWith('ELE') || p.department_id === '31842723-23ac-490b-912b-9f6d9afbdfb3') { deptId = 5; deptName = 'Electrical & Lighting Dept'; }
              else if (empId.startsWith('TRF') || p.department_id === 'ae5e4d0c-996f-4d81-9528-d642664c93ae') { deptId = 6; deptName = 'Traffic Management Dept'; }
              else if (empId.startsWith('MNT') || p.department_id === '71542723-23ac-490b-912b-9f6d9afbdfb7') { deptId = 7; deptName = 'Maintenance Department'; }

              return {
                id: p.id,
                name: p.full_name || p.name || 'Staff Member',
                email: p.email || '',
                mobile: p.mobile || '',
                employee_id: p.employee_id || `STF-${String(p.id).slice(0, 4).toUpperCase()}`,
                designation: 'Field Service Staff',
                department_id: deptId,
                department_name: deptName,
                status: p.status || 'active',
                language_pref: p.language_pref || 'en',
                created_at: p.created_at,
                active_tasks: 0,
                completed_tasks: 0,
                overdue_tasks: 0
              };
            });

            if (!isAdmin) {
              staffRows = staffRows.filter(s => s.department_id == userDeptId);
            } else if (req.query.department_id) {
              const filterId = codeToIdMap[String(req.query.department_id).toUpperCase()] || req.query.department_id;
              staffRows = staffRows.filter(s => s.department_id == filterId);
            }

            if (filterStatus === 'active') {
              staffRows = staffRows.filter(s => (s.status || '').toLowerCase() === 'active');
            } else if (filterStatus === 'inactive') {
              staffRows = staffRows.filter(s => (s.status || '').toLowerCase() === 'inactive');
            }

            if (searchQuery) {
              const q = searchQuery.toLowerCase();
              staffRows = staffRows.filter(s =>
                s.name.toLowerCase().includes(q) ||
                s.email.toLowerCase().includes(q) ||
                s.mobile.toLowerCase().includes(q) ||
                s.employee_id.toLowerCase().includes(q)
              );
            }
          }
        }
      } catch (sbErr) {
        console.warn('Supabase fallback staff query note:', sbErr);
      }
    }

    const staffList = staffRows.map((row) => ({
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

    if (totalStaff === 0 && staffList.length > 0) {
      staffList.forEach((s) => {
        const st = (s.status || '').toLowerCase();
        if (st === 'active') activeStaff++;
        if (st === 'inactive') inactiveStaff++;
        if (st !== 'archived') totalStaff++;
      });
    }

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
      if (s === '1' || s.includes('pwd') || s.includes('road')) return 'PWD';
      if (s === '2' || s.includes('san') || s.includes('waste')) return 'SAN';
      if (s === '3' || s.includes('wtr') || s.includes('water')) return 'WTR';
      if (s === '4' || s === '7' || s.includes('drn') || s.includes('drain')) return 'DRN';
      if (s === '5' || s === '4' || s.includes('ele') || s.includes('electric')) return 'ELE';
      if (s === '6' || s.includes('trf') || s.includes('traffic')) return 'TRF';
      if (s === '7' || s === '6' || s.includes('mnt') || s.includes('maint')) return 'MNT';
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

    // 5. Update Complaint in Database with affected row verification
    const updateRes = await query(
      `UPDATE complaints
       SET assigned_staff_id = $1,
           assigned_staff_name = $2,
           assigned_staff_email = $3,
           assigned_by = $4,
           assigned_by_name = $5,
           status = 'Staff Assigned',
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $6 OR complaint_number = $6`,
      [staff.id, staff.name, staff.email || '', req.user.id, req.user.name || 'Department Head', complaint.id]
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
      [complaint.id, staff.id, req.user.id]
    ).catch(() => {});

    await query(
      `INSERT INTO task_assignments (complaint_id, staff_id, assigned_by, created_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP)`,
      [complaint.id, staff.id, req.user.id]
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
      staff_id: staff.id,
      staff_name: staff.name,
      staff_email: staff.email,
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

    await query(
      `UPDATE complaints 
       SET status = $1, 
           verified_by = $2, 
           verified_by_name = $3, 
           verified_at = CURRENT_TIMESTAMP, 
           updated_at = CURRENT_TIMESTAMP 
       WHERE CAST(id AS TEXT) = $4 OR complaint_number = $4`,
      [targetStatus, verified_by || req.user.id, verified_by_name || req.user.name || 'Department Head', complaint_id]
    );

    const verifyRes = await query(
      `SELECT id, complaint_number, status, verified_by_name, updated_at FROM complaints WHERE CAST(id AS TEXT) = $1 OR complaint_number = $1`,
      [complaint_id]
    );

    if (!verifyRes.rows || verifyRes.rows.length === 0 || verifyRes.rows[0].status !== targetStatus) {
      return res.status(500).json({ error: 'Verification failed: Database read-back failed' });
    }

    await query(
      `INSERT INTO complaint_status_history (complaint_id, status, remark, department, updated_by) VALUES ($1, $2, $3, $4, $5)`,
      [complaint_id, targetStatus, `Department Head verified repair proof and resolved ticket.`, 'Department Operations', req.user.name || 'Department Head']
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
