/**
 * NAGARSETU Centralized Error Handler Middleware
 * Prevents information leakage by stripping stack traces, DB queries, and file paths
 * from user responses while preserving detailed server-side logs.
 */

function errorHandler(err, req, res, next) {
  const timestamp = new Date().toISOString();
  const method = req.method;
  const url = req.originalUrl || req.url;
  const user = req.user ? `[User ID: ${req.user.id}, Role: ${req.user.role}]` : '[Unauthenticated]';

  // Server-side logging of full error trace for debugging
  console.error(`[${timestamp}] ERROR ${method} ${url} ${user}`);
  console.error(`Message: ${err.message}`);
  if (err.stack) {
    console.error(`Stack Trace:\n${err.stack}`);
  }

  // Determine appropriate status code
  let statusCode = err.statusCode || err.status || 500;
  if (statusCode < 400 || statusCode > 599) {
    statusCode = 500;
  }

  // Handle client (4xx) vs server (5xx) response messages
  if (statusCode >= 400 && statusCode < 500) {
    // Client error: safe user message if provided and doesn't leak internal details
    const isInternalPath = err.message && (err.message.includes('/') || err.message.includes('\\') || err.message.includes('SQL'));
    const safeMessage = isInternalPath ? 'Invalid request data provided.' : err.message || 'Client request error.';
    return res.status(statusCode).json({
      error: safeMessage
    });
  }

  // Server error (5xx): NEVER expose raw internal error details, stack traces, or file paths
  return res.status(500).json({
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

module.exports = {
  errorHandler,
  asyncHandler
};
