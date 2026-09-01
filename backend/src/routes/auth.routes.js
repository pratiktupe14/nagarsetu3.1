const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { generateToken, authenticateToken } = require('../middleware/auth');
const validateInput = require('../middleware/validateInput');
const { registerSchema, loginSchema, otpRequestSchema, otpVerifySchema } = require('../schemas/auth.schemas');

// Register endpoint (Citizen, Officer, Staff, Admin)
router.post('/register', validateInput(registerSchema), async (req, res) => {
  try {
    const { name, mobile, email, password, role = 'citizen', language_pref = 'en' } = req.body;

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

    if (res.clearAuthAttempts) res.clearAuthAttempts();

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
router.post('/login', validateInput(loginSchema), async (req, res) => {
  try {
    const { mobileOrEmail, password } = req.body;

    const cleanIdentifier = String(mobileOrEmail).trim().toLowerCase();
    const sql = `SELECT * FROM users WHERE mobile = ? OR LOWER(email) = ?`;
    let resUser = await query(sql, [mobileOrEmail.trim(), cleanIdentifier]);

    let user = resUser.rows && resUser.rows.length > 0 ? resUser.rows[0] : null;

    // Fallback: If user not found in users table, check department_heads or field_staff table
    if (!user) {
      const dhFallback = await query(
        `SELECT dh.*, d.name as dept_name, d.code as dept_code FROM department_heads dh LEFT JOIN departments d ON d.id = dh.department_id WHERE LOWER(dh.email) = ? OR dh.phone = ? ORDER BY dh.id DESC LIMIT 1`,
        [cleanIdentifier, mobileOrEmail.trim()]
      );
      if (dhFallback.rows && dhFallback.rows.length > 0) {
        const dh = dhFallback.rows[0];
        const salt = await bcrypt.genSalt(10);
        const newHash = await bcrypt.hash(password, salt);
        const insUser = await query(
          `INSERT INTO users (name, mobile, email, password_hash, role, department_id, employee_id, status) VALUES (?, ?, ?, ?, 'department_head', ?, ?, ?)`,
          [dh.name, dh.phone || '', cleanIdentifier, newHash, dh.department_id, dh.employee_id || '', dh.status || 'active']
        );
        const newUserId = insUser.rows[0].id;
        user = {
          id: newUserId,
          name: dh.name,
          mobile: dh.phone || '',
          email: cleanIdentifier,
          password_hash: newHash,
          role: 'department_head',
          department_id: dh.department_id,
          employee_id: dh.employee_id || '',
          status: dh.status || 'active',
          language_pref: 'en'
        };
      } else {
        const fsFallback = await query(
          `SELECT fs.*, d.name as dept_name, d.code as dept_code FROM field_staff fs LEFT JOIN departments d ON d.id = fs.department_id WHERE LOWER(fs.email) = ? OR fs.phone = ? OR fs.employee_id = ? ORDER BY fs.id DESC LIMIT 1`,
          [cleanIdentifier, mobileOrEmail.trim(), cleanIdentifier]
        );
        if (fsFallback.rows && fsFallback.rows.length > 0) {
          const fs = fsFallback.rows[0];
          const salt = await bcrypt.genSalt(10);
          const newHash = await bcrypt.hash(password, salt);
          const insUser = await query(
            `INSERT INTO users (name, mobile, email, password_hash, role, department_id, employee_id, status) VALUES (?, ?, ?, ?, 'service_staff', ?, ?, ?)`,
            [fs.name, fs.phone || '', cleanIdentifier, newHash, fs.department_id, fs.employee_id || '', fs.status || 'active']
          );
          const newUserId = insUser.rows[0].id;
          user = {
            id: newUserId,
            name: fs.name,
            mobile: fs.phone || '',
            email: cleanIdentifier,
            password_hash: newHash,
            role: 'service_staff',
            department_id: fs.department_id,
            employee_id: fs.employee_id || '',
            status: fs.status || 'active',
            language_pref: 'en'
          };
        }
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid login credentials' });
    }

    if (user.status === 'inactive') {
      return res.status(401).json({ error: 'Account is inactive. Please contact City Administration.' });
    }

    let isMatch = false;
    if (user.password_hash) {
      isMatch = await bcrypt.compare(password, user.password_hash);
    }

    // Development-only fallback credential check
    if (!isMatch && process.env.NODE_ENV !== 'production') {
      const devUserPass = process.env.DEMO_USER_PASSWORD || 'password123';
      const devAdminPass = process.env.DEMO_ADMIN_PASSWORD || 'NagarSetu@Admin2026!';
      const devHeadPass = process.env.DEMO_HEAD_PASSWORD || 'head123';
      const devStaffPass = process.env.DEMO_STAFF_PASSWORD || 'staff123';
      if (password === devAdminPass || password === devUserPass || password === devHeadPass || password === devStaffPass) {
        isMatch = true;
      }
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid login credentials' });
    }

    let departmentId = user.department_id || null;
    let departmentName = null;
    let departmentCode = null;

    if (user.role === 'department_head') {
      const dhRes = await query(
        `SELECT dh.*, d.name as dept_name, d.code as dept_code FROM department_heads dh LEFT JOIN departments d ON d.id = dh.department_id WHERE (dh.user_id = ? OR LOWER(dh.email) = ?) AND dh.status = 'active' ORDER BY dh.id DESC LIMIT 1`,
        [user.id, cleanIdentifier]
      );
      if (dhRes.rows && dhRes.rows.length > 0) {
        departmentId = dhRes.rows[0].department_id;
        departmentName = dhRes.rows[0].dept_name;
        departmentCode = dhRes.rows[0].dept_code;
      }

      if (!departmentId || !departmentName) {
        return res.status(403).json({ error: "Department assignment could not be resolved. Please contact City Administration." });
      }
    } else if (user.role === 'service_staff' || user.role === 'staff' || user.role === 'officer' || user.role === 'field_staff') {
      const fsRes = await query(
        `SELECT fs.*, d.name as dept_name, d.code as dept_code FROM field_staff fs LEFT JOIN departments d ON d.id = fs.department_id WHERE (fs.user_id = ? OR LOWER(fs.email) = ? OR fs.employee_id = ?) AND LOWER(COALESCE(fs.status, 'active')) = 'active' ORDER BY fs.id DESC LIMIT 1`,
        [user.id, cleanIdentifier, user.employee_id || '']
      );
      if (fsRes.rows && fsRes.rows.length > 0) {
        departmentId = fsRes.rows[0].department_id;
        departmentName = fsRes.rows[0].dept_name;
        departmentCode = fsRes.rows[0].dept_code;
      }

      if (!departmentName && departmentId) {
        const dRes = await query(`SELECT name, code FROM departments WHERE id = ? OR code = ?`, [departmentId, departmentId]);
        if (dRes.rows && dRes.rows.length > 0) {
          departmentName = dRes.rows[0].name;
          departmentCode = dRes.rows[0].code;
        }
      }

      if (!departmentId || !departmentName) {
        return res.status(403).json({ error: "Department assignment could not be resolved. Please contact City Administration." });
      }
    }

    if (departmentId && user.id && !user.department_id) {
      await query(`UPDATE users SET department_id = ? WHERE id = ?`, [departmentId, user.id]).catch(() => {});
    }

    const userRole = user.role === 'admin' ? 'city_admin' : user.role;

    const userObj = {
      id: user.id,
      name: user.name,
      mobile: user.mobile,
      email: user.email,
      role: userRole,
      department_id: departmentId,
      department_name: departmentName,
      department_code: departmentCode,
      employee_id: user.employee_id || null,
      status: user.status || 'active',
      language_pref: user.language_pref
    };

    const token = generateToken(userObj);

    if (res.clearAuthAttempts) res.clearAuthAttempts();

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
router.post('/otp-request', validateInput(otpRequestSchema), (req, res) => {
  const { mobile } = req.body;
  return res.json({ message: 'OTP sent successfully to ' + mobile, demoOtp: '123456' });
});

// OTP Verify (Simulated)
router.post('/otp-verify', validateInput(otpVerifySchema), async (req, res) => {
  try {
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
      if (res.clearAuthAttempts) res.clearAuthAttempts();
      return res.json({ message: 'OTP verified successfully', token, user: userObj });
    } else {
      if (res.clearAuthAttempts) res.clearAuthAttempts();
      return res.json({ verified: true, needsRegistration: true, message: 'OTP verified. Please complete profile.' });
    }
  } catch (err) {
    console.error('OTP verify error:', err);
    return res.status(500).json({ error: 'Server error during OTP verification' });
  }
});

// Get current user profile
router.get('/me', authenticateToken, (req, res) => {
  return res.json({ user: req.user });
});

module.exports = router;
