const http = require('http');
const path = require('path');
const fs = require('fs');

const jwt = require(path.join(__dirname, '../backend/node_modules/jsonwebtoken'));
const app = require('../backend/src/app');
const { query, initDatabase } = require('../backend/src/config/db');

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
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function testHttpAssignment() {
  console.log('=== TESTING HTTP ASSIGNMENT ===');
  await initDatabase();
  const { server, port } = await startServer();

  try {
    const jwtSecret = process.env.JWT_SECRET || 'nagarsetu_dev_secret_key_2026_super_secure';
    const dhToken = jwt.sign(
      { id: 128, name: 'Rahul Kumar', email: 'rahul.kumar@nagarsetu.gov.in', role: 'department_head', department_id: 1 },
      jwtSecret,
      { expiresIn: '1h' }
    );
    console.log('1. Generated token for PWD Department Head');

    // 2. Ensure Complaint NS-2026-692436 exists or create it
    let compRes = await query(`SELECT id, complaint_number, department_id, status FROM complaints WHERE complaint_number = $1 OR CAST(id AS TEXT) = $1`, ['NS-2026-692436']);
    let complaintId;

    if (compRes.rows.length === 0) {
      console.log('2. Creating complaint NS-2026-692436...');
      const insRes = await query(
        `INSERT INTO complaints (complaint_number, citizen_id, photo_before_url, category, title, description, priority, status, department_id, latitude, longitude, location_source, location_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         RETURNING id`,
        ['NS-2026-692436', '1', 'https://images.unsplash.com/photo-1590674899484-d5640e854abe', 'Road Damage / Pothole', 'Pothole on MG Road', 'Dangerous pothole', 'High', 'Submitted', '1', 19.99, 73.78, 'manual_pin', 'Nashik']
      );
      complaintId = String(insRes.rows[0].id);
      console.log('   Created complaint with ID:', complaintId);
    } else {
      complaintId = String(compRes.rows[0].id);
      console.log('2. Found existing complaint NS-2026-692436, ID:', complaintId, 'Status:', compRes.rows[0].status);
    }

    // 3. Make POST /api/department/assign request
    console.log('\n3. Executing POST /api/department/assign for PWD-STF-001 (Amit Patil)...');
    const assignRes = await request(port, 'POST', '/api/department/assign', {
      Authorization: `Bearer ${dhToken}`
    }, {
      complaint_id: 'NS-2026-692436',
      staff_id: 'PWD-STF-001'
    });

    console.log('\n================ ASSIGN RESPONSE ================');
    console.log('HTTP Status:', assignRes.status);
    console.log('Body:', JSON.stringify(assignRes.body, null, 2));
    console.log('=================================================\n');

  } catch (err) {
    console.error('Test error:', err);
  } finally {
    server.close();
  }
}

testHttpAssignment();
