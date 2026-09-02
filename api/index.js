const app = require('../backend/src/app');
const { initDatabase } = require('../backend/src/config/db');

let initPromise = null;

module.exports = async (req, res) => {
  // Pass preflight OPTIONS directly to express app (handled by cors middleware)
  if (req.method === 'OPTIONS') {
    return app(req, res);
  }

  try {
    if (!initPromise) {
      initPromise = initDatabase();
    }
    await initPromise;
  } catch (err) {
    initPromise = null;
    console.error('[SERVERLESS DATABASE FATAL ERROR]:', err.message);
    const origin = req.headers.origin || '*';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Cache-Control, Pragma, Expires');
    return res.status(500).json({
      error: 'Database Connection Error',
      message: err.message
    });
  }
  return app(req, res);
};
