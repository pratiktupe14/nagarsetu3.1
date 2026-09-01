const app = require('../src/app');
const { initDatabase } = require('../src/config/db');

let dbInitPromise = null;

app.use(async (req, res, next) => {
  if (!dbInitPromise && typeof initDatabase === 'function') {
    dbInitPromise = initDatabase().catch(err => console.warn('[SERVERLESS DB INIT WARN]', err.message));
  }
  if (dbInitPromise) {
    await dbInitPromise;
  }
  next();
});

module.exports = app;
