const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
require('dotenv').config({ path: path.join(__dirname, '../.env') });
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { initDatabase, query } = require('./config/db');
const app = require('./app');

const PORT = process.env.PORT || 5000;

const seedDefaultUsers = require('./scripts/seedDefaultUsers');
const seed7DemoDepartmentHeads = require('./scripts/seedDemoDepartmentHeads');
const seedServiceStaff = require('./scripts/seedServiceStaff');

// Start Server after DB Init
initDatabase()
  .then(async () => {
    await seedDefaultUsers(query);
    await seed7DemoDepartmentHeads();
    await seedServiceStaff();
    app.listen(PORT, () => {
      console.log(`=======================================================`);
      console.log(`  NAGARSETU Backend API running on http://localhost:${PORT}`);
      console.log(`=======================================================`);
    });
  })
  .catch((err) => {
    console.error('Failed to initialize database:', err);
  });

