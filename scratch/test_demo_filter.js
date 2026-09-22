const { initDatabase, query } = require('../backend/src/config/db');

function isDemoComplaint(c) {
  if (!c) return true;
  const num = (c.complaint_number || '').toLowerCase();
  const title = (c.title || '').toLowerCase();
  const addr = (c.location_address || '').toLowerCase();
  const desc = (c.description || '').toLowerCase();

  if (num.includes('000145') || num.includes('000128')) return true;
  if (title.includes('garbage overflow near public market') || title.includes('severe asphalt pothole on m.g. road')) return true;
  if (addr.includes('market yard road') || (addr.includes('m.g. road') && addr.includes('ward 12'))) return true;
  if (desc.includes('solid waste accumulation requiring municipal sanitation clearance') || desc.includes('deep road crater causing traffic congestion')) return true;

  return false;
}

async function run() {
  await initDatabase();
  const res = await query(`
    SELECT c.*, d.name as department_name, d.code as department_code
    FROM complaints c
    LEFT JOIN departments d ON (
      CAST(c.department_id AS TEXT) = CAST(d.id AS TEXT)
      OR UPPER(CAST(c.department_id AS TEXT)) = UPPER(d.code)
    )
    WHERE CAST(c.department_id AS TEXT) = '1' OR UPPER(CAST(c.department_id AS TEXT)) = 'PWD'
  `);

  console.log('Total PWD complaints in DB:', res.rows.length);
  const filtered = res.rows.filter(c => !isDemoComplaint(c));
  console.log('After isDemoComplaint filter:', filtered.length);

  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
