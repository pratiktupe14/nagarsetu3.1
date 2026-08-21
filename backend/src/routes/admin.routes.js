const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { authenticateToken, requireRole } = require('../middleware/auth');
const { query } = require('../config/db');

// Admin Auth Guard
router.use(authenticateToken);
router.use(requireRole(['admin']));

// Admin Analytics summary
router.get('/analytics', async (req, res) => {
  try {
    const totalSql = `SELECT COUNT(*) as total FROM complaints`;
    const totalRes = await query(totalSql);

    const resolvedSql = `SELECT COUNT(*) as resolved FROM complaints WHERE status = 'Resolved'`;
    const resolvedRes = await query(resolvedSql);

    const pendingSql = `SELECT COUNT(*) as pending FROM complaints WHERE status IN ('Submitted', 'Verified', 'Assigned', 'In Progress')`;
    const pendingRes = await query(pendingSql);

    const categorySql = `SELECT category, COUNT(*) as count FROM complaints GROUP BY category`;
    const categoryRes = await query(categorySql);

    const deptSql = `
      SELECT d.name as department_name, COUNT(c.id) as total_complaints,
             SUM(CASE WHEN c.status = 'Resolved' THEN 1 ELSE 0 END) as resolved_count
      FROM departments d
      LEFT JOIN complaints c ON c.department_id = d.id
      GROUP BY d.id, d.name
    `;
    const deptRes = await query(deptSql);

    return res.json({
      metrics: {
        total_complaints: totalRes.rows[0].total || 0,
        resolved_complaints: resolvedRes.rows[0].resolved || 0,
        pending_complaints: pendingRes.rows[0].pending || 0,
        resolution_rate: totalRes.rows[0].total > 0 ? Math.round((resolvedRes.rows[0].resolved / totalRes.rows[0].total) * 100) : 0
      },
      by_category: categoryRes.rows,
      by_department: deptRes.rows
    });
  } catch (err) {
    console.error('Analytics error:', err);
    return res.status(500).json({ error: 'Failed to fetch admin analytics' });
  }
});

// Admin Hotspots map data
router.get('/hotspots', async (req, res) => {
  try {
    const sql = `
      SELECT id, category, title, status, priority, latitude, longitude, created_at
      FROM complaints
    `;
    const result = await query(sql);
    return res.json({ complaints: result.rows });
  } catch (err) {
    console.error('Hotspots error:', err);
    return res.status(500).json({ error: 'Failed to fetch hotspot data' });
  }
});

// CRUD Users
router.get('/users', async (req, res) => {
  try {
    const sql = `SELECT id, name, mobile, email, role, language_pref, created_at FROM users ORDER BY id DESC`;
    const result = await query(sql);
    return res.json({ users: result.rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch users' });
  }
});

router.post('/users', async (req, res) => {
  try {
    const { name, mobile, email, password, role = 'citizen', language_pref = 'en' } = req.body;
    if (!name || !mobile || !password) {
      return res.status(400).json({ error: 'Name, mobile, and password are required' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const sql = `
      INSERT INTO users (name, mobile, email, password_hash, role, language_pref)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const result = await query(sql, [name, mobile, email || null, password_hash, role, language_pref]);

    return res.status(201).json({ message: 'User created successfully', id: result.rows[0].id });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create user: ' + err.message });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const { name, mobile, email, role, language_pref } = req.body;
    const sql = `
      UPDATE users SET name = ?, mobile = ?, email = ?, role = ?, language_pref = ?
      WHERE id = ?
    `;
    await query(sql, [name, mobile, email, role, language_pref, req.params.id]);
    return res.json({ message: 'User updated successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    await query(`DELETE FROM users WHERE id = ?`, [req.params.id]);
    return res.json({ message: 'User deleted successfully' });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete user' });
  }
});

// CRUD Departments
router.get('/departments', async (req, res) => {
  try {
    const result = await query(`SELECT * FROM departments ORDER BY id ASC`);
    return res.json({ departments: result.rows });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

router.post('/departments', async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) return res.status(400).json({ error: 'Department name is required' });
    const result = await query(`INSERT INTO departments (name, description) VALUES (?, ?)`, [name, description || '']);
    return res.status(201).json({ message: 'Department created', id: result.rows[0].id });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create department' });
  }
});

module.exports = router;
