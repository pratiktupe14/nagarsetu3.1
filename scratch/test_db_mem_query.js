process.env.VERCEL = '1';
delete process.env.DATABASE_URL;
delete process.env.POSTGRES_URL;

const { query } = require('../backend/src/config/db');

async function testMemQueryUpdate() {
  console.log('Testing local DB query UPDATE handling under VERCEL memStore mode...');
  try {
    const insertRes = await query(
      `INSERT INTO complaints (complaint_number, title, department_id, status, photo_before_url) VALUES ($1, $2, $3, $4, $5)`,
      ['NS-TEST-123', 'Test Title', 1, 'Submitted', 'https://example.com/photo.jpg']
    );
    console.log('Insert Result:', insertRes);

    const selResBefore = await query(`SELECT * FROM complaints WHERE complaint_number = $1`, ['NS-TEST-123']);
    console.log('Select Before UPDATE:', selResBefore.rows);

    const compId = selResBefore.rows[0].id;

    const updateRes = await query(
      `UPDATE complaints
       SET assigned_staff_id = $1,
           assigned_staff_name = $2,
           assigned_staff_email = $3,
           assigned_by = $4,
           assigned_by_name = $5,
           status = $6,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 OR CAST(complaint_number AS TEXT) = CAST($7 AS TEXT)`,
      ['1', 'Ramesh Kumar', 'ramesh@nagarsetu.gov.in', 2, 'Rahul Kumar', 'Staff Assigned', compId]
    );
    console.log('Update Result:', updateRes);

    const selResAfter = await query(`SELECT * FROM complaints WHERE id = $1`, [compId]);
    console.log('Select After UPDATE:', selResAfter.rows);

  } catch (e) {
    console.error('Test error:', e);
  }
}

testMemQueryUpdate();
