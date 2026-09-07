const BASE_URL = 'http://localhost:5000';

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = options.headers || {};
  if (options.body && typeof options.body === 'object') {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { json = text; }
  return { status: res.status, ok: res.ok, data: json };
}

async function testPayloadVariants() {
  console.log('Testing 4 Payload Types Against /api/complaints/submit:\n');

  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: { mobileOrEmail: '8788562103', password: '8788562103' }
  });
  const token = loginRes.data.token;

  // Payload A: Text Only
  const resA = await request('/api/complaints/submit', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      title: 'Variant A: Text-Only Street Light Failure',
      description: 'Street light out on 5th avenue',
      category: 'Streetlight',
      photo_url: '',
      latitude: 19.9980,
      longitude: 73.7905,
      location_address: '5th Avenue, Nashik'
    }
  });
  console.log(`Variant A (Text Only): Status ${resA.status}, OK=${resA.ok}, ID=${resA.data.complaint?.id}`);

  // Payload B: Image Only / Standard
  const resB = await request('/api/complaints/submit', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      title: 'Variant B: Image Garbage Heap',
      description: 'Overflowing dumpster',
      category: 'Garbage',
      photo_url: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18',
      latitude: 19.9980,
      longitude: 73.7905,
      location_address: 'Market Circle, Nashik'
    }
  });
  console.log(`Variant B (Image): Status ${resB.status}, OK=${resB.ok}, ID=${resB.data.complaint?.id}`);

  // Payload C: Image + GPS Precision Coords
  const resC = await request('/api/complaints/submit', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      title: 'Variant C: Image + High Precision GPS Water Leak',
      description: 'Burst main pipe on sidewalk',
      category: 'Water Leakage',
      photo_url: 'https://images.unsplash.com/photo-1584467735815-f778f274e296',
      latitude: 19.998234,
      longitude: 73.791567,
      location_source: 'live_gps',
      location_address: 'Pipeline Road, Nashik'
    }
  });
  console.log(`Variant C (Image + GPS): Status ${resC.status}, OK=${resC.ok}, ID=${resC.data.complaint?.id}`);

  // Payload D: Image + Voice Audio Transcript / Rich Description
  const resD = await request('/api/complaints/submit', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      title: 'Variant D: Image + Voice Description Drainage Overflow',
      description: 'Transcribed from voice note: Sewage water entering compound gate since this morning, foul smell and risk of contamination',
      category: 'Drainage',
      photo_url: 'https://images.unsplash.com/photo-1542601906990-b4d3fb778b09',
      latitude: 19.9985,
      longitude: 73.7920,
      location_source: 'live_gps',
      location_address: 'Sharanpur Road, Nashik'
    }
  });
  console.log(`Variant D (Image + Voice Description): Status ${resD.status}, OK=${resD.ok}, ID=${resD.data.complaint?.id}`);

  if (resA.ok && resB.ok && resC.ok && resD.ok) {
    console.log('\n✓ ALL 4 COMPLAINT PAYLOAD VARIANTS ACCEPTED AND PERSISTED IN DB!');
  } else {
    throw new Error('At least one payload variant failed!');
  }
}

testPayloadVariants().catch(e => {
  console.error(e);
  process.exit(1);
});
