const express = require('express');
const router = express.Router();
const path = require('path');
const { uploadSingleImage } = require('../middleware/upload');
const { authenticateToken, optionalAuthenticateToken, requireRole } = require('../middleware/auth');
const validateInput = require('../middleware/validateInput');
const { createComplaintSchema, addFeedbackSchema } = require('../schemas/complaint.schemas');
const { query } = require('../config/db');
const { resolveLocation, checkForDuplicates } = require('../services/locationService');
const { analyzeComplaintPhoto } = require('../services/aiService');
const { notifyStatusChange } = require('../services/notificationService');

const { normalizeCategory, getDepartmentForCategory, normalizeSpecificIssue } = require('../services/taxonomyService');

// No-cache middleware for dynamic complaint data
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Step 1: Upload photo, extract location (EXIF / Live GPS / Pin), call AI analyzer
router.post('/analyze-upload', authenticateToken, uploadSingleImage('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No photo file provided' });
    }

    const photoUrl = req.file.publicUrl || req.file.supabaseUrl || (req.file.filename ? `/uploads/${req.file.filename}` : '/uploads/temp-photo.jpg');
    const fileInput = req.file.buffer || req.file.path || req.file;

    const liveLat = req.body.liveLat ? parseFloat(req.body.liveLat) : null;
    const liveLng = req.body.liveLng ? parseFloat(req.body.liveLng) : null;
    const manualLat = req.body.manualLat ? parseFloat(req.body.manualLat) : null;
    const manualLng = req.body.manualLng ? parseFloat(req.body.manualLng) : null;

    // Resolve location according to exact priority specification
    const locationRes = await resolveLocation(fileInput, liveLat, liveLng, manualLat, manualLng);

    // If client needs to make a decision due to 500m+ conflict between EXIF and Live GPS
    if (locationRes.requiresUserChoice) {
      return res.json({
        step: 'location_conflict_resolution',
        photo_url: photoUrl,
        location_conflict: locationRes
      });
    }

    // If EXIF stripped and no live GPS provided -> trigger mandatory map pin-drop step
    if (locationRes.requiresManualPin) {
      return res.json({
        step: 'manual_pin_required',
        photo_url: photoUrl,
        message: locationRes.message
      });
    }

    // Run AI Vision Analysis
    const aiAnalysis = await analyzeComplaintPhoto(fileInput);

    // Check potential duplicate complaints within 100m radius
    const duplicates = await checkForDuplicates(locationRes.latitude, locationRes.longitude, aiAnalysis.category, 100);

    return res.json({
      step: 'review_and_confirm',
      photo_url: photoUrl,
      location: {
        latitude: locationRes.latitude,
        longitude: locationRes.longitude,
        source: locationRes.location_source
      },
      ai: aiAnalysis,
      duplicates_found: duplicates
    });
  } catch (err) {
    console.error('Analyze upload error:', err);
    return res.status(500).json({ error: 'Failed to process and analyze photo.' });
  }
});

async function resolveCitizenProfileId(user) {
  if (!user) return null;

  // 1. Direct UUID check if user.id is already a UUID
  const idStr = String(user.id || '').trim();
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idStr);
  if (isUuid) {
    try {
      const directCheck = await query(`SELECT id FROM profiles WHERE id = ? LIMIT 1`, [idStr]);
      if (directCheck.rows && directCheck.rows.length > 0) {
        return directCheck.rows[0].id;
      }
    } catch (e) {}
  }

  // 2. Fetch authoritative user record from users table to get verified mobile and email
  let dbUser = user;
  try {
    const userRes = await query(`SELECT id, name, mobile, email, role FROM users WHERE id = ? LIMIT 1`, [user.id]);
    if (userRes.rows && userRes.rows.length > 0) {
      dbUser = userRes.rows[0];
    }
  } catch (uErr) {}

  const rawMobile = String(dbUser.mobile || user.mobile || '').trim();
  const digitsOnly = rawMobile.replace(/\D/g, '');
  const cleanMobile = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly;
  const cleanEmail = String(dbUser.email || user.email || '').trim().toLowerCase();

  // 3. Resolve profile UUID via existing mobile or email relationship
  try {
    const profileRes = await query(
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

    if (profileRes.rows && profileRes.rows.length > 0) {
      return profileRes.rows[0].id;
    }
  } catch (pErr) {
    console.warn('[RESOLVE CITIZEN PROFILE ERROR]:', pErr.message);
  }

  // 4. Auto-create/sync a profile in profiles table for referential integrity
  try {
    const crypto = require('crypto');
    const newUuid = (crypto.randomUUID && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : '00000000-0000-4000-8000-' + crypto.randomBytes(6).toString('hex');
    await query(
      `INSERT INTO profiles (id, full_name, mobile, email, role, language_pref, status) VALUES (?, ?, ?, ?, 'citizen', 'en', 'active')`,
      [newUuid, dbUser.name || 'Citizen User', rawMobile || cleanMobile, cleanEmail]
    );
    return newUuid;
  } catch (cErr) {
    // Fallback directly to user.id
    return String(user.id);
  }
}

async function resolveDepartmentId(deptInput, categoryInput, titleInput) {
  // Authoritative taxonomy lookup using normalized category
  const normalizedCategory = normalizeCategory(categoryInput || titleInput);
  const deptInfo = getDepartmentForCategory(normalizedCategory);

  // 1. Direct database lookup by department code (e.g., PWD, SAN, WTR, DRN, ELE, TRF, MNT)
  if (deptInfo && deptInfo.code) {
    const codeRes = await query(`SELECT id FROM departments WHERE UPPER(code) = UPPER(?) LIMIT 1`, [deptInfo.code]);
    if (codeRes.rows && codeRes.rows.length > 0) {
      return codeRes.rows[0].id;
    }
  }

  // 2. Direct database lookup by department name
  if (deptInfo && deptInfo.name) {
    const nameRes = await query(`SELECT id FROM departments WHERE UPPER(name) LIKE UPPER(?) LIMIT 1`, [`%${deptInfo.name}%`]);
    if (nameRes.rows && nameRes.rows.length > 0) {
      return nameRes.rows[0].id;
    }
  }

  // 3. Fallback: Lookup by user/dept input if provided
  const inputStr = String(deptInput || '').trim();
  if (inputStr) {
    const numericId = parseInt(inputStr, 10);
    if (!isNaN(numericId) && numericId > 0) {
      const idRes = await query(`SELECT id FROM departments WHERE CAST(id AS TEXT) = ? LIMIT 1`, [String(numericId)]);
      if (idRes.rows && idRes.rows.length > 0) {
        return idRes.rows[0].id;
      }
    }
    const flexRes = await query(`SELECT id FROM departments WHERE UPPER(code) = UPPER(?) OR UPPER(name) LIKE UPPER(?) OR CAST(id AS TEXT) = ? LIMIT 1`, [inputStr, `%${inputStr}%`, inputStr]);
    if (flexRes.rows && flexRes.rows.length > 0) {
      return flexRes.rows[0].id;
    }
  }

  // Fallback to PWD if database has entries
  const defaultRes = await query(`SELECT id FROM departments WHERE code = 'PWD' OR UPPER(name) LIKE '%PUBLIC WORKS%' ORDER BY id ASC LIMIT 1`);
  if (defaultRes.rows && defaultRes.rows.length > 0) {
    return defaultRes.rows[0].id;
  }
  const anyDept = await query(`SELECT id FROM departments ORDER BY id ASC LIMIT 1`);
  return anyDept.rows?.[0]?.id || 1;
}

// Step 2: Final Complaint Submission
router.post('/submit', authenticateToken, validateInput(createComplaintSchema), async (req, res) => {
  try {
    // 1. Authenticate user
    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // 2. Resolve profile UUID for authenticated user
    const citizenProfileId = await resolveCitizenProfileId(req.user);
    if (!citizenProfileId) {
      return res.status(404).json({ error: 'Citizen profile not found' });
    }

    const {
      complaint_number,
      photo_url,
      category,
      title,
      description,
      priority = 'Medium',
      latitude,
      longitude,
      location_source,
      location_address,
      department_id,
      duplicate_of_id,
      ai_category,
      ai_specific_issue,
      ai_confidence,
      ai_severity,
      ai_urgency,
      ai_evidence,
      ai_model,
      ai_analyzed_at,
      needs_manual_verification
    } = req.body;

    const normalizedCategory = normalizeCategory(ai_category || category);
    const finalComplaintNumber = complaint_number || `NS-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const finalDeptId = await resolveDepartmentId(department_id, normalizedCategory, title);

    if (!finalDeptId) {
      return res.status(400).json({ error: 'Invalid complaint data: Unable to resolve a valid municipal department.' });
    }

    const confidenceVal = typeof ai_confidence === 'number' ? ai_confidence : 0.90;
    const isLowConfidence = confidenceVal < 0.80 || needs_manual_verification === true;
    const initialStatus = isLowConfidence ? 'NEEDS_VERIFICATION' : 'Submitted';

    const insertSql = `
      INSERT INTO complaints (
        complaint_number, citizen_id, photo_before_url, category, title, description, priority,
        status, department_id, latitude, longitude, location_source, location_address, duplicate_of_id,
        ai_category, ai_specific_issue, ai_confidence, ai_severity, ai_urgency, ai_evidence,
        ai_model, ai_analyzed_at, needs_manual_verification
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await query(insertSql, [
      finalComplaintNumber,
      citizenProfileId,
      photo_url || '',
      normalizedCategory,
      title || `${normalizedCategory} Defect`,
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
      isLowConfidence ? 1 : 0
    ]);

    const complaintId = result.rows[0].id;

    // 6. Read the inserted complaint back from PostgreSQL to verify authoritative persistence
    const readBackRes = await query(
      `SELECT c.*, d.name as department_name, d.code as department_code 
       FROM complaints c 
       LEFT JOIN departments d ON CAST(d.id AS TEXT) = CAST(c.department_id AS TEXT)
       WHERE CAST(c.id AS TEXT) = ? OR c.complaint_number = ? LIMIT 1`,
      [String(complaintId), String(finalComplaintNumber)]
    );

    const persistedComplaint = readBackRes.rows && readBackRes.rows.length > 0 ? readBackRes.rows[0] : null;
    if (!persistedComplaint) {
      console.error(`Read-back verification failed: Complaint #${complaintId} (${finalComplaintNumber}) was not found in storage.`);
      return res.status(500).json({ error: 'Unable to save complaint to the database' });
    }

    // Fetch department name for status history
    const deptName = persistedComplaint.department_name || 'Municipal Triage Queue';

    // Record initial status history
    try {
      const remarkText = isLowConfidence
        ? 'Complaint registered. Awaiting officer manual verification (Low AI confidence / AI unavailable).'
        : `Complaint registered and automatically routed to ${deptName} via AI Vision classification.`;

      await query(
        `INSERT INTO complaint_status_history (complaint_id, status, remark, department, updated_by) VALUES (?, ?, ?, ?, ?)`,
        [String(persistedComplaint.id), initialStatus, remarkText, deptName, 'NAGARSETU AI Router']
      );
    } catch (hErr) {
      console.warn('Failed to record initial status history:', hErr.message);
    }

    // Send initial submission notification
    await notifyStatusChange(persistedComplaint.id, initialStatus, citizenProfileId).catch(nErr => console.warn('Notification notice:', nErr.message));

    return res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully',
      complaint_id: persistedComplaint.id,
      complaint: {
        id: persistedComplaint.id,
        complaint_number: persistedComplaint.complaint_number,
        citizen_id: persistedComplaint.citizen_id,
        category: persistedComplaint.category,
        title: persistedComplaint.title,
        description: persistedComplaint.description,
        priority: persistedComplaint.priority,
        latitude: persistedComplaint.latitude,
        longitude: persistedComplaint.longitude,
        location_address: persistedComplaint.location_address,
        photo_before_url: persistedComplaint.photo_before_url,
        specific_issue: persistedComplaint.ai_specific_issue || normalizeSpecificIssue(null, persistedComplaint.category),
        urgency: persistedComplaint.ai_urgency || persistedComplaint.priority,
        confidence: persistedComplaint.ai_confidence || confidenceVal,
        department: {
          id: persistedComplaint.department_id,
          name: deptName
        },
        status: persistedComplaint.status,
        needs_manual_verification: isLowConfidence,
        created_at: persistedComplaint.created_at
      }
    });
  } catch (err) {
    console.error('Submit complaint database error:', err);
    return res.status(500).json({
      error: 'Unable to save complaint to the database',
      details: err.message || 'Database error occurred during submission'
    });
  }
});

// Get complaint status history timeline
router.get('/:id/history', authenticateToken, async (req, res) => {
  try {
    const historyRes = await query(
      `SELECT h.* FROM complaint_status_history h
       LEFT JOIN complaints c ON CAST(h.complaint_id AS TEXT) = CAST(c.id AS TEXT)
       WHERE CAST(h.complaint_id AS TEXT) = ? OR c.complaint_number = ? OR CAST(c.id AS TEXT) = ?
       ORDER BY h.created_at ASC`,
      [String(req.params.id), String(req.params.id), String(req.params.id)]
    );
    return res.json({ history: historyRes.rows || [] });
  } catch (err) {
    console.error('Fetch complaint status history error:', err);
    return res.status(500).json({ error: 'Failed to fetch status history' });
  }
});

// Helper for department join condition
const DEPT_JOIN_SQL = `
  LEFT JOIN departments d ON (
    CAST(c.department_id AS TEXT) = CAST(d.id AS TEXT)
    OR UPPER(CAST(c.department_id AS TEXT)) = UPPER(d.code)
    OR (CAST(c.department_id AS TEXT) = '8ed9f760-1314-427c-a515-c2a54d6df6d8' AND d.code = 'PWD')
    OR (CAST(c.department_id AS TEXT) = '9cabc1f2-fd10-48dd-a5cb-01d05197de22' AND d.code = 'SAN')
    OR (CAST(c.department_id AS TEXT) = 'ead370cc-459c-44f0-899f-8a97f0928beb' AND d.code = 'WTR')
    OR (CAST(c.department_id AS TEXT) = 'ee73cb82-cc47-4333-b7d6-4491353c1354' AND d.code = 'DRN')
    OR (CAST(c.department_id AS TEXT) = '31842723-23ac-490b-912b-9f6d9afbdfb3' AND d.code = 'ELE')
    OR (CAST(c.department_id AS TEXT) = 'ae5e4d0c-996f-4d81-9528-d642664c93ae' AND d.code = 'TRF')
  )
`;

// Get complaints for Admin (all departments), Department Head (isolated by department), Citizen (own), or Public
router.get('/', optionalAuthenticateToken, async (req, res) => {
  try {
    const authUser = req.user;

    let sql = `
      SELECT c.*, d.name as department_name, d.code as department_code, f.rating, f.comment as feedback_comment
      FROM complaints c
      ${DEPT_JOIN_SQL}
      LEFT JOIN feedback f ON CAST(f.complaint_id AS TEXT) = CAST(c.id AS TEXT)
      WHERE 1=1
    `;
    const params = [];

    // Server-side Data Isolation based on Role
    if (authUser && authUser.role === 'citizen') {
      const citizenProfileId = await resolveCitizenProfileId(authUser);
      sql += ` AND (CAST(c.citizen_id AS TEXT) = ? OR CAST(c.citizen_id AS TEXT) = ?)`;
      params.push(String(citizenProfileId || ''), String(authUser.id));
    } else if (authUser && authUser.role === 'department_head') {
      let deptId = authUser.department_id;
      if (!deptId) {
        const uRes = await query('SELECT department_id FROM users WHERE id = ? OR email = ?', [authUser.id, authUser.email || '']);
        if (uRes.rows && uRes.rows.length > 0) deptId = uRes.rows[0].department_id;
      }
      if (!deptId) {
        const dhRes = await query('SELECT department_id FROM department_heads WHERE (user_id = ? OR LOWER(email) = LOWER(?)) AND status = \'active\'', [authUser.id, authUser.email || '']);
        if (dhRes.rows && dhRes.rows.length > 0) deptId = dhRes.rows[0].department_id;
      }
      sql += ` AND (
        CAST(c.department_id AS TEXT) = ?
        OR (d.id IS NOT NULL AND CAST(d.id AS TEXT) = ?)
        OR (d.code IS NOT NULL AND UPPER(d.code) = UPPER(?))
      )`;
      params.push(String(deptId || -1), String(deptId || -1), String(deptId || -1));
    } else if (authUser && (authUser.role === 'admin' || authUser.role === 'city_admin')) {
      if (req.query.department_id) {
        sql += ` AND (
          CAST(c.department_id AS TEXT) = ?
          OR (d.id IS NOT NULL AND CAST(d.id AS TEXT) = ?)
          OR (d.code IS NOT NULL AND UPPER(d.code) = UPPER(?))
        )`;
        params.push(String(req.query.department_id), String(req.query.department_id), String(req.query.department_id));
      }
    } else {
      // Unauthenticated / Public visitor: show non-draft complaints, allow optional department_id filter
      if (req.query.department_id) {
        sql += ` AND (
          CAST(c.department_id AS TEXT) = ?
          OR (d.id IS NOT NULL AND CAST(d.id AS TEXT) = ?)
          OR (d.code IS NOT NULL AND UPPER(d.code) = UPPER(?))
        )`;
        params.push(String(req.query.department_id), String(req.query.department_id), String(req.query.department_id));
      }
      sql += ` AND (CAST(c.status AS TEXT) NOT IN ('Draft', 'draft'))`;
    }

    sql += ` ORDER BY c.created_at DESC`;

    const result = await query(sql, params);
    return res.json({ complaints: result.rows });
  } catch (err) {
    console.error('Fetch complaints error:', err);
    return res.status(500).json({ error: 'Failed to fetch complaints' });
  }
});

// Get user's complaint history
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const citizenProfileId = await resolveCitizenProfileId(req.user);
    const sql = `
      SELECT c.*, d.name as department_name, d.code as department_code, f.rating, f.comment as feedback_comment
      FROM complaints c
      ${DEPT_JOIN_SQL}
      LEFT JOIN feedback f ON CAST(f.complaint_id AS TEXT) = CAST(c.id AS TEXT)
      WHERE CAST(c.citizen_id AS TEXT) = ? OR CAST(c.citizen_id AS TEXT) = ?
      ORDER BY c.created_at DESC
    `;
    const result = await query(sql, [String(citizenProfileId || ''), String(req.user.id)]);
    return res.json({ complaints: result.rows });
  } catch (err) {
    console.error('Fetch my complaints error:', err);
    return res.status(500).json({ error: 'Failed to fetch complaints' });
  }
});

// Get single complaint by ID
router.get('/:id', authenticateToken, async (req, res) => {
  try {
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
    const result = await query(sql, [String(req.params.id), String(req.params.id)]);
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const complaint = result.rows[0];

    // IDOR Authorization Guard: Citizens can ONLY view their own complaints
    if (req.user && req.user.role === 'citizen') {
      const citizenProfileId = await resolveCitizenProfileId(req.user);
      const isOwner = (citizenProfileId && String(complaint.citizen_id) === String(citizenProfileId)) ||
                      String(complaint.citizen_id) === String(req.user.id);
      if (!isOwner) {
        return res.status(403).json({ error: 'Citizen access denied: You are not authorized to view this complaint.' });
      }
    }

    // Fetch assignment details if any
    const assignSql = `
      SELECT a.*, s.name as staff_name, s.mobile as staff_mobile, o.name as officer_name
      FROM assignments a
      LEFT JOIN users s ON CAST(a.staff_id AS TEXT) = CAST(s.id AS TEXT)
      LEFT JOIN users o ON CAST(a.assigned_by AS TEXT) = CAST(o.id AS TEXT)
      WHERE CAST(a.complaint_id AS TEXT) = ? OR a.complaint_id = ?
      ORDER BY a.assigned_at DESC LIMIT 1
    `;
    const assignRes = await query(assignSql, [String(complaint.id), String(complaint.id)]);
    complaint.assignment = assignRes.rows && assignRes.rows.length > 0 ? assignRes.rows[0] : null;

    return res.json({ complaint });
  } catch (err) {
    console.error('Fetch complaint detail error:', err);
    return res.status(500).json({ error: 'Failed to fetch complaint details' });
  }
});

// Submit Feedback for resolved complaint (IDOR protected)
router.post('/:id/feedback', authenticateToken, validateInput(addFeedbackSchema), async (req, res) => {
  try {
    const { rating, comment } = req.body;

    const checkSql = `SELECT id, citizen_id FROM complaints WHERE id = ? OR complaint_number = ? OR CAST(id AS TEXT) = ?`;
    const checkRes = await query(checkSql, [req.params.id, req.params.id, req.params.id]);

    if (!checkRes.rows || checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const complaint = checkRes.rows[0];
    if (req.user && req.user.role === 'citizen') {
      const citizenProfileId = await resolveCitizenProfileId(req.user);
      const isOwner = (citizenProfileId && String(complaint.citizen_id) === String(citizenProfileId)) ||
                      String(complaint.citizen_id) === String(req.user.id);
      if (!isOwner) {
        return res.status(403).json({ error: 'Citizen access denied: You are not authorized to submit feedback for this complaint.' });
      }
    }

    const insertSql = `
      INSERT INTO feedback (complaint_id, rating, comment)
      VALUES (?, ?, ?)
    `;
    await query(insertSql, [complaint.id, rating, comment || '']);

    return res.json({ message: 'Feedback submitted successfully' });
  } catch (err) {
    console.error('Submit feedback error:', err);
    return res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// Reopen a complaint (Citizen owner or Admin)
router.post('/:id/reopen', authenticateToken, async (req, res) => {
  try {
    const { reason } = req.body;
    const targetId = req.params.id;

    const checkSql = `SELECT id, complaint_number, citizen_id, status FROM complaints WHERE id = ? OR complaint_number = ? OR CAST(id AS TEXT) = ?`;
    const checkRes = await query(checkSql, [targetId, targetId, targetId]);

    if (!checkRes.rows || checkRes.rows.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const complaint = checkRes.rows[0];
    if (req.user && req.user.role === 'citizen') {
      const citizenProfileId = await resolveCitizenProfileId(req.user);
      const isOwner = (citizenProfileId && String(complaint.citizen_id) === String(citizenProfileId)) ||
                      String(complaint.citizen_id) === String(req.user.id);
      if (!isOwner) {
        return res.status(403).json({ error: 'Access denied: You can only reopen your own complaints.' });
      }
    }

    const reworkReason = reason || 'Citizen reopened the issue';
    await query(
      `UPDATE complaints SET status = 'Reopened', rework_reason = ?, admin_rejection_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [reworkReason, reworkReason, complaint.id]
    );

    await query(
      `INSERT INTO complaint_status_history (complaint_id, status, remark, department, updated_by) VALUES (?, ?, ?, ?, ?)`,
      [complaint.id, 'Reopened', reworkReason, 'Citizen Request', req.user.name || 'Citizen']
    ).catch(() => {});

    await notifyStatusChange(complaint.id, 'Reopened', complaint.citizen_id).catch(() => {});

    return res.json({ success: true, message: 'Complaint reopened successfully' });
  } catch (err) {
    console.error('Reopen complaint error:', err);
    return res.status(500).json({ error: 'Failed to reopen complaint' });
  }
});

// Update complaint status (Admin / City Admin / Department Head)
const handleStatusUpdate = async (req, res) => {
  try {
    const complaintId = req.params.id;
    const { status, remarks, rejection_reason, priority, department_name, department_id } = req.body;

    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }

    const compRes = await query(
      `SELECT * FROM complaints WHERE CAST(id AS TEXT) = ? OR complaint_number = ? LIMIT 1`,
      [String(complaintId), String(complaintId)]
    );
    if (!compRes.rows || compRes.rows.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const complaint = compRes.rows[0];

    const updateParams = [status, new Date().toISOString()];
    let updateSql = `UPDATE complaints SET status = ?, updated_at = ?`;

    if (priority) {
      updateSql += `, priority = ?`;
      updateParams.push(priority);
    }

    if (department_id || department_name) {
      const resolvedDept = await resolveDepartmentId(department_id, null, department_name);
      if (resolvedDept) {
        updateSql += `, department_id = ?`;
        updateParams.push(resolvedDept);
      }
    }

    if (rejection_reason) {
      updateSql += `, admin_rejection_reason = ?`;
      updateParams.push(rejection_reason);
    }
    updateSql += ` WHERE id = ?`;
    updateParams.push(complaint.id);

    await query(updateSql, updateParams);

    // Record auditable status history
    await query(
      `INSERT INTO complaint_status_history (complaint_id, status, remark, department, updated_by)
       VALUES (?, ?, ?, ?, ?)`,
      [
        complaint.id,
        status,
        remarks || `Status updated to ${status} by ${req.user.role}`,
        complaint.department_id || 'Administration',
        req.user.name || req.user.role
      ]
    ).catch(() => {});

    await notifyStatusChange(complaint.id, status, complaint.citizen_id).catch(() => {});

    const updatedRes = await query(`SELECT * FROM complaints WHERE id = ?`, [complaint.id]);
    return res.json({
      success: true,
      message: `Complaint status updated to ${status}`,
      complaint: updatedRes.rows[0]
    });
  } catch (err) {
    console.error('Update complaint status error:', err);
    return res.status(500).json({ error: 'Failed to update complaint status' });
  }
};

router.patch('/:id/status', authenticateToken, requireRole(['admin', 'city_admin', 'department_head']), handleStatusUpdate);
router.put('/:id/status', authenticateToken, requireRole(['admin', 'city_admin', 'department_head']), handleStatusUpdate);

// Citizen duplicate issue support / upvote (atomic persistent counter)
router.post('/:id/support', authenticateToken, async (req, res) => {
  try {
    const complaintId = req.params.id;
    const compRes = await query(
      `SELECT * FROM complaints WHERE CAST(id AS TEXT) = ? OR complaint_number = ? LIMIT 1`,
      [String(complaintId), String(complaintId)]
    );
    if (!compRes.rows || compRes.rows.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }
    const complaint = compRes.rows[0];

    await query(
      `UPDATE complaints SET support_count = COALESCE(support_count, 0) + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [complaint.id]
    );

    const updatedRes = await query(`SELECT support_count FROM complaints WHERE id = ?`, [complaint.id]);
    const count = updatedRes.rows && updatedRes.rows[0] ? updatedRes.rows[0].support_count : 1;

    return res.json({ success: true, message: 'Issue supported successfully', support_count: count });
  } catch (err) {
    console.error('Support complaint error:', err);
    return res.status(500).json({ error: 'Failed to support issue' });
  }
});

// Purge/remove all complaints and associated records (Admin Only)
const purgeHandler = async (req, res) => {
  try {
    await query(`DELETE FROM feedback`);
    await query(`DELETE FROM assignments`);
    await query(`DELETE FROM complaint_status_history`);
    await query(`DELETE FROM notifications`);
    await query(`DELETE FROM complaints`);
    return res.json({ message: 'All complaints and associated records purged successfully' });
  } catch (err) {
    console.error('Purge all complaints error:', err);
    return res.status(500).json({ error: 'Failed to purge complaints' });
  }
};
router.delete('/purge-all', authenticateToken, requireRole(['admin', 'city_admin']), purgeHandler);
router.post('/purge-all', authenticateToken, requireRole(['admin', 'city_admin']), purgeHandler);

module.exports = router;
