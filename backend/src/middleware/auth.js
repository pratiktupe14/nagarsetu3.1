const jwt = require('jsonwebtoken');

const isProd = process.env.NODE_ENV === 'production';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET || 'nagarsetu_secret_key_2026_super_secure';
  if (isProd && !process.env.JWT_SECRET) {
    console.warn('SECURITY WARNING: JWT_SECRET environment variable is unconfigured in production mode.');
  }
  return secret;
}

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      mobile: user.mobile,
      email: user.email,
      role: user.role,
      department_id: user.department_id,
      department_name: user.department_name,
      department_code: user.department_code,
      language_pref: user.language_pref
    },
    getJwtSecret(),
    { expiresIn: '30d' }
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, getJwtSecret(), (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
}

function requireRole(roles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Access denied for user role' });
    }
    next();
  };
}

module.exports = {
  getJwtSecret,
  get JWT_SECRET() { return getJwtSecret(); },
  generateToken,
  authenticateToken,
  requireRole
};
