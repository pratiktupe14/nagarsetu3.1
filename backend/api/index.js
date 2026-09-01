const app = require('../src/app');
const { initDatabase } = require('../src/config/db');

try {
  if (typeof initDatabase === 'function') {
    initDatabase().catch(err => console.warn('[SERVERLESS INIT NOTE]', err.message));
  }
} catch (e) {
  console.warn('[SERVERLESS INIT CATCH]', e.message);
}

module.exports = app;
