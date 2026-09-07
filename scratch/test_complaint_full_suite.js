const http = require('http');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch(e) {}
        resolve({ status: res.statusCode, headers: res.headers, body, json });
      });
    });
    req.on('error', reject);
    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runSuite() {
  console.log('=== NAGARSETU CITIZEN COMPLAINT VERIFICATION SUITE ===');

  // 1. Authenticate Seed Citizen
  console.log('\n[1] Logging in Citizen (8788562103)...');
  const loginRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/login',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    mobileOrEmail: '8788562103',
    password: 'password123'
  });

  console.log('Login Status:', loginRes.status);
  if (loginRes.status !== 200 || !loginRes.json?.token) {
    throw new Error('Citizen login failed: ' + JSON.stringify(loginRes.json));
  }
  const citizenToken = loginRes.json.token;
  const citizenUser = loginRes.json.user;
  console.log('Logged in citizen user id:', citizenUser.id, 'role:', citizenUser.role);

  // 2. Test Payload A: Text-only complaint
  console.log('\n[2] Testing Payload A: Text-only complaint...');
  const payloadA = {
    category: 'Roads & Footpaths',
    title: 'Text-Only Broken Curb',
    description: 'The road curb is cracked and poses hazard to pedestrians.',
    priority: 'Medium',
    department: 'PWD',
    location_address: 'Station Road, Ward 4'
  };

  const resA = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/complaints/submit',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${citizenToken}`
    }
  }, payloadA);

  console.log('Payload A Status:', resA.status);
  console.log('Payload A Response:', JSON.stringify(resA.json, null, 2));
  if (resA.status !== 201 || !resA.json?.complaint?.id) {
    throw new Error('Payload A failed: ' + JSON.stringify(resA.json));
  }
  const complaintAId = resA.json.complaint.id;
  const complaintANumber = resA.json.complaint.complaint_number;
  console.log('✓ Payload A created successfully:', complaintANumber, 'ID:', complaintAId, 'Citizen ID:', resA.json.complaint.citizen_id);

  // 3. Test Payload B: Complaint + Image
  console.log('\n[3] Testing Payload B: Complaint + Image...');
  const payloadB = {
    category: 'Sanitation & Waste',
    title: 'Garbage Dump Overflow with Image',
    description: 'Large waste bin overflowing on market road.',
    priority: 'High',
    department: 'SAN',
    photo_url: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...',
    location_address: 'Main Market Yard'
  };

  const resB = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/complaints/submit',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${citizenToken}`
    }
  }, payloadB);

  console.log('Payload B Status:', resB.status);
  if (resB.status !== 201 || !resB.json?.complaint?.photo_before_url) {
    throw new Error('Payload B failed: ' + JSON.stringify(resB.json));
  }
  console.log('✓ Payload B created successfully with photo:', resB.json.complaint.complaint_number);

  // 4. Test Payload C: Complaint + Image + GPS
  console.log('\n[4] Testing Payload C: Complaint + Image + GPS Coordinates...');
  const payloadC = {
    category: 'Water Supply',
    title: 'Pipeline Leakage with GPS',
    description: 'Continuous water leakage from main pipeline valve.',
    priority: 'High',
    department: 'WTR',
    latitude: 18.5204,
    longitude: 73.8567,
    location_source: 'gps',
    location_address: 'Shivaji Nagar Water Station',
    photo_url: 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP...'
  };

  const resC = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/complaints/submit',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${citizenToken}`
    }
  }, payloadC);

  console.log('Payload C Status:', resC.status);
  if (resC.status !== 201 || !resC.json?.complaint?.latitude || !resC.json?.complaint?.longitude) {
    throw new Error('Payload C failed: ' + JSON.stringify(resC.json));
  }
  console.log('✓ Payload C created with GPS coordinates:', resC.json.complaint.latitude, resC.json.complaint.longitude);

  // 5. Test Payload D: Complaint + Voice description
  console.log('\n[5] Testing Payload D: Complaint + Voice description...');
  const payloadD = {
    category: 'Street Lighting',
    title: 'Flickering Street Light at Crossing',
    description: 'Street light pole 42 flickering continuously causing dark spots at crossing (Recorded via voice note).',
    priority: 'Low',
    department: 'ELE',
    location_address: 'Ring Road Junction',
    ai_evidence: 'Voice note transcribed: Street light at junction flickering continuously.'
  };

  const resD = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/complaints/submit',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${citizenToken}`
    }
  }, payloadD);

  console.log('Payload D Status:', resD.status);
  if (resD.status !== 201) {
    throw new Error('Payload D failed: ' + JSON.stringify(resD.json));
  }
  console.log('✓ Payload D created successfully:', resD.json.complaint.complaint_number);

  // 6. Test GET /api/complaints/my (authoritative citizen isolation)
  console.log('\n[6] Testing GET /api/complaints/my...');
  const myRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/complaints/my',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${citizenToken}`
    }
  });

  console.log('My Complaints Status:', myRes.status);
  const myComplaints = myRes.json?.complaints || [];
  console.log('Found', myComplaints.length, 'complaints for citizen.');
  const foundA = myComplaints.find(c => c.complaint_number === complaintANumber);
  if (!foundA) {
    throw new Error('Created complaint ' + complaintANumber + ' not returned in /my complaints!');
  }
  console.log('✓ Verified created complaint is present in GET /api/complaints/my');

  // 7. Test Single Complaint GET /api/complaints/:id
  console.log('\n[7] Testing GET /api/complaints/:id...');
  const singleRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/complaints/${complaintAId}`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${citizenToken}`
    }
  });
  console.log('Single Complaint Status:', singleRes.status);
  if (singleRes.status !== 200 || !singleRes.json?.complaint) {
    throw new Error('Failed to fetch single complaint: ' + JSON.stringify(singleRes.json));
  }
  console.log('✓ Single complaint fetched with citizen_name:', singleRes.json.complaint.citizen_name);

  // 8. Test Citizen Isolation: Register Citizen B and verify Citizen B cannot view Citizen A's complaint
  console.log('\n[8] Testing Citizen Isolation: Register Citizen B...');
  const randNum = Math.floor(100000 + Math.random() * 900000);
  const citizenBMobile = `9822${randNum}`;
  const citizenBEmail = `citizen_b_${randNum}@example.com`;

  const regB = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/auth/register',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {
    name: 'Citizen B Tester',
    mobile: citizenBMobile,
    email: citizenBEmail,
    password: 'password123',
    role: 'citizen'
  });

  console.log('Citizen B Registration Status:', regB.status);
  if (regB.status !== 201 || !regB.json?.token) {
    throw new Error('Failed to register Citizen B: ' + JSON.stringify(regB.json));
  }
  const tokenB = regB.json.token;

  console.log('Attempting to access Citizen A\'s complaint using Citizen B token...');
  const idorRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: `/api/complaints/${complaintAId}`,
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${tokenB}`
    }
  });

  console.log('Citizen B accessing Citizen A complaint status:', idorRes.status);
  if (idorRes.status !== 403) {
    throw new Error(`Citizen isolation failed! Expected HTTP 403, received HTTP ${idorRes.status}`);
  }
  console.log('✓ Citizen isolation verified! HTTP 403 Access Denied returned for other citizen\'s complaint.');

  // 9. Verify Citizen B's /my complaints list does NOT contain Citizen A's complaints
  const myBRes = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/complaints/my',
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${tokenB}`
    }
  });
  const bComplaints = myBRes.json?.complaints || [];
  const leaked = bComplaints.find(c => c.complaint_number === complaintANumber);
  if (leaked) {
    throw new Error('Data leakage! Citizen B can see Citizen A\'s complaint in /my');
  }
  console.log('✓ Verified Citizen B /my complaints contains 0 complaints from Citizen A.');

  // 10. Test Newly Registered Citizen Complaint Submission
  console.log('\n[10] Testing newly registered Citizen B complaint submission...');
  const bSubmission = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/complaints/submit',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${tokenB}`
    }
  }, {
    category: 'Drainage & Sewage',
    title: 'Citizen B Clogged Drain',
    description: 'Drain line blocked near gate.',
    priority: 'Medium',
    department: 'DRN'
  });
  console.log('Citizen B Submission Status:', bSubmission.status);
  if (bSubmission.status !== 201) {
    throw new Error('Citizen B submission failed: ' + JSON.stringify(bSubmission.json));
  }
  console.log('✓ Newly registered Citizen B submitted complaint successfully:', bSubmission.json.complaint.complaint_number);

  // 11. Test Error Classification
  console.log('\n[11] Testing Error Classifications...');

  // Validation Failure: 400
  const badReq = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/complaints/submit',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${citizenToken}`
    }
  }, {
    // Missing required category and title
    description: 'Incomplete'
  });
  console.log('Missing category/title status:', badReq.status, badReq.json?.error);
  if (badReq.status !== 400) {
    throw new Error(`Expected HTTP 400, got ${badReq.status}`);
  }
  console.log('✓ Verified HTTP 400 for validation failure.');

  // Authentication Failure: 401
  const unauthReq = await request({
    hostname: 'localhost',
    port: 5000,
    path: '/api/complaints/submit',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer invalid_token_12345'
    }
  }, payloadA);
  console.log('Invalid token status:', unauthReq.status, unauthReq.json?.error);
  if (unauthReq.status !== 401 && unauthReq.status !== 403) {
    throw new Error(`Expected HTTP 401/403, got ${unauthReq.status}`);
  }
  console.log('✓ Verified HTTP 401 for authentication failure.');

  console.log('\n======================================================');
  console.log('  ALL VERIFICATION TESTS PASSED SUCCESSFULLY!         ');
  console.log('======================================================\n');
}

runSuite().catch(err => {
  console.error('\n❌ SUITE FAILED:', err.message);
  process.exit(1);
});
