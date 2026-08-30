const app = require('../backend/src/app');
const { initDatabase } = require('../backend/src/config/db');

if (initDatabase) {
  initDatabase().catch(err => console.warn('[SERVERLESS INIT NOTE]', err.message));
}

module.exports = app;
