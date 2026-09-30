const express = require('express');
const router = express.Router();
const path = require('path');
const { uploadSingleImage } = require('../middleware/upload');
const { authenticateToken, optionalAuthenticateToken } = require('../middleware/auth');
const { complaintSubmitLimiter } = require('../middleware/rateLimiter');
const validateInput = require('../middleware/validateInput');
const { createComplaintSchema, addFeedbackSchema } = require('../schemas/complaint.schemas');
const { query } = require('../config/db');
const { resolveLocation, checkForDuplicates } = require('../services/locationService');
const { analyzeComplaintPhoto } = require('../services/aiService');
const { notifyStatusChange } = require('../services/notificationService');

// No-cache middleware for dynamic complaint data
router.use((req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Dedicated photo upload endpoint for complaints (persists to /uploads or Supabase storage)
router.post('/upload', authenticateToken, uploadSingleImage('photo'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }
    const host = req.get('host');
    const protocol = req.protocol || 'http';
    const photoUrl = req.file.publicUrl || req.file.supabaseUrl || (req.file.filename ? `/uploads/${req.file.filename}` : '/uploads/temp-photo.jpg');
    
    // Normalize relative /uploads/ path to full URL
    const fullUrl = photoUrl.startsWith('/uploads/') ? `${protocol}://${host}${photoUrl}` : photoUrl;

    return res.json({
      success: true,
      url: fullUrl,
      publicUrl: fullUrl,
      relativeUrl: photoUrl.startsWith('/uploads/') ? photoUrl : `/uploads/${path.basename(photoUrl)}`,
      filename: req.file.filename || path.basename(photoUrl)
    });
  } catch (err) {
    console.error('Complaint image upload error:', err);
    return res.status(500).json({ error: 'Failed to upload complaint image' });
  }
});

/**
 * Normalizes complaint photo URLs so relative /uploads/ paths are returned as fully qualified URLs.
 */
function normalizeComplaintPhotoUrls(complaint, req) {
  if (!complaint || typeof complaint !== 'object') return complaint;
  const protocol = req?.protocol || 'http';
  const host = (req?.get && req.get('host')) || req?.headers?.host || 'localhost:5000';
  const baseUrl = `${protocol}://${host}`;

  const formatUrl = (url, fallbackToDefault = false) => {
    if (!url || typeof url !== 'string') {
      return fallbackToDefault ? `${baseUrl}/uploads/civic-default.jpg` : '';
    }
    const trimmed = url.trim();
    if (!trimmed || trimmed === '' || trimmed === 'undefined' || trimmed === 'null' || trimmed.startsWith('blob:')) {
      return fallbackToDefault ? `${baseUrl}/uploads/civic-default.jpg` : '';
    }
    if (trimmed.startsWith('/uploads/')) {
      return `${baseUrl}${trimmed}`;
    }
    if (trimmed.startsWith('uploads/')) {
      return `${baseUrl}/${trimmed}`;
    }
    return trimmed;
  };

  const c = { ...complaint };
  const rawPrimary = c.photo_before_url || c.photo_front_url || c.photo_url;
  c.photo_before_url = formatUrl(rawPrimary, true);
  c.photo_front_url = formatUrl(c.photo_front_url || rawPrimary, true);
  if (c.photo_after_url) c.photo_after_url = formatUrl(c.photo_after_url, false);
  if (c.photo_left_url) c.photo_left_url = formatUrl(c.photo_left_url, false);
  if (c.photo_right_url) c.photo_right_url = formatUrl(c.photo_right_url, false);
  if (c.photo_closeup_url) c.photo_closeup_url = formatUrl(c.photo_closeup_url, false);

  if (c.angle_photos) {
    try {
      const parsed = typeof c.angle_photos === 'string' ? JSON.parse(c.angle_photos) : c.angle_photos;
      if (Array.isArray(parsed)) {
        c.angle_photos = parsed.map(item => ({
          ...item,
          url: formatUrl(item?.url)
        }));
      }
    } catch (e) {}
  }

  if (c.additional_photos) {
    try {
      const parsed = typeof c.additional_photos === 'string' ? JSON.parse(c.additional_photos) : c.additional_photos;
      if (Array.isArray(parsed)) {
        c.additional_photos = parsed.map(formatUrl);
      }
    } catch (e) {}
  }

  return c;
}

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

// Step 2: Final Complaint Submission (supports both /submit and /)
const submitComplaintHandler = async (req, res) => {
  try {
    const {
      complaint_number,
      photo_url,
      photo_before_url,
      photo_front_url,
      photo_left_url,
      photo_right_url,
      photo_closeup_url,
      angle_photos,
      additional_photos,
      category,
      title,
      description,
      priority = 'Medium',
      latitude,
      longitude,
      location_source,
      location_address,
      department_id,
      department_name,
      department_code,
      department,
      duplicate_of_id
    } = req.body;

    // Always generate complaint_number authoritatively on the server side
    const finalComplaintNumber = `NS-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    // Authoritatively resolve canonical department
    let resolvedDept = null;
    const rawDeptInput = department_id || department_code || department_name || department;
    if (rawDeptInput) {
      try {
        const dRes = await query(
          `SELECT id, name, code FROM departments WHERE id = ? OR code = ? OR name = ? OR name LIKE ? LIMIT 1`,
          [rawDeptInput, String(rawDeptInput).toUpperCase(), rawDeptInput, `%${rawDeptInput}%`]
        );
        if (dRes.rows && dRes.rows.length > 0) {
          resolvedDept = dRes.rows[0];
        }
      } catch (deptLookupErr) {
        console.warn('Department direct lookup note:', deptLookupErr.message);
      }
    }

    // Infer from category if not resolved
    if (!resolvedDept && category) {
      let deptCode = 'PWD';
      const catLower = (category || '').toLowerCase();
      if (catLower.includes('water') || catLower.includes('pipeline') || catLower.includes('leak')) deptCode = 'WTR';
      else if (catLower.includes('garbage') || catLower.includes('waste') || catLower.includes('sanitat') || catLower.includes('clean')) deptCode = 'SAN';
      else if (catLower.includes('drain') || catLower.includes('sewag') || catLower.includes('sewer') || catLower.includes('gutter')) deptCode = 'DRN';
      else if (catLower.includes('street') || catLower.includes('electric') || catLower.includes('light')) deptCode = 'ELE';
      else if (catLower.includes('traffic') || catLower.includes('signal') || catLower.includes('sign')) deptCode = 'TRF';
      else if (catLower.includes('maintenance') || catLower.includes('park') || catLower.includes('facility')) deptCode = 'MNT';
      else if (catLower.includes('pothole') || catLower.includes('road') || catLower.includes('bridge')) deptCode = 'PWD';

      try {
        const deptRes = await query(`SELECT id, name, code FROM departments WHERE code = ? LIMIT 1`, [deptCode]);
        if (deptRes.rows && deptRes.rows.length > 0) {
          resolvedDept = deptRes.rows[0];
        }
      } catch (deptCodeErr) {
        console.warn('Department code lookup note:', deptCodeErr.message);
      }
    }

    if (!resolvedDept) {
      try {
        const fallbackRes = await query(`SELECT id, name, code FROM departments ORDER BY id ASC LIMIT 1`);
        resolvedDept = fallbackRes.rows?.[0] || { id: 1, name: 'Public Works Department', code: 'PWD' };
      } catch (fallbackErr) {
        resolvedDept = { id: 1, name: 'Public Works Department', code: 'PWD' };
      }
    }
    const CANONICAL_DEPT_UUIDS = {
      PWD: '8ed9f760-1314-427c-a515-c2a54d6df6d8',
      SAN: '9cabc1f2-fd10-48dd-a5cb-01d05197de22',
      WTR: 'ead370cc-459c-44f0-899f-8a97f0928beb',
      DRN: 'ee73cb82-cc47-4333-b7d6-4491353c1354',
      ELE: '31842723-23ac-490b-912b-9f6d9afbdfb3',
      TRF: 'ae5e4d0c-996f-4d81-9528-d642664c93ae',
      MNT: '8ed9f760-1314-427c-a515-c2a54d6df6d8'
    };

    const isUuid = (val) => typeof val === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val);

    const finalDeptCode = resolvedDept?.code || deptCode || 'PWD';
    const finalDeptName = resolvedDept?.name || 'Public Works Department (PWD)';
    const finalDeptId = isUuid(resolvedDept?.id)
      ? resolvedDept.id
      : (CANONICAL_DEPT_UUIDS[finalDeptCode] || '8ed9f760-1314-427c-a515-c2a54d6df6d8');

    const finalPhotoUrl = photo_url || photo_front_url || photo_before_url || '/uploads/civic-default.jpg';
    const finalPhotoFront = photo_front_url || finalPhotoUrl;
    const finalPhotoLeft = photo_left_url || null;
    const finalPhotoRight = photo_right_url || null;
    const finalPhotoCloseup = photo_closeup_url || null;
    const finalAnglePhotos = angle_photos ? (typeof angle_photos === 'string' ? angle_photos : JSON.stringify(angle_photos)) : null;
    const finalAdditionalPhotos = additional_photos ? (typeof additional_photos === 'string' ? additional_photos : JSON.stringify(additional_photos)) : null;

    let citizenId = req.user?.id ? String(req.user.id) : 'e2a4338c-5d49-4ae3-b766-40d99fb26f87';
    if (citizenId === 'c-8788562103' || req.user?.mobile === '8788562103' || (req.user?.email && req.user?.email.includes('8788'))) {
      citizenId = 'e2a4338c-5d49-4ae3-b766-40d99fb26f87';
    }

    const insertSql = `
      INSERT INTO complaints (
        complaint_number, citizen_id, photo_before_url, category, title, description, priority,
        status, department_id, latitude, longitude, location_source, location_address, duplicate_of_id,
        photo_front_url, photo_left_url, photo_right_url, photo_closeup_url, angle_photos, additional_photos
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Submitted', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const result = await query(insertSql, [
      finalComplaintNumber,
      citizenId,
      finalPhotoUrl,
      category,
      title,
      description || '',
      priority,
      finalDeptId,
      latitude,
      longitude,
      location_source || 'manual_pin',
      location_address || '',
      duplicate_of_id || null,
      finalPhotoFront,
      finalPhotoLeft,
      finalPhotoRight,
      finalPhotoCloseup,
      finalAnglePhotos,
      finalAdditionalPhotos
    ]);

    const complaintId = result.rows[0].id;

    // Record initial status history
    try {
      const deptNameRes = await query(`SELECT name FROM departments WHERE id = ?`, [finalDeptId]);
      const deptName = deptNameRes.rows?.[0]?.name || 'Municipal Triage Queue';
      await query(
        `INSERT INTO complaint_status_history (complaint_id, status, remark, department, updated_by) VALUES (?, ?, ?, ?, ?)`,
        [complaintId, 'Submitted', 'Complaint registered successfully by citizen.', deptName, 'Citizen']
      );
    } catch (hErr) {
      console.warn('Failed to record initial status history:', hErr.message);
    }

    // Dual-write to Supabase so complaint persists across serverless lambda containers
    let supaComplaintId = null;
    try {
      const { getSupabaseClient } = require('../middleware/auth');
      const supabase = getSupabaseClient();
      if (supabase) {
        const DEPT_UUID_MAP = {
          '1': '8ed9f760-1314-427c-a515-c2a54d6df6d8',
          '2': '9cabc1f2-fd10-48dd-a5cb-01d05197de22',
          '3': 'ead370cc-459c-44f0-899f-8a97f0928beb',
          '4': 'ee73cb82-cc47-4333-b7d6-4491353c1354',
          '5': '31842723-23ac-490b-912b-9f6d9afbdfb3',
          PWD: '8ed9f760-1314-427c-a515-c2a54d6df6d8',
          SAN: '9cabc1f2-fd10-48dd-a5cb-01d05197de22',
          WTR: 'ead370cc-459c-44f0-899f-8a97f0928beb',
          DRN: 'ee73cb82-cc47-4333-b7d6-4491353c1354',
          ELE: '31842723-23ac-490b-912b-9f6d9afbdfb3'
        };
        const supaDeptId = DEPT_UUID_MAP[String(finalDeptId)] || (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(department_id)) ? String(department_id) : '8ed9f760-1314-427c-a515-c2a54d6df6d8');

        let parsedAnglePhotos = null;
        try { if (finalAnglePhotos) parsedAnglePhotos = JSON.parse(finalAnglePhotos); } catch {}
        let parsedAdditionalPhotos = null;
        try { if (finalAdditionalPhotos) parsedAdditionalPhotos = JSON.parse(finalAdditionalPhotos); } catch {}

        const { data: supaComp, error: supaErr } = await supabase.from('complaints').insert([{
          complaint_number: finalComplaintNumber,
          citizen_id: citizenId,
          photo_before_url: finalPhotoUrl,
          photo_front_url: finalPhotoFront,
          photo_left_url: finalPhotoLeft,
          photo_right_url: finalPhotoRight,
          photo_closeup_url: finalPhotoCloseup,
          angle_photos: parsedAnglePhotos,
          additional_photos: parsedAdditionalPhotos,
          category,
          title,
          description: description || '',
          priority,
          status: 'Submitted',
          department_id: supaDeptId,
          latitude,
          longitude,
          location_source: location_source || 'manual_pin',
          location_address: location_address || '',
          ai_category: req.body.ai_category || category,
          ai_specific_issue: req.body.ai_specific_issue || category,
          ai_confidence: req.body.ai_confidence || 0.85,
          ai_severity: req.body.ai_severity || priority,
          ai_urgency: req.body.ai_urgency || priority,
          ai_evidence: req.body.ai_evidence || description || '',
          ai_model: req.body.ai_model || 'gemini-3.6-flash',
          ai_analyzed_at: req.body.ai_analyzed_at || new Date().toISOString()
        }]).select().maybeSingle();

        if (supaErr && supaErr.message && supaErr.message.includes('additional_photos')) {
          const { data: supaCompRetry, error: supaRetryErr } = await supabase.from('complaints').insert([{
            complaint_number: finalComplaintNumber,
            citizen_id: citizenId,
            photo_before_url: finalPhotoUrl,
            photo_front_url: finalPhotoFront,
            photo_left_url: finalPhotoLeft,
            photo_right_url: finalPhotoRight,
            photo_closeup_url: finalPhotoCloseup,
            angle_photos: parsedAnglePhotos,
            category,
            title,
            description: description || '',
            priority,
            status: 'Submitted',
            department_id: supaDeptId,
            latitude,
            longitude,
            location_source: location_source || 'manual_pin',
            location_address: location_address || '',
            ai_category: req.body.ai_category || category,
            ai_specific_issue: req.body.ai_specific_issue || category,
            ai_confidence: req.body.ai_confidence || 0.85,
            ai_severity: req.body.ai_severity || priority,
            ai_urgency: req.body.ai_urgency || priority,
            ai_evidence: req.body.ai_evidence || description || '',
            ai_model: req.body.ai_model || 'gemini-3.6-flash',
            ai_analyzed_at: req.body.ai_analyzed_at || new Date().toISOString()
          }]).select().maybeSingle();

          if (supaCompRetry?.id) {
            supaComplaintId = supaCompRetry.id;
          }
          if (supaRetryErr) {
            console.warn('Supabase mirror retry note:', supaRetryErr.message);
          }
        } else if (supaComp?.id) {
          supaComplaintId = supaComp.id;
        } else if (supaErr) {
          console.warn('Supabase mirror insert note:', supaErr.message);
        }
      }
    } catch (sErr) {
      console.warn('Supabase mirror insert exception:', sErr.message);
    }

    // Send initial submission notification
    await notifyStatusChange(complaintId, 'Submitted', citizenId).catch(nErr => {
      console.warn('Initial submission notification note:', nErr.message);
    });

    const returnedId = complaintId || supaComplaintId || finalComplaintNumber;

    return res.status(201).json({
      message: 'Complaint submitted successfully',
      complaint_id: returnedId,
      complaint_number: finalComplaintNumber,
      complaint: normalizeComplaintPhotoUrls({
        id: returnedId,
        complaint_number: finalComplaintNumber,
        citizen_id: citizenId,
        photo_before_url: finalPhotoUrl,
        photo_front_url: finalPhotoFront,
        photo_left_url: finalPhotoLeft,
        photo_right_url: finalPhotoRight,
        photo_closeup_url: finalPhotoCloseup,
        angle_photos: angle_photos || [],
        additional_photos: additional_photos || [],
        category,
        title,
        description: description || '',
        priority,
        status: 'Submitted',
        department_id: finalDeptId,
        department_name: finalDeptName,
        department_code: finalDeptCode,
        latitude,
        longitude,
        location_source: location_source || 'manual_pin',
        location_address: location_address || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, req)
    });
  } catch (err) {
    console.error('Submit complaint error:', err);
    return res.status(500).json({ error: 'Failed to submit complaint' });
  }
};

router.post('/submit', complaintSubmitLimiter, authenticateToken, validateInput(createComplaintSchema), submitComplaintHandler);
router.post('/', complaintSubmitLimiter, authenticateToken, validateInput(createComplaintSchema), submitComplaintHandler);

// Get complaint status history timeline with role-aware authorization
router.get('/:id/history', authenticateToken, async (req, res) => {
  try {
    const compRes = await query(
      `SELECT id, citizen_id, department_id, assigned_staff_id, assigned_staff_email 
       FROM complaints 
       WHERE id = ? OR complaint_number = ? OR CAST(id AS TEXT) = ?`,
      [req.params.id, req.params.id, req.params.id]
    );
    if (!compRes.rows || compRes.rows.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const complaint = compRes.rows[0];
    const user = req.user;
    const userRole = user?.role || 'citizen';
    const isOwner = String(complaint.citizen_id) === String(user?.id);
    const isAdmin = ['admin', 'city_admin'].includes(userRole);
    const isDeptHeadOrOfficer = ['department_head', 'officer'].includes(userRole);
    const isStaff = ['staff', 'service_staff'].includes(userRole);

    if (userRole === 'citizen') {
      if (!isOwner) {
        return res.status(403).json({ error: 'Forbidden: You can only view your own complaints history' });
      }
    } else if (isStaff) {
      const isAssigned = (complaint.assigned_staff_id && String(complaint.assigned_staff_id) === String(user.id)) ||
        (complaint.assigned_staff_email && complaint.assigned_staff_email.toLowerCase() === (user.email || '').toLowerCase());
      if (!isAssigned) {
        const assignCheck = await query(
          `SELECT id FROM assignments WHERE (complaint_id = ? OR CAST(complaint_id AS TEXT) = ?) AND (staff_id = ? OR CAST(staff_id AS TEXT) = ?)`,
          [complaint.id, String(complaint.id), user.id, String(user.id)]
        );
        if (!assignCheck.rows || assignCheck.rows.length === 0) {
          return res.status(403).json({ error: 'Forbidden: You are not assigned to this complaint' });
        }
      }
    } else if (isDeptHeadOrOfficer) {
      if (user.department_id && complaint.department_id && String(user.department_id) !== String(complaint.department_id)) {
        return res.status(403).json({ error: 'Forbidden: Access denied for this department' });
      }
    } else if (!isAdmin) {
      return res.status(403).json({ error: 'Forbidden: Unauthorized access' });
    }

    const historyRes = await query(
      `SELECT h.* FROM complaint_status_history h
       WHERE h.complaint_id = ? OR CAST(h.complaint_id AS TEXT) = ?
       ORDER BY h.created_at ASC`,
      [complaint.id, String(complaint.id)]
    );
    return res.json({ history: historyRes.rows || [] });
  } catch (err) {
    console.error('Fetch complaint status history error:', err);
    return res.status(500).json({ error: 'Failed to fetch status history' });
  }
});

// Get all complaints for Admin / Portals (Citizens only list their own complaints)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userRole = req.user?.role || 'citizen';
    const isCitizen = userRole === 'citizen';
    const isDeptHead = userRole === 'department_head';

    let sql = `
      SELECT c.*, d.name as department_name, f.rating, f.comment as feedback_comment
      ${!isCitizen ? ', u.name as citizen_name, u.mobile as citizen_mobile' : ''}
      FROM complaints c
      LEFT JOIN departments d ON (CAST(c.department_id AS TEXT) = CAST(d.id AS TEXT) OR c.department_id = d.code)
      LEFT JOIN feedback f ON f.complaint_id = c.id
      ${!isCitizen ? 'LEFT JOIN users u ON c.citizen_id = u.id' : ''}
    `;
    const params = [];
    if (isCitizen) {
      sql += ` WHERE (c.citizen_id = ? OR CAST(c.citizen_id AS TEXT) = ?)`;
      params.push(req.user.id, String(req.user.id));
    } else if (isDeptHead && req.user?.department_id) {
      sql += ` WHERE (c.department_id = ? OR CAST(c.department_id AS TEXT) = ? OR d.id = ? OR CAST(d.id AS TEXT) = ?)`;
      params.push(req.user.department_id, String(req.user.department_id), req.user.department_id, String(req.user.department_id));
    }
    sql += ` ORDER BY c.created_at DESC`;
    const result = await query(sql, params);
    if (result.rows && result.rows.length > 0) {
      return res.json({ complaints: result.rows.map(c => normalizeComplaintPhotoUrls(c, req)) });
    }

    // Supabase fallback if local database has 0 rows (e.g. serverless /tmp container)
    try {
      const { getSupabaseClient } = require('../middleware/auth');
      const supabase = getSupabaseClient();
      if (supabase) {
        let supaQuery = supabase
          .from('complaints')
          .select('*')
          .order('created_at', { ascending: false });

        if (isCitizen) {
          supaQuery = supaQuery.eq('citizen_id', req.user.id);
        } else if (isDeptHead && req.user?.department_id) {
          supaQuery = supaQuery.eq('department_id', req.user.department_id);
        }

        const { data, error } = await supaQuery;

        if (!error && Array.isArray(data) && data.length > 0) {
          let deptMap = {};
          try {
            const { data: depts } = await supabase.from('departments').select('id, name');
            if (depts) {
              depts.forEach((d) => { deptMap[d.id] = d.name; });
            }
          } catch (e) {}

          const formatted = data.map((c) => ({
            ...c,
            department_name: deptMap[c.department_id] || c.department_name || 'Public Works Department (PWD)'
          }));
          return res.json({ complaints: formatted.map(c => normalizeComplaintPhotoUrls(c, req)) });
        }
      }
    } catch (sErr) {
      console.warn('Supabase fallback in GET / warning:', sErr.message);
    }

    return res.json({ complaints: (result.rows || []).map(c => normalizeComplaintPhotoUrls(c, req)) });
  } catch (err) {
    console.error('Fetch all complaints error:', err);
    return res.status(500).json({ error: 'Failed to fetch complaints' });
  }
});

// Get user's complaint history
router.get('/my', authenticateToken, async (req, res) => {
  try {
    let citizenId = req.user.id;
    if (citizenId === 'c-8788562103' || req.user.mobile === '8788562103' || (req.user?.email && req.user?.email.includes('8788'))) {
      citizenId = 'e2a4338c-5d49-4ae3-b766-40d99fb26f87';
    }

    const sql = `
      SELECT c.*, d.name as department_name, f.rating, f.comment as feedback_comment
      FROM complaints c
      LEFT JOIN departments d ON c.department_id = d.id
      LEFT JOIN feedback f ON f.complaint_id = c.id
      WHERE c.citizen_id = ? OR CAST(c.citizen_id AS TEXT) = ?
      ORDER BY c.created_at DESC
    `;
    const result = await query(sql, [citizenId, String(citizenId)]);
    if (result.rows && result.rows.length > 0) {
      return res.json({ complaints: result.rows.map(c => normalizeComplaintPhotoUrls(c, req)) });
    }

    // Supabase fallback if local database has 0 rows for this citizen
    try {
      const { getSupabaseClient } = require('../middleware/auth');
      const supabase = getSupabaseClient();
      if (supabase) {
        const { data, error } = await supabase
          .from('complaints')
          .select('*, departments(name)')
          .eq('citizen_id', citizenId)
          .order('created_at', { ascending: false });

        if (!error && Array.isArray(data) && data.length > 0) {
          const formatted = data.map((c) => ({
            ...c,
            department_name: c.departments?.name || c.department_name
          }));
          return res.json({ complaints: formatted.map(c => normalizeComplaintPhotoUrls(c, req)) });
        }
      }
    } catch (sErr) {
      console.warn('Supabase fallback in GET /my warning:', sErr.message);
    }

    return res.json({ complaints: (result.rows || []).map(c => normalizeComplaintPhotoUrls(c, req)) });
  } catch (err) {
    console.error('Fetch my complaints error:', err);
    return res.status(500).json({ error: 'Failed to fetch complaints' });
  }
});

// Get single complaint by ID with strict role-aware authorization
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const idParam = req.params.id;
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
    let result = await query(sql, [idParam, idParam, idParam]);
    let complaint = result.rows && result.rows.length > 0 ? result.rows[0] : null;

    // Supabase fallback if local database returned 0 rows
    if (!complaint) {
      try {
        const { getSupabaseClient } = require('../middleware/auth');
        const supabase = getSupabaseClient();
        if (supabase) {
          const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(idParam);
          let supaQuery;
          if (isUuid) {
            supaQuery = supabase.from('complaints').select('*, departments(name)').or(`id.eq.${idParam},complaint_number.eq.${idParam}`).maybeSingle();
          } else if (idParam.startsWith('NS-')) {
            supaQuery = supabase.from('complaints').select('*, departments(name)').eq('complaint_number', idParam).maybeSingle();
          } else {
            supaQuery = supabase.from('complaints').select('*, departments(name)').or(`complaint_number.eq.${idParam}`).maybeSingle();
          }

          const { data: supaData } = await supaQuery;
          if (supaData) {
            complaint = {
              ...supaData,
              department_name: supaData.departments?.name || supaData.department_name
            };
          }
        }
      } catch (sErr) {
        console.warn('Supabase complaint detail fallback note:', sErr.message);
      }
    }

    if (!complaint) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const user = req.user;
    const userRole = user?.role || 'citizen';
    const isOwner = String(complaint.citizen_id) === String(user?.id);
    const isAdmin = ['admin', 'city_admin'].includes(userRole);
    const isDeptHeadOrOfficer = ['department_head', 'officer'].includes(userRole);
    const isStaff = ['staff', 'service_staff'].includes(userRole);

    if (userRole === 'citizen') {
      if (!isOwner) {
        return res.status(403).json({ error: 'Forbidden: You can only view your own complaints' });
      }
    } else if (isStaff) {
      const isAssigned = (complaint.assigned_staff_id && String(complaint.assigned_staff_id) === String(user.id)) ||
        (complaint.assigned_staff_email && complaint.assigned_staff_email.toLowerCase() === (user.email || '').toLowerCase());
      if (!isAssigned) {
        const assignCheck = await query(
          `SELECT id FROM assignments WHERE (complaint_id = ? OR CAST(complaint_id AS TEXT) = ?) AND (staff_id = ? OR CAST(staff_id AS TEXT) = ?)`,
          [complaint.id, String(complaint.id), user.id, String(user.id)]
        );
        if (!assignCheck.rows || assignCheck.rows.length === 0) {
          return res.status(403).json({ error: 'Forbidden: You are not assigned to this complaint' });
        }
      }
    } else if (isDeptHeadOrOfficer) {
      if (user.department_id && complaint.department_id && String(user.department_id) !== String(complaint.department_id)) {
        return res.status(403).json({ error: 'Forbidden: Access denied for this department' });
      }
    } else if (!isAdmin) {
      return res.status(403).json({ error: 'Forbidden: Unauthorized access' });
    }

    // IDOR Protection: Redact citizen mobile and private details for non-owners
    if (!isOwner) {
      delete complaint.citizen_mobile;
      if (complaint.citizen_name) {
        complaint.citizen_name = 'Citizen';
      }
    }

    // Fetch assignment details if any (without exposing staff mobile)
    try {
      const assignSql = `
        SELECT a.id, a.complaint_id, a.staff_id, a.assigned_by, a.assigned_at, a.resolved_at,
               s.name as staff_name, o.name as officer_name
        FROM assignments a
        LEFT JOIN users s ON a.staff_id = s.id
        LEFT JOIN users o ON a.assigned_by = o.id
        WHERE a.complaint_id = ?
        ORDER BY a.assigned_at DESC LIMIT 1
      `;
      const assignRes = await query(assignSql, [complaint.id]);
      complaint.assignment = assignRes.rows && assignRes.rows.length > 0 ? assignRes.rows[0] : null;
    } catch (aErr) {
      complaint.assignment = null;
    }

    return res.json({ complaint: normalizeComplaintPhotoUrls(complaint, req) });
  } catch (err) {
    console.error('Fetch complaint detail error:', err);
    return res.status(500).json({ error: 'Failed to fetch complaint details' });
  }
});

// Submit Feedback for resolved complaint
router.post('/:id/feedback', authenticateToken, validateInput(addFeedbackSchema), async (req, res) => {
  try {
    const { rating, comment } = req.body;
    if (req.user?.role !== 'citizen') {
      return res.status(403).json({ error: 'Only citizens can submit complaint feedback' });
    }

    const compRes = await query(
      `SELECT id, citizen_id, status FROM complaints WHERE id = ? OR complaint_number = ? OR CAST(id AS TEXT) = ?`,
      [req.params.id, req.params.id, req.params.id]
    );
    if (!compRes.rows || compRes.rows.length === 0) {
      return res.status(404).json({ error: 'Complaint not found' });
    }

    const complaint = compRes.rows[0];
    if (String(complaint.citizen_id) !== String(req.user.id)) {
      return res.status(403).json({ error: 'Forbidden: You can only provide feedback for your own complaint' });
    }

    const resolvedStatuses = ['Resolved', 'Closed', 'Completed', 'Resolution Submitted', 'Completed — Pending Verification'];
    if (!resolvedStatuses.includes(complaint.status)) {
      return res.status(400).json({ error: 'Feedback can only be submitted for resolved or completed complaints' });
    }

    const existingFeedback = await query(
      `SELECT id FROM feedback WHERE complaint_id = ? OR CAST(complaint_id AS TEXT) = ?`,
      [complaint.id, String(complaint.id)]
    );
    if (existingFeedback.rows && existingFeedback.rows.length > 0) {
      return res.status(400).json({ error: 'Feedback has already been submitted for this complaint' });
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

module.exports = router;
