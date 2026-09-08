const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const validateInput = require('../middleware/validateInput');
const { markReadSchema } = require('../schemas/notification.schemas');
const { query } = require('../config/db');

router.use(authenticateToken);

// Get user notifications
router.get(['/', '/my'], async (req, res) => {
  try {
    const userIdStr = String(req.user.id);
    const userRole = req.user.role || 'citizen';
    const isAdmin = ['admin', 'city_admin'].includes(userRole);

    let whereClause = `WHERE (CAST(n.user_id AS TEXT) = ? OR LOWER(COALESCE(CAST(n.user_id AS TEXT), '')) = LOWER(?))`;
    const params = [userIdStr, req.user.email || ''];

    if (isAdmin) {
      whereClause = `WHERE (CAST(n.user_id AS TEXT) = ? OR LOWER(COALESCE(CAST(n.user_id AS TEXT), '')) = LOWER(?) OR CAST(n.user_id AS TEXT) = 'admin-group')`;
    }

    const sql = `
      SELECT n.*, c.title as complaint_title, c.complaint_number
      FROM notifications n
      LEFT JOIN complaints c ON (CAST(n.complaint_id AS TEXT) = CAST(c.id AS TEXT) OR CAST(n.complaint_id AS TEXT) = c.complaint_number)
      ${whereClause}
      ORDER BY n.created_at DESC
      LIMIT 50
    `;
    const result = await query(sql, params);
    return res.json({ notifications: result.rows });
  } catch (err) {
    console.error('Fetch notifications error:', err);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notifications read
router.post('/mark-read', validateInput(markReadSchema), async (req, res) => {
  try {
    const { notification_id } = req.body;
    const userIdStr = String(req.user.id);
    if (notification_id) {
      await query(`UPDATE notifications SET is_read = true WHERE (CAST(id AS TEXT) = ? OR CAST(id AS TEXT) = ?) AND (CAST(user_id AS TEXT) = ? OR user_id IS NULL OR user_id = 'admin-group')`, [String(notification_id), String(notification_id), userIdStr]);
    } else {
      await query(`UPDATE notifications SET is_read = true WHERE CAST(user_id AS TEXT) = ? OR user_id IS NULL OR user_id = 'admin-group'`, [userIdStr]);
    }
    return res.json({ message: 'Notifications marked as read' });
  } catch (err) {
    console.error('Mark read notifications error:', err);
    return res.status(500).json({ error: 'Failed to update notifications' });
  }
});

module.exports = router;
