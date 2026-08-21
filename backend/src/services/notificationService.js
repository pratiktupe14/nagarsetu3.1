const { query } = require('../config/db');

async function createNotification(userId, complaintId, message, channel = 'in_app') {
  try {
    const sql = `
      INSERT INTO notifications (user_id, complaint_id, channel, message, is_read, sent_at)
      VALUES (?, ?, ?, ?, 0, CURRENT_TIMESTAMP)
    `;
    await query(sql, [userId, complaintId, channel, message]);
    
    // Web Push / SMS / Email Fallback Stub
    console.log(`[Notification Dispatch - ${channel.toUpperCase()}] User #${userId}: ${message}`);
  } catch (err) {
    console.error('Error creating notification:', err);
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
