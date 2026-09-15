const { initDatabase, query } = require('../backend/src/config/db');
const bcrypt = require('../backend/node_modules/bcryptjs');

async function testAll() {
  await initDatabase();
  const res = await query("SELECT id, name, email, role, password_hash FROM users WHERE role = 'department_head'");
  console.log('Found DH users:', res.rows.length);
  for (const u of res.rows) {
    const isNagarsetu = await bcrypt.compare('nagarsetu@123', u.password_hash);
    const isRahul = await bcrypt.compare('rahul@123', u.password_hash);
    const isPass123 = await bcrypt.compare('password123', u.password_hash);
    const firstName = u.name.split(' ')[0].toLowerCase();
    const isFirst = await bcrypt.compare(`${firstName}@123`, u.password_hash);
    console.log(`${u.email} (${u.name})`);
    console.log(`  -> nagarsetu@123: ${isNagarsetu} | ${firstName}@123: ${isFirst} | password123: ${isPass123}`);
    console.log(`  -> Hash: ${u.password_hash}\n`);
  }
}

testAll().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
