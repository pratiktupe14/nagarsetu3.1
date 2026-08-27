const express = require('express');
const router = express.Router();
const { uploadSingleImage } = require('../middleware/upload');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { query } = require('../config/db');
const { notifyStatusChange } = require('../services/notificationService');

// Field Staff Auth Guard
router.use(authenticateToken);
router.use(requireRole(['staff', 'admin']));

// Get assigned tasks for current field staff member
router.get('/tasks', async (req, res) => {
  try {
    const sql = `
      SELECT c.*, a.id as assignment_id, a.assigned_at, a.resolved_at, d.name as department_name
      FROM assignments a
      INNER JOIN complaints c ON a.complaint_id = c.id
      LEFT JOIN departments d ON c.department_id = d.id
      WHERE a.staff_id = ?
      ORDER BY a.assigned_at DESC
    `;
    const result = await query(sql, [req.user.id]);
    return res.json({ tasks: result.rows });
  } catch (err) {
    console.error('Fetch staff tasks error:', err);
    return res.status(500).json({ error: 'Failed to fetch assigned tasks' });
  }
});

// Update Task status (e.g. to 'In Progress')
router.post('/task/:id/status', async (req, res) => {
  try {
    const { status } = req.body; // 'In Progress'
    if (!status) return res.status(400).json({ error: 'Status is required' });

    const compRes = await query(`SELECT citizen_id FROM complaints WHERE id = ?`, [req.params.id]);
    if (!compRes.rows || compRes.rows.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    await query(`UPDATE complaints SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [status, req.params.id]);
    await query(
      `INSERT INTO complaint_status_history (complaint_id, status, remark, department, updated_by) VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, status, `Field staff updated task status to ${status}.`, 'Field Operations', req.user.name || 'Field Staff']
    ).catch(() => {});
    await notifyStatusChange(req.params.id, status, compRes.rows[0].citizen_id);

    return res.json({ message: `Task status updated to ${status}` });
  } catch (err) {
    console.error('Task status update error:', err);
    return res.status(500).json({ error: 'Failed to update task status' });
  }
});

// Resolve Task with "After" Photo Proof
router.post('/task/:id/resolve', uploadSingleImage('photo_after'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Resolution photo proof ("after" photo) is required' });
    }

    const photoAfterUrl = `/uploads/${req.file.filename}`;

    const compRes = await query(`SELECT citizen_id FROM complaints WHERE id = ?`, [req.params.id]);
    if (!compRes.rows || compRes.rows.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }
    const citizenId = compRes.rows[0].citizen_id;

    // Update complaint record with after photo and 'Resolved' status
    await query(
      `UPDATE complaints SET photo_after_url = ?, status = 'Resolved', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [photoAfterUrl, req.params.id]
    );

    await query(
      `INSERT INTO complaint_status_history (complaint_id, status, remark, department, updated_by) VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, 'Resolved', 'Field work completed with resolution photo proof.', 'Field Operations', req.user.name || 'Field Staff']
    ).catch(() => {});

    // Update assignment record with resolved_at timestamp
    await query(
      `UPDATE assignments SET resolved_at = CURRENT_TIMESTAMP WHERE complaint_id = ? AND staff_id = ?`,
      [req.params.id, req.user.id]
    );

    // Notify Citizen
    await notifyStatusChange(req.params.id, 'Resolved', citizenId);

    return res.json({
      message: 'Task resolved successfully with photo proof',
      photo_after_url: photoAfterUrl
    });
  } catch (err) {
    console.error('Resolve task error:', err);
    return res.status(500).json({ error: 'Failed to resolve task' });
  }
});

module.exports = router;
