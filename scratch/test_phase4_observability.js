/**
 * NAGARSETU 3.1 — PHASE 4 OBSERVABILITY & HEALTH TEST SUITE
 * 
 * Verifies request correlation ID propagation, health & readiness probes,
 * error classification, stack trace privacy, and sensitive data sanitization.
 */

const http = require('http');
const app = require('../backend/src/app');
const logger = require('../backend/src/utils/logger');

let server;
const PORT = 5999;
const BASE_URL = `http://127.0.0.1:${PORT}`;

function makeRequest(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = `${BASE_URL}${path}`;
    const reqOpts = {
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: 5000
    };

    const req = http.request(url, reqOpts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(data); } catch (e) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          data: json || data
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });

    if (options.body) {
      req.write(typeof options.body === 'object' ? JSON.stringify(options.body) : options.body);
    }
    req.end();
  });
}

async function runObservabilityTests() {
  console.log('=======================================================');
  console.log('  NAGARSETU 3.1 PHASE 4 OBSERVABILITY & HEALTH SUITE  ');
  console.log('=======================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  ✓ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ✗ FAIL: ${message}`);
      failed++;
    }
  }

  try {
    server = app.listen(PORT);
    await new Promise(r => setTimeout(r, 500));

    // Test 1: GET /api/health Liveness Probe
    const healthRes = await makeRequest('/api/health');
    assert(healthRes.status === 200, 'GET /api/health returns HTTP 200 OK');
    assert(healthRes.data && healthRes.data.status === 'ok', 'GET /api/health contains status: ok');
    assert(healthRes.data && healthRes.data.database === 'connected', 'GET /api/health confirms database: connected');
    assert(Boolean(healthRes.data && healthRes.data.requestId), 'GET /api/health response includes requestId');

    // Test 2: GET /api/health/ready Readiness Probe
    const readyRes = await makeRequest('/api/health/ready');
    assert(readyRes.status === 200, 'GET /api/health/ready returns HTTP 200 OK');
    assert(readyRes.data && readyRes.data.status === 'ready', 'GET /api/health/ready contains status: ready');

    // Test 3: Request Correlation ID Propagation
    const testId = 'req_custom_test_correlation_12345';
    const corrRes = await makeRequest('/api/health', { headers: { 'x-request-id': testId } });
    assert(corrRes.headers['x-request-id'] === testId, 'Custom X-Request-ID is preserved and returned in headers');
    assert(corrRes.data && corrRes.data.requestId === testId, 'Custom X-Request-ID is attached to JSON response body');

    // Test 4: Generated Request ID when Header Absent
    const genRes = await makeRequest('/');
    assert(Boolean(genRes.headers['x-request-id']), 'X-Request-ID is automatically generated when header is missing');

    // Test 5: Stack Trace Privacy on Client Errors
    const badReqRes = await makeRequest('/api/nonexistent-route-xyz-404');
    assert(badReqRes.status === 404, 'Non-existent route returns HTTP 404');
    assert(!JSON.stringify(badReqRes.data).includes('at Module._compile'), 'Client response NEVER leaks Node.js stack traces');

    // Test 6: 401 Unauthorized Error Classification
    const unauthRes = await makeRequest('/api/officer/complaints');
    assert(unauthRes.status === 401, 'Protected officer endpoint returns HTTP 401 Unauthorized');
    assert(Boolean(unauthRes.data && unauthRes.data.requestId), 'HTTP 401 response contains requestId for troubleshooting');

    // Test 7: Sensitive Key Redaction in Logger
    const sensitivePayload = {
      user: 'john_doe',
      password: 'secret_password_123',
      token: 'jwt.token.here',
      database_url: 'postgres://user:secret@host/db',
      gemini_api_key: 'AIzaSySecretKey'
    };
    const cleanPayload = logger.sanitize(sensitivePayload);
    assert(cleanPayload.password === '[REDACTED]', 'Logger redacts "password" field');
    assert(cleanPayload.token === '[REDACTED]', 'Logger redacts "token" field');
    assert(cleanPayload.database_url === '[REDACTED]', 'Logger redacts "database_url" field');
    assert(cleanPayload.gemini_api_key === '[REDACTED]', 'Logger redacts "gemini_api_key" field');

    // Test 8: Runtime Observability Metrics Tracking
    const metrics = logger.getMetrics();
    assert(metrics.totalRequests > 0, 'Runtime metrics tracker records request count');
    assert(typeof metrics.uptimeSeconds === 'number', 'Runtime metrics tracker records uptime');

    console.log('\n=======================================================');
    console.log(`  OBSERVABILITY SUITE COMPLETE: ${passed} PASSED, ${failed} FAILED  `);
    console.log('=======================================================');

    server.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    if (server) server.close();
    console.error('OBSERVABILITY SUITE FAILED:', err);
    process.exit(1);
  }
}

runObservabilityTests();
