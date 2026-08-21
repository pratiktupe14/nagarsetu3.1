const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { generateToken, authenticateToken } = require('../middleware/auth');

// Register endpoint (Citizen, Officer, Staff, Admin)
router.post('/register', async (req, res) => {
  try {
    const { name, mobile, email, password, role = 'citizen', language_pref = 'en' } = req.body;

    if (!name || !mobile || !password) {
      return res.status(400).json({ error: 'Name, mobile, and password are required' });
    }

    // Check existing user
    const checkSql = `SELECT id FROM users WHERE mobile = ? OR (email IS NOT NULL AND email = ?)`;
    const existing = await query(checkSql, [mobile, email || '']);
    if (existing.rows && existing.rows.length > 0) {
      return res.status(400).json({ error: 'User with this mobile number or email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const insertSql = `
      INSERT INTO users (name, mobile, email, password_hash, role, language_pref)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const result = await query(insertSql, [name, mobile, email || null, password_hash, role, language_pref]);

    const newUserId = result.rows[0].id;
    const userObj = { id: newUserId, name, mobile, email, role, language_pref };
    const token = generateToken(userObj);

    return res.status(201).json({
      message: 'Registration successful',
      token,
      user: userObj
    });
  } catch (err) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Server error during registration' });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { mobileOrEmail, password } = req.body;

    if (!mobileOrEmail || !password) {
      return res.status(400).json({ error: 'Mobile/Email and password are required' });
    }

    const sql = `SELECT * FROM users WHERE mobile = ? OR email = ?`;
    const resUser = await query(sql, [mobileOrEmail, mobileOrEmail]);

    if (!resUser.rows || resUser.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = resUser.rows[0];
    const isMatch = await bcrypt.compare(password, user.password_hash);

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const userObj = {
      id: user.id,
      name: user.name,
      mobile: user.mobile,
      email: user.email,
      role: user.role,
      language_pref: user.language_pref
    };

    const token = generateToken(userObj);

    return res.json({
      message: 'Login successful',
      token,
      user: userObj
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Server error during login' });
  }
});

// OTP Request (Simulated)
router.post('/otp-request', (req, res) => {
  const { mobile } = req.body;
  if (!mobile) return res.status(400).json({ error: 'Mobile number required' });
  // Simulated OTP 123456
  return res.json({ message: 'OTP sent successfully to ' + mobile, demoOtp: '123456' });
});

// OTP Verify (Simulated)
router.post('/otp-verify', async (req, res) => {
  const { mobile, otp } = req.body;
  if (otp !== '123456') {
    return res.status(400).json({ error: 'Invalid OTP code' });
  }

  const sql = `SELECT * FROM users WHERE mobile = ?`;
  const resUser = await query(sql, [mobile]);
  
  if (resUser.rows && resUser.rows.length > 0) {
    const user = resUser.rows[0];
    const userObj = { id: user.id, name: user.name, mobile: user.mobile, email: user.email, role: user.role, language_pref: user.language_pref };
    const token = generateToken(userObj);
    return res.json({ message: 'OTP verified successfully', token, user: userObj });
  } else {
    return res.json({ verified: true, needsRegistration: true, message: 'OTP verified. Please complete profile.' });
  }
});

// Get current user profile
router.get('/me', authenticateToken, (req, res) => {
  return res.json({ user: req.user });
});

module.exports = router;
