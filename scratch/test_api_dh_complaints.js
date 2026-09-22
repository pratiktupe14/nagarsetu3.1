const http = require('http');
const app = require('../backend/src/app');
const { initDatabase, query } = require('../backend/src/config/db');

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer(app);
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, port: server.address().port });
    });
  });
}

function request(port, method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: '127.0.0.1',
      port,
      path,
      method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, text: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function run() {
  await initDatabase();
  const { server, port } = await startServer();

  try {
    const loginRes = await request(port, 'POST', '/api/auth/login', {}, {
      mobileOrEmail: 'rahul.kumar@nagarsetu.gov.in',
      password: 'rahul@pass2026' // password was changed in previous test, or rahul@123 if reset
    });

    console.log('Login Status:', loginRes.status);
    console.log('Full user object from login:', loginRes.data?.user);

    const token = loginRes.data?.token;

    const compRes = await request(port, 'GET', '/api/department/complaints', {
      Authorization: `Bearer ${token}`
    });

    console.log('Backend /api/department/complaints response summary:');
    console.log('HTTP Status:', compRes.status);
    console.log('department_id:', compRes.data?.department_id);
    console.log('department_name:', compRes.data?.department_name);
    console.log('complaints count:', compRes.data?.complaints?.length);
  } finally {
    server.close();
    process.exit(0);
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
