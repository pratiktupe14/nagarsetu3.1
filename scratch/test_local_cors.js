const app = require('../backend/src/app');
const http = require('http');

const server = http.createServer(app);
server.listen(0, async () => {
  const port = server.address().port;
  console.log('Testing app on port', port);

  function request(method, path, headers = {}, body = null) {
    return new Promise((resolve) => {
      const req = http.request({
        port,
        path,
        method,
        headers
      }, (res) => {
        let data = '';
        res.on('data', c => data += c);
        res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, data }));
      });
      req.on('error', err => resolve({ error: err.message }));
      if (body) req.write(body);
      req.end();
    });
  }

  console.log('\n--- 1. Testing OPTIONS preflight request ---');
  const optRes = await request('OPTIONS', '/api/auth/login', {
    'Origin': 'https://nagarsetu3-1.vercel.app',
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'content-type'
  });
  console.log('OPTIONS status:', optRes.status);
  console.log('Access-Control-Allow-Origin:', optRes.headers['access-control-allow-origin']);
  console.log('Access-Control-Allow-Methods:', optRes.headers['access-control-allow-methods']);

  console.log('\n--- 2. Testing POST login request ---');
  const postRes = await request('POST', '/api/auth/login', {
    'Content-Type': 'application/json',
    'Origin': 'https://nagarsetu3-1.vercel.app'
  }, JSON.stringify({ mobileOrEmail: '8788562103', password: 'password123' }));
  console.log('POST status:', postRes.status);
  console.log('Access-Control-Allow-Origin:', postRes.headers['access-control-allow-origin']);
  console.log('POST data:', postRes.data);

  server.close();
  process.exit(optRes.status === 204 && optRes.headers['access-control-allow-origin'] ? 0 : 1);
});
