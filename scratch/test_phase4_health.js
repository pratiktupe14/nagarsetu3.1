/**
 * NAGARSETU 3.1 — PHASE 4 STANDALONE PRODUCTION HEALTH VERIFICATION SCRIPT
 * 
 * Executes read-only health and readiness probe checks against local or production host.
 */

const http = require('http');
const https = require('https');

let app = null;
let server = null;
const PORT = process.env.PORT || 5000;
const TARGET_URL = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : (process.env.API_URL || `http://127.0.0.1:${PORT}`);

function fetchEndpoint(urlStr) {
  return new Promise((resolve, reject) => {
    const isHttps = urlStr.startsWith('https');
    const client = isHttps ? https : http;

    const req = client.get(urlStr, { timeout: 10000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, headers: res.headers, raw: data });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Connection timeout (10s)'));
    });
  });
}

async function verifyHealth() {
  console.log('=======================================================');
  console.log('  NAGARSETU 3.1 PRODUCTION HEALTH & READINESS AUDIT  ');
  console.log(`  Target URL: ${TARGET_URL}`);
  console.log('=======================================================\n');

  try {
    // Attempt health check against target URL; spin up test server if offline
    let health;
    try {
      health = await fetchEndpoint(`${TARGET_URL}/api/health`);
    } catch (e) {
      console.log(`[NOTE] Local server not running on ${TARGET_URL}. Initializing local instance for health audit...`);
      app = require('../backend/src/app');
      server = app.listen(PORT);
      await new Promise(r => setTimeout(r, 500));
      health = await fetchEndpoint(`${TARGET_URL}/api/health`);
    }

    console.log('1. Auditing Liveness Probe (GET /api/health)...');
    console.log(`   - HTTP Status: ${health.status}`);
    console.log(`   - Status Payload: ${health.body?.status || 'N/A'}`);
    console.log(`   - Database Connection: ${health.body?.database || 'N/A'}`);
    console.log(`   - Request ID: ${health.body?.requestId || 'N/A'}`);

    console.log('\n2. Auditing Readiness Probe (GET /api/health/ready)...');
    const ready = await fetchEndpoint(`${TARGET_URL}/api/health/ready`);
    console.log(`   - HTTP Status: ${ready.status}`);
    console.log(`   - Readiness State: ${ready.body?.status || 'N/A'}`);
    console.log(`   - Request ID: ${ready.body?.requestId || 'N/A'}`);

    if (server) server.close();

    if (health.status === 200 && ready.status === 200) {
      console.log('\n=======================================================');
      console.log('  PRODUCTION HEALTH VERIFICATION COMPLETE: ALL OK  ');
      console.log('=======================================================');
      process.exit(0);
    } else {
      console.error('\nPRODUCTION HEALTH AUDIT FAILED: Non-200 response received');
      process.exit(1);
    }
  } catch (err) {
    if (server) server.close();
    console.error('\nPRODUCTION HEALTH AUDIT FAILED:', err.message);
    process.exit(1);
  }
}

verifyHealth();
