const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { query } = require('../config/db');

// Admin Auth Guard
router.use(authenticateToken);
router.use(requireRole(['admin', 'city_admin']));

// Admin Analytics summary
router.get('/analytics', async (req, res) => {
  try {
    const totalSql = `SELECT COUNT(*) as total FROM complaints`;
    const totalRes = await query(totalSql);

    const resolvedSql = `SELECT COUNT(*) as resolved FROM complaints WHERE status = 'Resolved'`;
    const resolvedRes = await query(resolvedSql);

    const pendingSql = `SELECT COUNT(*) as pending FROM complaints WHERE status IN ('Submitted', 'Verified', 'Assigned', 'In Progress')`;
    const pendingRes = await query(pendingSql);

    const categorySql = `SELECT category, COUNT(*) as count FROM complaints GROUP BY category`;
    const categoryRes = await query(categorySql);

    const deptSql = `
      SELECT d.name as department_name, COUNT(c.id) as total_complaints,
             SUM(CASE WHEN c.status = 'Resolved' THEN 1 ELSE 0 END) as resolved_count
      FROM departments d
      LEFT JOIN complaints c ON c.department_id = d.id
      GROUP BY d.id, d.name
    `;
    const deptRes = await query(deptSql);

    return res.json({
      metrics: {
        total_complaints: totalRes.rows[0].total || 0,
        resolved_complaints: resolvedRes.rows[0].resolved || 0,
        pending_complaints: pendingRes.rows[0].pending || 0,
        resolution_rate: totalRes.rows[0].total > 0 ? Math.round((resolvedRes.rows[0].resolved / totalRes.rows[0].total) * 100) : 0
      },
      by_category: categoryRes.rows,
      by_department: deptRes.rows
    });
  } catch (err) {
    console.error('Analytics error:', err);
    return res.status(500).json({ error: 'Failed to fetch admin analytics' });
  }
});

// Admin Hotspots map data
router.get('/hotspots', async (req, res) => {
  try {
    const sql = `
      SELECT id, category, title, status, priority, latitude, longitude, created_at
      FROM complaints
    `;
    const result = await query(sql);
    return res.json({ complaints: result.rows });
  } catch (err) {
    console.error('Hotspots error:', err);
    return res.status(500).json({ error: 'Failed to fetch hotspot data' });
  }
});

// CRUD Users
router.get('/users', async (req, res) => {
  try {
    const sql = `SELECT id, name, mobile, email, role, language_pref, created_at FROM users ORDER BY id DESC`;
    const result = await query(sql);
    return res.json({ users: result.rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/users', async (req, res) => {
  try {
    const { name, mobile, email, password, role = 'citizen', language_pref = 'en' } = req.body;
    if (!name || !mobile || !password) {
      return res.status(400).json({ error: 'Name, mobile, and password are required' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const sql = `
      INSERT INTO users (name, mobile, email, password_hash, role, language_pref)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const result = await query(sql, [name, mobile, email || null, password_hash, role, language_pref]);

    return res.status(201).json({ message: 'User created successfully', id: result.rows[0].id });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create user: ' + err.message });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const { name, mobile, email, role, language_pref } = req.body;
    const sql = `
      UPDATE users SET name = ?, mobile = ?, email = ?, role = ?, language_pref = ?
      WHERE id = ?
    `;
    await query(sql, [name, mobile, email, role, language_pref, req.params.id]);
    return res.json({ message: 'User updated successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    await query(`DELETE FROM users WHERE id = ?`, [req.params.id]);
    return res.json({ message: 'User deleted successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete user' });
  }
});

// CRUD Departments
router.get('/departments', async (req, res) => {
  try {
    const result = await query(`SELECT * FROM departments ORDER BY id ASC`);
    return res.json({ departments: result.rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

router.post('/departments', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Department name is required' });
    const result = await query(`INSERT INTO departments (name, description) VALUES (?, ?)`, [name, description || '']);
    return res.status(201).json({ message: 'Department created', id: result.rows[0].id });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create department' });
  }
});

// ==========================================
// DEPARTMENT HEADS MANAGEMENT ENDPOINTS
// ==========================================

// GET all Department Heads
router.get('/department-heads', async (req, res) => {
  try {
    const sql = `
      SELECT dh.*, d.name as department_name, d.description as department_description,
             u.id as linked_user_id, u.role as user_role, u.status as user_status
      FROM department_heads dh
      LEFT JOIN departments d ON d.id = dh.department_id
      LEFT JOIN users u ON u.id = dh.user_id OR u.email = dh.email
      ORDER BY dh.id DESC
    `;
    const result = await query(sql);
    return res.json({ department_heads: result.rows });
  } catch (err) {
    console.error('Error fetching department heads:', err);
    return res.status(500).json({ error: 'Failed to fetch department heads' });
  }
});

// Helper function to resolve string code/name/ID to actual database department ID
async function resolveDepartmentId(deptInput) {
  if (!deptInput) return null;
  if (typeof deptInput === 'number' && !isNaN(deptInput)) return deptInput;
  const parsedNum = Number(deptInput);
  if (!isNaN(parsedNum) && parsedNum > 0) return parsedNum;

  const str = String(deptInput).trim();
  const deptRes = await query(
    `SELECT id FROM departments WHERE id = ? OR name LIKE ? OR description LIKE ? LIMIT 1`,
    [str, `%${str}%`, `%${str}%`]
  );
  if (deptRes.rows && deptRes.rows.length > 0) {
    return deptRes.rows[0].id;
  }

  const strUpper = str.toUpperCase();
  if (strUpper.includes('SAN')) {
    const r = await query(`SELECT id FROM departments WHERE name LIKE '%Sanitation%' LIMIT 1`);
    if (r.rows && r.rows.length > 0) return r.rows[0].id;
  }
  if (strUpper.includes('WTR') || strUpper.includes('WATER')) {
    const r = await query(`SELECT id FROM departments WHERE name LIKE '%Water%' LIMIT 1`);
    if (r.rows && r.rows.length > 0) return r.rows[0].id;
  }
  if (strUpper.includes('DRN') || strUpper.includes('DRAIN') || strUpper.includes('SEWER')) {
    const r = await query(`SELECT id FROM departments WHERE name LIKE '%Drain%' OR name LIKE '%Sewer%' LIMIT 1`);
    if (r.rows && r.rows.length > 0) return r.rows[0].id;
  }
  if (strUpper.includes('ELE') || strUpper.includes('LIGHT')) {
    const r = await query(`SELECT id FROM departments WHERE name LIKE '%Electric%' OR name LIKE '%Light%' LIMIT 1`);
    if (r.rows && r.rows.length > 0) return r.rows[0].id;
  }
  if (strUpper.includes('TRF') || strUpper.includes('TRAF')) {
    const r = await query(`SELECT id FROM departments WHERE name LIKE '%Traffic%' LIMIT 1`);
    if (r.rows && r.rows.length > 0) return r.rows[0].id;
  }
  if (strUpper.includes('PWD') || strUpper.includes('ROAD') || strUpper.includes('WORK')) {
    const r = await query(`SELECT id FROM departments WHERE name LIKE '%Public Works%' OR name LIKE '%PWD%' LIMIT 1`);
    if (r.rows && r.rows.length > 0) return r.rows[0].id;
  }

  return null;
}

// POST Create or Appoint Department Head
router.post('/department-heads', async (req, res) => {
  try {
    const { name, fullName, email, phone, mobile, employeeId, departmentId, designation, password, status = 'active' } = req.body;
    const cleanName = (fullName || name || '').trim();
    const cleanEmail = (email || '').trim().toLowerCase();
    const cleanPhone = (mobile || phone || '').trim() || '+91 98220 00000';
    const cleanEmpId = (employeeId || '').trim();
    const cleanDeptId = await resolveDepartmentId(departmentId);

    if (!cleanName || !cleanEmail || !cleanDeptId) {
      return res.status(400).json({ error: 'Name, email, and a valid department selection are required.' });
    }

    // Email Uniqueness Check
    const emailCheck = await query(`SELECT id, email, role FROM users WHERE email = ?`, [cleanEmail]);
    let existingUser = emailCheck.rows && emailCheck.rows.length > 0 ? emailCheck.rows[0] : null;

    if (existingUser) {
      return res.status(400).json({ error: 'Email address is already in use.' });
    }

    // Employee ID Uniqueness Check
    if (cleanEmpId) {
      const empCheck = await query(`SELECT id FROM users WHERE employee_id = ? AND email != ?`, [cleanEmpId, cleanEmail]);
      if (empCheck.rows && empCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Employee ID is already in use.' });
      }
    }

    // Password Hashing
    let passwordHash = null;
    if (password && password.length >= 6) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(password, salt);
    } else {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash('Nagarsetu@2026', salt);
    }

    // Create new User auth account
    const insertUserRes = await query(
      `INSERT INTO users (name, mobile, email, password_hash, role, department_id, employee_id, status) VALUES (?, ?, ?, ?, 'department_head', ?, ?, ?)`,
      [cleanName, cleanPhone, cleanEmail, passwordHash, cleanDeptId, cleanEmpId, status]
    );
    const userId = insertUserRes.rows[0].id;

    // If status is active, deactivate previous active heads for this department
    if (status === 'active') {
      await query(`UPDATE department_heads SET status = 'inactive' WHERE department_id = ?`, [cleanDeptId]);
    }

    // Insert or Update department_heads record
    const dhCheck = await query(`SELECT id FROM department_heads WHERE user_id = ? OR email = ?`, [userId, cleanEmail]);
    if (dhCheck.rows && dhCheck.rows.length > 0) {
      await query(
        `UPDATE department_heads SET user_id = ?, department_id = ?, name = ?, email = ?, phone = ?, employee_id = ?, designation = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [userId, cleanDeptId, cleanName, cleanEmail, cleanPhone, cleanEmpId, designation || 'Department Head', status, dhCheck.rows[0].id]
      );
    } else {
      await query(
        `INSERT INTO department_heads (user_id, department_id, name, email, phone, employee_id, designation, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, cleanDeptId, cleanName, cleanEmail, cleanPhone, cleanEmpId, designation || 'Department Head', status]
      );
    }

    return res.status(201).json({
      message: 'Department Head saved successfully',
      user_id: userId,
      department_id: cleanDeptId,
      status
    });
  } catch (err) {
    console.error('Error saving department head:', err);
    return res.status(500).json({ error: 'Failed to save Department Head: ' + err.message });
  }
});

// PUT Update Department Head by ID
router.put('/department-heads/:id', async (req, res) => {
  try {
    const headId = req.params.id;
    const { name, fullName, email, phone, mobile, employeeId, departmentId, designation, password, status } = req.body;

    const dhRes = await query(`SELECT * FROM department_heads WHERE id = ? OR user_id = ?`, [headId, headId]);
    const uRes = await query(`SELECT * FROM users WHERE id = ? OR email = ?`, [headId, email || '']);

    if ((!dhRes.rows || dhRes.rows.length === 0) && (!uRes.rows || uRes.rows.length === 0)) {
      return res.status(404).json({ error: 'Department Head not found.' });
    }

    const currentHead = dhRes.rows[0] || {};
    const currentUser = uRes.rows[0] || {};
    const targetUserId = currentHead.user_id || currentUser.id;
    const targetEmail = currentHead.email || currentUser.email;

    const newName = (fullName || name || currentHead.name || currentUser.name).trim();
    const newEmail = (email || targetEmail).trim().toLowerCase();
    const newPhone = (mobile || phone || currentHead.phone || currentUser.mobile || '+91 98220 00000').trim();
    const newEmpId = (employeeId !== undefined ? employeeId : (currentHead.employee_id || currentUser.employee_id || '')).trim();
    const newDeptId = departmentId ? (await resolveDepartmentId(departmentId)) : (currentHead.department_id || currentUser.department_id);
    const newStatus = status || currentHead.status || currentUser.status || 'active';

    // Email Uniqueness check if email changed
    if (targetEmail && newEmail !== targetEmail.toLowerCase()) {
      const emailCheck = await query(`SELECT id FROM users WHERE LOWER(email) = ? AND id != ? AND LOWER(email) != ?`, [newEmail, targetUserId, targetEmail.toLowerCase()]);
      if (emailCheck.rows && emailCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Email address is already in use.' });
      }
    }

    // Password Hash update if provided
    let passwordHash = null;
    if (password && password.trim().length > 0) {
      const salt = await bcrypt.genSalt(10);
      passwordHash = await bcrypt.hash(password.trim(), salt);
    }

    // Update Users Auth Account
    if (passwordHash) {
      await query(
        `UPDATE users SET name = ?, mobile = ?, email = ?, password_hash = ?, department_id = ?, employee_id = ?, status = ? WHERE id = ? OR email = ?`,
        [newName, newPhone, newEmail, passwordHash, newDeptId, newEmpId, newStatus, targetUserId, targetEmail]
      );
    } else {
      await query(
        `UPDATE users SET name = ?, mobile = ?, email = ?, department_id = ?, employee_id = ?, status = ? WHERE id = ? OR email = ?`,
        [newName, newPhone, newEmail, newDeptId, newEmpId, newStatus, targetUserId, targetEmail]
      );
    }

    // Update Department Heads record
    if (currentHead.id) {
      await query(
        `UPDATE department_heads SET name = ?, email = ?, phone = ?, employee_id = ?, department_id = ?, designation = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [newName, newEmail, newPhone, newEmpId, newDeptId, designation || currentHead.designation || 'Department Head', newStatus, currentHead.id]
      );
    } else {
      await query(
        `INSERT INTO department_heads (user_id, department_id, name, email, phone, employee_id, designation, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [targetUserId, newDeptId, newName, newEmail, newPhone, newEmpId, designation || 'Department Head', newStatus]
      );
    }

    return res.json({ message: 'Department Head updated successfully' });
  } catch (err) {
    console.error('Error updating department head:', err);
    return res.status(500).json({ error: 'Failed to update Department Head: ' + err.message });
  }
});

// Deactivate Department Head
router.post('/department-heads/:id/deactivate', async (req, res) => {
  try {
    const headId = req.params.id;
    const dhRes = await query(`SELECT * FROM department_heads WHERE id = ? OR user_id = ?`, [headId, headId]);
    if (dhRes.rows && dhRes.rows.length > 0) {
      const head = dhRes.rows[0];
      await query(`UPDATE department_heads SET status = 'inactive', updated_at = CURRENT_TIMESTAMP WHERE id = ? OR user_id = ?`, [headId, headId]);
      await query(`UPDATE users SET status = 'inactive' WHERE id = ? OR email = ?`, [head.user_id, head.email]);
    } else {
      await query(`UPDATE users SET status = 'inactive' WHERE id = ?`, [headId]);
    }
    return res.json({ message: 'Department Head deactivated successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to deactivate Department Head' });
  }
});

// Reactivate Department Head
router.post('/department-heads/:id/reactivate', async (req, res) => {
  try {
    const headId = req.params.id;
    const dhRes = await query(`SELECT * FROM department_heads WHERE id = ? OR user_id = ?`, [headId, headId]);
    if (dhRes.rows && dhRes.rows.length > 0) {
      const head = dhRes.rows[0];
      await query(`UPDATE department_heads SET status = 'inactive' WHERE department_id = ?`, [head.department_id]);
      await query(`UPDATE department_heads SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ? OR user_id = ?`, [headId, headId]);
      await query(`UPDATE users SET status = 'active' WHERE id = ? OR email = ?`, [head.user_id, head.email]);
    } else {
      await query(`UPDATE users SET status = 'active' WHERE id = ?`, [headId]);
    }
    return res.json({ message: 'Department Head reactivated successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to reactivate Department Head' });
  }
});

module.exports = router;
