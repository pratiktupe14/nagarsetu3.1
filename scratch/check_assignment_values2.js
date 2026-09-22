const { query, initDatabase } = require('../backend/src/config/db');

async function check() {
  try {
    await initDatabase();
    console.log("=== ACTOR: Rahul Kumar ===");
    const actorRes = await query("SELECT id, name, role, department_id, email FROM users WHERE name LIKE '%Rahul Kumar%'");
    console.log(actorRes.rows);
    if (actorRes.rows.length > 0) {
      const dhRes = await query("SELECT * FROM department_heads WHERE user_id = " + actorRes.rows[0].id);
      console.log("Department Head Record:", dhRes.rows);
    }

    console.log("\n=== COMPLAINT: NS-PWD-394206 ===");
    const compRes = await query("SELECT id, complaint_number, department_id FROM complaints WHERE complaint_number = 'NS-PWD-394206'");
    console.log(compRes.rows);

    console.log("\n=== STAFF: Amit Patil / PWD-STF-001 ===");
    const staffRes = await query("SELECT id, name, employee_id, department_id FROM field_staff WHERE employee_id = 'PWD-STF-001'");
    console.log(staffRes.rows);

    console.log("\n=== DEPARTMENTS TABLE ===");
    const deptRes = await query("SELECT * FROM departments");
    console.log(deptRes.rows);

  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

check();
