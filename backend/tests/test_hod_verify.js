const jwt = require('jsonwebtoken');
const http = require('http');
const { query } = require('../src/config/db');

const secret = 'nagarsetu_secret_key_2026_super_secure';

const pwdHodToken = jwt.sign({
  id: 1,
  name: 'Rahul Kumar',
  email: 'rahul.kumar@nagarsetu.gov.in',
  role: 'department_head',
  department_id: 1,
  department_code: 'PWD'
}, secret, { expiresIn: '1h' });

const wtrHodToken = jwt.sign({
  id: 2,
  name: 'Vikram Patil',
  email: 'vikram.patil@nagarsetu.gov.in',
  role: 'department_head',
  department_id: 3,
  department_code: 'WTR'
}, secret, { expiresIn: '1h' });

const app = require('../src/app');

let testPort = 5099;
let server;

function startServer() {
  return new Promise((resolve) => {
    server = app.listen(testPort, () => resolve(testPort));
  });
}

function postVerify(token, complaintId) {
  return new Promise((resolve) => {
    const postData = JSON.stringify({ complaint_id: complaintId, status: 'Resolved' });
    const req = http.request({
      hostname: 'localhost',
      port: testPort,
      path: '/api/department/verify',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + token
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ statusCode: res.statusCode, body: data }));
    });
    req.write(postData);
    req.end();
  });
}

(async () => {
  await startServer();
  const compNumber = 'CMP-PWD-VERIFY-' + Date.now();
  await query(
    'INSERT INTO complaints (complaint_number, category, title, description, department_id, status, latitude, longitude, photo_before_url, location_source) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [compNumber, 'Roads & Footpaths', 'PWD Road Defect', 'Pothole fixed', 1, 'Resolution Submitted', 19.07, 72.87, 'https://example.com/p.jpg', 'device_gps']
  );

  const compRes = await query('SELECT id, status, department_id FROM complaints WHERE complaint_number = ?', [compNumber]);
  const complaintId = compRes.rows[0].id;

  // Cross-dept check: WTR HOD verifying PWD complaint -> MUST return 403
  const crossRes = await postVerify(wtrHodToken, complaintId);
  console.log('CROSS_DEPT_STATUS:', crossRes.statusCode, crossRes.body);

  // Same-dept check: PWD HOD verifying PWD complaint -> MUST return 200
  const sameRes = await postVerify(pwdHodToken, complaintId);
  console.log('SAME_DEPT_STATUS:', sameRes.statusCode, sameRes.body);

  // DB Status verification
  const finalDb = await query('SELECT id, status FROM complaints WHERE id = ?', [complaintId]);
  console.log('FINAL_DB_STATUS:', finalDb.rows[0]?.status);
  process.exit(0);
})();
