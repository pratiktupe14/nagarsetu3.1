const { query } = require('../../config/db');

/**
 * Complaint Repository Layer
 * Houses raw database operations and query executions for complaints, profiles, feedback, and status history.
 */

// Profile & User Queries
async function findProfileById(idStr) {
  return query(`SELECT id FROM profiles WHERE id = ? LIMIT 1`, [idStr]);
}

async function findUserById(userId) {
  return query(`SELECT id, name, mobile, email, role FROM users WHERE id = ? LIMIT 1`, [userId]);
}

async function findProfileByMobileOrEmail(rawMobile, cleanMobile, cleanEmail) {
  return query(
    `SELECT id FROM profiles
     WHERE (
       (mobile IS NOT NULL AND mobile != '' AND (
         mobile = ? OR mobile = ? OR mobile LIKE ? OR REPLACE(mobile, ' ', '') LIKE ?
       ))
       OR (email IS NOT NULL AND email != '' AND LOWER(email) = ?)
     )
     ORDER BY created_at DESC LIMIT 1`,
    [rawMobile, cleanMobile, `%${cleanMobile}%`, `%${cleanMobile}%`, cleanEmail || '']
  );
}

async function insertProfile(newUuid, fullName, mobile, email) {
  return query(
    `INSERT INTO profiles (id, full_name, mobile, email, role, language_pref, status) VALUES (?, ?, ?, ?, 'citizen', 'en', 'active')`,
    [newUuid, fullName, mobile, email]
  );
}

// Department Resolution Queries
async function findDepartmentByCode(code) {
  return query(`SELECT id FROM departments WHERE UPPER(code) = UPPER(?) LIMIT 1`, [code]);
}

async function findDepartmentByName(name) {
  return query(`SELECT id FROM departments WHERE UPPER(name) LIKE UPPER(?) LIMIT 1`, [`%${name}%`]);
}

async function findDepartmentByIdOrFlex(inputStr, numericId) {
  if (numericId && !isNaN(numericId) && numericId > 0) {
    const idRes = await query(`SELECT id FROM departments WHERE CAST(id AS TEXT) = ? LIMIT 1`, [String(numericId)]);
    if (idRes.rows && idRes.rows.length > 0) return idRes;
  }
  return query(`SELECT id FROM departments WHERE UPPER(code) = UPPER(?) OR UPPER(name) LIKE UPPER(?) OR CAST(id AS TEXT) = ? LIMIT 1`, [inputStr, `%${inputStr}%`, inputStr]);
}

async function findDefaultDepartment() {
  const pwdRes = await query(`SELECT id FROM departments WHERE code = 'PWD' OR UPPER(name) LIKE '%PUBLIC WORKS%' ORDER BY id ASC LIMIT 1`);
  if (pwdRes.rows && pwdRes.rows.length > 0) return pwdRes;
  return query(`SELECT id FROM departments ORDER BY id ASC LIMIT 1`);
}

// Complaint Insertion & Read-Back Verification
async function insertComplaint(params) {
  const insertSql = `
    INSERT INTO complaints (
      complaint_number, citizen_id, photo_before_url, category, title, description, priority,
      status, department_id, latitude, longitude, location_source, location_address, duplicate_of_id,
      ai_category, ai_specific_issue, ai_confidence, ai_severity, ai_urgency, ai_evidence,
      ai_model, ai_analyzed_at, needs_manual_verification, sla_deadline
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  return query(insertSql, params);
}

async function findComplaintWithDeptByIdOrNumber(complaintId, complaintNumber) {
  return query(
    `SELECT c.*, d.name as department_name, d.code as department_code
     FROM complaints c
     LEFT JOIN departments d ON CAST(d.id AS TEXT) = CAST(c.department_id AS TEXT)
     WHERE CAST(c.id AS TEXT) = ? OR c.complaint_number = ? LIMIT 1`,
    [String(complaintId), String(complaintNumber)]
  );
}

// Status History
async function insertStatusHistory(complaintId, status, remark, department, updatedBy) {
  return query(
    `INSERT INTO complaint_status_history (complaint_id, status, remark, department, updated_by) VALUES (?, ?, ?, ?, ?)`,
    [String(complaintId), status, remark, department, updatedBy]
  );
}

async function findStatusHistoryByComplaintIdOrNumber(idOrNumber) {
  return query(
    `SELECT h.* FROM complaint_status_history h
     LEFT JOIN complaints c ON CAST(h.complaint_id AS TEXT) = CAST(c.id AS TEXT)
     WHERE CAST(h.complaint_id AS TEXT) = ? OR c.complaint_number = ? OR CAST(c.id AS TEXT) = ?
     ORDER BY h.created_at ASC`,
    [String(idOrNumber), String(idOrNumber), String(idOrNumber)]
  );
}

// Complaint Retrieval & Filtering
async function findComplaintsRaw(sql, params) {
  return query(sql, params);
}

async function findUserDeptFallback(userId, email) {
  return query('SELECT department_id FROM users WHERE id = ? OR email = ?', [userId, email || '']);
}

async function findDepartmentHeadDeptFallback(userId, email) {
  return query("SELECT department_id FROM department_heads WHERE (user_id = ? OR LOWER(email) = LOWER(?)) AND status = 'active'", [userId, email || '']);
}

async function findMyComplaints(citizenProfileId, authUserId) {
  const DEPT_JOIN_SQL = `
    LEFT JOIN departments d ON (
      CAST(c.department_id AS TEXT) = CAST(d.id AS TEXT)
      OR UPPER(CAST(c.department_id AS TEXT)) = UPPER(d.code)
    )
  `;
  const sql = `
    SELECT c.*, d.name as department_name, d.code as department_code, f.rating, f.comment as feedback_comment
    FROM complaints c
    ${DEPT_JOIN_SQL}
    LEFT JOIN feedback f ON CAST(f.complaint_id AS TEXT) = CAST(c.id AS TEXT)
    WHERE CAST(c.citizen_id AS TEXT) = ? OR CAST(c.citizen_id AS TEXT) = ?
    ORDER BY c.created_at DESC
  `;
  return query(sql, [String(citizenProfileId || ''), String(authUserId)]);
}

async function findComplaintDetailByIdOrNumber(idOrNumber) {
  const DEPT_JOIN_SQL = `
    LEFT JOIN departments d ON (
      CAST(c.department_id AS TEXT) = CAST(d.id AS TEXT)
      OR UPPER(CAST(c.department_id AS TEXT)) = UPPER(d.code)
    )
  `;
  const sql = `
    SELECT c.*, d.name as department_name, d.code as department_code,
           COALESCE(p.full_name, u.name) as citizen_name,
           COALESCE(p.mobile, u.mobile) as citizen_mobile,
           f.rating, f.comment as feedback_comment, f.created_at as feedback_created_at
       FROM complaints c
    ${DEPT_JOIN_SQL}
    LEFT JOIN profiles p ON CAST(c.citizen_id AS TEXT) = CAST(p.id AS TEXT)
    LEFT JOIN users u ON CAST(c.citizen_id AS TEXT) = CAST(u.id AS TEXT) OR (p.mobile IS NOT NULL AND u.mobile = p.mobile)
    LEFT JOIN feedback f ON CAST(f.complaint_id AS TEXT) = CAST(c.id AS TEXT)
    WHERE CAST(c.id AS TEXT) = ? OR c.complaint_number = ?
  `;
  return query(sql, [String(idOrNumber), String(idOrNumber)]);
}

async function findFieldStaffCheck(userId, email) {
  return query(
    'SELECT id, department_id, employee_id FROM field_staff WHERE user_id = $1 OR LOWER(email) = LOWER($2) LIMIT 1',
    [userId, email || '']
  );
}

async function findAssignmentCheck(complaintId, complaintNum, userId, staffFsId, staffEmpId) {
  return query(
    'SELECT id FROM assignments WHERE (CAST(complaint_id AS TEXT) = $1 OR complaint_id = $2) AND (CAST(staff_id AS TEXT) = $3 OR CAST(staff_id AS TEXT) = $4 OR CAST(staff_id AS TEXT) = $5) LIMIT 1',
    [String(complaintId), complaintNum || '', String(userId), String(staffFsId), String(staffEmpId || '')]
  );
}

async function findLatestAssignment(complaintId) {
  const assignSql = `
    SELECT a.*, s.name as staff_name, s.mobile as staff_mobile, o.name as officer_name
    FROM assignments a
    LEFT JOIN users s ON CAST(a.staff_id AS TEXT) = CAST(s.id AS TEXT)
    LEFT JOIN users o ON CAST(a.assigned_by AS TEXT) = CAST(o.id AS TEXT)
    WHERE CAST(a.complaint_id AS TEXT) = ? OR a.complaint_id = ?
    ORDER BY a.assigned_at DESC LIMIT 1
  `;
  return query(assignSql, [String(complaintId), String(complaintId)]);
}

// Feedback, Reopen, Status Update, Support & Purge
async function findComplaintForCheck(idOrNumber) {
  const checkSql = `SELECT id, complaint_number, citizen_id, department_id, status FROM complaints WHERE id = ? OR complaint_number = ? OR CAST(id AS TEXT) = ?`;
  return query(checkSql, [idOrNumber, idOrNumber, idOrNumber]);
}

async function findComplaintByIdOrNumberLimit1(complaintId) {
  return query(
    `SELECT * FROM complaints WHERE CAST(id AS TEXT) = ? OR complaint_number = ? LIMIT 1`,
    [String(complaintId), String(complaintId)]
  );
}

async function insertFeedback(complaintId, rating, comment) {
  const insertSql = `
    INSERT INTO feedback (complaint_id, rating, comment)
    VALUES (?, ?, ?)
  `;
  return query(insertSql, [complaintId, rating, comment || '']);
}

async function updateComplaintReopen(reworkReason, complaintId) {
  return query(
    `UPDATE complaints SET status = 'Reopened', rework_reason = ?, admin_rejection_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [reworkReason, reworkReason, complaintId]
  );
}

async function updateComplaintStatus(updateSql, updateParams) {
  return query(updateSql, updateParams);
}

async function findComplaintById(complaintId) {
  return query(`SELECT * FROM complaints WHERE id = ?`, [complaintId]);
}

async function incrementSupportCount(complaintId) {
  return query(
    `UPDATE complaints SET support_count = COALESCE(support_count, 0) + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
    [complaintId]
  );
}

async function findSupportCount(complaintId) {
  return query(`SELECT support_count FROM complaints WHERE id = ?`, [complaintId]);
}

async function purgeAllComplaints() {
  await query(`DELETE FROM feedback`);
  await query(`DELETE FROM assignments`);
  await query(`DELETE FROM complaint_status_history`);
  await query(`DELETE FROM notifications`);
  return query(`DELETE FROM complaints`);
}

module.exports = {
  findProfileById,
  findUserById,
  findProfileByMobileOrEmail,
  insertProfile,
  findDepartmentByCode,
  findDepartmentByName,
  findDepartmentByIdOrFlex,
  findDefaultDepartment,
  insertComplaint,
  findComplaintWithDeptByIdOrNumber,
  insertStatusHistory,
  findStatusHistoryByComplaintIdOrNumber,
  findComplaintsRaw,
  findUserDeptFallback,
  findDepartmentHeadDeptFallback,
  findMyComplaints,
  findComplaintDetailByIdOrNumber,
  findFieldStaffCheck,
  findAssignmentCheck,
  findLatestAssignment,
  findComplaintForCheck,
  findComplaintByIdOrNumberLimit1,
  insertFeedback,
  updateComplaintReopen,
  updateComplaintStatus,
  findComplaintById,
  incrementSupportCount,
  findSupportCount,
  purgeAllComplaints
};
