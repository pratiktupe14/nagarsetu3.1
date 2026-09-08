const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { query } = require('../config/db');
const { generateToken, authenticateToken } = require('../middleware/auth');
const validateInput = require('../middleware/validateInput');
const { registerSchema, loginSchema, otpRequestSchema, otpVerifySchema } = require('../schemas/auth.schemas');

function extractDigits(str) {
  return String(str || '').replace(/\D/g, '');
}

function normalizeMobile(str) {
  const digits = extractDigits(str);
  if (digits.length >= 10) {
    return digits.slice(-10);
  }
  return digits || String(str || '').trim();
}

// Register endpoint (Citizen, Officer, Staff, Admin)
router.post('/register', validateInput(registerSchema), async (req, res) => {
  try {
    const { name, mobile, email, password, role = 'citizen', language_pref = 'en' } = req.body;

    const cleanMobile = normalizeMobile(mobile);
    const cleanEmail = email && String(email).trim() !== '' ? String(email).trim().toLowerCase() : null;

    // Check existing user by mobile or email
    const checkSql = `SELECT id FROM users WHERE mobile = ? OR mobile = ? OR (email IS NOT NULL AND email != '' AND LOWER(email) = ?)`;
    const existing = await query(checkSql, [cleanMobile, String(mobile).trim(), cleanEmail || '']);
    if (existing.rows && existing.rows.length > 0) {
      return res.status(400).json({ error: 'User with this mobile number or email already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const insertSql = `
      INSERT INTO users (name, mobile, email, password_hash, role, language_pref)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const result = await query(insertSql, [name.trim(), cleanMobile, cleanEmail, password_hash, role, language_pref]);

    const newUserId = result.rows[0].id;
    const userObj = { id: newUserId, name: name.trim(), mobile: cleanMobile, email: cleanEmail, role, language_pref };
    const token = generateToken(userObj);

    // Create corresponding profile record for UUID referential integrity
    try {
      const crypto = require('crypto');
      const pCheck = await query(
        `SELECT id FROM profiles WHERE (mobile IS NOT NULL AND mobile = ?) OR (email IS NOT NULL AND email != '' AND LOWER(email) = ?) LIMIT 1`,
        [cleanMobile, cleanEmail || '']
      );
      if (!pCheck.rows || pCheck.rows.length === 0) {
        const newProfileUuid = crypto.randomUUID();
        await query(
          `INSERT INTO profiles (id, full_name, mobile, email, role, language_pref, status) VALUES (?, ?, ?, ?, ?, ?, 'active')`,
          [newProfileUuid, name.trim(), cleanMobile, cleanEmail, role, language_pref]
        );
      }
    } catch (pErr) {
      console.warn('[REGISTRATION PROFILE SYNC NOTE]:', pErr.message);
    }

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

    const rawInput = String(mobileOrEmail).trim();
    const cleanIdentifier = rawInput.toLowerCase();
    const digitsOnly = extractDigits(rawInput);
    const normMobile = normalizeMobile(rawInput);

    const sql = `
      SELECT * FROM users 
      WHERE mobile = ? 
         OR mobile = ? 
         OR mobile = ?
         OR (email IS NOT NULL AND email != '' AND LOWER(email) = ?)
      ORDER BY id DESC LIMIT 1
    `;
    let resUser = await query(sql, [rawInput, digitsOnly, normMobile, cleanIdentifier]);

    let user = resUser.rows && resUser.rows.length > 0 ? resUser.rows[0] : null;

    // Fallback: If user not found in users table by direct identifier, check if linked via department_heads or field_staff
    if (!user) {
      const dhFallback = await query(
        `SELECT u.* FROM department_heads dh 
         JOIN users u ON (CAST(u.id AS TEXT) = CAST(dh.user_id AS TEXT) OR LOWER(u.email) = LOWER(dh.email))
         WHERE LOWER(dh.email) = ? OR dh.phone = ? OR dh.phone LIKE ? OR dh.phone LIKE ?
         ORDER BY dh.id DESC LIMIT 1`,
        [cleanIdentifier, rawInput, `%${normMobile}%`, `%${digitsOnly}%`]
      );
      if (dhFallback.rows && dhFallback.rows.length > 0) {
        user = dhFallback.rows[0];
      } else {
        const fsFallback = await query(
          `SELECT u.* FROM field_staff fs 
           JOIN users u ON (CAST(u.id AS TEXT) = CAST(fs.user_id AS TEXT) OR LOWER(u.email) = LOWER(fs.email))
           WHERE LOWER(fs.email) = ? OR fs.phone = ? OR fs.phone LIKE ? OR fs.phone LIKE ? OR fs.employee_id = ? 
           ORDER BY fs.id DESC LIMIT 1`,
          [cleanIdentifier, rawInput, `%${normMobile}%`, `%${digitsOnly}%`, rawInput]
        );
        if (fsFallback.rows && fsFallback.rows.length > 0) {
          user = fsFallback.rows[0];
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
      if (user.password_hash.startsWith('$2')) {
        isMatch = await bcrypt.compare(password, user.password_hash);
      } else {
        isMatch = (password === user.password_hash);
      }
    }

    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid login credentials' });
    }

    if (typeof res.clearAuthAttempts === 'function') {
      res.clearAuthAttempts();
    }

    let departmentId = user.department_id || null;
    let departmentName = null;
    let departmentCode = null;

    const codeToDept = {
      '1': 'PWD', '2': 'SAN', '3': 'WTR', '4': 'DRN', '5': 'ELE', '6': 'TRF', '7': 'MNT'
    };

    if (user.role === 'department_head') {
      let resolvedDept = null;
      const targetId = user.department_id || departmentId;
      if (targetId) {
        const dCheck = await query(
          `SELECT id, name, code FROM departments WHERE CAST(id AS TEXT) = ? OR code = ? OR code = ? LIMIT 1`,
          [String(targetId), String(targetId), codeToDept[String(targetId)] || '']
        );
        if (dCheck.rows && dCheck.rows.length > 0) {
          resolvedDept = dCheck.rows[0];
        }
      }

      if (!resolvedDept) {
        const dhRes = await query(
          `SELECT dh.*, d.id as d_id, d.name as dept_name, d.code as dept_code 
           FROM department_heads dh 
           LEFT JOIN departments d ON (CAST(d.id AS TEXT) = CAST(dh.department_id AS TEXT) OR d.code = CAST(dh.department_id AS TEXT))
           WHERE (CAST(dh.user_id AS TEXT) = ? OR LOWER(dh.email) = ?) 
           AND LOWER(COALESCE(dh.status, 'active')) = 'active' 
           ORDER BY dh.id DESC LIMIT 1`,
          [String(user.id), cleanIdentifier]
        );
        if (dhRes.rows && dhRes.rows.length > 0) {
          const dhRow = dhRes.rows[0];
          if (dhRow.dept_name) {
            resolvedDept = { id: dhRow.d_id || dhRow.department_id, name: dhRow.dept_name, code: dhRow.dept_code };
          } else if (dhRow.department_id) {
            const code = codeToDept[String(dhRow.department_id)] || String(dhRow.department_id);
            const dCheck2 = await query(
              `SELECT id, name, code FROM departments WHERE CAST(id AS TEXT) = ? OR code = ? LIMIT 1`,
              [String(dhRow.department_id), code]
            );
            if (dCheck2.rows && dCheck2.rows.length > 0) {
              resolvedDept = dCheck2.rows[0];
            }
          }
        }
      }

      if (resolvedDept) {
        departmentId = resolvedDept.id;
        departmentName = resolvedDept.name;
        departmentCode = resolvedDept.code;
      } else {
        return res.status(403).json({ error: "Department assignment could not be resolved. Please contact City Administration." });
      }
    } else if (user.role === 'service_staff' || user.role === 'staff' || user.role === 'officer' || user.role === 'field_staff') {
      let resolvedDept = null;
      const targetId = user.department_id || departmentId;
      if (targetId) {
        const dCheck = await query(
          `SELECT id, name, code FROM departments WHERE CAST(id AS TEXT) = ? OR code = ? OR code = ? LIMIT 1`,
          [String(targetId), String(targetId), codeToDept[String(targetId)] || '']
        );
        if (dCheck.rows && dCheck.rows.length > 0) {
          resolvedDept = dCheck.rows[0];
        }
      }

      if (!resolvedDept) {
        const fsRes = await query(
          `SELECT fs.*, d.id as d_id, d.name as dept_name, d.code as dept_code 
           FROM field_staff fs 
           LEFT JOIN departments d ON (CAST(d.id AS TEXT) = CAST(fs.department_id AS TEXT) OR d.code = CAST(fs.department_id AS TEXT))
           WHERE (CAST(fs.user_id AS TEXT) = ? OR LOWER(fs.email) = ? OR fs.employee_id = ?) 
           AND LOWER(COALESCE(fs.status, 'active')) = 'active' 
           ORDER BY fs.id DESC LIMIT 1`,
          [String(user.id), cleanIdentifier, user.employee_id || '']
        );
        if (fsRes.rows && fsRes.rows.length > 0) {
          const fsRow = fsRes.rows[0];
          if (fsRow.dept_name) {
            resolvedDept = { id: fsRow.d_id || fsRow.department_id, name: fsRow.dept_name, code: fsRow.dept_code };
          } else if (fsRow.department_id) {
            const code = codeToDept[String(fsRow.department_id)] || String(fsRow.department_id);
            const dCheck2 = await query(
              `SELECT id, name, code FROM departments WHERE CAST(id AS TEXT) = ? OR code = ? LIMIT 1`,
              [String(fsRow.department_id), code]
            );
            if (dCheck2.rows && dCheck2.rows.length > 0) {
              resolvedDept = dCheck2.rows[0];
            }
          }
        }
      }

      // Default fallback for staff to PWD if still unresolved
      if (!resolvedDept) {
        const pwdCheck = await query(`SELECT id, name, code FROM departments WHERE code = 'PWD' OR name ILIKE '%Public Works%' LIMIT 1`);
        if (pwdCheck.rows && pwdCheck.rows.length > 0) {
          resolvedDept = pwdCheck.rows[0];
        }
      }

      if (resolvedDept) {
        departmentId = resolvedDept.id;
        departmentName = resolvedDept.name;
        departmentCode = resolvedDept.code;
      } else {
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
    const { mobile, otp, name } = req.body;
    if (otp !== '123456') {
      return res.status(400).json({ error: 'Invalid OTP code' });
    }

    const cleanMobile = normalizeMobile(mobile);
    const sql = `SELECT * FROM users WHERE mobile = ? OR mobile = ?`;
    const resUser = await query(sql, [cleanMobile, mobile]);
    
    if (resUser.rows && resUser.rows.length > 0) {
      const user = resUser.rows[0];
      const userObj = { id: user.id, name: user.name, mobile: user.mobile, email: user.email, role: user.role, language_pref: user.language_pref };
      const token = generateToken(userObj);
      if (res.clearAuthAttempts) res.clearAuthAttempts();
      return res.json({ message: 'OTP verified successfully', token, user: userObj });
    } else {
      // Auto-register citizen on first verified OTP
      const citizenName = (name && String(name).trim()) || 'Citizen User';
      const salt = await bcrypt.genSalt(10);
      const defaultHash = await bcrypt.hash(Math.random().toString(36), salt);
      const citizenEmail = `${cleanMobile}@citizen.nagarsetu.gov.in`;

      await query(
        `INSERT INTO users (name, mobile, email, password_hash, role, language_pref, status) VALUES (?, ?, ?, ?, 'citizen', 'en', 'active')`,
        [citizenName, cleanMobile, citizenEmail, defaultHash]
      );

      const createdRes = await query(`SELECT * FROM users WHERE mobile = ? LIMIT 1`, [cleanMobile]);
      const newUser = createdRes.rows[0];
      const userObj = { id: newUser.id, name: newUser.name, mobile: newUser.mobile, email: newUser.email, role: 'citizen', language_pref: 'en' };
      const token = generateToken(userObj);
      if (res.clearAuthAttempts) res.clearAuthAttempts();
      return res.json({ message: 'OTP verified successfully', token, user: userObj });
    }
  } catch (err) {
    console.error('OTP verify error:', err);
    return res.status(500).json({ error: 'Server error during OTP verification' });
  }
});

// Get authoritative current user profile directly from persistent database
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRes = await query(
      `SELECT u.id, u.name, u.mobile, u.email, u.role, u.department_id, u.employee_id, u.designation, u.status, u.language_pref,
              d.name as department_name, d.code as department_code
       FROM users u
       LEFT JOIN departments d ON (CAST(u.department_id AS TEXT) = CAST(d.id AS TEXT) OR CAST(u.department_id AS TEXT) = d.code)
       WHERE CAST(u.id AS TEXT) = ? OR LOWER(COALESCE(u.email, '')) = LOWER(?)
       LIMIT 1`,
      [String(userId), String(req.user.email || '')]
    );

    if (!userRes.rows || userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User record not found in persistent database' });
    }

    const u = userRes.rows[0];
    const userRole = u.role === 'admin' ? 'city_admin' : (u.role === 'staff' ? 'service_staff' : u.role);

    let departmentId = u.department_id ? String(u.department_id) : null;
    let departmentName = u.department_name || null;
    let departmentCode = u.department_code || null;

    if (!departmentId && userRole === 'department_head') {
      const dhRes = await query(
        `SELECT dh.department_id, d.name as dept_name, d.code as dept_code 
         FROM department_heads dh 
         LEFT JOIN departments d ON (CAST(d.id AS TEXT) = CAST(dh.department_id AS TEXT) OR d.code = CAST(dh.department_id AS TEXT))
         WHERE CAST(dh.user_id AS TEXT) = ? OR LOWER(dh.email) = LOWER(?)`,
        [String(u.id), u.email || '']
      );
      if (dhRes.rows && dhRes.rows.length > 0) {
        departmentId = String(dhRes.rows[0].department_id);
        departmentName = dhRes.rows[0].dept_name;
        departmentCode = dhRes.rows[0].dept_code;
      }
    } else if (!departmentId && (userRole === 'service_staff' || userRole === 'staff' || userRole === 'field_staff')) {
      const fsRes = await query(
        `SELECT fs.department_id, d.name as dept_name, d.code as dept_code 
         FROM field_staff fs 
         LEFT JOIN departments d ON (CAST(d.id AS TEXT) = CAST(fs.department_id AS TEXT) OR d.code = CAST(fs.department_id AS TEXT))
         WHERE CAST(fs.user_id AS TEXT) = ? OR LOWER(fs.email) = LOWER(?) OR fs.employee_id = ?`,
        [String(u.id), u.email || '', u.employee_id || '']
      );
      if (fsRes.rows && fsRes.rows.length > 0) {
        departmentId = String(fsRes.rows[0].department_id);
        departmentName = fsRes.rows[0].dept_name;
        departmentCode = fsRes.rows[0].dept_code;
      }
    }

    if (departmentId && (!departmentName || !departmentCode)) {
      const dCheck = await query(
        `SELECT id, name, code FROM departments WHERE CAST(id AS TEXT) = ? OR code = ? LIMIT 1`,
        [String(departmentId), String(departmentId)]
      );
      if (dCheck.rows && dCheck.rows.length > 0) {
        departmentName = dCheck.rows[0].name;
        departmentCode = dCheck.rows[0].code;
      }
    }

    const userObj = {
      id: u.id,
      name: u.name,
      mobile: u.mobile,
      email: u.email,
      role: userRole,
      department_id: departmentId,
      department_name: departmentName,
      department_code: departmentCode,
      employee_id: u.employee_id || null,
      designation: u.designation || null,
      status: u.status || 'active',
      language_pref: u.language_pref || 'en'
    };

    return res.json({
      success: true,
      user: userObj
    });
  } catch (err) {
    console.error('Fetch /api/auth/me database error:', err);
    return res.status(500).json({ error: 'Failed to retrieve user profile from database' });
  }
});

/**
 * PUT /api/auth/profile
 * Authoritative user profile update (Citizen, Field Staff, Department Head, Admin)
 */
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, fullName, mobile, email, address, language_pref } = req.body;

    const cleanName = (fullName || name || '').trim();
    const cleanMobile = mobile ? normalizeMobile(mobile) : null;
    const cleanEmail = email && String(email).trim() !== '' ? String(email).trim().toLowerCase() : null;
    const cleanLang = language_pref ? String(language_pref).trim() : null;

    // Check if user exists
    const userCheck = await query(`SELECT * FROM users WHERE CAST(id AS TEXT) = ?`, [String(userId)]);
    if (!userCheck.rows || userCheck.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const currentUser = userCheck.rows[0];

    // Check email uniqueness if email is being changed
    if (cleanEmail && cleanEmail !== (currentUser.email || '').toLowerCase()) {
      const emailCheck = await query(`SELECT id FROM users WHERE LOWER(email) = ? AND CAST(id AS TEXT) != ?`, [cleanEmail, String(userId)]);
      if (emailCheck.rows && emailCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Email is already in use by another account' });
      }
    }

    // Check mobile uniqueness if mobile is being changed
    if (cleanMobile && cleanMobile !== currentUser.mobile) {
      const mobCheck = await query(`SELECT id FROM users WHERE mobile = ? AND CAST(id AS TEXT) != ?`, [cleanMobile, String(userId)]);
      if (mobCheck.rows && mobCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Mobile number is already in use by another account' });
      }
    }

    const updatedName = cleanName || currentUser.name;
    const updatedMobile = cleanMobile || currentUser.mobile;
    const updatedEmail = cleanEmail !== null ? cleanEmail : currentUser.email;
    const updatedLang = cleanLang || currentUser.language_pref || 'en';

    await query(
      `UPDATE users 
       SET name = ?, mobile = ?, email = ?, language_pref = ? 
       WHERE CAST(id AS TEXT) = ?`,
      [updatedName, updatedMobile, updatedEmail, updatedLang, String(userId)]
    );

    // Sync profiles table (for UUID referential integrity)
    try {
      await query(
        `UPDATE profiles 
         SET full_name = ?, mobile = ?, email = ?, language_pref = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE (mobile IS NOT NULL AND mobile = ?) 
            OR (email IS NOT NULL AND email != '' AND LOWER(email) = ?)`,
        [updatedName, updatedMobile, updatedEmail, updatedLang, updatedMobile, (updatedEmail || '').toLowerCase()]
      );
    } catch (pErr) {
      console.warn('[PROFILE SYNC NOTE]:', pErr.message);
    }

    // Read back updated user
    const readBack = await query(
      `SELECT u.id, u.name, u.mobile, u.email, u.role, u.department_id, u.employee_id, u.designation, u.status, u.language_pref,
              d.name as department_name, d.code as department_code
       FROM users u
       LEFT JOIN departments d ON (CAST(u.department_id AS TEXT) = CAST(d.id AS TEXT) OR CAST(u.department_id AS TEXT) = d.code)
       WHERE CAST(u.id AS TEXT) = ?
       LIMIT 1`,
      [String(userId)]
    );

    const u = readBack.rows[0];
    const userRole = u.role === 'admin' ? 'city_admin' : (u.role === 'staff' ? 'service_staff' : u.role);

    const userObj = {
      id: u.id,
      name: u.name,
      full_name: u.name,
      mobile: u.mobile,
      email: u.email,
      role: userRole,
      department_id: u.department_id ? String(u.department_id) : null,
      department_name: u.department_name || null,
      department_code: u.department_code || null,
      employee_id: u.employee_id || null,
      designation: u.designation || null,
      status: u.status || 'active',
      language_pref: u.language_pref || 'en'
    };

    return res.json({
      success: true,
      message: 'Profile updated successfully',
      user: userObj
    });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: 'Failed to update profile: ' + (err.message || 'Server error') });
  }
});

/**
 * POST /api/auth/change-password
 * Secure authenticated password change
 */
router.post('/change-password', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    if (String(newPassword).length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long' });
    }

    // Retrieve user and password hash
    const userRes = await query(`SELECT id, password_hash FROM users WHERE CAST(id AS TEXT) = ?`, [String(userId)]);
    if (!userRes.rows || userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentHash = userRes.rows[0].password_hash || '';
    let isMatch = false;
    if (currentHash) {
      if (currentHash.startsWith('$2')) {
        isMatch = await bcrypt.compare(currentPassword, currentHash);
      } else {
        isMatch = (currentPassword === currentHash);
      }
    }
    if (!isMatch) {
      return res.status(401).json({ error: 'Incorrect current password' });
    }

    const salt = await bcrypt.genSalt(10);
    const newHash = await bcrypt.hash(newPassword, salt);

    await query(`UPDATE users SET password_hash = ? WHERE CAST(id AS TEXT) = ?`, [newHash, String(userId)]);

    // Read back check
    const verifyRes = await query(`SELECT id, password_hash FROM users WHERE CAST(id AS TEXT) = ?`, [String(userId)]);
    if (!verifyRes.rows || verifyRes.rows[0].password_hash !== newHash) {
      return res.status(500).json({ error: 'Password update verification failed' });
    }

    return res.json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (err) {
    console.error('Change password error:', err);
    return res.status(500).json({ error: 'Failed to update password: ' + (err.message || 'Server error') });
  }
});

/**
 * POST /api/auth/refresh
 * Refresh active JWT token for seamless session continuation
 */
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const userRes = await query(
      `SELECT u.id, u.name, u.mobile, u.email, u.role, u.department_id, u.employee_id, u.designation, u.status, u.language_pref,
              d.name as department_name, d.code as department_code
       FROM users u
       LEFT JOIN departments d ON (CAST(u.department_id AS TEXT) = CAST(d.id AS TEXT) OR CAST(u.department_id AS TEXT) = d.code)
       WHERE CAST(u.id AS TEXT) = ?
       LIMIT 1`,
      [String(userId)]
    );

    if (!userRes.rows || userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User record not found' });
    }

    const u = userRes.rows[0];
    const userRole = u.role === 'admin' ? 'city_admin' : (u.role === 'staff' ? 'service_staff' : u.role);

    const userObj = {
      id: u.id,
      name: u.name,
      full_name: u.name,
      mobile: u.mobile,
      email: u.email,
      role: userRole,
      department_id: u.department_id ? String(u.department_id) : null,
      department_name: u.department_name || null,
      department_code: u.department_code || null,
      employee_id: u.employee_id || null,
      designation: u.designation || null,
      status: u.status || 'active',
      language_pref: u.language_pref || 'en'
    };

    const newToken = generateToken(userObj);

    return res.json({
      success: true,
      token: newToken,
      user: userObj
    });
  } catch (err) {
    console.error('Session refresh error:', err);
    return res.status(500).json({ error: 'Failed to refresh session' });
  }
});

module.exports = router;
