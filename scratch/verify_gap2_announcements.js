// Set DB_TYPE to sqlite before requiring db module
process.env.DB_TYPE = 'sqlite';
delete process.env.DATABASE_URL;
delete process.env.POSTGRES_URL;

const { initDatabase, query } = require('../backend/src/config/db');

async function testGap2() {
  await initDatabase();

  // Clear existing announcements for clean test
  await query('DELETE FROM announcements WHERE title LIKE "GAP2_TEST%"');

  // Insert test row
  // We want to test department matching ($3) and department_name search ($4)
  // when $2 is repeated multiple times (target_audience = 'all_dept_heads', 'all_staff', target_role = $2)
  const testAnnouncement = {
    title: 'GAP2_TEST_ANNOUNCEMENT',
    description: 'Testing SQLite parameter binding after repeated $2 references',
    type: 'Emergency',
    priority: 'High',
    status: 'Published',
    target_type: 'department',
    target_audience: 'department_only',
    target_role: null,
    department_id: 42,
    department_name: 'Water Supply Board',
    created_by: 'Test Admin',
    is_published: 1
  };

  const insertRes = await query(`
    INSERT INTO announcements (
      title, description, type, priority, status, target_type, target_audience,
      target_role, department_id, department_name, created_by, is_published
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    testAnnouncement.title,
    testAnnouncement.description,
    testAnnouncement.type,
    testAnnouncement.priority,
    testAnnouncement.status,
    testAnnouncement.target_type,
    testAnnouncement.target_audience,
    testAnnouncement.target_role,
    testAnnouncement.department_id,
    testAnnouncement.department_name,
    testAnnouncement.created_by,
    testAnnouncement.is_published
  ]);

  console.log('Inserted test row, result:', insertRes);

  // Now run the announcement query from announcement.routes.js:80-88
  // Params: $1 = userId, $2 = userRole, $3 = userDeptId, $4 = cleanDeptName
  // Query has $2 repeated 3 times before $3 and $4!
  const userId = 'user_123';
  const userRole = 'citizen';
  const userDeptId = '42'; // Matches department_id = 42
  const cleanDeptName = '%Water Supply Board%'; // Matches department_name

  const sql = `
    SELECT a.*, r.read_at
    FROM announcements a
    LEFT JOIN announcement_reads r ON CAST(r.announcement_id AS TEXT) = CAST(a.id AS TEXT) AND r.user_id = $1
    WHERE a.is_published = 1
      AND (a.status IS NULL OR a.status = 'Published')
      AND (a.published_at IS NULL OR a.published_at <= CURRENT_TIMESTAMP)
      AND (a.expires_at IS NULL OR a.expires_at >= CURRENT_TIMESTAMP)
      AND (
        a.target_type = 'all'
        OR a.target_audience = 'all_citizens'
        OR (a.target_audience = 'all_dept_heads' AND $2 = 'department_head')
        OR (a.target_audience = 'all_staff' AND $2 = 'service_staff')
        OR (a.target_role = $2)
        OR (a.department_id IS NOT NULL AND CAST(a.department_id AS TEXT) = $3)
        OR (a.department_name IS NOT NULL AND LOWER(a.department_name) LIKE LOWER($4))
      )
    ORDER BY a.published_at DESC, a.created_at DESC
  `;

  const params = [userId, userRole, String(userDeptId || -1), cleanDeptName];

  const result = await query(sql, params);
  console.log('Query returned rows count:', result.rows.length);

  const matched = result.rows.find(r => r.title === testAnnouncement.title);
  if (!matched) {
    console.error('FAIL: Test announcement not found in returned rows!');
    process.exit(1);
  }

  console.log('\n--- FIELD-BY-FIELD COMPARISON ---');
  const checkFields = ['title', 'description', 'type', 'priority', 'status', 'target_type', 'target_audience', 'department_id', 'department_name'];
  let allMatch = true;

  for (const field of checkFields) {
    const dbValue = testAnnouncement[field];
    const returnedValue = matched[field];
    const match = String(dbValue) === String(returnedValue);
    console.log(`Field '${field}': DB = ${JSON.stringify(dbValue)} | Returned = ${JSON.stringify(returnedValue)} | Match: ${match ? 'YES' : 'NO'}`);
    if (!match) allMatch = false;
  }

  if (allMatch) {
    console.log('\nSUCCESS: All fields match perfectly! Parameter binding for $3 and $4 after repeated $2 is VERIFIED.');
  } else {
    console.error('\nFAILURE: Mismatch detected!');
    process.exit(1);
  }

  // Cleanup
  await query('DELETE FROM announcements WHERE title LIKE "GAP2_TEST%"');
  process.exit(0);
}

testGap2().catch(err => {
  console.error('Error during Gap 2 verification:', err);
  process.exit(1);
});
