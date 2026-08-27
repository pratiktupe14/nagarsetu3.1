/**
 * Global Express Error Handling Middleware.
 * Catches all unhandled sync/async errors across routes & body-parser syntax errors.
 * Logs full diagnostic trace server-side and sends generic client JSON responses.
 */
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  // Log full internal error stack server-side
  const timestamp = new Date().toISOString();
  console.error(`[SERVER ERROR ${timestamp}] ${req.method} ${req.originalUrl}:`, {
    message: err.message,
    stack: err.stack,
    ip: req.ip,
    user: req.user ? req.user.id : 'anonymous'
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
      error: 'Bad Request: Invalid parameters provided'
    });
  }

  // Handle Auth / Unauthorized / Forbidden errors
  if (err.status === 401 || err.statusCode === 401) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (err.status === 403 || err.statusCode === 403) {
    return res.status(403).json({ error: 'Access forbidden' });
  }

  // Default 500 Internal Server Error (Generic output - no stack trace or SQL leaks)
  const statusCode = err.status || err.statusCode || 500;
  return res.status(statusCode).json({
    error: 'An internal server error occurred. Please try again later.'
  });
}

module.exports = errorHandler;
