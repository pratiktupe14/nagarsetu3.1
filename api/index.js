module.exports = (req, res) => {
  try {
    const app = require('../backend/src/app');
    return app(req, res);
  } catch (err) {
    console.error('[DIAGNOSTIC SERVERLESS ERROR]', err);
    return res.status(200).json({
      diagnosticError: true,
      message: err.message,
      stack: err.stack
    });
  }
};

