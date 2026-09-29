let app;
let dbInitPromise = null;

module.exports = async (req, res) => {
  try {
    if (!app) {
      app = require('../backend/src/app');
    }

    if (!dbInitPromise) {
      try {
        const { initDatabase } = require('../backend/src/config/db');
        dbInitPromise = initDatabase().catch(err => {
          console.warn('[SERVERLESS DB INIT WARN]', err.message);
        });
      } catch (dbErr) {
        console.warn('[SERVERLESS DB LOAD WARN]', dbErr.message);
        dbInitPromise = Promise.resolve();
      }
    }

    await dbInitPromise;
    return app(req, res);
  } catch (err) {
    console.error('[SERVERLESS FATAL ERROR]', err);
    return res.status(500).json({
      success: false,
      error: 'Serverless Function Error: ' + err.message
    });
  }
};
