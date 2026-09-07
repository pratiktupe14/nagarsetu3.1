const http = require('http');

async function testResolutionAndReopen() {
  console.log('Testing Resolution Review and Citizen Reopen...');

  // 1. Login as Admin
  const adminLoginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobileOrEmail: 'admin@nagarsetu.gov.in', password: 'password123' })
  });
  const adminLogin = await adminLoginRes.json();
  const adminToken = adminLogin.token;
  console.log('Admin login status:', adminLoginRes.status, 'Token exists:', !!adminToken);

  // 2. Fetch complaint 100
  const compRes = await fetch('http://localhost:5000/api/complaints/100', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const compData = await compRes.json();
  console.log('Complaint 100 current status:', compData.complaint?.status);

  // 3. Admin verifies/approves resolution
  const verifyRes = await fetch('http://localhost:5000/api/department/verify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      complaint_id: 100,
      status: 'Resolved',
      verified_by_name: 'City Administration'
    })
  });
  const verifyData = await verifyRes.json();
  console.log('Admin verify status:', verifyRes.status, 'Updated status:', verifyData.complaint?.status);

  // 4. Login as citizen demo account
  const citLoginRes = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobileOrEmail: '8788562103', password: 'password123' })
  });
  const citLogin = await citLoginRes.json();
  const citToken = citLogin.token;
  console.log('Citizen login status:', citLoginRes.status, 'Token exists:', !!citToken);

  // 5. Test Citizen Reopen
  const reopenRes = await fetch('http://localhost:5000/api/complaints/100/reopen', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${citToken || adminToken}`
    },
    body: JSON.stringify({ reason: 'Water is still leaking around the base valve.' })
  });
  const reopenData = await reopenRes.json();
  console.log('Reopen status:', reopenRes.status, reopenData);

  // 6. Direct read-back of complaint 100
  const verifyReadBack = await fetch('http://localhost:5000/api/complaints/100', {
    headers: { Authorization: `Bearer ${adminToken}` }
  });
  const finalComp = await verifyReadBack.json();
  console.log('Final Complaint Status in DB:', finalComp.complaint?.status, 'Rework reason:', finalComp.complaint?.rework_reason);

  if (finalComp.complaint?.status === 'Reopened') {
    console.log('ALL RESOLUTION & REOPEN TESTS PASSED!');
  }
}

testResolutionAndReopen().catch(console.error);
