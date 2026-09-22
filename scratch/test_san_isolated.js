const http = require('http');
const jwt = require('../backend/node_modules/jsonwebtoken');
const app = require('../backend/src/app');
const { query, initDatabase } = require('../backend/src/config/db');

async function testSanIsolated() {
  await initDatabase();
  const server = http.createServer(app);
  server.listen(0, '127.0.0.1', async () => {
    const port = server.address().port;
    const jwtSecret = process.env.JWT_SECRET || 'nagarsetu_dev_secret_key_2026_super_secure';
    
    // Look up real SAN department head
    const dhRes = await query("SELECT id, name, email, department_id FROM users WHERE role = 'department_head' AND (department_id = '2' OR LOWER(email) LIKE '%san%' OR LOWER(email) LIKE '%sharma%') LIMIT 1");
    console.log('SAN DH User in DB:', dhRes.rows[0]);
    const sanUser = dhRes.rows[0];

    const sanDhToken = jwt.sign(
      { id: sanUser.id, name: sanUser.name, email: sanUser.email, role: 'department_head', department_id: sanUser.department_id },
      jwtSecret,
      { expiresIn: '1h' }
    );

    const insSan = await query(
      `INSERT INTO complaints (complaint_number, citizen_id, photo_before_url, category, title, description, priority, status, department_id, latitude, longitude, location_source)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
      [`NS-SAN-${Date.now()}`, '1', 'https://example.com/photo.jpg', 'Sanitation', 'Garbage dump', 'Dumpster overflow', 'Medium', 'Submitted', '2', 19.99, 73.78, 'manual_pin']
    );
    const compId = String(insSan.rows[0].id);
    console.log('Created SAN complaint ID:', compId);

    const reqOpts = {
      hostname: '127.0.0.1',
      port,
      path: '/api/department/assign',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sanDhToken}`
      }
    };

    const req = http.request(reqOpts, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        console.log('\n--- SAN ASSIGN RESPONSE ---');
        console.log('Status:', res.statusCode);
        console.log('Body:', data);
        server.close();
        process.exit(0);
      });
    });

    req.write(JSON.stringify({ complaint_id: compId, staff_id: 'SAN-STF-001' }));
    req.end();
  });
}

testSanIsolated();
