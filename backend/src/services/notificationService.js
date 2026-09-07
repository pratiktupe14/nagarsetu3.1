const { query, getIsSqlite } = require('../config/db');

async function createNotification(userId, complaintId, message, channel = 'in_app') {
  try {
    let targetUserId = userId;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(userId || ''));
    if (!isUuid && userId) {
      try {
        const uRes = await query(`SELECT mobile, email FROM users WHERE id = ? LIMIT 1`, [userId]);
        if (uRes.rows && uRes.rows.length > 0) {
          const u = uRes.rows[0];
          const cleanMobile = String(u.mobile || '').replace(/\D/g, '').slice(-10);
          const pRes = await query(
            `SELECT id FROM profiles WHERE (mobile LIKE ? OR (email IS NOT NULL AND email != '' AND LOWER(email) = ?)) LIMIT 1`,
            [`%${cleanMobile}%`, String(u.email || '').toLowerCase()]
          );
          if (pRes.rows && pRes.rows.length > 0) {
            targetUserId = pRes.rows[0].id;
          }
        }
      } catch (e) {}
    }

    try {
      const sql = `
        INSERT INTO notifications (user_id, complaint_id, channel, message, is_read, sent_at)
        VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
      `;
      await query(sql, [targetUserId, String(complaintId), channel, message]);
    } catch (insertErr) {
      // In PostgreSQL if channel column doesn't exist
      try {
        await query(
          `INSERT INTO notifications (user_id, complaint_id, message, is_read) VALUES (?, ?, ?, false)`,
          [targetUserId, String(complaintId), message]
        );
      } catch (insertErr2) {
        // Fallback without user_id if FK fails
        await query(
          `INSERT INTO notifications (complaint_id, message, is_read) VALUES (?, ?, false)`,
          [String(complaintId), message]
        ).catch(() => {});
      }
    }
    
    // Web Push / SMS / Email Fallback Stub
    console.log(`[Notification Dispatch - ${channel.toUpperCase()}] User #${userId}: ${message}`);
  } catch (err) {
    console.error('Error creating notification:', err.message);
  }
}

async function notifyStatusChange(complaintId, newStatus, citizenId, extraDetails = '') {
  let message = `Your complaint #${complaintId} status has been updated to "${newStatus}".`;
  if (newStatus === 'Verified') {
    message = `Your complaint #${complaintId} has been verified by the municipal officer.`;
  } else if (newStatus === 'Assigned') {
    message = `Your complaint #${complaintId} has been assigned to field maintenance staff.`;
  } else if (newStatus === 'In Progress') {
    message = `Field staff is currently resolving your complaint #${complaintId}.`;
  } else if (newStatus === 'Resolved') {
    message = `Good news! Your complaint #${complaintId} has been resolved. Tap to view resolution proof and submit feedback.`;
  } else if (newStatus === 'Rejected') {
    message = `Your complaint #${complaintId} was reviewed and rejected. Reason: ${extraDetails || 'Does not meet municipal criteria.'}`;
  }

  await createNotification(citizenId, complaintId, message, 'in_app');
}

module.exports = {
  createNotification,
  notifyStatusChange
};
