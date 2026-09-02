const http = require('http');
const path = require('path');
const jwt = require(path.join(__dirname, '../backend/node_modules/jsonwebtoken'));
const app = require('../backend/src/app');

const server = app.listen(0, async () => {
  const port = server.address().port;
  console.log(`BUG-003 test server running on port ${port}`);

  // Perform login for admin account to get token
  const postData = JSON.stringify({ mobileOrEmail: '9876543213', password: 'NagarSetu@Admin2026!' });
  const req = http.request(`http://localhost:${port}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log(`LOGIN STATUS: ${res.statusCode}`);
      const body = JSON.parse(data);
      if (res.statusCode === 200 && body.token) {
        const decoded = jwt.decode(body.token);
        console.log(`DECODED TOKEN ROLE: ${decoded.role}`);
        server.close();
        if (decoded.role === 'admin' || decoded.role === 'city_admin') {
          console.log('BUG-003 PASSED: Backend correctly issues role-based JWT token');
          process.exit(0);
        } else {
          console.log('BUG-003 FAILED: Token role mismatch');
          process.exit(1);
        }
      } else {
        console.log('BUG-003 FAILED: Unable to authenticate admin');
        server.close();
        process.exit(1);
      }
    });
  });

  req.write(postData);
  req.end();
});
