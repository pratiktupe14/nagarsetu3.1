const app = require('../src/app');
const { initDatabase } = require('../src/config/db');

// Trigger background database initialization without blocking request handling
initDatabase().catch(err => console.warn('[SERVERLESS INIT NOTE]', err.message));

module.exports = app;
