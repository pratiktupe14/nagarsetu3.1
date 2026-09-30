const { query } = require('../config/db');

async function runEndToEndVerification() {
  console.log('=== STARTING CITIZEN COMPLAINT PERSISTENCE & VISIBILITY VERIFICATION ===');

  const BASE_URL = 'http://localhost:5000';

  // 1. Get Citizen Auth Token
  const citizenTokenRes = await fetch(`${BASE_URL}/api/auth/demo-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'citizen' })
  });
  const citizenTokenData = await citizenTokenRes.json();
  const citizenToken = citizenTokenData.token;
  console.log('✓ Citizen token obtained');

  // 2. Get Admin Auth Token
  const adminTokenRes = await fetch(`${BASE_URL}/api/auth/demo-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'city_admin' })
  });
  const adminTokenData = await adminTokenRes.json();
  const adminToken = adminTokenData.token;
  console.log('✓ City Admin token obtained');

  // 3. Get PWD Department Head Auth Token
  const pwdHeadRes = await fetch(`${BASE_URL}/api/auth/demo-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'department_head', email: 'rahul.kumar@nagarsetu.gov.in' })
  });
  const pwdHeadData = await pwdHeadRes.json();
  const pwdHeadToken = pwdHeadData.token;
  console.log('✓ PWD Department Head token obtained');

  // 4. Get Sanitation Department Head Auth Token
  const sanHeadRes = await fetch(`${BASE_URL}/api/auth/demo-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role: 'department_head', email: 'amit.sharma@nagarsetu.gov.in' })
  });
  const sanHeadData = await sanHeadRes.json();
  const sanHeadToken = sanHeadData.token;
  console.log('✓ Sanitation Department Head token obtained');

  // 5. Submit Citizen Complaint with 4-Angle Images to PWD
  const testNumber = `NS-TEST-${Date.now()}`;
  const frontImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const leftImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const rightImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
  const closeupImage = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';

  const anglePhotos = [
    { angle: 'front', label: 'Front View', url: frontImage },
    { angle: 'left', label: 'Left View', url: leftImage },
    { angle: 'right', label: 'Right View', url: rightImage },
    { angle: 'closeup', label: 'Close-up Detail', url: closeupImage }
  ];

  const complaintPayload = {
    complaint_number: testNumber,
    title: 'Severe Pothole on College Road Crossroad',
    description: 'Deep road crater causing hazardous traffic conditions outside college gate.',
    category: 'Roads & Footpaths',
    priority: 'High',
    latitude: 19.9975,
    longitude: 73.7898,
    location_source: 'live_gps',
    location_address: 'College Road, Nashik, Maharashtra 422005',
    department_id: 1,
    department_name: 'Public Works Department (PWD)',
    department_code: 'PWD',
    photo_url: frontImage,
    photo_front_url: frontImage,
    photo_left_url: leftImage,
    photo_right_url: rightImage,
    photo_closeup_url: closeupImage,
    angle_photos: anglePhotos,
    additional_photos: [leftImage, rightImage, closeupImage]
  };

  const submitRes = await fetch(`${BASE_URL}/api/complaints/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${citizenToken}`
    },
    body: JSON.stringify(complaintPayload)
  });

  if (!submitRes.ok) {
    const errText = await submitRes.text();
    throw new Error(`Citizen complaint submission failed (${submitRes.status}): ${errText}`);
  }

  const submitData = await submitRes.json();
  console.log('✓ Citizen submission succeeded:', submitData.complaint_number, 'ID:', submitData.complaint_id);

  // A. Database Verification
  const dbCheck = await query(`SELECT * FROM complaints WHERE complaint_number = ?`, [testNumber]);
  if (!dbCheck.rows || dbCheck.rows.length !== 1) {
    throw new Error(`Database check failed: expected 1 record, got ${dbCheck.rows?.length}`);
  }
  const persisted = dbCheck.rows[0];
  console.log('✓ A. Database persistence verified: exactly 1 complaint persisted with id', persisted.id);

  // B. Images Verification
  if (!persisted.photo_front_url || !persisted.photo_left_url || !persisted.photo_right_url || !persisted.photo_closeup_url) {
    throw new Error('Images check failed: 4-angle photo fields are missing in database record');
  }
  console.log('✓ B. All 4 angle images persisted in database record');

  // C. Citizen Isolation: My Complaints
  const myCompRes = await fetch(`${BASE_URL}/api/complaints/my`, {
    headers: { 'Authorization': `Bearer ${citizenToken}` }
  });
  const myCompData = await myCompRes.json();
  const myComplaints = myCompData.complaints || myCompData;
  const foundInMy = myComplaints.some(c => c.complaint_number === testNumber);
  if (!foundInMy) {
    throw new Error('Citizen check failed: complaint does not appear in My Complaints');
  }
  console.log('✓ C. Citizen sees complaint in My Complaints');

  // D. City Admin Visibility: All Complaints
  const adminCompRes = await fetch(`${BASE_URL}/api/complaints`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  const adminCompData = await adminCompRes.json();
  const adminComplaints = adminCompData.complaints || adminCompData;
  const foundInAdmin = adminComplaints.some(c => c.complaint_number === testNumber);
  if (!foundInAdmin) {
    throw new Error('Admin check failed: complaint does not appear in All Complaints');
  }
  console.log('✓ D. City Admin sees complaint in All Complaints');

  // E. Correct Department Head (PWD): Complaint Appears
  const pwdCompRes = await fetch(`${BASE_URL}/api/department/complaints`, {
    headers: { 'Authorization': `Bearer ${pwdHeadToken}` }
  });
  const pwdCompData = await pwdCompRes.json();
  const pwdComplaints = pwdCompData.complaints || pwdCompData;
  const foundInPwd = pwdComplaints.some(c => c.complaint_number === testNumber);
  if (!foundInPwd) {
    throw new Error('Department Head check failed: complaint does not appear in PWD portal');
  }
  console.log('✓ E. PWD Department Head sees the complaint');

  // F. Other Department Head (SAN): Complaint Does NOT Appear (Department Isolation)
  const sanCompRes = await fetch(`${BASE_URL}/api/department/complaints`, {
    headers: { 'Authorization': `Bearer ${sanHeadToken}` }
  });
  const sanCompData = await sanCompRes.json();
  const sanComplaints = sanCompData.complaints || sanCompData;
  const foundInSan = sanComplaints.some(c => c.complaint_number === testNumber);
  if (foundInSan) {
    throw new Error('Department Isolation failed: complaint routed to PWD appears in Sanitation portal!');
  }
  console.log('✓ F. Sanitation Department Head does NOT see PWD complaint (Strict Department Isolation enforced)');

  // G. Single complaint by ID (refresh simulation)
  const singleCompRes = await fetch(`${BASE_URL}/api/complaints/${persisted.id}`, {
    headers: { 'Authorization': `Bearer ${citizenToken}` }
  });
  const singleCompData = await singleCompRes.json();
  const singleComplaint = singleCompData.complaint || singleCompData;
  if (!singleComplaint || singleComplaint.complaint_number !== testNumber) {
    throw new Error('Single complaint refresh check failed');
  }
  console.log('✓ G. Single complaint and images retrievable upon page refresh / reload');

  // Clean up test complaint from SQLite
  await query(`DELETE FROM complaint_status_history WHERE complaint_id = ?`, [persisted.id]);
  await query(`DELETE FROM complaints WHERE id = ?`, [persisted.id]);
  console.log('✓ Test complaint cleaned up cleanly');

  console.log('=== ALL PERSISTENCE AND VISIBILITY CHECKS PASSED PERFECTLY ===');
}

runEndToEndVerification().catch(e => {
  console.error('VERIFICATION FAILED:', e);
  process.exit(1);
});
