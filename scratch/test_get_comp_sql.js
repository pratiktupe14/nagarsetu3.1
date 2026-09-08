require('dotenv').config({ path: require('path').join(__dirname, '../backend/.env') });
const { query } = require('../backend/src/config/db');

async function test() {
  const DEPT_JOIN_SQL = `
    LEFT JOIN departments d ON (
      CAST(c.department_id AS TEXT) = CAST(d.id AS TEXT)
      OR UPPER(CAST(c.department_id AS TEXT)) = UPPER(d.code)
      OR (CAST(c.department_id AS TEXT) = '8ed9f760-1314-427c-a515-c2a54d6df6d8' AND d.code = 'PWD')
      OR (CAST(c.department_id AS TEXT) = '9cabc1f2-fd10-48dd-a5cb-01d05197de22' AND d.code = 'SAN')
      OR (CAST(c.department_id AS TEXT) = 'ead370cc-459c-44f0-899f-8a97f0928beb' AND d.code = 'WTR')
      OR (CAST(c.department_id AS TEXT) = 'ee73cb82-cc47-4333-b7d6-4491353c1354' AND d.code = 'DRN')
      OR (CAST(c.department_id AS TEXT) = '31842723-23ac-490b-912b-9f6d9afbdfb3' AND d.code = 'ELE')
      OR (CAST(c.department_id AS TEXT) = 'ae5e4d0c-996f-4d81-9528-d642664c93ae' AND d.code = 'TRF')
    )
  `;
  const sql = `
    SELECT c.*, d.name as department_name, d.code as department_code,
           COALESCE(p.full_name, u.name) as citizen_name,
           COALESCE(p.mobile, u.mobile) as citizen_mobile,
           f.rating, f.comment as feedback_comment, f.created_at as feedback_created_at
       FROM complaints c
    ${DEPT_JOIN_SQL}
    LEFT JOIN profiles p ON CAST(c.citizen_id AS TEXT) = CAST(p.id AS TEXT)
    LEFT JOIN users u ON CAST(c.citizen_id AS TEXT) = CAST(u.id AS TEXT) OR (p.mobile IS NOT NULL AND u.mobile = p.mobile)
    LEFT JOIN feedback f ON CAST(f.complaint_id AS TEXT) = CAST(c.id AS TEXT)
    WHERE CAST(c.id AS TEXT) = ? OR c.complaint_number = ?
  `;
  try {
    const res = await query(sql, ['f6c062f8-b1f9-49d2-9ebf-c07be1f25165', 'f6c062f8-b1f9-49d2-9ebf-c07be1f25165']);
    console.log('Query 1 success! rows:', res.rows.length);
  } catch (err) {
    console.error('SQL Error 1:', err);
  }

  // Also test assignSql
  try {
    const assignSql = `
      SELECT a.*, s.name as staff_name, s.mobile as staff_mobile, o.name as officer_name
      FROM assignments a
      LEFT JOIN users s ON a.staff_id = s.id
      LEFT JOIN users o ON a.assigned_by = o.id
      WHERE a.complaint_id = ?
      ORDER BY a.assigned_at DESC LIMIT 1
    `;
    const res2 = await query(assignSql, ['f6c062f8-b1f9-49d2-9ebf-c07be1f25165']);
    console.log('Assign Query success! rows:', res2.rows.length);
  } catch (err2) {
    console.error('Assign SQL Error 2:', err2);
  }
}

test().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
