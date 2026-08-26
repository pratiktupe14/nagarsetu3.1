const app = require('../backend/src/app');
const { initDatabase } = require('../backend/src/config/db');

let dbInitialized = false;

module.exports = async (req, res) => {
  if (!dbInitialized) {
    try {
      await initDatabase();
      dbInitialized = true;
    } catch (err) {
      console.warn('Vercel serverless DB init warning:', err.message);
    }
  }
  return app(req, res);
};
