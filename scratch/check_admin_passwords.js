const BASE_URL = 'https://nagarsetu-backend-api.vercel.app';
const passwords = ['admin@123', 'admin123', 'admin@2026', 'Nagarsetu@2026', 'Admin@2026', 'admin@nagarsetu.gov.in'];

async function testAdminPass() {
  for (const pass of passwords) {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileOrEmail: 'admin@nagarsetu.gov.in', password: pass })
    });
    const data = await res.json();
    console.log(`Password '${pass}': HTTP ${res.status}`, res.ok ? `SUCCESS User=${data.user?.name}` : data.error || data.message);
    if (res.ok) break;
  }
}

testAdminPass();
