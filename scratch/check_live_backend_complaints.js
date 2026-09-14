

async function testLiveBackend() {
  console.log('=== CHECKING LIVE BACKEND & SUPABASE COMPLAINTS ===');

  // 1. Fetch public complaints from live Vercel backend API
  try {
    const res = await fetch('https://nagarsetu-backend-api.vercel.app/api/complaints');
    console.log('Live Vercel Backend /api/complaints HTTP status:', res.status);
    if (res.ok) {
      const data = await res.json();
      console.log('Live Vercel Backend complaints count:', (data.complaints || data || []).length);
    } else {
      const text = await res.text();
      console.log('Live Vercel Backend error response:', text);
    }
  } catch (e) {
    console.error('Fetch live backend error:', e.message);
  }

  // 2. Try scope=all on live backend
  try {
    const res = await fetch('https://nagarsetu-backend-api.vercel.app/api/complaints?scope=all');
    console.log('Live Vercel Backend /api/complaints?scope=all HTTP status:', res.status);
    if (res.ok) {
      const data = await res.json();
      console.log('Live Vercel Backend scope=all complaints count:', (data.complaints || data || []).length);
    }
  } catch (e) {
    console.error('Fetch live backend scope=all error:', e.message);
  }

  // 3. Login as admin on live backend
  try {
    const res = await fetch('https://nagarsetu-backend-api.vercel.app/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mobileOrEmail: 'admin@nagarsetu.gov.in', password: 'admin@123' })
    });
    console.log('Live Vercel Admin Login status:', res.status);
    if (res.ok) {
      const data = await res.json();
      console.log('Live Admin Login User Role:', data.user?.role);
      const token = data.token;

      // 4. Fetch complaints with Admin Token
      const adminCompRes = await fetch('https://nagarsetu-backend-api.vercel.app/api/complaints', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('Live Admin Token /api/complaints HTTP status:', adminCompRes.status);
      if (adminCompRes.ok) {
        const compData = await adminCompRes.json();
        console.log('Live Admin Token complaints count:', (compData.complaints || compData || []).length);
      }
    } else {
      console.log('Admin login failed:', await res.text());
    }
  } catch (e) {
    console.error('Admin login error:', e.message);
  }
}

testLiveBackend();
