const http = require('http');
const path = require('path');
const jwt = require(path.join(__dirname, '../backend/node_modules/jsonwebtoken'));
const app = require('../backend/src/app');
const { JWT_SECRET } = require('../backend/src/middleware/auth');

const token = jwt.sign({ id: 1, role: 'city_admin', email: 'admin@nagarsetu.gov.in' }, JWT_SECRET, { expiresIn: '1h' });

const server = app.listen(0, async () => {
  const port = server.address().port;
  console.log(`Authenticated test server running on port ${port}`);

  const req = http.request(`http://localhost:${port}/api/complaints`, {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log(`STATUS CODE WITH VALID TOKEN: ${res.statusCode}`);
      server.close();
      if (res.statusCode === 200) {
        console.log('AUTHENTICATED TEST PASSED: Valid admin token successfully returns 200 OK');
        process.exit(0);
      } else {
        console.log(`AUTHENTICATED TEST FAILED: Returned ${res.statusCode} instead of 200`);
        process.exit(1);
      }
    });
  });

  req.on('error', err => {
    console.error('Request error:', err);
    server.close();
    process.exit(1);
  });

  req.end();
});
