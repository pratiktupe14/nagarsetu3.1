const express = require('express');
const router = express.Router();
const { authenticateToken, requireRole } = require('../middleware/auth');
const { query } = require('../config/db');

// All announcement routes require authentication
router.use(authenticateToken);

/**
 * Helper: Resolve department ID and Name for current user
 */
async function resolveUserDepartment(req) {
  let userDeptId = req.user.department_id || null;
  let userDeptName = req.user.department_name || '';

  if (!userDeptId || !userDeptName) {
    const uRes = await query('SELECT department_id, role FROM users WHERE id = $1 OR email = $2', [req.user.id, req.user.email]);
    if (uRes.rows.length > 0) {
      userDeptId = uRes.rows[0].department_id || userDeptId;
    }

    const dhRes = await query(
      `SELECT dh.department_id, d.name as department_name 
       FROM department_heads dh 
       LEFT JOIN departments d ON d.id = dh.department_id 
       WHERE dh.user_id = $1 OR dh.email = $2`,
      [req.user.id, req.user.email]
    );
    if (dhRes.rows.length > 0) {
      userDeptId = dhRes.rows[0].department_id || userDeptId;
      userDeptName = dhRes.rows[0].department_name || userDeptName;
    }
  }

  return { userDeptId, userDeptName };
}

/**
 * GET /api/announcements
 * Fetch announcements visible to the current authenticated user (Citizen, Dept Head, Staff, Admin)
 * Returns published, non-expired announcements targeted to user's role/department + read status
 */
router.get('/', async (req, res) => {
  try {
    const userId = String(req.user.id || req.user.email || '');
    const userRole = req.user.role || 'citizen';
    const { userDeptId, userDeptName } = await resolveUserDepartment(req);

    const isAdmin = ['admin', 'city_admin'].includes(userRole);
    const cleanDeptName = `%${(userDeptName || '').split('(')[0].trim()}%`;

    let sql;
    let params;

    if (isAdmin) {
      sql = `
        SELECT a.*,
               CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END as is_read,
               r.read_at
        FROM announcements a
        LEFT JOIN announcement_reads r ON r.announcement_id = a.id AND r.user_id = $1
        WHERE a.status != 'Archived'
        ORDER BY a.published_at DESC, a.created_at DESC
      `;
      params = [userId];
    } else {
      sql = `
        SELECT a.*,
               CASE WHEN r.id IS NOT NULL THEN 1 ELSE 0 END as is_read,
               r.read_at
        FROM announcements a
        LEFT JOIN announcement_reads r ON r.announcement_id = a.id AND r.user_id = $1
        WHERE a.is_published = 1
          AND (a.status IS NULL OR a.status = 'Published')
          AND (a.published_at IS NULL OR a.published_at <= CURRENT_TIMESTAMP)
          AND (a.expires_at IS NULL OR a.expires_at >= CURRENT_TIMESTAMP)
          AND (
            a.target_type = 'all'
            OR a.target_audience = 'all_citizens'
            OR (a.target_audience = 'all_dept_heads' AND $2 = 'department_head')
            OR (a.target_audience = 'all_staff' AND $2 = 'service_staff')
            OR (a.target_role = $2)
            OR (a.department_id IS NOT NULL AND a.department_id = $3)
            OR (a.department_name IS NOT NULL AND LOWER(a.department_name) LIKE LOWER($4))
          )
        ORDER BY a.published_at DESC, a.created_at DESC
      `;
      params = [userId, userRole, userDeptId || -1, cleanDeptName];
    }

    const result = await query(sql, params);

    const formatted = result.rows.map((row) => ({
      id: String(row.id),
      title: row.title,
      description: row.description,
      type: row.type || 'General',
      priority: row.priority || 'Medium',
      status: row.status || 'Published',
      target_type: row.target_type || 'all',
      target_audience: row.target_audience || 'all_departments',
      target_role: row.target_role || null,
      department_id: row.department_id ? String(row.department_id) : null,
      department_name: row.department_name || 'All Departments',
      posted_by: row.posted_by || row.created_by || 'City Admin',
      created_by: row.created_by || 'City Admin',
      created_by_role: row.created_by_role || 'city_admin',
      is_published: row.is_published === 1 || row.is_published === true,
      is_read: row.is_read === 1 || row.is_read === true,
      read_at: row.read_at || null,
      published_at: row.published_at || row.created_at,
      expires_at: row.expires_at || null,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    return res.json({ announcements: formatted, count: formatted.length });
  } catch (err) {
    console.error('Error fetching announcements:', err);
    return res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

/**
 * POST /api/announcements/:id/read
 * Mark an announcement as read by the authenticated user
 */
router.post('/:id/read', async (req, res) => {
  try {
    const annId = req.params.id;
    const userId = String(req.user.id || req.user.email || '');

    await query(
      `INSERT INTO announcement_reads (announcement_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (announcement_id, user_id) DO NOTHING`,
      [annId, userId]
    );

    return res.json({ success: true, message: 'Announcement marked as read' });
  } catch (err) {
    console.error('Error marking announcement read:', err);
    return res.status(500).json({ error: 'Failed to mark announcement as read' });
  }
});

/**
 * POST /api/announcements
 * Create announcement by Admin OR Department Head
 * SECURITY ENFORCED: Department Heads can ONLY publish for their own department/staff/citizens.
 */
router.post('/', requireRole(['admin', 'city_admin', 'department_head']), async (req, res) => {
  try {
    const {
      title, description, type, priority, status, target_audience,
      target_type, department_id, department_name, expires_at
    } = req.body;

    if (!title || !description) {
      return res.status(400).json({ error: 'Title and description are required' });
    }

    const { userDeptId, userDeptName } = await resolveUserDepartment(req);
    const userRole = req.user.role || 'citizen';
    const isDeptHead = userRole === 'department_head';

    let finalDeptId = department_id || null;
    let finalDeptName = department_name || null;
    let finalTargetAudience = target_audience || 'all_departments';
    let finalTargetType = target_type || 'all';
    let finalTargetRole = null;

    // SECURITY ENFORCEMENT FOR DEPARTMENT HEAD
    if (isDeptHead) {
      // Dept Head MUST ONLY publish for their own department
      finalDeptId = userDeptId;
      finalDeptName = userDeptName || 'Department';

      if (target_audience === 'citizens') {
        finalTargetAudience = 'department_citizens';
        finalTargetRole = 'citizen';
      } else if (target_audience === 'staff' || target_audience === 'service_staff') {
        finalTargetAudience = 'department_staff';
        finalTargetRole = 'service_staff';
      } else {
        finalTargetAudience = 'department';
      }
      finalTargetType = 'department';
    } else {
      // Admin creation rules
      if (target_type === 'department' || target_audience === 'specific_department') {
        finalTargetType = 'department';
      }
    }

    const annType = type || 'General';
    const annPriority = priority || 'Medium';
    const annStatus = status || 'Published';
    const published = annStatus === 'Published' ? 1 : 0;
    const postedBy = req.user.name || (isDeptHead ? 'Department Head' : 'City Admin');

    const insertRes = await query(
      `INSERT INTO announcements 
       (title, description, type, priority, status, target_type, target_audience, target_role, department_id, department_name, posted_by, created_by, created_by_role, is_published, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [
        title, description, annType, annPriority, annStatus, finalTargetType,
        finalTargetAudience, finalTargetRole, finalDeptId, finalDeptName,
        postedBy, postedBy, userRole, published, expires_at || null
      ]
    );

    const created = insertRes.rows[0] || {};

    // Dispatch In-App Notifications if Published
    if (published === 1) {
      try {
        let notifSql = `SELECT id FROM users WHERE status = 'active'`;
        let notifParams = [];

        if (isDeptHead) {
          if (finalTargetRole === 'service_staff') {
            notifSql += ` AND role = 'service_staff' AND department_id = $1`;
            notifParams.push(finalDeptId);
          } else if (finalTargetRole === 'citizen') {
            notifSql += ` AND role = 'citizen'`;
          } else {
            notifSql += ` AND department_id = $1`;
            notifParams.push(finalDeptId);
          }
        } else {
          if (finalTargetAudience === 'all_citizens') {
            notifSql += ` AND role = 'citizen'`;
          } else if (finalTargetAudience === 'all_dept_heads') {
            notifSql += ` AND role = 'department_head'`;
          } else if (finalTargetAudience === 'all_staff') {
            notifSql += ` AND role = 'service_staff'`;
          } else if (finalTargetType === 'department' && finalDeptId) {
            notifSql += ` AND department_id = $1`;
            notifParams.push(finalDeptId);
          }
        }

        const targetUsers = await query(notifSql, notifParams);
        const notifMsg = `📢 ${title} (${annPriority} Priority)`;

        for (const u of targetUsers.rows) {
          await query(
            `INSERT INTO notifications (user_id, channel, message, is_read)
             VALUES ($1, 'in_app', $2, 0)`,
            [u.id, notifMsg]
          );
        }
      } catch (nErr) {
        console.error('Error dispatching notifications:', nErr);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Announcement created successfully',
      announcement: {
        id: String(created.id),
        title: created.title,
        description: created.description,
        type: created.type,
        priority: created.priority,
        status: created.status,
        target_type: created.target_type,
        target_audience: created.target_audience,
        department_id: created.department_id ? String(created.department_id) : null,
        department_name: created.department_name,
        posted_by: created.posted_by,
        is_published: created.is_published === 1,
        created_at: created.created_at
      }
    });
  } catch (err) {
    console.error('Error creating announcement:', err);
    return res.status(500).json({ error: 'Failed to create announcement' });
  }
});

/**
 * GET /api/announcements/admin/all
 * Admin-only: Fetch all announcements citywide
 */
router.get('/admin/all', requireRole(['admin', 'city_admin']), async (req, res) => {
  try {
    const result = await query(
      `SELECT a.*, COUNT(r.id) as total_reads
       FROM announcements a
       LEFT JOIN announcement_reads r ON r.announcement_id = a.id
       GROUP BY a.id
       ORDER BY a.published_at DESC, a.created_at DESC`
    );

    const formatted = result.rows.map((row) => ({
      id: String(row.id),
      title: row.title,
      description: row.description,
      type: row.type || 'General',
      priority: row.priority || 'Medium',
      status: row.status || 'Published',
      target_type: row.target_type || 'all',
      target_audience: row.target_audience || 'all_departments',
      department_id: row.department_id ? String(row.department_id) : null,
      department_name: row.department_name || 'All Departments',
      posted_by: row.posted_by || 'City Admin',
      created_by: row.created_by || 'City Admin',
      is_published: row.is_published === 1 || row.is_published === true,
      total_reads: parseInt(row.total_reads || 0, 10),
      published_at: row.published_at || row.created_at,
      expires_at: row.expires_at || null,
      created_at: row.created_at,
      updated_at: row.updated_at
    }));

    return res.json({ announcements: formatted, count: formatted.length });
  } catch (err) {
    console.error('Error fetching admin announcements:', err);
    return res.status(500).json({ error: 'Failed to fetch admin announcements' });
  }
});

/**
 * PUT /api/announcements/:id
 * Edit announcement (Admin or Department Head for their own department)
 */
router.put('/:id', requireRole(['admin', 'city_admin', 'department_head']), async (req, res) => {
  try {
    const annId = req.params.id;
    const { title, description, type, priority, status, target_type, department_id, department_name, is_published, expires_at } = req.body;

    const { userDeptId } = await resolveUserDepartment(req);
    const isDeptHead = req.user.role === 'department_head';

    // Verify ownership for Department Head
    if (isDeptHead) {
      const existingRes = await query('SELECT department_id FROM announcements WHERE id = $1', [annId]);
      if (existingRes.rows.length === 0) {
        return res.status(404).json({ error: 'Announcement not found' });
      }
      if (String(existingRes.rows[0].department_id) !== String(userDeptId)) {
        return res.status(403).json({ error: 'Forbidden: You can only edit announcements created for your department' });
      }
    }

    const published = is_published === false ? 0 : 1;

    await query(
      `UPDATE announcements
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           type = COALESCE($3, type),
           priority = COALESCE($4, priority),
           status = COALESCE($5, status),
           target_type = COALESCE($6, target_type),
           department_id = COALESCE($7, department_id),
           department_name = COALESCE($8, department_name),
           is_published = COALESCE($9, is_published),
           expires_at = COALESCE($10, expires_at),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $11`,
      [title, description, type, priority, status, target_type, department_id, department_name, published, expires_at, annId]
    );

    return res.json({ success: true, message: 'Announcement updated successfully' });
  } catch (err) {
    console.error('Error updating announcement:', err);
    return res.status(500).json({ error: 'Failed to update announcement' });
  }
});

/**
 * DELETE /api/announcements/:id
 * Delete or Soft-Archive announcement
 */
router.delete('/:id', requireRole(['admin', 'city_admin', 'department_head']), async (req, res) => {
  try {
    const annId = req.params.id;
    const { userDeptId } = await resolveUserDepartment(req);
    const isDeptHead = req.user.role === 'department_head';

    if (isDeptHead) {
      const existingRes = await query('SELECT department_id FROM announcements WHERE id = $1', [annId]);
      if (existingRes.rows.length === 0) {
        return res.status(404).json({ error: 'Announcement not found' });
      }
      if (String(existingRes.rows[0].department_id) !== String(userDeptId)) {
        return res.status(403).json({ error: 'Forbidden: You can only delete announcements created for your department' });
      }
    }

    // Soft delete / archive
    await query("UPDATE announcements SET status = 'Archived', is_published = 0 WHERE id = $1", [annId]);

    return res.json({ success: true, message: 'Announcement archived successfully' });
  } catch (err) {
    console.error('Error archiving announcement:', err);
    return res.status(500).json({ error: 'Failed to archive announcement' });
  }
});

module.exports = router;
