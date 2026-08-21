const express = require('express');
const router = express.Router();
const { query } = require('../config/db');

// Public or authenticated list of municipal departments
router.get('/', async (req, res) => {
  try {
    const result = await query(`SELECT * FROM departments ORDER BY id ASC`);
    return res.json({ departments: result.rows });
  } catch (err) {
    console.error('Fetch departments error:', err);
    return res.status(500).json({ error: 'Failed to fetch departments' });
  }
});

module.exports = router;
