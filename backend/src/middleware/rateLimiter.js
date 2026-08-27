const rateLimit = require('express-rate-limit');

// Helper to parse env int with fallback
const getEnvInt = (key, fallback) => {
  const val = parseInt(process.env[key], 10);
  return !isNaN(val) && val > 0 ? val : fallback;
};

// 1. Auth Rate Limiter (Login, Register, Password Reset, OTP)
// Stricter rate limits on auth routes per IP & account tracking
const authRateLimiter = rateLimit({
  windowMs: getEnvInt('RATE_LIMIT_AUTH_WINDOW_MS', 15 * 60 * 1000), // 15 minutes
  max: getEnvInt('RATE_LIMIT_AUTH_MAX', 10), // Limit each IP to 10 requests per window
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  validate: false,
  keyGenerator: (req) => {
    const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
    const identifier = req.body && (req.body.mobile || req.body.email || req.body.mobileOrEmail);
    const cleanId = identifier ? String(identifier).trim().toLowerCase() : '';
    return `${ip}_${cleanId}`;
  },
  handler: (req, res /*, next, options */) => {
    const retryAfter = Math.ceil(getEnvInt('RATE_LIMIT_AUTH_WINDOW_MS', 15 * 60 * 1000) / 1000);
    res.setHeader('Retry-After', retryAfter);
    return res.status(429).json({
      error: 'Too many authentication attempts. Please try again later.',
      retryAfterSeconds: retryAfter
    });
  }
});

// 2. Public Endpoints Rate Limiter (Health, Geocoding, public maps)
const publicRateLimiter = rateLimit({
  windowMs: getEnvInt('RATE_LIMIT_PUBLIC_WINDOW_MS', 15 * 60 * 1000), // 15 minutes
  max: getEnvInt('RATE_LIMIT_PUBLIC_MAX', 100), // 100 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: {
    error: 'Too many requests from this IP. Please try again later.'
  }
});

// 3. Authenticated User Actions Rate Limiter (Complaints, Admin, Staff, Officer)
const authedRateLimiter = rateLimit({
  windowMs: getEnvInt('RATE_LIMIT_AUTHED_WINDOW_MS', 15 * 60 * 1000), // 15 minutes
  max: getEnvInt('RATE_LIMIT_AUTHED_MAX', 300), // 300 requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  validate: false,
  message: {
    error: 'Action rate limit exceeded. Please slow down your requests.'
  }
});

module.exports = {
  authRateLimiter,
  publicRateLimiter,
  authedRateLimiter
};
