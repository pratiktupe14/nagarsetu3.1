const https = require('https');

function testEndpoint(method, path, headers = {}, body = null) {
  return new Promise((resolve) => {
    const opts = {
      hostname: 'nagarsetu-backend-api.vercel.app',
      port: 443,
      path,
      method,
      headers: {
        ...headers
      }
    };
    const req = https.request(opts, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, data });
      });
    });
    req.on('error', (err) => resolve({ error: err.message }));
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  console.log('1. Testing OPTIONS preflight request to /api/auth/login from localhost:5173...');
  const preflight = await testEndpoint('OPTIONS', '/api/auth/login', {
    'Origin': 'http://localhost:5173',
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'content-type'
  });
  console.log('OPTIONS status:', preflight.status);
  console.log('OPTIONS headers:', preflight.headers);
  console.log('OPTIONS data:', preflight.data);

  console.log('\n2. Testing OPTIONS preflight from Vercel frontend...');
  const preflightVercel = await testEndpoint('OPTIONS', '/api/auth/login', {
    'Origin': 'https://nagarsetu3-1.vercel.app',
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'content-type'
  });
  console.log('Vercel OPTIONS status:', preflightVercel.status);
  console.log('Vercel OPTIONS headers:', preflightVercel.headers);

  console.log('\n3. Testing POST request to /api/auth/login...');
  const postRes = await testEndpoint('POST', '/api/auth/login', {
    'Content-Type': 'application/json',
    'Origin': 'http://localhost:5173'
  }, JSON.stringify({ mobileOrEmail: '8788562103', password: 'password123' }));
  console.log('POST status:', postRes.status);
  console.log('POST headers:', postRes.headers);
  console.log('POST data:', postRes.data);
}

main();
