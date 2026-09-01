const path = require('path');
const express = require(path.join(__dirname, '../backend/node_modules/express'));
const { initDatabase, query } = require(path.join(__dirname, '../backend/src/config/db'));
const authRoutes = require(path.join(__dirname, '../backend/src/routes/auth.routes'));
const complaintRoutes = require(path.join(__dirname, '../backend/src/routes/complaint.routes'));

async function testIsolation() {
  await initDatabase();

  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);
  app.use('/api/complaints', complaintRoutes);

  const server = app.listen(5088, async () => {
    console.log('Testing Citizen Complaint Isolation Server on port 5088...');

    try {
      // 1. Login Citizen A (8788562103)
      const resCitA = await fetch('http://localhost:5088/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileOrEmail: '8788562103', password: '8788562103' })
      });
      const dataCitA = await resCitA.json();
      const tokenA = dataCitA.token;
      const userAId = dataCitA.user.id;
      console.log(`\nCitizen A logged in. DB User ID: ${userAId}`);

      // 2. Register / Login Citizen B (9876543299)
      let tokenB, userBId;
      const regCitB = await fetch('http://localhost:5088/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Citizen B', mobile: '9876543299', email: 'citizenB@nagarsetu.gov.in', password: 'password123', role: 'citizen' })
      });
      const dataRegB = await regCitB.json();
      if (regCitB.ok && dataRegB.user) {
        tokenB = dataRegB.token;
        userBId = dataRegB.user.id;
      } else {
        const loginCitB = await fetch('http://localhost:5088/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mobileOrEmail: '9876543299', password: 'password123' })
        });
        const dataLoginB = await loginCitB.json();
        tokenB = dataLoginB.token;
        userBId = dataLoginB.user.id;
      }
      console.log(`Citizen B ready. DB User ID: ${userBId}`);

      // 3. Login Municipal Admin
      const resAdmin = await fetch('http://localhost:5088/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobileOrEmail: 'admin@nagarsetu.gov.in', password: 'NagarSetu@Admin2026!' })
      });
      const dataAdmin = await resAdmin.json();
      const tokenAdmin = dataAdmin.token;
      console.log(`Admin logged in. Role: ${dataAdmin.user.role}`);

      // 4. Citizen A submits Complaint A
      const resCompA = await fetch('http://localhost:5088/api/complaints/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenA}` },
        body: JSON.stringify({
          title: 'Complaint A - Pothole on Main Road',
          category: 'Roads & Footpaths',
          photo_url: 'https://images.unsplash.com/photo-pothole.jpg',
          description: 'Pothole near sector 4',
          priority: 'High',
          latitude: 18.5204,
          longitude: 73.8567
        })
      });
      const dataCompA = await resCompA.json();
      console.log(`\nCitizen A submitted Complaint A (ID: ${dataCompA.complaint_id})`);

      // 5. Citizen B submits Complaint B
      const resCompB = await fetch('http://localhost:5088/api/complaints/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${tokenB}` },
        body: JSON.stringify({
          title: 'Complaint B - Water Supply Leakage',
          category: 'Water Supply & Pipelines',
          photo_url: 'https://images.unsplash.com/photo-water-leak.jpg',
          description: 'Water leak near street 9',
          priority: 'Medium',
          latitude: 18.5304,
          longitude: 73.8667
        })
      });
      const dataCompB = await resCompB.json();
      console.log(`Citizen B submitted Complaint B (ID: ${dataCompB.complaint_id})`);

      // 6. Citizen A calls GET /api/complaints/my
      const resMyA = await fetch('http://localhost:5088/api/complaints/my', {
        headers: { 'Authorization': `Bearer ${tokenA}` }
      });
      const dataMyA = await resMyA.json();
      console.log(`\n--- Citizen A My Complaints (${dataMyA.complaints.length} found) ---`);
      dataMyA.complaints.forEach(c => console.log(`  - [ID ${c.id}] ${c.title} (citizen_id: ${c.citizen_id})`));

      // 7. Citizen B calls GET /api/complaints/my
      const resMyB = await fetch('http://localhost:5088/api/complaints/my', {
        headers: { 'Authorization': `Bearer ${tokenB}` }
      });
      const dataMyB = await resMyB.json();
      console.log(`\n--- Citizen B My Complaints (${dataMyB.complaints.length} found) ---`);
      dataMyB.complaints.forEach(c => console.log(`  - [ID ${c.id}] ${c.title} (citizen_id: ${c.citizen_id})`));

      // 8. Admin calls GET /api/complaints
      const resAllAdmin = await fetch('http://localhost:5088/api/complaints', {
        headers: { 'Authorization': `Bearer ${tokenAdmin}` }
      });
      const dataAllAdmin = await resAllAdmin.json();
      console.log(`\n--- Admin All Complaints (${dataAllAdmin.complaints.length} found) ---`);
      dataAllAdmin.complaints.forEach(c => console.log(`  - [ID ${c.id}] ${c.title} (citizen_id: ${c.citizen_id})`));

      // 9. IDOR Test: Citizen A tries to view Complaint B via GET /api/complaints/:id
      const resIdor = await fetch(`http://localhost:5088/api/complaints/${dataCompB.complaint_id}`, {
        headers: { 'Authorization': `Bearer ${tokenA}` }
      });
      console.log(`\n--- IDOR GUARD TEST (Citizen A requesting Complaint B) ---`);
      console.log(`HTTP Status: ${resIdor.status} (Expected 403)`);

      // Assertions
      const citizenAOnlyHasA = dataMyA.complaints.length > 0 && dataMyA.complaints.every(c => String(c.citizen_id) === String(userAId));
      const citizenBOnlyHasB = dataMyB.complaints.length > 0 && dataMyB.complaints.every(c => String(c.citizen_id) === String(userBId));
      const adminHasBoth = dataAllAdmin.complaints.some(c => String(c.id) === String(dataCompA.complaint_id)) &&
                           dataAllAdmin.complaints.some(c => String(c.id) === String(dataCompB.complaint_id));

      console.log('\n================ VERIFICATION SUMMARY ================');
      console.log('Citizen A sees ONLY Complaint A:', citizenAOnlyHasA);
      console.log('Citizen B sees ONLY Complaint B:', citizenBOnlyHasB);
      console.log('Admin sees BOTH Complaints:', adminHasBoth);
      console.log('IDOR Attack Blocked (403):', resIdor.status === 403);
      console.log('======================================================');

      server.close();
      process.exit(0);
    } catch (err) {
      console.error('Test Error:', err);
      server.close();
      process.exit(1);
    }
  });
}

testIsolation();
