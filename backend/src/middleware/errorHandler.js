/**
 * NAGARSETU Centralized Error Handler Middleware
 * Global Express Error Handling Middleware.
 * Catches all unhandled sync/async errors across routes & body-parser syntax errors.
 * Logs full diagnostic trace server-side with structured request ID and error classification.
 * Prevents information leakage by stripping stack traces, DB queries, and file paths in production.
 */

const logger = require('../utils/logger');

function classifyError(err) {
  if (err.name === 'ValidationError' || err.status === 400 || err.statusCode === 400) return 'VALIDATION_ERROR';
  if (err.status === 401 || err.statusCode === 401) return 'AUTH_ERROR';
  if (err.status === 403 || err.statusCode === 403) return 'AUTHORIZATION_ERROR';
  if (err.errorCode && err.errorCode.startsWith('AI_')) return 'AI_ERROR';
  if (err.errorCode && err.errorCode.startsWith('STORAGE_')) return 'STORAGE_ERROR';
  if (err.message && (err.message.includes('Database') || err.message.includes('PostgreSQL') || err.message.includes('SQLite'))) return 'DATABASE_ERROR';
  return 'INTERNAL_ERROR';
}

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const requestId = req.requestId || req.id || logger.generateRequestId();
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl || req.url;
  const userStr = req.user ? `[User ID: ${req.user.id}, Role: ${req.user.role}]` : '[Unauthenticated]';
  const classification = classifyError(err);

  // Server-side structured logging of full error trace for debugging
  logger.error('APPLICATION_ERROR', {
    requestId,
    classification,
    message: err.message,
    stack: err.stack,
    method,
    url,
    user: req.user ? { id: req.user.id, role: req.user.role } : undefined,
    ip: req.ip
  });

  // Handle Body-Parser JSON syntax parsing errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Bad Request: Malformed JSON payload',
      requestId
    });
  }

  // Handle Multer upload errors
  if (err.name === 'MulterError') {
    logger.recordStorageError();
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds maximum allowed limit', requestId });
    }
    return res.status(400).json({ error: 'File upload error: Invalid request', requestId });
  }

  // Handle validation or explicit bad request errors
  if (err.status === 400 || err.statusCode === 400 || err.name === 'ValidationError') {
    return res.status(400).json({
      error: err.message || 'Bad Request: Invalid parameters provided',
      requestId
    });
  }

  // Handle Auth / Unauthorized / Forbidden errors
  if (err.status === 401 || err.statusCode === 401) {
    logger.recordSecurityEvent();
    return res.status(401).json({ error: err.message || 'Authentication required', requestId });
  }

  if (err.status === 403 || err.statusCode === 403) {
    logger.recordSecurityEvent();
    return res.status(403).json({ error: err.message || 'Access forbidden', requestId });
  }

  // Determine appropriate status code
  let statusCode = err.statusCode || err.status || 500;
  if (statusCode < 400 || statusCode > 599) {
    statusCode = 500;
  }

  // Server error (5xx): NEVER expose raw internal error details, stack traces, or file paths
  return res.status(statusCode).json({
    error: 'An internal server error occurred. Please try again later.',
    requestId
  });
}

/**
 * Async Handler Wrapper
 * Wraps async Express controllers to catch unhandled promise rejections and pass to errorHandler
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = errorHandler;
module.exports.errorHandler = errorHandler;
module.exports.asyncHandler = asyncHandler;
