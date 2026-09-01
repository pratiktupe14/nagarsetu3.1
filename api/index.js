const app = require('../backend/src/app');
const { initDatabase } = require('../backend/src/config/db');

let initPromise = null;

module.exports = async (req, res) => {
  if (!initPromise) {
    initPromise = initDatabase().catch(err => console.warn('[SERVERLESS INIT NOTE]', err.message));
  }
  await initPromise;
  return app(req, res);
};
