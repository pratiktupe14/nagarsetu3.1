const { query } = require('../backend/src/config/db');

async function checkComp() {
  const cRes = await query(`SELECT id, complaint_number, department_id FROM complaints WHERE id = 46`);
  console.log('Complaint 46:', cRes.rows);
}

checkComp();
