const http = require('http');

function checkPort(port, pathStr = '/') {
  return new Promise((resolve) => {
    const req = http.get({ hostname: 'localhost', port, path: pathStr }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve({ status: res.statusCode, body: data });
      });
    });
    req.on('error', (err) => {
      resolve({ status: null, error: err.message });
    });
    req.end();
  });
}

async function run() {
  console.log('Checking Backend API (Port 5000)...');
  const backendRes = await checkPort(5000, '/api/ai/health');
  console.log('Backend Port 5000 status:', backendRes.status, backendRes.body || backendRes.error);

  console.log('\nChecking Frontend Server (Port 3000)...');
  const frontendRes = await checkPort(3000, '/');
  console.log('Frontend Port 3000 status:', frontendRes.status, frontendRes.error ? frontendRes.error : 'Frontend Server active');
}

run();
