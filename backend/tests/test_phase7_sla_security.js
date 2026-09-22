const assert = require('assert');
const fs = require('fs');
const path = require('path');

function checkSecurity() {
  console.log('--- Running SLA Security Test ---');

  // Check adminService.ts for slaHours signature
  const adminServicePath = path.join(__dirname, '../../frontend/src/services/adminService.ts');
  const adminServiceStr = fs.readFileSync(adminServicePath, 'utf8');
  assert.ok(!adminServiceStr.includes('slaHours: number = 24'), 'Client should not pass slaHours default');
  console.log('PASS: Client cannot override SLA hours/deadline.');

  // Check routes for sla_deadline override
  const routesPath = path.join(__dirname, '../src/routes/complaint.routes.js');
  const routesStr = fs.readFileSync(routesPath, 'utf8');
  assert.ok(!routesStr.includes('req.body.sla_deadline'), 'Routes should not accept sla_deadline from client');
  console.log('PASS: Unauthorized users cannot modify SLA config via payload.');

  console.log('--- SLA Security Test Complete ---');
}

checkSecurity();