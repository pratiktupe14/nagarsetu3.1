const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '../backend/src/routes/complaint.routes.js');
let content = fs.readFileSync(targetPath, 'utf8');

// 1. Ensure import of complaintRepo
if (!content.includes("const complaintRepo = require('../modules/complaints/complaint.repository');")) {
  content = content.replace(
    "const { query } = require('../config/db');",
    "const { query } = require('../config/db');\nconst complaintRepo = require('../modules/complaints/complaint.repository');"
  );
}

// 2. resolveCitizenProfileId replacements
content = content.replace(
  `const directCheck = await query(\`SELECT id FROM profiles WHERE id = ? LIMIT 1\`, [idStr]);`,
  `const directCheck = await complaintRepo.findProfileById(idStr);`
);

content = content.replace(
  `const userRes = await query(\`SELECT id, name, mobile, email, role FROM users WHERE id = ? LIMIT 1\`, [user.id]);`,
  `const userRes = await complaintRepo.findUserById(user.id);`
);

content = content.replace(
  `const profileRes = await query(
      \`SELECT id FROM profiles 
       WHERE (
         (mobile IS NOT NULL AND mobile != '' AND (
           mobile = ? OR mobile = ? OR mobile LIKE ? OR REPLACE(mobile, ' ', '') LIKE ?
         ))
         OR (email IS NOT NULL AND email != '' AND LOWER(email) = ?)
       )
       ORDER BY created_at DESC LIMIT 1\`,
      [rawMobile, cleanMobile, \`%\${cleanMobile}%\`, \`%\${cleanMobile}%\`, cleanEmail || '']
    );`,
  `const profileRes = await complaintRepo.findProfileByMobileOrEmail(rawMobile, cleanMobile, cleanEmail);`
);

content = content.replace(
  `await query(
      \`INSERT INTO profiles (id, full_name, mobile, email, role, language_pref, status) VALUES (?, ?, ?, ?, 'citizen', 'en', 'active')\`,
      [newUuid, dbUser.name || 'Citizen User', rawMobile || cleanMobile, cleanEmail]
    );`,
  `await complaintRepo.insertProfile(newUuid, dbUser.name || 'Citizen User', rawMobile || cleanMobile, cleanEmail);`
);

// 3. resolveDepartmentId replacements
content = content.replace(
  `const codeRes = await query(\`SELECT id FROM departments WHERE UPPER(code) = UPPER(?) LIMIT 1\`, [deptInfo.code]);`,
  `const codeRes = await complaintRepo.findDepartmentByCode(deptInfo.code);`
);

content = content.replace(
  `const nameRes = await query(\`SELECT id FROM departments WHERE UPPER(name) LIKE UPPER(?) LIMIT 1\`, [\`%\${deptInfo.name}%\`]);`,
  `const nameRes = await complaintRepo.findDepartmentByName(deptInfo.name);`
);

content = content.replace(
  `const inputStr = String(deptInput || '').trim();
  if (inputStr) {
    const numericId = parseInt(inputStr, 10);
    if (!isNaN(numericId) && numericId > 0) {
      const idRes = await query(\`SELECT id FROM departments WHERE CAST(id AS TEXT) = ? LIMIT 1\`, [String(numericId)]);
      if (idRes.rows && idRes.rows.length > 0) {
        return idRes.rows[0].id;
      }
    }
    const flexRes = await query(\`SELECT id FROM departments WHERE UPPER(code) = UPPER(?) OR UPPER(name) LIKE UPPER(?) OR CAST(id AS TEXT) = ? LIMIT 1\`, [inputStr, \`%\${inputStr}%\`, inputStr]);
    if (flexRes.rows && flexRes.rows.length > 0) {
      return flexRes.rows[0].id;
    }
  }`,
  `const inputStr = String(deptInput || '').trim();
  if (inputStr) {
    const numericId = parseInt(inputStr, 10);
    const flexRes = await complaintRepo.findDepartmentByIdOrFlex(inputStr, numericId);
    if (flexRes.rows && flexRes.rows.length > 0) {
      return flexRes.rows[0].id;
    }
  }`
);

content = content.replace(
  `const defaultRes = await query(\`SELECT id FROM departments WHERE code = 'PWD' OR UPPER(name) LIKE '%PUBLIC WORKS%' ORDER BY id ASC LIMIT 1\`);
  if (defaultRes.rows && defaultRes.rows.length > 0) {
    return defaultRes.rows[0].id;
  }
  const anyDept = await query(\`SELECT id FROM departments ORDER BY id ASC LIMIT 1\`);
  return anyDept.rows?.[0]?.id || 1;`,
  `const defaultRes = await complaintRepo.findDefaultDepartment();
  return defaultRes.rows?.[0]?.id || 1;`
);

// 4. POST /submit replacements
content = content.replace(
  `const result = await query(insertSql, [
      finalComplaintNumber,
      citizenProfileId,
      photo_url || '',
      normalizedCategory,
      title || \`\${normalizedCategory} Defect\`,
      description || '',
      priority,
      initialStatus,
      finalDeptId,
      typeof latitude === 'number' ? latitude : (parseFloat(latitude) || 0),
      typeof longitude === 'number' ? longitude : (parseFloat(longitude) || 0),
      location_source || 'manual_pin',
      location_address || '',
      duplicate_of_id || null,
      normalizedCategory,
      ai_specific_issue || normalizeSpecificIssue(null, normalizedCategory),
      confidenceVal,
      (ai_severity || priority).toUpperCase(),
      (ai_urgency || priority).toUpperCase(),
      ai_evidence || description || 'Visual evidence recorded.',
      ai_model || 'gemini-3.6-flash',
      ai_analyzed_at || new Date().toISOString(),
      isLowConfidence ? 1 : 0,
      slaDeadline.toISOString()
    ]);`,
  `const result = await complaintRepo.insertComplaint([
      finalComplaintNumber,
      citizenProfileId,
      photo_url || '',
      normalizedCategory,
      title || \`\${normalizedCategory} Defect\`,
      description || '',
      priority,
      initialStatus,
      finalDeptId,
      typeof latitude === 'number' ? latitude : (parseFloat(latitude) || 0),
      typeof longitude === 'number' ? longitude : (parseFloat(longitude) || 0),
      location_source || 'manual_pin',
      location_address || '',
      duplicate_of_id || null,
      normalizedCategory,
      ai_specific_issue || normalizeSpecificIssue(null, normalizedCategory),
      confidenceVal,
      (ai_severity || priority).toUpperCase(),
      (ai_urgency || priority).toUpperCase(),
      ai_evidence || description || 'Visual evidence recorded.',
      ai_model || 'gemini-3.6-flash',
      ai_analyzed_at || new Date().toISOString(),
      isLowConfidence ? 1 : 0,
      slaDeadline.toISOString()
    ]);`
);

content = content.replace(
  `const readBackRes = await query(
      \`SELECT c.*, d.name as department_name, d.code as department_code 
       FROM complaints c 
       LEFT JOIN departments d ON CAST(d.id AS TEXT) = CAST(c.department_id AS TEXT)
       WHERE CAST(c.id AS TEXT) = ? OR c.complaint_number = ? LIMIT 1\`,
      [String(complaintId), String(finalComplaintNumber)]
    );`,
  `const readBackRes = await complaintRepo.findComplaintWithDeptByIdOrNumber(complaintId, finalComplaintNumber);`
);

content = content.replace(
  `await query(
        \`INSERT INTO complaint_status_history (complaint_id, status, remark, department, updated_by) VALUES (?, ?, ?, ?, ?)\`,
        [String(persistedComplaint.id), initialStatus, remarkText, deptName, 'NAGARSETU AI Router']
      );`,
  `await complaintRepo.insertStatusHistory(persistedComplaint.id, initialStatus, remarkText, deptName, 'NAGARSETU AI Router');`
);

// 5. GET /:id/history replacement
content = content.replace(
  `const historyRes = await query(
      \`SELECT h.* FROM complaint_status_history h
       LEFT JOIN complaints c ON CAST(h.complaint_id AS TEXT) = CAST(c.id AS TEXT)
       WHERE CAST(h.complaint_id AS TEXT) = ? OR c.complaint_number = ? OR CAST(c.id AS TEXT) = ?
       ORDER BY h.created_at ASC\`,
      [String(req.params.id), String(req.params.id), String(req.params.id)]
    );`,
  `const historyRes = await complaintRepo.findStatusHistoryByComplaintIdOrNumber(req.params.id);`
);

// 6. GET / replacements
content = content.replace(
  `const uRes = await query('SELECT department_id FROM users WHERE id = ? OR email = ?', [authUser.id, authUser.email || '']);`,
  `const uRes = await complaintRepo.findUserDeptFallback(authUser.id, authUser.email);`
);

content = content.replace(
  `const dhRes = await query('SELECT department_id FROM department_heads WHERE (user_id = ? OR LOWER(email) = LOWER(?)) AND status = \'active\'', [authUser.id, authUser.email || '']);`,
  `const dhRes = await complaintRepo.findDepartmentHeadDeptFallback(authUser.id, authUser.email);`
);

content = content.replace(
  `const result = await query(sql, params);`,
  `const result = await complaintRepo.findComplaintsRaw(sql, params);`
);

// 7. GET /my replacement
content = content.replace(
  `const result = await query(sql, [String(citizenProfileId || ''), String(req.user.id)]);`,
  `const result = await complaintRepo.findMyComplaints(citizenProfileId, req.user.id);`
);

// 8. GET /:id replacements
content = content.replace(
  `const result = await query(sql, [String(req.params.id), String(req.params.id)]);`,
  `const result = await complaintRepo.findComplaintDetailByIdOrNumber(req.params.id);`
);

content = content.replace(
  `const fsCheck = await query(
        'SELECT id, department_id, employee_id FROM field_staff WHERE user_id = $1 OR LOWER(email) = LOWER($2) LIMIT 1',
        [user.id, user.email || '']
      );`,
  `const fsCheck = await complaintRepo.findFieldStaffCheck(user.id, user.email);`
);

content = content.replace(
  `const assignCheck = await query(
          'SELECT id FROM assignments WHERE (CAST(complaint_id AS TEXT) = $1 OR complaint_id = $2) AND (CAST(staff_id AS TEXT) = $3 OR CAST(staff_id AS TEXT) = $4 OR CAST(staff_id AS TEXT) = $5) LIMIT 1',
          [String(complaint.id), complaint.complaint_number || '', String(user.id), String(staffFsId), String(staffEmpId || '')]
        );`,
  `const assignCheck = await complaintRepo.findAssignmentCheck(complaint.id, complaint.complaint_number, user.id, staffFsId, staffEmpId);`
);

content = content.replace(
  `const assignRes = await query(assignSql, [String(complaint.id), String(complaint.id)]);`,
  `const assignRes = await complaintRepo.findLatestAssignment(complaint.id);`
);

// 9. POST /:id/feedback replacements
content = content.replace(
  `const checkRes = await query(checkSql, [req.params.id, req.params.id, req.params.id]);`,
  `const checkRes = await complaintRepo.findComplaintForCheck(req.params.id);`
);

content = content.replace(
  `await query(insertSql, [complaint.id, rating, comment || '']);`,
  `await complaintRepo.insertFeedback(complaint.id, rating, comment || '');`
);

// 10. POST /:id/reopen replacements
content = content.replace(
  `const checkRes = await query(checkSql, [targetId, targetId, targetId]);`,
  `const checkRes = await complaintRepo.findComplaintForCheck(targetId);`
);

content = content.replace(
  `await query(
      \`UPDATE complaints SET status = 'Reopened', rework_reason = ?, admin_rejection_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?\`,
      [reworkReason, reworkReason, complaint.id]
    );`,
  `await complaintRepo.updateComplaintReopen(reworkReason, complaint.id);`
);

content = content.replace(
  `await query(
      \`INSERT INTO complaint_status_history (complaint_id, status, remark, department, updated_by) VALUES (?, ?, ?, ?, ?)\`,
      [complaint.id, 'Reopened', reworkReason, 'Citizen Request', req.user.name || 'Citizen']
    ).catch(() => {});`,
  `await complaintRepo.insertStatusHistory(complaint.id, 'Reopened', reworkReason, 'Citizen Request', req.user.name || 'Citizen').catch(() => {});`
);

// 11. handleStatusUpdate replacements
content = content.replace(
  `const compRes = await query(
      \`SELECT * FROM complaints WHERE CAST(id AS TEXT) = ? OR complaint_number = ? LIMIT 1\`,
      [String(complaintId), String(complaintId)]
    );`,
  `const compRes = await complaintRepo.findComplaintByIdOrNumberLimit1(complaintId);`
);

content = content.replace(
  `await query(updateSql, updateParams);`,
  `await complaintRepo.updateComplaintStatus(updateSql, updateParams);`
);

content = content.replace(
  `await query(
      \`INSERT INTO complaint_status_history (complaint_id, status, remark, department, updated_by)
       VALUES (?, ?, ?, ?, ?)\`,
      [
        complaint.id,
        status,
        remarks || \`Status updated to \${status} by \${req.user.role}\`,
        complaint.department_id || 'Administration',
        req.user.name || req.user.role
      ]
    ).catch(() => {});`,
  `await complaintRepo.insertStatusHistory(
        complaint.id,
        status,
        remarks || \`Status updated to \${status} by \${req.user.role}\`,
        complaint.department_id || 'Administration',
        req.user.name || req.user.role
      ).catch(() => {});`
);

content = content.replace(
  `const updatedRes = await query(\`SELECT * FROM complaints WHERE id = ?\`, [complaint.id]);`,
  `const updatedRes = await complaintRepo.findComplaintById(complaint.id);`
);

// 12. POST /:id/support replacements
content = content.replace(
  `await query(
      \`UPDATE complaints SET support_count = COALESCE(support_count, 0) + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?\`,
      [complaint.id]
    );`,
  `await complaintRepo.incrementSupportCount(complaint.id);`
);

content = content.replace(
  `const updatedRes = await query(\`SELECT support_count FROM complaints WHERE id = ?\`, [complaint.id]);`,
  `const updatedRes = await complaintRepo.findSupportCount(complaint.id);`
);

// 13. purgeHandler replacements
content = content.replace(
  `const purgeHandler = async (req, res) => {
  try {
    await query(\`DELETE FROM feedback\`);
    await query(\`DELETE FROM assignments\`);
    await query(\`DELETE FROM complaint_status_history\`);
    await query(\`DELETE FROM notifications\`);
    await query(\`DELETE FROM complaints\`);
    return res.json({ message: 'All complaints and associated records purged successfully' });
  } catch (err) {
    console.error('Purge all complaints error:', err);
    return res.status(500).json({ error: 'Failed to purge complaints' });
  }
};`,
  `const purgeHandler = async (req, res) => {
  try {
    await complaintRepo.purgeAllComplaints();
    return res.json({ message: 'All complaints and associated records purged successfully' });
  } catch (err) {
    console.error('Purge all complaints error:', err);
    return res.status(500).json({ error: 'Failed to purge complaints' });
  }
};`
);

fs.writeFileSync(targetPath, content, 'utf8');
console.log('Successfully applied Iteration 003A Repository Layer extraction to complaint.routes.js');
