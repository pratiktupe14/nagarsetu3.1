/**
 * NAGARSETU 3.1 — STRUCTURED LOGGING & OBSERVABILITY UTILITY
 * 
 * Provides safe, structured JSON logging and lightweight runtime metrics collection.
 * GUARANTEE: Never logs passwords, OTPs, JWTs, API keys, database URLs, or secrets.
 */

const crypto = require('crypto');

const SENSITIVE_KEYS = [
  'password', 'password_hash', 'pass', 'pwd',
  'otp', 'token', 'jwt', 'authorization', 'bearer',
  'secret', 'jwt_secret', 'service_role', 'service_role_key',
  'database_url', 'postgres_url', 'supabase_db_url',
  'gemini_api_key', 'api_key', 'apikey', 'cookie', 'session'
];

/**
 * Recursively sanitizes data objects to prevent credential/secret leakage
 */
function sanitize(obj) {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(sanitize);

  const clean = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.some(s => lowerKey.includes(s))) {
      clean[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      clean[key] = sanitize(value);
    } else {
      clean[key] = value;
    }
  }
  return clean;
}

// In-Memory Runtime Observability Metrics (Non-persistent, platform-only)
const metrics = {
  startTime: new Date().toISOString(),
  totalRequests: 0,
  successfulRequests: 0,
  clientErrors: 0, // 4xx
  serverErrors: 0, // 5xx
  slowRequests: 0, // > 1000ms
  databaseErrors: 0,
  storageErrors: 0,
  aiErrors: 0,
  securityEvents: 0
};

function generateRequestId() {
  return `req_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`;
}

function log(level, event, data = {}) {
  const timestamp = new Date().toISOString();
  const safeData = sanitize(data);

  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    event,
    ...safeData
  };

  const output = JSON.stringify(logEntry);

  if (level === 'error') {
    console.error(output);
  } else if (level === 'warn') {
    console.warn(output);
  } else {
    console.log(output);
  }
}

function info(event, data) { log('info', event, data); }
function warn(event, data) { log('warn', event, data); }
function error(event, data) { log('error', event, data); }
function debug(event, data) {
  if (process.env.NODE_ENV !== 'production') {
    log('debug', event, data);
  }
}

function recordMetric(type, durationMs = 0) {
  metrics.totalRequests++;
  if (type >= 200 && type < 400) metrics.successfulRequests++;
  else if (type >= 400 && type < 500) metrics.clientErrors++;
  else if (type >= 500) metrics.serverErrors++;

  if (durationMs > 1000) metrics.slowRequests++;
}

function recordDatabaseError() { metrics.databaseErrors++; }
function recordStorageError() { metrics.storageErrors++; }
function recordAiError() { metrics.aiErrors++; }
function recordSecurityEvent() { metrics.securityEvents++; }

function getMetrics() {
  return {
    ...metrics,
    uptimeSeconds: Math.floor(process.uptime())
  };
}

module.exports = {
  sanitize,
  generateRequestId,
  info,
  warn,
  error,
  debug,
  recordMetric,
  recordDatabaseError,
  recordStorageError,
  recordAiError,
  recordSecurityEvent,
  getMetrics
};
