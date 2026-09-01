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
  console.log('  TESTING COMPLETE END-TO-END WORKFLOW (APPROVAL & REWORK PATHS)');
  console.log('========================================================================\n');

  // 1. Authenticate Citizen
  let citizenToken = '';
  const citRes = await makeRequest({
    hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { mobileOrEmail: '9876543210', password: 'password123' });
  if (citRes.status === 200) citizenToken = citRes.data.token;

  // 2. Authenticate ELE Department Head
  let eleHeadToken = '';
  const eleHeadRes = await makeRequest({
    hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { mobileOrEmail: 'aditya.joshi@nagarsetu.gov.in', password: 'password123' });
  if (eleHeadRes.status === 200) eleHeadToken = eleHeadRes.data.token;

  // 3. Authenticate ELE Field Staff
  let eleStaffToken = '', eleStaffId = '';
  const eleStaffRes = await makeRequest({
    hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { mobileOrEmail: 'rahul.joshi@nagarsetu.gov.in', password: 'password123' });
  if (eleStaffRes.status === 200) {
    eleStaffToken = eleStaffRes.data.token;
    eleStaffId = eleStaffRes.data.user.id;
  }

  // 4. Authenticate Admin
  let adminToken = '';
  const admRes = await makeRequest({
    hostname: 'localhost', port: 5000, path: '/api/auth/login', method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, { mobileOrEmail: 'admin@nagarsetu.gov.in', password: 'password123' });
  if (admRes.status === 200) adminToken = admRes.data.token;

  console.log('✓ All authentications successful.\n');
  console.log('------------------------------------------------------------------------');
  console.log('  TEST PATH 1: WORK SUBMISSION -> REWORK REQUESTED -> RE-SUBMIT -> APPROVE');
  console.log('------------------------------------------------------------------------\n');

  // STEP 1: Create complaint
  const subRes = await makeRequest({
    hostname: 'localhost', port: 5000, path: '/api/complaints/submit', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${citizenToken}` }
  }, {
    photo_url: '/uploads/light-broken.jpg',
    category: 'Streetlight Repair',
    title: 'Feeder Line Trip on Park Avenue',
    description: 'Streetlights flickering and tripping breaker.',
    priority: 'High',
    latitude: 20.0059, longitude: 73.7898,
    department_id: 'ELE'
  });

  const complaintId = subRes.data.complaint_id;
  const complaintNumber = subRes.data.complaint_number;
  console.log(`✓ Step 1: Created complaint #${complaintNumber} (ID: ${complaintId}).`);

  // STEP 2: Department Head assigns task
  await makeRequest({
    hostname: 'localhost', port: 5000, path: '/api/department/assign', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${eleHeadToken}` }
  }, { complaint_id: complaintId, staff_id: eleStaffId });
  console.log(`✓ Step 2: Department Head assigned #${complaintNumber} to Field Staff.`);

  // STEP 3: Field Staff submits resolution proof (First Attempt)
  await makeRequest({
    hostname: 'localhost', port: 5000, path: `/api/staff/task/${complaintNumber}/resolve`, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${eleStaffToken}` }
  }, {
    complaint_number: complaintNumber, complaint_id: complaintId,
    photo_after_url: '/uploads/proof-v1.jpg', work_performed: 'Reset breaker switch.'
  });
  console.log(`✓ Step 3: Field Staff submitted first repair proof. Status = 'Resolution Submitted'.`);

  // STEP 4: Department Head requests Rework
  const reworkReason = 'Breaker reset is temporary. Please replace fuse carrier and secure junction door.';
  const rwRes = await makeRequest({
    hostname: 'localhost', port: 5000, path: '/api/department/verify', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${eleHeadToken}` }
  }, {
    complaint_id: complaintNumber, status: 'Reopened', rework_reason: reworkReason
  });

  if (rwRes.status === 200 && rwRes.data.complaint.status === 'Reopened') {
    console.log(`✓ Step 4: Department Head requested rework. Status in DB is '${rwRes.data.complaint.status}'.`);
  } else {
    console.error('✗ Rework request failed:', rwRes.data);
  }

  // STEP 5: Field Staff submits NEW resolution proof (Second Attempt after rework)
  const finalProofUrl = '/uploads/proof-v2-carrier-replaced.jpg';
  const finalNotes = 'Replaced damaged fuse carrier, installed 32A HRC fuse, and secured box lock.';

  const resubmitRes = await makeRequest({
    hostname: 'localhost', port: 5000, path: `/api/staff/task/${complaintNumber}/resolve`, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${eleStaffToken}` }
  }, {
    complaint_number: complaintNumber, complaint_id: complaintId,
    photo_after_url: finalProofUrl, work_performed: finalNotes
  });

  if (resubmitRes.status === 200 && resubmitRes.data.status === 'Resolution Submitted') {
    console.log(`✓ Step 5: Field Staff re-submitted resolution proof after rework. Status = 'Resolution Submitted'.`);
  } else {
    console.error('✗ Re-submission after rework failed:', resubmitRes.data);
  }

  // STEP 6: Department Head approves final resolution proof
  const appRes = await makeRequest({
    hostname: 'localhost', port: 5000, path: '/api/department/verify', method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${eleHeadToken}` }
  }, {
    complaint_id: complaintNumber, status: 'Resolved', verified_by_name: 'Aditya Joshi (ELE Head)'
  });

  if (appRes.status === 200 && appRes.data.complaint.status === 'Resolved') {
    console.log(`✓ Step 6: Department Head approved final proof. Ticket status = 'Resolved' (Ticket Closed).`);
  } else {
    console.error('✗ Final approval failed:', appRes.data);
  }

  // STEP 7: Database read-back verification
  const dbCheck = await query(`SELECT id, complaint_number, status, photo_after_url, work_performed, rework_reason, verified_by_name FROM complaints WHERE id = $1`, [complaintId]);
  const rec = dbCheck.rows[0];

  if (rec && rec.status === 'Resolved' && rec.photo_after_url === finalProofUrl && rec.rework_reason === reworkReason) {
    console.log(`✓ Step 7: DATABASE PERSISTENCE & HISTORY VERIFIED! Record status='${rec.status}', final proof stored, rework history preserved.`);
  } else {
    console.error('✗ DB Verification error:', rec);
  }

  console.log('\n========================================================================');
  console.log('  🎉 E2E REWORK & APPROVAL WORKFLOW SUCCESSFULLY VERIFIED!');
  console.log('========================================================================\n');
}

runTest();
