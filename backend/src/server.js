const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();
const { initDatabase, query } = require('./config/db');
const app = require('./app');
const logger = require('./utils/logger');

const PORT = process.env.PORT || 5000;

const seedDefaultUsers = require('./scripts/seedDefaultUsers');
const seed7DemoDepartmentHeads = require('./scripts/seedDemoDepartmentHeads');
const seedServiceStaff = require('./scripts/seedServiceStaff');

// Global Process Uncaught Exception Handler
process.on('uncaughtException', (err) => {
  logger.error('FATAL_UNCAUGHT_EXCEPTION', {
    message: err.message,
    stack: err.stack
  });
  // Keep process running in managed environment or exit cleanly if non-recoverable
  if (process.env.NODE_ENV === 'production') {
    console.error('[FATAL PROCESS UNCAUGHT EXCEPTION]:', err.message);
  }
});

// Global Process Unhandled Rejection Handler
process.on('unhandledRejection', (reason, promise) => {
  logger.error('FATAL_UNHANDLED_REJECTION', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined
  });
});

// Start Server after DB Init
initDatabase()
  .then(async () => {
    await seedDefaultUsers(query);
    await seed7DemoDepartmentHeads();
    await seedServiceStaff();
    app.listen(PORT, () => {
      logger.info('SERVER_STARTED', { port: PORT, url: `http://localhost:${PORT}` });
      console.log(`=======================================================`);
      console.log(`  NAGARSETU Backend API running on http://localhost:${PORT}`);
      console.log(`=======================================================`);
    });
  })
  .catch((err) => {
    logger.error('FATAL_DB_INIT_FAILED', { message: err.message, stack: err.stack });
    console.error('Failed to initialize database:', err);
  });
