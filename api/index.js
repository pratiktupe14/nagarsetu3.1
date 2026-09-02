const app = require('../backend/src/app');
const { initDatabase } = require('../backend/src/config/db');

let initPromise = null;

module.exports = async (req, res) => {
  try {
    if (!initPromise) {
      initPromise = initDatabase();
    }
    await initPromise;
  } catch (err) {
    initPromise = null;
    console.error('[SERVERLESS DATABASE FATAL ERROR]:', err.message);
    return res.status(500).json({
      error: 'Database Connection Error',
      message: err.message
    });
  }
  return app(req, res);
};
