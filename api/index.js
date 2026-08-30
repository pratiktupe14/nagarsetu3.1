const path = require('path');

let app;
try {
  app = require('../backend/src/app');
} catch (e1) {
  try {
    app = require('./backend/src/app');
  } catch (e2) {
    app = require('./src/app');
  }
}

let initDatabase;
try {
  initDatabase = require('../backend/src/config/db').initDatabase;
} catch (e1) {
  try {
    initDatabase = require('./backend/src/config/db').initDatabase;
  } catch (e2) {
    initDatabase = require('./src/config/db').initDatabase;
  }
}

if (initDatabase) {
  initDatabase().catch(err => console.warn('[SERVERLESS INIT NOTE]', err.message));
}

module.exports = app;
