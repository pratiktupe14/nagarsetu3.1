/**
 * NAGARSETU Security Middleware — Configurable Rate Limiter
 * Provides rate limiting for:
 * 1. Auth routes (Stricter, per-IP + per-account with exponential backoff)
 * 2. Public endpoints (Moderate sliding window)
 * 3. Authenticated actions (Looser sliding window)
 */

// In-memory stores for tracking rate limit windows and attempts
const authStore = new Map();
const publicStore = new Map();
const authenticatedStore = new Map();

// Periodic cleanup of expired entries (every 10 minutes)
setInterval(() => {
  const now = Date.now();
  
  for (const [key, data] of authStore.entries()) {
    if (now - data.lastAttempt > (data.windowMs || 900000) * 2) {
      authStore.delete(key);
    }
  }

  for (const [ip, data] of publicStore.entries()) {
    if (now - data.startTime > (data.windowMs || 900000)) {
      publicStore.delete(ip);
    }
  }

  for (const [userIdKey, data] of authenticatedStore.entries()) {
    if (now - data.startTime > (data.windowMs || 900000)) {
      authenticatedStore.delete(userIdKey);
    }
  }
}, 600000);

/**
 * 1. Authentication Routes Limiter
 * Combination of per-IP and per-account tracking with exponential backoff
 */
function authRateLimiter(req, res, next) {
  const windowMs = parseInt(process.env.RATE_LIMIT_AUTH_WINDOW_MS, 10) || 15 * 60 * 1000; // Default 15 minutes
  const maxAttempts = parseInt(process.env.RATE_LIMIT_AUTH_MAX_ATTEMPTS, 10) || 5; // 5 allowed free attempts
  const baseBackoffMs = parseInt(process.env.RATE_LIMIT_AUTH_BASE_BACKOFF_MS, 10) || 2000; // Base backoff 2 seconds

  const ip = req.ip || req.connection?.remoteAddress || 'unknown-ip';
  const accountIdentifier = String(
    req.body?.mobileOrEmail || req.body?.mobile || req.body?.email || ''
  ).trim().toLowerCase();

  const compositeKey = `auth:${ip}:${accountIdentifier || 'anon'}`;
  const now = Date.now();

  let record = authStore.get(compositeKey);

  if (!record) {
    record = { attempts: 0, lastAttempt: now, windowMs };
    authStore.set(compositeKey, record);
  }

  // Reset window if elapsed time since last attempt is greater than windowMs
  if (now - record.lastAttempt > windowMs) {
    record.attempts = 0;
  }

  // Check if attempts exceed threshold and compute exponential backoff
  if (record.attempts >= maxAttempts) {
    const excess = record.attempts - maxAttempts + 1;
    // Exponential backoff: baseBackoff * 2^(excess - 1), capped at windowMs
    const backoffDelayMs = Math.min(baseBackoffMs * Math.pow(2, excess - 1), windowMs);
    const timeSinceLastAttempt = now - record.lastAttempt;

    if (timeSinceLastAttempt < backoffDelayMs) {
      const retryAfterSeconds = Math.ceil((backoffDelayMs - timeSinceLastAttempt) / 1000);
      res.setHeader('Retry-After', retryAfterSeconds);
      res.setHeader('X-RateLimit-Limit', maxAttempts);
      res.setHeader('X-RateLimit-Remaining', 0);
      return res.status(429).json({
        error: 'Too many authentication attempts. Please wait before trying again.',
        retryAfterSeconds,
        backoffDelayMs
      });
    }
  }

  // Increment attempts for this request attempt
  record.attempts += 1;
  record.lastAttempt = now;
  record.windowMs = windowMs;

  const remaining = Math.max(0, maxAttempts - record.attempts);
  res.setHeader('X-RateLimit-Limit', maxAttempts);
  res.setHeader('X-RateLimit-Remaining', remaining);

  // Attach a helper to reset count on successful authentication
  res.on('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      authStore.delete(compositeKey);
    }
  });

  next();
}

/**
 * 2. Public Endpoints Limiter
 * Moderate limits on unauthenticated public routes (e.g. /api/health, /api/maps/*)
 */
function publicRateLimiter(req, res, next) {
  const windowMs = parseInt(process.env.RATE_LIMIT_PUBLIC_WINDOW_MS, 10) || 15 * 60 * 1000; // 15 mins
  const max = parseInt(process.env.RATE_LIMIT_PUBLIC_MAX, 10) || 100; // 100 requests per 15 mins

  const ip = req.ip || req.connection?.remoteAddress || 'unknown-ip';
  const now = Date.now();

  let record = publicStore.get(ip);

  if (!record || now - record.startTime > windowMs) {
    record = { count: 0, startTime: now, windowMs };
    publicStore.set(ip, record);
  }

  record.count += 1;

  if (record.count > max) {
    const retryAfterSeconds = Math.ceil((windowMs - (now - record.startTime)) / 1000);
    res.setHeader('Retry-After', retryAfterSeconds);
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', 0);
    return res.status(429).json({
      error: 'Too many requests to public endpoint. Please slow down.',
      retryAfterSeconds
    });
  }

  res.setHeader('X-RateLimit-Limit', max);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
  next();
}

/**
 * 3. Authenticated User Actions Limiter
 * Looser limits on authenticated user actions (e.g. complaints, officer, staff actions)
 */
function authenticatedRateLimiter(req, res, next) {
  const windowMs = parseInt(process.env.RATE_LIMIT_AUTHENTICATED_WINDOW_MS, 10) || 15 * 60 * 1000; // 15 mins
  const max = parseInt(process.env.RATE_LIMIT_AUTHENTICATED_MAX, 10) || 300; // 300 requests per 15 mins

  const userId = req.user?.id || req.ip || 'unknown-user';
  const key = `user:${userId}`;
  const now = Date.now();

  let record = authenticatedStore.get(key);

  if (!record || now - record.startTime > windowMs) {
    record = { count: 0, startTime: now, windowMs };
    authenticatedStore.set(key, record);
  }

  record.count += 1;

  if (record.count > max) {
    const retryAfterSeconds = Math.ceil((windowMs - (now - record.startTime)) / 1000);
    res.setHeader('Retry-After', retryAfterSeconds);
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', 0);
    return res.status(429).json({
      error: 'Rate limit exceeded for authenticated actions. Please slow down.',
      retryAfterSeconds
    });
  }

  res.setHeader('X-RateLimit-Limit', max);
  res.setHeader('X-RateLimit-Remaining', Math.max(0, max - record.count));
  next();
}

module.exports = {
  authRateLimiter,
  publicRateLimiter,
  authenticatedRateLimiter
};
