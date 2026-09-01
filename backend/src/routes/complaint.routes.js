const express = require('express');
const router = express.Router();
const path = require('path');
const { uploadSingleImage } = require('../middleware/upload');
const { authenticateToken } = require('../middleware/auth');
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

async function resolveDepartmentId(deptInput, categoryInput, titleInput) {
  // Authoritative taxonomy lookup using normalized category
  const normalizedCategory = normalizeCategory(categoryInput || titleInput);
  const deptInfo = getDepartmentForCategory(normalizedCategory);

  // 1. Direct database lookup by department code (e.g., PWD, SAN, WTR, DRN, ELE, TRF, MNT)
  if (deptInfo && deptInfo.code) {
    const codeRes = await query(`SELECT id FROM departments WHERE UPPER(code) = UPPER($1) LIMIT 1`, [deptInfo.code]);
    if (codeRes.rows && codeRes.rows.length > 0) {
      return codeRes.rows[0].id;
    }
  }

  // 2. Direct database lookup by department name
  if (deptInfo && deptInfo.name) {
    const nameRes = await query(`SELECT id FROM departments WHERE UPPER(name) LIKE UPPER($1) LIMIT 1`, [`%${deptInfo.name}%`]);
    if (nameRes.rows && nameRes.rows.length > 0) {
      return nameRes.rows[0].id;
    }
  }

  // 3. Fallback: Lookup by user/dept input if provided
  const inputStr = String(deptInput || '').trim();
  if (inputStr) {
    const numericId = parseInt(inputStr, 10);
    if (!isNaN(numericId) && numericId > 0) {
      const idRes = await query(`SELECT id FROM departments WHERE id = $1 LIMIT 1`, [numericId]);
      if (idRes.rows && idRes.rows.length > 0) {
        return idRes.rows[0].id;
      }
    }
    const flexRes = await query(`SELECT id FROM departments WHERE UPPER(code) = UPPER($1) OR UPPER(name) LIKE UPPER($2) LIMIT 1`, [inputStr, `%${inputStr}%`]);
    if (flexRes.rows && flexRes.rows.length > 0) {
      return flexRes.rows[0].id;
    }
  }

  // Fallback to PWD (id 1) if database has entries
  const defaultRes = await query(`SELECT id FROM departments ORDER BY id ASC LIMIT 1`);
  return defaultRes.rows?.[0]?.id || 1;
}

// Step 2: Final Complaint Submission
router.post('/submit', authenticateToken, validateInput(createComplaintSchema), async (req, res) => {
  try {
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
      return res.status(400).json({ error: 'Validation Error: Unable to resolve a valid municipal department for this complaint.' });
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
      req.user.id,
      photo_url,
      normalizedCategory,
      title || `${normalizedCategory} Defect`,
      description || '',
      priority,
      initialStatus,
      finalDeptId,
      latitude,
      longitude,
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

    // Fetch department name for status history
    let deptName = 'Municipal Triage Queue';
    try {
      const deptNameRes = await query(`SELECT name FROM departments WHERE id = ?`, [finalDeptId]);
      if (deptNameRes.rows && deptNameRes.rows.length > 0) {
        deptName = deptNameRes.rows[0].name;
      }
    } catch (dErr) {}

    // Record initial status history
    try {
      const remarkText = isLowConfidence
        ? 'Complaint registered. Awaiting officer manual verification (Low AI confidence / AI unavailable).'
        : `Complaint registered and automatically routed to ${deptName} via AI Vision classification.`;

      await query(
        `INSERT INTO complaint_status_history (complaint_id, status, remark, department, updated_by) VALUES (?, ?, ?, ?, ?)`,
        [complaintId, initialStatus, remarkText, deptName, 'NAGARSETU AI Router']
      );
    } catch (hErr) {
      console.warn('Failed to record initial status history:', hErr.message);
    }

    // Send initial submission notification
    await notifyStatusChange(complaintId, initialStatus, req.user.id);

    return res.status(201).json({
      success: true,
      message: 'Complaint submitted successfully',
      complaint_id: complaintId,
      complaint: {
        id: complaintId,
        complaint_number: finalComplaintNumber,
        category: normalizedCategory,
        specific_issue: ai_specific_issue || normalizeSpecificIssue(null, normalizedCategory),
        urgency: ai_urgency || priority,
        confidence: confidenceVal,
        department: {
          id: finalDeptId,
          name: deptName
        },
        status: initialStatus,
        needs_manual_verification: isLowConfidence
      }
    });
  } catch (err) {
    console.error('Submit complaint error:', err);
    return res.status(500).json({ error: 'Failed to submit complaint' });
  }
});

// Get complaint status history timeline
router.get('/:id/history', authenticateToken, async (req, res) => {
  try {
    const historyRes = await query(
      `SELECT h.* FROM complaint_status_history h
       LEFT JOIN complaints c ON h.complaint_id = c.id
       WHERE h.complaint_id = ? OR c.complaint_number = ? OR CAST(c.id AS TEXT) = ?
       ORDER BY h.created_at ASC`,
      [req.params.id, req.params.id, req.params.id]
    );
    return res.json({ history: historyRes.rows || [] });
  } catch (err) {
    console.error('Fetch complaint status history error:', err);
    return res.status(500).json({ error: 'Failed to fetch status history' });
  }
});

// Get all complaints for Admin (all departments) or Department Head (isolated by department_id)
router.get('/', async (req, res) => {
  try {
    const jwt = require('jsonwebtoken');
    const { JWT_SECRET } = require('../middleware/auth');

    let authUser = null;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      try {
        authUser = jwt.verify(token, JWT_SECRET);
      } catch (e) {}
    }

    let sql = `
      SELECT c.*, d.name as department_name, d.code as department_code, f.rating, f.comment as feedback_comment
      FROM complaints c
      LEFT JOIN departments d ON c.department_id = d.id
      LEFT JOIN feedback f ON f.complaint_id = c.id
      WHERE 1=1
    `;
    const params = [];

    // Server-side Data Isolation based on Role
    if (authUser && authUser.role === 'citizen') {
      sql += ` AND (c.citizen_id = $1 OR CAST(c.citizen_id AS TEXT) = $2)`;
      params.push(authUser.id, String(authUser.id));
    } else if (authUser && authUser.role === 'department_head') {
      let deptId = authUser.department_id;
      if (!deptId) {
        const uRes = await query('SELECT department_id FROM users WHERE id = $1 OR email = $2', [authUser.id, authUser.email || '']);
        if (uRes.rows && uRes.rows.length > 0) deptId = uRes.rows[0].department_id;
      }
      if (!deptId) {
        const dhRes = await query('SELECT department_id FROM department_heads WHERE (user_id = $1 OR LOWER(email) = LOWER($2)) AND status = \'active\'', [authUser.id, authUser.email || '']);
        if (dhRes.rows && dhRes.rows.length > 0) deptId = dhRes.rows[0].department_id;
      }
      sql += ` AND (c.department_id = $1 OR CAST(c.department_id AS TEXT) = $2)`;
      params.push(deptId || -1, String(deptId || -1));
    } else if (req.query.department_id) {
      sql += ` AND (c.department_id = $1 OR CAST(c.department_id AS TEXT) = $2)`;
      params.push(req.query.department_id, String(req.query.department_id));
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
    const sql = `
      SELECT c.*, d.name as department_name, f.rating, f.comment as feedback_comment
      FROM complaints c
      LEFT JOIN departments d ON c.department_id = d.id
      LEFT JOIN feedback f ON f.complaint_id = c.id
      WHERE c.citizen_id = ? OR CAST(c.citizen_id AS TEXT) = ?
      ORDER BY c.created_at DESC
    `;
    const result = await query(sql, [req.user.id, String(req.user.id)]);
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
      SELECT c.*, d.name as department_name,
             u.name as citizen_name, u.mobile as citizen_mobile,
             f.rating, f.comment as feedback_comment, f.created_at as feedback_created_at
      FROM complaints c
      LEFT JOIN departments d ON c.department_id = d.id
      LEFT JOIN users u ON c.citizen_id = u.id
      LEFT JOIN feedback f ON f.complaint_id = c.id
      WHERE c.id = ? OR c.complaint_number = ? OR CAST(c.id AS TEXT) = ?
    `;
    const result = await query(sql, [req.params.id, req.params.id, req.params.id]);
    if (!result.rows || result.rows.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const complaint = result.rows[0];

    // IDOR Authorization Guard: Citizens can ONLY view their own complaints
    if (req.user && req.user.role === 'citizen') {
      if (String(complaint.citizen_id) !== String(req.user.id)) {
        return res.status(403).json({ error: 'Access denied: You are not authorized to view this complaint.' });
      }
    }

    // Fetch assignment details if any
    const assignSql = `
      SELECT a.*, s.name as staff_name, s.mobile as staff_mobile, o.name as officer_name
      FROM assignments a
      LEFT JOIN users s ON a.staff_id = s.id
      LEFT JOIN users o ON a.assigned_by = o.id
      WHERE a.complaint_id = ?
      ORDER BY a.assigned_at DESC LIMIT 1
    `;
    const assignRes = await query(assignSql, [complaint.id]);
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
    if (req.user && req.user.role === 'citizen' && String(complaint.citizen_id) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Access denied: You are not authorized to submit feedback for this complaint.' });
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
// Purge/remove all complaints and associated records
router.delete('/purge-all', async (req, res) => {
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
});

router.post('/purge-all', async (req, res) => {
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
});

module.exports = router;
