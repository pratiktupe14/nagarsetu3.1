const BASE_URL = 'https://nagarsetu-backend-api.vercel.app';

async function runFullE2ETest() {
  console.log('================================================================');
  console.log('  NAGARSETU 3.1 — E2E PRODUCTION PERSISTENCE & LIFECYCLE TEST   ');
  console.log('================================================================\n');

  try {
    const uniqueNum = Date.now().toString().slice(-4);
    const testCitizenMobile = `9822${Date.now().toString().slice(-6)}`;
    const testCitizenEmail = `e2ecitizen${Date.now()}@gmail.com`;
    const testCitizenPassword = `TestPass@1234`;

    // 1. REGISTER NEW CITIZEN
    console.log(`1. Registering New Citizen (${testCitizenEmail} / ${testCitizenMobile})...`);
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `E2E Citizen ${uniqueNum}`,
        mobile: testCitizenMobile,
        email: testCitizenEmail,
        password: testCitizenPassword,
        role: 'citizen',
        language_pref: 'en'
      })
    });
    const regData = await regRes.json();
    console.log(`   Register HTTP ${regRes.status}:`, regData.message || regData.error);
    if (regRes.status !== 201) throw new Error(`Citizen registration failed: ${JSON.stringify(regData)}`);

    const citizenToken = regData.token;
    const citizenUserId = regData.user.id;
    console.log(`   Registered User ID: ${citizenUserId}`);

    // 2. LOGIN NEW CITIZEN
    console.log('\n2. Logging in New Citizen...');
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileOrEmail: testCitizenEmail, password: testCitizenPassword })
    });
    const loginData = await loginRes.json();
    console.log(`   Login HTTP ${loginRes.status}: User ID ${loginData.user.id}, Role ${loginData.user.role}`);
    if (loginRes.status !== 200) throw new Error('Citizen login failed');

    // 3. SUBMIT TEST COMPLAINT
    console.log('\n3. Submitting Test Complaint...');
    const complaintPayload = {
      title: `Pothole Danger Zone ${uniqueNum}`,
      category: 'Roads & Infrastructure',
      description: `E2E automated verification complaint test ${uniqueNum}`,
      priority: 'High',
      latitude: 20.005,
      longitude: 73.782,
      location_source: 'manual_pin',
      location_address: 'College Road, Nashik',
      photo_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800'
    };

    const subRes = await fetch(`${BASE_URL}/api/complaints/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${citizenToken}`
      },
      body: JSON.stringify(complaintPayload)
    });
    const subData = await subRes.json();
    console.log(`   Submit HTTP ${subRes.status}: Complaint ID ${subData.id || subData.complaint?.id}, Number ${subData.complaint_number || subData.complaint?.complaint_number}`);
    if (subRes.status !== 201 && subRes.status !== 200) throw new Error('Complaint submission failed');

    const complaintId = subData.id || subData.complaint?.id;
    const complaintNumber = subData.complaint_number || subData.complaint?.complaint_number;

    // 4. VERIFY CITIZEN CAN SEE COMPLAINT
    console.log('\n4. Verifying Citizen My Complaints Endpoint...');
    const myRes = await fetch(`${BASE_URL}/api/complaints/my`, {
      headers: { 'Authorization': `Bearer ${citizenToken}` }
    });
    const myData = await myRes.json();
    const myComplaints = Array.isArray(myData) ? myData : myData.complaints || [];
    const citizenHasComplaint = myComplaints.some(c => c.id == complaintId || c.complaint_number === complaintNumber);
    console.log(`   My Complaints HTTP ${myRes.status}: Citizen owns complaint: ${citizenHasComplaint} (Total: ${myComplaints.length})`);

    // 5. LOGIN ADMIN & VERIFY ADMIN SEES COMPLAINT
    console.log('\n5. Admin Verification...');
    const adminLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileOrEmail: 'admin@nagarsetu.gov.in', password: 'NagarSetu@Admin2026!' })
    });
    const adminLoginData = await adminLoginRes.json();
    const adminToken = adminLoginData.token;

    const adminCompRes = await fetch(`${BASE_URL}/api/complaints`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const adminCompData = await adminCompRes.json();
    const adminComplaints = Array.isArray(adminCompData) ? adminCompData : adminCompData.complaints || [];
    const adminHasComplaint = adminComplaints.some(c => c.id == complaintId || c.complaint_number === complaintNumber);
    console.log(`   Admin Complaints HTTP ${adminCompRes.status}: Admin sees complaint: ${adminHasComplaint} (Total: ${adminComplaints.length})`);

    // 6. LOGIN PWD DEPARTMENT HEAD (rahul.kumar@nagarsetu.gov.in) & SAN DEPT HEAD (amit.sharma@nagarsetu.gov.in) FOR ISOLATION
    console.log('\n6. Department Isolation Verification...');
    const pwdLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileOrEmail: 'rahul.kumar@nagarsetu.gov.in', password: 'nagarsetu@123' })
    });
    const pwdData = await pwdLoginRes.json();
    const pwdToken = pwdData.token;

    const pwdCompRes = await fetch(`${BASE_URL}/api/complaints`, {
      headers: { 'Authorization': `Bearer ${pwdToken}` }
    });
    const pwdCompData = await pwdCompRes.json();
    const pwdComplaints = Array.isArray(pwdCompData) ? pwdCompData : pwdCompData.complaints || [];
    const pwdHasComplaint = pwdComplaints.some(c => c.id == complaintId || c.complaint_number === complaintNumber);
    console.log(`   PWD Dept Head sees complaint: ${pwdHasComplaint}`);

    const sanLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileOrEmail: 'amit.sharma@nagarsetu.gov.in', password: 'nagarsetu@123' })
    });
    const sanData = await sanLoginRes.json();
    const sanToken = sanData.token;

    const sanCompRes = await fetch(`${BASE_URL}/api/complaints`, {
      headers: { 'Authorization': `Bearer ${sanToken}` }
    });
    const sanCompData = await sanCompRes.json();
    const sanComplaints = Array.isArray(sanCompData) ? sanCompData : sanCompData.complaints || [];
    const sanHasComplaint = sanComplaints.some(c => c.id == complaintId || c.complaint_number === complaintNumber);
    console.log(`   SAN Dept Head sees complaint (Should be FALSE): ${sanHasComplaint}`);

    // 7. ASSIGN FIELD STAFF (Ramesh Kumar - STF-001)
    console.log('\n7. Assigning Field Staff...');
    const assignRes = await fetch(`${BASE_URL}/api/department/assign`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${pwdToken}`
      },
      body: JSON.stringify({
        complaint_id: complaintId,
        staff_id: 'STF-001',
        staff_name: 'Ramesh Kumar',
        sla_hours: 24
      })
    });
    const assignData = await assignRes.json();
    console.log(`   Assign HTTP ${assignRes.status}:`, assignData.message || assignData.error);

    // 8. FIELD STAFF LOGIN & COMPLETE TASK WITH AFTER-PHOTO
    console.log('\n8. Field Staff Task Completion...');
    const staffLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileOrEmail: 'staff@nagarsetu.gov.in', password: 'password123' })
    });
    const staffLoginData = await staffLoginRes.json();
    const staffToken = staffLoginData.token;

    const completeRes = await fetch(`${BASE_URL}/api/staff/complaints/${complaintId}/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${staffToken}`
      },
      body: JSON.stringify({
        work_performed: 'Asphalt cold-mix patching completed',
        materials_used: 'Bitumen emulsion cold mix 50kg',
        photo_after_url: 'https://images.unsplash.com/photo-1584467735871-8e85353a8413?w=800'
      })
    });
    const completeData = await completeRes.json();
    console.log(`   Complete HTTP ${completeRes.status}:`, completeData.message || completeData.error);

    // 9. DEPARTMENT HEAD VERIFIES COMPLAINT
    console.log('\n9. Department Head Verification...');
    const verifyRes = await fetch(`${BASE_URL}/api/department/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${pwdToken}`
      },
      body: JSON.stringify({
        complaint_id: complaintId,
        action: 'approve',
        notes: 'Quality inspection verified. Asphalt patching satisfactory.'
      })
    });
    const verifyData = await verifyRes.json();
    console.log(`   Verify HTTP ${verifyRes.status}:`, verifyData.message || verifyData.error);

    // 10. CITIZEN RE-FETCHES COMPLAINT TO VERIFY RESOLVED STATUS
    console.log('\n10. Citizen Final Status Check...');
    const finalMyRes = await fetch(`${BASE_URL}/api/complaints/my`, {
      headers: { 'Authorization': `Bearer ${citizenToken}` }
    });
    const finalMyData = await finalMyRes.json();
    const finalMyList = Array.isArray(finalMyData) ? finalMyData : finalMyData.complaints || [];
    const targetComp = finalMyList.find(c => c.id == complaintId || c.complaint_number === complaintNumber);
    console.log(`    Final Complaint Status for Citizen: '${targetComp?.status}'`);

    const allPassed = citizenHasComplaint && adminHasComplaint && pwdHasComplaint && !sanHasComplaint && (targetComp?.status === 'Resolved' || targetComp?.status === 'Resolution Submitted' || targetComp?.status === 'Approved');

    console.log('\n================ E2E LIFECYCLE RESULT ================');
    console.log(`Complete End-to-End Complaint Lifecycle Passed: ${allPassed}`);
    console.log('======================================================');

    return allPassed;
  } catch (err) {
    console.error('E2E Test Error:', err);
    return false;
  }
}

runFullE2ETest();
