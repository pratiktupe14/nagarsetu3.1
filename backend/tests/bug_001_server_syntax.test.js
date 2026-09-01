const { test } = require('node:test');
const assert = require('node:assert');
const { execSync } = require('node:child_process');
const path = require('node:path');

test('BUG-001: server.js syntax must be valid and free of SyntaxError', () => {
  const serverPath = path.join(__dirname, '../src/server.js');
  let output = '';
  let passed = false;
  try {
    output = execSync(`node -c "${serverPath}"`, { encoding: 'utf8' });
    passed = true;
  } catch (err) {
    passed = false;
    output = err.stderr ? err.stderr.toString() : err.message;
  }
  assert.strictEqual(passed, true, `server.js syntax check failed:\n${output}`);
});
