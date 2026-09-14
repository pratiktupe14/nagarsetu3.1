const path = require('path');
const allowedOrigins = [
  'https://nagarsetu3-1.vercel.app',
  'https://nagarsetu-backend-api.vercel.app',
  'http://localhost:3000',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://localhost:5000'
];

function testCorsOrigin(origin, nodeEnv = 'production') {
  let isAllowed = false;
  let corsError = null;

  const originFn = function (reqOrigin, callback) {
    if (!reqOrigin || allowedOrigins.includes(reqOrigin) || (reqOrigin.endsWith('.vercel.app') && reqOrigin.includes('nagarsetu'))) {
      callback(null, true);
    } else if (nodeEnv !== 'production' && (reqOrigin.startsWith('http://localhost') || reqOrigin.startsWith('http://127.0.0.1'))) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'), false);
    }
  };

  originFn(origin, (err, allow) => {
    if (err || !allow) {
      corsError = err ? err.message : 'Disallowed';
      isAllowed = false;
    } else {
      isAllowed = true;
    }
  });

  return { origin, isAllowed, corsError };
}

console.log('=== CORS SECURITY TEST ===');
const originsToTest = [
  { origin: 'https://nagarsetu3-1.vercel.app', expected: true },
  { origin: 'http://localhost:5173', expected: true, env: 'development' },
  { origin: 'https://malicious-example.com', expected: false },
  { origin: 'https://random-unauthorized-app.vercel.app', expected: false }
];

let allPassed = true;
originsToTest.forEach(t => {
  const res = testCorsOrigin(t.origin, t.env || 'production');
  const pass = res.isAllowed === t.expected;
  console.log(`Origin: ${t.origin.padEnd(45)} | Allowed: ${String(res.isAllowed).padEnd(5)} | Expected: ${String(t.expected).padEnd(5)} | Result: ${pass ? 'PASS' : 'FAIL'}`);
  if (!pass) allPassed = false;
});

if (allPassed) {
  console.log('\nCORS SECURITY VERIFICATION: ALL PASSED!');
  process.exit(0);
} else {
  console.error('\nCORS SECURITY VERIFICATION: FAILED!');
  process.exit(1);
}
