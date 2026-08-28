const jwt = require('jsonwebtoken');

function getJwtSecret() {
  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }
  if (process.env.NODE_ENV === 'production') {
    throw new Error('[FATAL SECURITY ERROR] JWT_SECRET environment variable must be set in production!');
  }
  console.warn('[SECURITY WARNING] JWT_SECRET is not configured in environment variables. Falling back to development environment key.');
  return 'nagarsetu_dev_secret_key_change_in_production_2026';
}

const JWT_SECRET = getJwtSecret();

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      mobile: user.mobile,
      email: user.email,
      role: user.role,
      language_pref: user.language_pref
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
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
  JWT_SECRET,
  generateToken,
  authenticateToken,
  requireRole
};
