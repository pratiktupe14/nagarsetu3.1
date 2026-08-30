/**
 * NAGARSETU Security Middleware — Configurable Rate Limiter
 * Provides rate limiting for:
 * 1. Auth routes (per-IP + per-account exponential backoff with res.clearAuthAttempts())
 * 2. Public endpoints (Health, Maps, Geocoding)
 * 3. Authenticated actions (Complaints, Admin, Staff, Officer)
 */

const rateLimit = require('express-rate-limit');

// Helper to parse env int with fallback
const getEnvInt = (key, fallback) => {
  const val = parseInt(process.env[key], 10);
  return !isNaN(val) && val > 0 ? val : fallback;
};

/**
 * In-Memory Exponential Backoff Tracker for Authentication Routes.
 * Combines per-IP and per-account (mobile/email) attempt tracking.
 */
const authAttemptTracker = new Map();

// Periodic cleanup of stale attempt records (unref'd for serverless event-loop safety)
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of authAttemptTracker.entries()) {
    if (record.blockedUntil && record.blockedUntil < now && record.resetAt < now) {
      authAttemptTracker.delete(key);
    }
  }
}, 10 * 60 * 1000);

if (cleanupTimer && typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref();
}

/**
 * Custom Exponential Backoff Auth Rate Limiter
 * Enforces per-IP and per-account limits with progressive retry delays instead of hard lockout.
 */
function authRateLimiter(req, res, next) {
  const windowMs = getEnvInt('RATE_LIMIT_AUTH_WINDOW_MS', 15 * 60 * 1000); // Default 15 minutes
  const maxAttempts = getEnvInt('RATE_LIMIT_AUTH_MAX', 5); // Allow 5 free attempts before backoff
  const baseBackoffSec = getEnvInt('RATE_LIMIT_AUTH_BACKOFF_BASE_SEC', 30); // 30s base multiplier

  const ip = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '127.0.0.1';
  const identifier = req.body && (req.body.mobile || req.body.email || req.body.mobileOrEmail);
  const cleanId = identifier ? String(identifier).trim().toLowerCase() : '';

  const ipKey = `ip_${ip}`;
  const accountKey = cleanId ? `account_${cleanId}` : null;

  const now = Date.now();

  // Helper to retrieve or create record
  const getRecord = (key) => {
    let rec = authAttemptTracker.get(key);
    if (!rec || rec.resetAt < now) {
      rec = { count: 0, blockedUntil: 0, resetAt: now + windowMs };
      authAttemptTracker.set(key, rec);
    }
    return rec;
  };

  const ipRecord = getRecord(ipKey);
  const accountRecord = accountKey ? getRecord(accountKey) : null;

  // Check if either IP or account is currently blocked
  const ipBlockedMs = ipRecord.blockedUntil - now;
  const accountBlockedMs = accountRecord ? accountRecord.blockedUntil - now : 0;
  const maxBlockedMs = Math.max(ipBlockedMs, accountBlockedMs);

  if (maxBlockedMs > 0) {
    const retryAfterSeconds = Math.ceil(maxBlockedMs / 1000);
    res.setHeader('Retry-After', retryAfterSeconds);
    return res.status(429).json({
      error: 'Too many authentication attempts. Please try again later.',
      retryAfterSeconds
    });
  }

  // Increment attempt count on request trigger
  ipRecord.count += 1;
  if (accountRecord) accountRecord.count += 1;

  // Calculate exponential backoff if max attempts exceeded
  const checkAndApplyBackoff = (rec) => {
    if (rec.count > maxAttempts) {
      const exponent = rec.count - maxAttempts;
      // Exponential backoff: baseSec * (2 ^ (exponent - 1)) capped at 1 hour max delay
      const delaySec = Math.min(baseBackoffSec * Math.pow(2, exponent - 1), 3600);
      rec.blockedUntil = Date.now() + (delaySec * 1000);
    }
  };

  checkAndApplyBackoff(ipRecord);
  if (accountRecord) checkAndApplyBackoff(accountRecord);

  // Helper attached to res so route handlers can clear attempts upon successful login/register
  res.clearAuthAttempts = () => {
    authAttemptTracker.delete(ipKey);
    if (accountKey) authAttemptTracker.delete(accountKey);
  };

  next();
}

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
  authedRateLimiter,
  authenticatedRateLimiter: authedRateLimiter
};
