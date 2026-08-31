const http = require('http');
const { query } = require('../backend/src/config/db');

async function makeRequest(options, postData) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: data });
        }
      });
    });
    req.on('error', reject);
    if (postData) req.write(JSON.stringify(postData));
    req.end();
  });
}

async function runTest() {
  console.log('========================================================================');
  console.log('  TESTING CITIZEN COMPLAINT ROUTING & HARDENED DEPARTMENT ISOLATION');
  console.log('========================================================================\n');

  // 1. Authenticate Citizen
  let citizenToken = '';
  try {
    const citRes = await makeRequest({
      hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { mobileOrEmail: '9876543210', password: 'password123' });

    if (citRes.status === 200 && citRes.data.token) {
      citizenToken = citRes.data.token;
      console.log('✓ Citizen authenticated successfully.');
    } else {
      console.error('✗ Citizen login failed:', citRes.data);
      process.exit(1);
    }
  } catch (e) {
    console.error('✗ Error logging in citizen:', e.message);
    process.exit(1);
  }

  // 2. Authenticate Admin
  let adminToken = '';
  try {
    const admRes = await makeRequest({
      hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { mobileOrEmail: 'admin@nagarsetu.gov.in', password: 'password123' });

    if (admRes.status === 200 && admRes.data.token) {
      adminToken = admRes.data.token;
      console.log('✓ Admin authenticated successfully.');
    } else {
      console.log('Admin login response:', admRes.data);
    }
  } catch (e) {
    console.error('✗ Error logging in admin:', e.message);
  }

  // 3. Authenticate All 7 Department Heads
  const deptHeadAccounts = [
    { code: 'PWD', email: 'rahul.kumar@nagarsetu.gov.in' },
    { code: 'SAN', email: 'amit.sharma@nagarsetu.gov.in' },
    { code: 'WTR', email: 'vikram.patil@nagarsetu.gov.in' },
    { code: 'DRN', email: 'sanjay.more@nagarsetu.gov.in' },
    { code: 'ELE', email: 'aditya.joshi@nagarsetu.gov.in' },
    { code: 'TRF', email: 'rohan.deshmukh@nagarsetu.gov.in' },
    { code: 'MNT', email: 'kunal.kulkarni@nagarsetu.gov.in' }
  ];

  const deptTokens = {};

  for (const dept of deptHeadAccounts) {
    try {
      const dhRes = await makeRequest({
        hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, { mobileOrEmail: dept.email, password: 'password123' });

      if (dhRes.status === 200 && dhRes.data.token) {
        deptTokens[dept.code] = { token: dhRes.data.token, deptId: dhRes.data.user?.department_id, user: dhRes.data.user };
        console.log(`✓ Department Head [${dept.code}] authenticated (${dept.email}, DB department_id: ${dhRes.data.user?.department_id}).`);
      } else {
        console.error(`✗ Department Head [${dept.code}] login failed:`, dhRes.data);
      }
    } catch (e) {
      console.error(`✗ Error logging in Department Head [${dept.code}]:`, e.message);
    }
  }

  console.log('\n------------------------------------------------------------------------');
  console.log('  TEST 1: UNRESOLVABLE DEPARTMENT ERROR HANDLING (NO SILENT PWD FALLBACK)');
  console.log('------------------------------------------------------------------------');

  const invalidRes = await makeRequest({
    hostname: 'localhost', port: 5000, path: '/api/complaints/submit', method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${citizenToken}`
    }
  }, {
    photo_url: '/uploads/test-photo.jpg',
    category: 'Invalid Unresolvable Category',
    title: 'Random non-civic complaint',
    description: 'Testing invalid department error handling.',
    priority: 'Low',
    latitude: 20.0059,
    longitude: 73.7898,
    department_id: 'NON_EXISTENT_DEPT_999'
  });

  if (invalidRes.status === 400) {
    console.log(`✓ SUCCESS: Invalid department request correctly rejected with 400 Bad Request.`);
    console.log(`  Response message: "${invalidRes.data.error}"`);
  } else {
    console.error(`✗ FAIL: Invalid department was NOT rejected! Status=${invalidRes.status}, data=`, invalidRes.data);
  }

  console.log('\n------------------------------------------------------------------------');
  console.log('  TEST 2: DYNAMIC COMPLAINT CREATION & ISOLATION FOR ALL 7 DEPARTMENTS');
  console.log('------------------------------------------------------------------------\n');

  const testCases = [
    { code: 'PWD', category: 'Asphalt Pothole', title: 'Severe Road Pothole Test', deptInput: 'PWD' },
    { code: 'SAN', category: 'Garbage Overflow', title: 'Solid Waste Accumulation Test', deptInput: 'SAN' },
    { code: 'WTR', category: 'Pipeline Leakage', title: 'Water Main Leakage Test', deptInput: 'WTR' },
    { code: 'DRN', category: 'Drainage Overflow', title: 'Stormwater Drain Blockage Test', deptInput: 'DRN' },
    { code: 'ELE', category: 'Streetlight Repair', title: 'Broken LED Streetlight Test', deptInput: 'ELE' },
    { code: 'TRF', category: 'Traffic Signal', title: 'Faulty Signal Controller Test', deptInput: 'TRF' },
    { code: 'MNT', category: 'Building Maintenance', title: 'Municipal Hall Roof Leak Test', deptInput: 'MNT' }
  ];

  let totalPassed = 0;

  for (const tc of testCases) {
    console.log(`\n▶ [${tc.code}] Submitting Citizen Complaint: "${tc.title}" (Input Dept Code: "${tc.deptInput}")...`);

    // Submit complaint as citizen
    const submitRes = await makeRequest({
      hostname: 'localhost', port: 5000, path: '/api/complaints/submit', method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${citizenToken}`
      }
    }, {
      photo_url: '/uploads/test-photo.jpg',
      category: tc.category,
      title: tc.title,
      description: `Automated hardened test complaint for ${tc.code} department isolation.`,
      priority: 'High',
      latitude: 20.0059,
      longitude: 73.7898,
      location_address: 'Central District, Nashik',
      department_id: tc.deptInput
    });

    if (submitRes.status !== 201) {
      console.error(`✗ Complaint creation failed for ${tc.code}:`, submitRes.data);
      continue;
    }

    const createdComplaintId = submitRes.data.complaint_id;
    const complaintNumber = submitRes.data.complaint_number;
    const resolvedDeptId = submitRes.data.department_id;

    console.log(`  Created Complaint #${complaintNumber} (ID: ${createdComplaintId}, Resolved Department ID: ${resolvedDeptId})`);

    // Verify DB relation directly
    const dbCheck = await query(`SELECT c.id, c.department_id, d.code FROM complaints c LEFT JOIN departments d ON d.id = c.department_id WHERE c.id = $1`, [createdComplaintId]);
    if (dbCheck.rows && dbCheck.rows.length > 0 && dbCheck.rows[0].code === tc.code) {
      console.log(`  ✓ DATABASE RELATION VERIFIED: complaints.department_id (${dbCheck.rows[0].department_id}) references departments.code = '${dbCheck.rows[0].code}'`);
    } else {
      console.error(`  ✗ DATABASE RELATION ERROR: DB stored department_id does NOT map to ${tc.code}:`, dbCheck.rows);
    }

    // Verify Admin Portal sees it
    if (adminToken) {
      const adminRes = await makeRequest({
        hostname: 'localhost', port: 5000, path: '/api/complaints', method: 'GET',
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });

      const adminComplaints = adminRes.data?.complaints || [];
      const foundInAdmin = adminComplaints.some(c => c.id === createdComplaintId || c.complaint_number === complaintNumber);
      if (foundInAdmin) {
        console.log(`  ✓ ADMIN PORTAL: Complaint visible in Admin portal (Total complaints in Admin: ${adminComplaints.length}).`);
      } else {
        console.error(`  ✗ ADMIN PORTAL ERROR: Complaint NOT found in Admin portal!`);
      }
    }

    // Verify Department Head Portals
    let correctHeadSawIt = false;
    let otherHeadsLeakedIt = false;
    const leakageDepts = [];

    for (const dhCode of Object.keys(deptTokens)) {
      const dhData = deptTokens[dhCode];
      const dhRes = await makeRequest({
        hostname: 'localhost', port: 5000, path: '/api/department/complaints', method: 'GET',
        headers: { 'Authorization': `Bearer ${dhData.token}` }
      });

      const dhComplaints = dhRes.data?.complaints || [];
      const foundInDh = dhComplaints.some(c => c.id === createdComplaintId || c.complaint_number === complaintNumber);

      if (dhCode === tc.code) {
        if (foundInDh) {
          correctHeadSawIt = true;
          console.log(`  ✓ TARGET DEPT HEAD [${dhCode}]: Complaint VISIBLE.`);
        } else {
          console.error(`  ✗ TARGET DEPT HEAD [${dhCode}] ERROR: Complaint NOT visible to intended department head!`);
        }
      } else {
        if (foundInDh) {
          otherHeadsLeakedIt = true;
          leakageDepts.push(dhCode);
          console.error(`  ✗ LEAKAGE ERROR [${dhCode}]: Complaint was incorrectly visible to ${dhCode} department head!`);
        }
      }
    }

    if (correctHeadSawIt && !otherHeadsLeakedIt) {
      console.log(`  🎉 ISOLATION PERFECT: Complaint #${complaintNumber} visible ONLY to Admin & [${tc.code}] Head!`);
      totalPassed++;
    } else {
      console.error(`  ❌ ISOLATION FAILED for ${tc.code}: correctHeadSawIt=${correctHeadSawIt}, leakedTo=[${leakageDepts.join(', ')}]`);
    }
  }

  console.log('\n========================================================================');
  console.log(`  FINAL RESULT: ${totalPassed} / ${testCases.length} DEPARTMENTS PASSED STRICT HARDENED ISOLATION`);
  console.log('========================================================================\n');
}

runTest();
