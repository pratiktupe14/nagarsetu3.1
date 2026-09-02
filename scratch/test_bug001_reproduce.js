const http = require('http');
const app = require('../backend/src/app');

const server = app.listen(0, async () => {
  const port = server.address().port;
  console.log(`Regression test server running on port ${port}`);

  http.get(`http://localhost:${port}/api/complaints`, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      console.log(`STATUS CODE: ${res.statusCode}`);
      server.close();
      if (res.statusCode === 401) {
        console.log('REGRESSION TEST PASSED: GET /api/complaints properly returned 401 Unauthorized!');
        process.exit(0);
      } else {
        console.log(`REGRESSION TEST FAILED: GET /api/complaints returned ${res.statusCode} instead of 401 Unauthorized`);
        process.exit(1);
      }
    });
  }).on('error', err => {
    console.error('Request error:', err);
    server.close();
    process.exit(1);
  });
});
