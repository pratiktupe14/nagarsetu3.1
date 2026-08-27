const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const { query } = require('../config/db');
const { notifyStatusChange } = require('../services/notificationService');

// Officer Auth Guard
router.use(authenticateToken);
router.use(requireRole(['officer', 'admin', 'city_admin', 'department_head']));

// Command Center Dashboard Complaints list with filters
router.get('/dashboard', async (req, res) => {
  try {
    const { department_id, priority, status, search } = req.query;

    let sql = `
      SELECT c.*, d.name as department_name, u.name as citizen_name, u.mobile as citizen_mobile
      FROM complaints c
      LEFT JOIN departments d ON c.department_id = d.id
      LEFT JOIN users u ON c.citizen_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (department_id) {
      sql += ` AND c.department_id = ?`;
      params.push(department_id);
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

// Get available field staff for assignment
router.get('/staff-list', async (req, res) => {
  try {
    const sql = `SELECT id, name, mobile, email FROM users WHERE role = 'staff'`;
    const result = await query(sql);
    return res.json({ staff: result.rows });
  } catch (err) {
    console.error('Fetch staff list error:', err);
    return res.status(500).json({ error: 'Failed to fetch staff members' });
  }
});

// Verify & Approve / Reject Complaint
router.post('/verify', async (req, res) => {
  try {
    const { complaint_id, action, rejection_reason } = req.body; // action: 'approve' or 'reject'
    if (!complaint_id || !action) {
      return res.status(400).json({ error: 'complaint_id and action are required' });
    }

    const compRes = await query(`SELECT citizen_id FROM complaints WHERE id = ?`, [complaint_id]);
    if (!compRes.rows || compRes.rows.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }
    const citizenId = compRes.rows[0].citizen_id;

    if (action === 'approve') {
      await query(`UPDATE complaints SET status = 'Verified', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [complaint_id]);
      await query(
        `INSERT INTO complaint_status_history (complaint_id, status, remark, department, updated_by) VALUES (?, ?, ?, ?, ?)`,
        [complaint_id, 'Verified', 'Complaint verified and approved by municipal officer.', 'Municipal Review', req.user.name || 'Municipal Officer']
      ).catch(() => {});
      await notifyStatusChange(complaint_id, 'Verified', citizenId);
      return res.json({ message: 'Complaint verified and approved' });
    } else if (action === 'reject') {
      await query(`UPDATE complaints SET status = 'Rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [complaint_id]);
      await query(
        `INSERT INTO complaint_status_history (complaint_id, status, remark, department, updated_by) VALUES (?, ?, ?, ?, ?)`,
        [complaint_id, 'Rejected', rejection_reason || 'Does not meet municipal criteria.', 'Municipal Review', req.user.name || 'Municipal Officer']
      ).catch(() => {});
      await notifyStatusChange(complaint_id, 'Rejected', citizenId, rejection_reason);
      return res.json({ message: 'Complaint rejected' });
    }

    return res.status(400).json({ error: 'Invalid action type' });
  } catch (err) {
    console.error('Officer verify error:', err);
    return res.status(500).json({ error: 'Failed to process verification' });
  }
});

// Assign complaint to staff member
router.post('/assign', async (req, res) => {
  try {
    const { complaint_id, staff_id, department_id } = req.body;
    if (!complaint_id || !staff_id) {
      return res.status(400).json({ error: 'complaint_id and staff_id are required' });
    }

    const compRes = await query(`SELECT citizen_id FROM complaints WHERE id = ?`, [complaint_id]);
    if (!compRes.rows || compRes.rows.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }
    const citizenId = compRes.rows[0].citizen_id;

    // Record assignment
    const assignSql = `
      INSERT INTO assignments (complaint_id, staff_id, assigned_by, assigned_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `;
    await query(assignSql, [complaint_id, staff_id, req.user.id]);

    // Update complaint status & department
    let updateSql = `UPDATE complaints SET status = 'Assigned', updated_at = CURRENT_TIMESTAMP`;
    const params = [];
    if (department_id) {
      updateSql += `, department_id = ?`;
      params.push(department_id);
    }
    updateSql += ` WHERE id = ?`;
    params.push(complaint_id);
    await query(updateSql, params);

    // Record status history
    try {
      const staffRes = await query(`SELECT name FROM users WHERE id = ?`, [staff_id]);
      const staffName = staffRes.rows?.[0]?.name || 'Field Officer';
      await query(
        `INSERT INTO complaint_status_history (complaint_id, status, remark, department, updated_by) VALUES (?, ?, ?, ?, ?)`,
        [complaint_id, 'Assigned', `Assigned to field staff ${staffName}.`, 'Department Operations', req.user.name || 'Municipal Officer']
      );
    } catch (hErr) {}

    // Trigger Notification
    await notifyStatusChange(complaint_id, 'Assigned', citizenId);

    return res.json({ message: 'Complaint assigned to field staff successfully' });
  } catch (err) {
    console.error('Officer assign error:', err);
    return res.status(500).json({ error: 'Failed to assign complaint' });
  }
});

// List duplicate complaints
router.get('/duplicates', async (req, res) => {
  try {
    const sql = `
      SELECT c.*, d.name as department_name, orig.title as original_title
      FROM complaints c
      LEFT JOIN departments d ON c.department_id = d.id
      INNER JOIN complaints orig ON c.duplicate_of_id = orig.id
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
