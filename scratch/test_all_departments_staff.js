const app = require('../backend/src/app');
const { initDatabase } = require('../backend/src/config/db');
const jwt = require('../backend/node_modules/jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'nagarsetu_secret_key_2026_super_secure';

async function test() {
  await initDatabase();
  const server = app.listen(5009, async () => {
    try {
      const port = 5009;
      const depts = [
        { code: 'PWD', id: 1, name: 'Public Works' },
        { code: 'SAN', id: 2, name: 'Sanitation' },
        { code: 'WTR', id: 3, name: 'Water' },
        { code: 'DRN', id: 4, name: 'Drainage' },
        { code: 'ELE', id: 5, name: 'Electrical' },
        { code: 'TRF', id: 6, name: 'Traffic' },
        { code: 'MNT', id: 7, name: 'Maintenance' },
      ];

      for (const d of depts) {
        const token = jwt.sign(
          { id: 100 + d.id, name: `Head ${d.code}`, email: `head.${d.code.toLowerCase()}@nagarsetu.gov.in`, role: 'department_head', department_id: `DEPT-${d.id}` },
          JWT_SECRET, { expiresIn: '1h' }
        );

        const res = await fetch(`http://localhost:${port}/api/department/staff?status=active`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        console.log(`Dept Head ${d.code} (DEPT-${d.id}): Status ${res.status}, Staff Count: ${data.staff ? data.staff.length : 0}`);
        if (!data.staff || data.staff.length === 0) {
          console.error(`FAILED for ${d.code}`);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      server.close();
      process.exit(0);
    }
  });
}

test().catch(console.error);
