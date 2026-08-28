/**
 * NAGARSETU Centralized Error Handler Middleware
 * Global Express Error Handling Middleware.
 * Catches all unhandled sync/async errors across routes & body-parser syntax errors.
 * Logs full diagnostic trace server-side and sends generic client JSON responses.
 * Prevents information leakage by stripping stack traces, DB queries, and file paths.
 */

function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl || req.url;
  const user = req.user ? `[User ID: ${req.user.id}, Role: ${req.user.role}]` : '[Unauthenticated]';

  // Server-side logging of full error trace for debugging
  console.error(`[${timestamp}] ERROR ${method} ${url} ${user}:`, {
    message: err.message,
    stack: err.stack,
    ip: req.ip
  });

  // Handle Body-Parser JSON syntax parsing errors
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Bad Request: Malformed JSON payload'
    });
  }

  // Handle Multer upload errors
  if (err.name === 'MulterError') {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ error: 'File size exceeds maximum allowed limit' });
    }
    return res.status(400).json({ error: 'File upload error: Invalid request' });
  }

  // Handle validation or explicit bad request errors
  if (err.status === 400 || err.statusCode === 400 || err.name === 'ValidationError') {
    return res.status(400).json({
      error: err.message || 'Bad Request: Invalid parameters provided'
    });
  }

  // Handle Auth / Unauthorized / Forbidden errors
  if (err.status === 401 || err.statusCode === 401) {
    return res.status(401).json({ error: err.message || 'Authentication required' });
  }

  if (err.status === 403 || err.statusCode === 403) {
    return res.status(403).json({ error: err.message || 'Access forbidden' });
  }

  // Determine appropriate status code
  let statusCode = err.statusCode || err.status || 500;
  if (statusCode < 400 || statusCode > 599) {
    statusCode = 500;
  }

  // Server error (5xx): NEVER expose raw internal error details, stack traces, or file paths
  return res.status(statusCode).json({
    error: 'An internal server error occurred. Please try again later.'
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
