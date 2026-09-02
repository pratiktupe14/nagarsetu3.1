const http = require('http');
const path = require('path');
const jwt = require(path.join(__dirname, '../backend/node_modules/jsonwebtoken'));
const app = require('../backend/src/app');
const { JWT_SECRET } = require('../backend/src/middleware/auth');

const adminToken = jwt.sign({ id: 1, role: 'city_admin', email: 'admin@nagarsetu.gov.in' }, JWT_SECRET, { expiresIn: '1h' });

const server = app.listen(0, async () => {
  const port = server.address().port;
  console.log(`BUG-002 DELETE test server running on port ${port}`);

  const reqDelete = http.request(`http://localhost:${port}/api/complaints/purge-all`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${adminToken}` }
  }, (res) => {
    console.log(`DELETE STATUS: ${res.statusCode}`);
    server.close();
    if (res.statusCode === 200) {
      console.log('BUG-002 DELETE PASSED: DELETE /api/complaints/purge-all returned 200 OK');
      process.exit(0);
    } else {
      console.log(`BUG-002 DELETE FAILED: Returned ${res.statusCode} instead of 200`);
      process.exit(1);
    }
  });

  reqDelete.on('error', err => {
    console.error('Request error:', err);
    server.close();
    process.exit(1);
  });

  reqDelete.end();
});
