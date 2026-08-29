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
      duplicate_of_id
    } = req.body;

    const finalComplaintNumber = complaint_number || `NS-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    // Default department mapping if not provided
    let finalDeptId = department_id;
    if (!finalDeptId) {
      let searchToken = category ? category.split(' ')[0] : 'Public Works';
      if (category.includes('Pothole') || category.includes('Road')) searchToken = 'Public Works';
      else if (category.includes('Garbage') || category.includes('Waste')) searchToken = 'Sanitation';
      else if (category.includes('Water')) searchToken = 'Water';
      else if (category.includes('Drainage') || category.includes('Sewage')) searchToken = 'Drainage';
      else if (category.includes('Streetlight') || category.includes('Electrical')) searchToken = 'Electric';
      else if (category.includes('Traffic')) searchToken = 'Traffic';
      else if (category.includes('Infrastructure') || category.includes('Maintenance') || category.includes('Other')) searchToken = 'Maintenance';

      const deptSql = `SELECT id FROM departments WHERE name LIKE ? LIMIT 1`;
      const deptRes = await query(deptSql, [`%${searchToken}%`]);
      if (deptRes.rows && deptRes.rows.length > 0) {
        finalDeptId = deptRes.rows[0].id;
      } else {
        finalDeptId = 1; // Default to PWD
      }
    }


    const insertSql = `
      INSERT INTO complaints (
        complaint_number, citizen_id, photo_before_url, category, title, description, priority,
        status, department_id, latitude, longitude, location_source, location_address, duplicate_of_id
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Submitted', ?, ?, ?, ?, ?, ?)
    `;

    const result = await query(insertSql, [
      finalComplaintNumber,
      req.user.id,
      photo_url,
      category,
      title,
      description || '',
      priority,
      finalDeptId,
      latitude,
      longitude,
      location_source || 'manual_pin',
      location_address || '',
      duplicate_of_id || null
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

    // Send initial submission notification
    await notifyStatusChange(complaintId, 'Submitted', req.user.id);

    return res.status(201).json({
      message: 'Complaint submitted successfully',
      complaint_id: complaintId,
      complaint_number: finalComplaintNumber
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

// Get user's complaint history
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const sql = `
      SELECT c.*, d.name as department_name, f.rating, f.comment as feedback_comment
      FROM complaints c
      LEFT JOIN departments d ON c.department_id = d.id
      LEFT JOIN feedback f ON f.complaint_id = c.id
      WHERE c.citizen_id = ?
      ORDER BY c.created_at DESC
    `;
    const result = await query(sql, [req.user.id]);
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

// Submit Feedback for resolved complaint
router.post('/:id/feedback', authenticateToken, validateInput(addFeedbackSchema), async (req, res) => {
  try {
    const { rating, comment } = req.body;

    const insertSql = `
      INSERT INTO feedback (complaint_id, rating, comment)
      VALUES (?, ?, ?)
    `;
    await query(insertSql, [req.params.id, rating, comment || '']);

    return res.json({ message: 'Feedback submitted successfully' });
  } catch (err) {
    console.error('Submit feedback error:', err);
    return res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

module.exports = router;
