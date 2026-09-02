const apiHandler = require('../api/index');
const http = require('http');

const server = http.createServer(async (req, res) => {
  await apiHandler(req, res);
});

server.listen(0, async () => {
  const port = server.address().port;
  console.log('Testing api/index handler on port', port);

  function request(method, path, headers = {}) {
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
      req.end();
    });
  }

  console.log('\n--- 1. Testing OPTIONS preflight through api/index.js ---');
  const optRes = await request('OPTIONS', '/api/auth/login', {
    'Origin': 'https://nagarsetu3-1.vercel.app',
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'content-type'
  });
  console.log('OPTIONS status:', optRes.status);
  console.log('Access-Control-Allow-Origin:', optRes.headers['access-control-allow-origin']);

  server.close();
  process.exit(optRes.status === 204 && optRes.headers['access-control-allow-origin'] ? 0 : 1);
});
