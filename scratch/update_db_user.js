const sqlite3 = require('../backend/node_modules/sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../backend/nagarsetu.sqlite');
const db = new sqlite3.Database(dbPath);

console.log('Updating SQLite database at:', dbPath);
db.run("UPDATE users SET name = 'Pratik Dilip Tupe' WHERE role = 'citizen' OR name = 'Demo Citizen' OR name = 'Citizen User' OR mobile = '8788562103'", function(err) {
  if (err) {
    console.error('Error updating users:', err);
  } else {
    console.log(`Updated ${this.changes} user record(s) to 'Pratik Dilip Tupe'.`);
  }
  db.close();
});
