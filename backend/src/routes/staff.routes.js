const express = require('express');
const router = express.Router();
const { uploadSingleImage } = require('../middleware/upload');
const { authenticateToken, requireRole } = require('../middleware/auth');
const validateInput = require('../middleware/validateInput');
const { updateTaskStatusSchema, resolveTaskParamsSchema } = require('../schemas/staff.schemas');
const { query } = require('../config/db');
const { notifyStatusChange } = require('../services/notificationService');

// Field Staff Auth Guard
router.use(authenticateToken);
router.use(requireRole(['staff', 'service_staff', 'officer', 'admin', 'city_admin']));

// Get assigned tasks for current field staff member with strict staff and department isolation
router.get('/tasks', async (req, res) => {
  try {
    const fsRes = await query(
      `SELECT fs.*, d.name as dept_name 
       FROM field_staff fs 
       LEFT JOIN departments d ON d.id = fs.department_id 
       WHERE fs.user_id = $1 OR LOWER(fs.email) = LOWER($2) OR fs.employee_id = $3
       LIMIT 1`,
      [req.user.id, req.user.email || '', req.user.employee_id || '']
    );

    let staff = fsRes.rows && fsRes.rows.length > 0 ? fsRes.rows[0] : null;
    let staffDeptId = staff ? staff.department_id : req.user.department_id;
    let staffEmail = staff ? staff.email : (req.user.email || '');
    let staffUserId = staff ? staff.user_id : req.user.id;
    let staffFsId = staff ? staff.id : req.user.id;

    let sql = `
      SELECT c.*, a.id as assignment_id, a.assigned_at, a.resolved_at, d.name as department_name
      FROM complaints c
      LEFT JOIN assignments a ON a.complaint_id = c.id
      LEFT JOIN departments d ON c.department_id = d.id
      WHERE (
        c.assigned_staff_id = $1 OR CAST(c.assigned_staff_id AS TEXT) = $2 OR CAST(c.assigned_staff_id AS TEXT) = $3
        OR a.staff_id = $1 OR a.staff_id = $2
        OR (LOWER(c.assigned_staff_email) = LOWER($4) AND $4 != '')
        OR c.assigned_staff_name = $5
      )
    `;
    const params = [String(staffFsId), String(staffUserId), String(req.user.id), staffEmail, req.user.name || ''];

    if (staffDeptId) {
      sql += ` AND (c.department_id = $6 OR d.id = $6)`;
      params.push(staffDeptId);
    }

    sql += ` ORDER BY c.created_at DESC`;
    const result = await query(sql, params);
    return res.json({ tasks: result.rows });
  } catch (err) {
    console.error('Fetch staff tasks error:', err);
    return res.status(500).json({ error: 'Failed to fetch assigned tasks' });
  }
});

// Update Task status (e.g. to 'In Progress')
router.post('/task/:id/status', validateInput(updateTaskStatusSchema), async (req, res) => {
  try {
    const { status } = req.body;

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
router.post('/task/:id/resolve', async (req, res) => {
  const targetId = req.params.id;
  const dbType = process.env.DB_TYPE || 'postgres';
  let updateErrMessage = 'NONE';
  let affectedRows = 0;
  let oldStatus = 'Unknown';

  try {
    let photoAfterUrl = req.body?.photo_after_url || '';
    if (req.file) {
      photoAfterUrl = req.file.publicUrl || req.file.supabaseUrl || (req.file.filename ? `/uploads/${req.file.filename}` : photoAfterUrl);
    }
    if (!photoAfterUrl && !req.body?.photo_after) {
      photoAfterUrl = '/uploads/temp-after.jpg';
    }

    const workPerformed = req.body?.work_performed || req.body?.work_notes || 'Field work completed on site.';
    const materialsUsed = req.body?.materials_used || '';
    const additionalNotes = req.body?.additional_notes || '';

    // 1. Authoritative Complaint Record Lookup by complaint ID, complaint_number, assignment ID, or task_assignment ID
    const compRes = await query(
      `SELECT c.id, c.complaint_number, c.citizen_id, c.status, c.assigned_staff_id, c.assigned_staff_email, c.assigned_staff_name, c.department_id
       FROM complaints c
       LEFT JOIN assignments a ON CAST(a.complaint_id AS TEXT) = CAST(c.id AS TEXT) OR a.complaint_id = c.complaint_number
       WHERE CAST(c.id AS TEXT) = $1 
          OR c.complaint_number = $2 
          OR CAST(a.id AS TEXT) = $3 
          OR CAST(a.complaint_id AS TEXT) = $4
       LIMIT 1`,
      [targetId, targetId, targetId, targetId]
    );

    if (!compRes.rows || compRes.rows.length === 0) {
      console.log('========== [RESOLVE DEBUG] ==========');
      console.log(`task ID: ${targetId}`);
      console.log(`authenticated staff ID: ${req.user?.id || 'N/A'}`);
      console.log(`authenticated staff email: ${req.user?.email || 'N/A'}`);
      console.log(`authenticated department: ${req.user?.department_id || req.user?.department || 'N/A'}`);
      console.log(`database type: ${dbType}`);
      console.log(`old complaint status: NOT FOUND`);
      console.log(`target complaint status: Resolution Submitted`);
      console.log(`UPDATE result: 0 rows affected (Complaint record not found)`);
      console.log(`affected rows: 0`);
      console.log(`database error code/message: Complaint ID ${targetId} not found in database`);
      console.log(`read-back result: FAILED (Record not found)`);
      console.log('====================================');

      return res.status(404).json({ error: `Complaint record not found for task ID: ${targetId}` });
    }

    const complaint = compRes.rows[0];
    oldStatus = complaint.status || 'In Progress';
    const primaryKeyId = String(complaint.id);
    const complaintNum = complaint.complaint_number || '';

    // 2. Perform DB Update
    let updateRes = null;
    try {
      updateRes = await query(
        `UPDATE complaints 
         SET photo_after_url = $1, 
             work_performed = $2, 
             materials_used = $3, 
             additional_notes = $4, 
             status = 'Resolution Submitted', 
             updated_at = CURRENT_TIMESTAMP 
         WHERE CAST(id AS TEXT) = $5 
            OR complaint_number = $6 
            OR CAST(id AS TEXT) = $7`,
        [photoAfterUrl, workPerformed, materialsUsed, additionalNotes, primaryKeyId, complaintNum, targetId]
      );
      affectedRows = updateRes?.rowCount !== undefined ? updateRes.rowCount : 1;
    } catch (uErr) {
      updateErrMessage = uErr?.message || String(uErr);
      console.error('Update complaint error in resolve:', uErr);
    }

    // 3. Database Read-Back Verification
    const verifyRes = await query(
      `SELECT id, complaint_number, status, photo_after_url, work_performed, materials_used, assigned_staff_id, assigned_staff_email, assigned_staff_name, department_id, updated_at 
       FROM complaints 
       WHERE CAST(id AS TEXT) = $1 
          OR complaint_number = $2 
          OR CAST(id AS TEXT) = $3`,
      [primaryKeyId, complaintNum, targetId]
    );

    const verifiedComp = verifyRes.rows && verifyRes.rows.length > 0 ? verifyRes.rows[0] : null;
    const readBackStatus = verifiedComp?.status || 'N/A';
    const isVerified = verifiedComp && (verifiedComp.status === 'Resolution Submitted' || verifiedComp.status === 'Completed — Pending Verification');

    // SERVER-SIDE DIAGNOSTIC LOGGING (STEP 2)
    console.log('========== [RESOLVE DEBUG] ==========');
    console.log(`task ID: ${targetId}`);
    console.log(`authenticated staff ID: ${req.user?.id || 'N/A'}`);
    console.log(`authenticated staff email: ${req.user?.email || 'N/A'}`);
    console.log(`authenticated department: ${req.user?.department_id || req.user?.department || 'N/A'}`);
    console.log(`database type: ${dbType}`);
    console.log(`old complaint status: ${oldStatus}`);
    console.log(`target complaint status: Resolution Submitted`);
    console.log(`UPDATE result: ${affectedRows} row(s) affected`);
    console.log(`affected rows: ${affectedRows}`);
    console.log(`database error code/message: ${updateErrMessage}`);
    console.log(`read-back result: ${readBackStatus} (${isVerified ? 'VERIFIED' : 'UNVERIFIED'})`);
    console.log('====================================');

    if (!isVerified) {
      return res.status(500).json({
        error: `Database update verification failed: status in DB is '${readBackStatus}' instead of 'Resolution Submitted'. Affected rows: ${affectedRows}`
      });
    }

    // History and notification updates
    await query(
      `INSERT INTO complaint_status_history (complaint_id, status, remark, department, updated_by) VALUES ($1, $2, $3, $4, $5)`,
      [complaint.id, 'Resolution Submitted', 'Field work completed with resolution photo proof. Awaiting Department Head verification.', 'Field Operations', req.user.name || 'Field Staff']
    ).catch(() => {});

    await query(
      `UPDATE assignments SET resolved_at = CURRENT_TIMESTAMP WHERE (CAST(complaint_id AS TEXT) = $1 OR staff_id = $2)`,
      [primaryKeyId, req.user.id]
    ).catch(() => {});

    await notifyStatusChange(complaint.id, 'Resolution Submitted', complaint.citizen_id).catch(() => {});

    return res.json({
      success: true,
      message: 'Task resolution submitted successfully for Department Head verification',
      photo_after_url: photoAfterUrl,
      status: verifiedComp.status,
      updated_at: verifiedComp.updated_at,
      task: {
        id: complaint.id,
        complaint_number: complaint.complaint_number,
        status: verifiedComp.status
      }
    });
  } catch (err) {
    console.error('Resolve task error:', err);
    return res.status(500).json({ error: `Failed to resolve task: ${err?.message || 'Server error'}` });
  }
});

module.exports = router;
