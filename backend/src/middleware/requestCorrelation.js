/**
 * NAGARSETU 3.1 — REQUEST CORRELATION & TIMING MIDDLEWARE
 * 
 * Attaches a unique X-Request-ID to incoming HTTP requests, tracks duration,
 * and logs structured request completion / slow request events.
 */

const logger = require('../utils/logger');

const SLOW_REQUEST_THRESHOLD_MS = parseInt(process.env.SLOW_REQUEST_THRESHOLD_MS, 10) || 1000;

function requestCorrelation(req, res, next) {
  const incomingId = req.headers['x-request-id'];
  const requestId = incomingId && incomingId.length < 128 ? incomingId : logger.generateRequestId();

  req.requestId = requestId;
  req.id = requestId;
  res.setHeader('X-Request-ID', requestId);

  const startTime = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const statusCode = res.statusCode;
    const isSlow = durationMs > SLOW_REQUEST_THRESHOLD_MS;

    logger.recordMetric(statusCode, durationMs);

    const logData = {
      requestId,
      method: req.method,
      route: req.originalUrl || req.url,
      status: statusCode,
      durationMs,
      user: req.user ? { id: req.user.id, role: req.user.role } : undefined
    };

    if (statusCode >= 500) {
      logger.error('HTTP_REQUEST_SERVER_ERROR', logData);
    } else if (isSlow) {
      logger.warn('HTTP_REQUEST_SLOW', { ...logData, thresholdMs: SLOW_REQUEST_THRESHOLD_MS });
    } else {
      logger.debug('HTTP_REQUEST_COMPLETE', logData);
    }
  });

  next();
}

module.exports = requestCorrelation;
