async function checkBackendVersion() {
  console.log('Checking live backend / health response...');
  try {
    const res = await fetch('https://nagarsetu-backend-api.vercel.app/');
    const data = await res.json();
    console.log('Root Response:', data);

    const healthRes = await fetch('https://nagarsetu-backend-api.vercel.app/api/health');
    const healthData = await healthRes.json();
    console.log('Health Response:', healthData);
  } catch (e) {
    console.error('Fetch error:', e);
  }
}

checkBackendVersion();
