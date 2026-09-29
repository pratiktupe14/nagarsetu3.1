const express = require('express');
const app = require('../backend/src/app');
const jwt = require('jsonwebtoken');
const http = require('http');

const JWT_SECRET = process.env.JWT_SECRET || 'nagarsetu_jwt_secret_key_2026_safe';

async function runTest() {
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`Test server running on port ${port}`);

  // Create City Admin Token
  const adminToken = jwt.sign(
    { id: 1, role: 'city_admin', email: 'admin@nagarsetu.gov.in', department_id: '1' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  const headers = {
    'Authorization': `Bearer ${adminToken}`,
    'Content-Type': 'application/json'
  };

  async function makeReq(path) {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, { headers });
    const status = res.status;
    const body = await res.json().catch(() => ({}));
    return { status, body };
  }

  console.log('\n--- 1. GET /api/departments ---');
  const rDept = await makeReq('/api/departments');
  console.log('Status:', rDept.status);
  console.log('Departments Count:', rDept.body?.departments?.length || 0);
  if (rDept.body?.departments) {
    console.log('Departments:', rDept.body.departments.map(d => ({ id: d.id, code: d.code, name: d.name })));
  }

  console.log('\n--- 2. GET /api/admin/department-heads ---');
  const rDh = await makeReq('/api/admin/department-heads');
  console.log('Status:', rDh.status);
  console.log('Department Heads Count:', rDh.body?.department_heads?.length || 0);
  if (rDh.body?.department_heads) {
    console.log('Department Heads:', rDh.body.department_heads.map(dh => ({
      id: dh.id,
      name: dh.name || dh.full_name,
      email: dh.email,
      department_id: dh.department_id,
      status: dh.status
    })));
  }

  console.log('\n--- 3. GET /api/department/staff ---');
  const rStaff = await makeReq('/api/department/staff');
  console.log('Status:', rStaff.status);
  console.log('Summary:', rStaff.body?.summary);
  console.log('Staff Count:', rStaff.body?.staff?.length || 0);
  if (rStaff.body?.staff) {
    console.log('Staff Sample (first 3):', rStaff.body.staff.slice(0, 3).map(s => ({
      id: s.id,
      name: s.name,
      department_id: s.department_id,
      department_name: s.department_name,
      status: s.status
    })));
  }

  server.close();
  process.exit(0);
}

runTest().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
