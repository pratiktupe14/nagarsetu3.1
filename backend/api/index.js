const app = require('../src/app');
const { initDatabase } = require('../src/config/db');

let isInitialized = false;

module.exports = async (req, res) => {
  if (!isInitialized) {
    try {
      await initDatabase();
    } catch (e) {
      console.warn('[SERVERLESS INIT NOTE]', e.message);
    }
    isInitialized = true;
  }
  return app(req, res);
};
