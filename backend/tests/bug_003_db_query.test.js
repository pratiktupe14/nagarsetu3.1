const { test } = require('node:test');
const assert = require('node:assert');
const { query, initDatabase } = require('../src/config/db');

test('BUG-003: db query wrapper must handle parameterized queries and return valid rowCount/rows', async () => {
  await initDatabase();

  // Test 1: $1 parameter binding in SQLite
  const res1 = await query('SELECT id, name, role FROM users WHERE mobile = $1', ['9876543213']);
  assert.strictEqual(Array.isArray(res1.rows), true);
  assert.strictEqual(res1.rows.length > 0, true);
  assert.strictEqual(res1.rows[0].role, 'admin');

  // Test 2: ? parameter binding in SQLite
  const res2 = await query('SELECT id, name, role FROM users WHERE mobile = ?', ['9876543213']);
  assert.strictEqual(Array.isArray(res2.rows), true);
  assert.strictEqual(res2.rows.length > 0, true);
  assert.strictEqual(res2.rows[0].role, 'admin');

  // Test 3: Insert with $1 parameter binding returns rows with id and rowCount = 1
  const insRes = await query(
    `INSERT INTO notifications (user_id, complaint_id, channel, message) VALUES ($1, $2, $3, $4)`,
    [1, 1, 'in_app', 'Test notification message']
  );
  assert.strictEqual(insRes.rowCount, 1);
  assert.strictEqual(Array.isArray(insRes.rows), true);
  assert.strictEqual(typeof insRes.rows[0].id === 'number' || typeof insRes.rows[0].id === 'string', true);

  // Clean up
  await query('DELETE FROM notifications WHERE id = $1', [insRes.rows[0].id]);
});
