const { query, initDatabase } = require('../backend/src/config/db');

async function check() {
  try {
    await initDatabase();
    const compRes = await query("SELECT id, complaint_number, department_id FROM complaints LIMIT 10");
    console.log(compRes.rows);
  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

check();
