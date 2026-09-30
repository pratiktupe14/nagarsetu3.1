const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

describe('API URL Resolver Configuration Contract', () => {
  const apiConfigPath = path.join(__dirname, '../../frontend/src/config/apiConfig.ts');
  const envPath = path.join(__dirname, '../../frontend/.env');

  test('apiConfig.ts must not fall back to stale backend-zeta-two-60 URL', () => {
    const content = fs.readFileSync(apiConfigPath, 'utf8');
    assert.strictEqual(
      content.includes('backend-zeta-two-60.vercel.app'),
      false,
      'apiConfig.ts still contains hardcoded legacy URL backend-zeta-two-60.vercel.app'
    );
  });

  test('apiConfig.ts must return empty string for same-origin relative API routing when VITE_API_URL is unset', () => {
    const content = fs.readFileSync(apiConfigPath, 'utf8');
    assert.match(
      content,
      /return\s+'';/,
      'apiConfig.ts should return empty string for relative URL resolution'
    );
  });

  test('Environment configuration must not point to stale backend-zeta-two-60 URL', () => {
    const localEnv = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
    const viteApiUrl = process.env.VITE_API_URL || '';
    assert.strictEqual(
      viteApiUrl.includes('backend-zeta-two-60.vercel.app'),
      false,
      'process.env.VITE_API_URL points to backend-zeta-two-60.vercel.app'
    );
    assert.strictEqual(
      localEnv.includes('backend-zeta-two-60.vercel.app'),
      false,
      '.env still points to backend-zeta-two-60.vercel.app'
    );
  });
});
