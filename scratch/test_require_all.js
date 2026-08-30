const path = require('path');

const filesToTest = [
  './src/app.js',
  './src/config/db.js',
  './src/config/supabaseStorage.js',
  './src/middleware/auth.js',
  './src/middleware/rateLimiter.js',
  './src/middleware/errorHandler.js',
  './src/middleware/upload.js',
  './src/routes/auth.routes.js',
  './src/routes/complaint.routes.js',
  './src/routes/officer.routes.js',
  './src/routes/staff.routes.js',
  './src/routes/admin.routes.js',
  './src/routes/department.routes.js',
  './src/routes/notification.routes.js',
  './src/routes/announcement.routes.js',
  './src/routes/maps.routes.js',
  './src/routes/ai.routes.js',
  './src/services/aiService.js',
  './src/services/locationService.js',
  './src/services/notificationService.js'
];

console.log('Testing requiring all backend files...');
for (const file of filesToTest) {
  try {
    require(path.resolve(__dirname, '../backend', file));
    console.log(`[PASS] ${file}`);
  } catch (err) {
    console.error(`[FAIL] ${file}: ${err.message}\n${err.stack}`);
  }
}
