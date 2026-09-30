const app = require('../src/app');
const { initDatabase } = require('../src/config/db');

if (initDatabase) {
  initDatabase().catch(err => console.warn('[SERVERLESS INIT NOTE]', err.message));
}

module.exports = app;
