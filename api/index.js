let app;
let initError = null;

try {
  app = require('../backend/src/app');
  const { initDatabase } = require('../backend/src/config/db');
  if (initDatabase) {
    initDatabase().catch(err => console.warn('[SERVERLESS INIT NOTE]', err.message));
  }
} catch (err) {
  console.error('[SERVERLESS ROOT REQUIRE ERROR]', err);
  initError = err;
}

module.exports = (req, res) => {
  if (initError || !app) {
    console.error('[SERVERLESS INVOCATION ERROR]', initError);
    return res.status(500).json({
      error: 'Serverless initialization error',
      message: initError ? initError.message : 'App not initialized',
      stack: process.env.NODE_ENV !== 'production' ? (initError ? initError.stack : null) : undefined
    });
  }
  return app(req, res);
};

