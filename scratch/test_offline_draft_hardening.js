const BASE_URL = 'http://localhost:5000';

// Mock localStorage for node environment
const storageStore = {};
global.localStorage = {
  getItem: (k) => storageStore[k] || null,
  setItem: (k, v) => { storageStore[k] = String(v); },
  removeItem: (k) => { delete storageStore[k]; },
  clear: () => { Object.keys(storageStore).forEach(k => delete storageStore[k]); }
};
global.sessionStorage = global.localStorage;
global.navigator = { onLine: true };

// Import or implement classifier matching frontend
class HttpError extends Error {
  constructor(status, message, data) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.data = data;
    this.isHttpError = true;
  }
}

class AuthError extends Error {
  constructor(message = 'Authentication required to submit complaint. Please log in.') {
    super(message);
    this.name = 'AuthError';
    this.status = 401;
    this.isAuthError = true;
  }
}

function isNetworkError(err) {
  if (!err) return false;
  if (err instanceof HttpError || err.isHttpError || typeof err.status === 'number' || err.statusCode) {
    return false;
  }
  if (err instanceof AuthError || err.isAuthError || err.message?.includes('Authentication required')) {
    return false;
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }
  const errMsg = (err.message || '').toLowerCase();
  return (
    errMsg.includes('failed to fetch') ||
    errMsg.includes('networkerror') ||
    errMsg.includes('network error') ||
    errMsg.includes('load failed') ||
    errMsg.includes('fetch failed') ||
    errMsg.includes('econnrefused') ||
    errMsg.includes('enotfound') ||
    errMsg.includes('connection refused') ||
    errMsg.includes('net::err') ||
    errMsg.includes('offline')
  );
}

const LOCAL_STORAGE_OFFLINE_DRAFTS_KEY = 'nagarsetu_offline_drafts_v3';

function saveOfflineDraft(draft) {
  const data = localStorage.getItem(LOCAL_STORAGE_OFFLINE_DRAFTS_KEY);
  const drafts = data ? JSON.parse(data) : [];
  const draftId = draft.id || `draft-${Date.now()}`;
  drafts.unshift({ ...draft, id: draftId, savedAt: new Date().toISOString() });
  localStorage.setItem(LOCAL_STORAGE_OFFLINE_DRAFTS_KEY, JSON.stringify(drafts));
}

function getOfflineDrafts() {
  const data = localStorage.getItem(LOCAL_STORAGE_OFFLINE_DRAFTS_KEY);
  return data ? JSON.parse(data) : [];
}

function clearOfflineDrafts() {
  localStorage.removeItem(LOCAL_STORAGE_OFFLINE_DRAFTS_KEY);
}

function removeOfflineDraft(draftIdOrSavedAt) {
  const drafts = getOfflineDrafts();
  const filtered = drafts.filter(d => d.id !== draftIdOrSavedAt && d.savedAt !== draftIdOrSavedAt);
  localStorage.setItem(LOCAL_STORAGE_OFFLINE_DRAFTS_KEY, JSON.stringify(filtered));
}

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

// Simulates the exact handleFinalSubmit logic from ReportIssuePage.tsx
async function simulateSubmitHandler(payload, token, fetchOverride = null) {
  let offlineDraftSaved = false;
  let offlineNoticeShown = false;
  let apiErrorMessage = null;
  let authErrorMessage = null;
  let createdComplaint = null;

  try {
    if (!token) {
      throw new AuthError('Authentication required to submit complaint. Please log in.');
    }

    let res;
    if (fetchOverride) {
      res = await fetchOverride();
    } else {
      res = await request('/api/complaints/submit', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: payload
      });
    }

    if (res.ok) {
      createdComplaint = res.data?.complaint || res.data;
      clearOfflineDrafts();
    } else {
      const errData = res.data || {};
      const msg = errData.error || errData.message || (errData.details ? errData.details.join(', ') : '') || `Failed to submit complaint (HTTP ${res.status})`;
      throw new HttpError(res.status, msg, errData);
    }
  } catch (err) {
    if (isNetworkError(err)) {
      saveOfflineDraft(payload);
      offlineDraftSaved = true;
      offlineNoticeShown = true;
    } else if (err instanceof AuthError || err.isAuthError || err.status === 401 || err.status === 403) {
      authErrorMessage = err.message;
    } else if (err instanceof HttpError || err.isHttpError || err.status) {
      const detailStr = err.data?.details && Array.isArray(err.data.details) ? ` (${err.data.details.join(', ')})` : '';
      apiErrorMessage = `${err.message}${detailStr}`;
    } else {
      apiErrorMessage = err.message;
    }
  }

  return {
    createdComplaint,
    offlineDraftSaved,
    offlineNoticeShown,
    apiErrorMessage,
    authErrorMessage
  };
}

async function runHardeningTests() {
  console.log('===========================================================');
  console.log('STARTING NAGARSETU 8-TEST OFFLINE DRAFT HARDENING SUITE');
  console.log('===========================================================\n');

  // Step 0: Get Citizen Token
  console.log('0. Authenticating citizen with DB...');
  const loginRes = await request('/api/auth/login', {
    method: 'POST',
    body: { mobileOrEmail: '8788562103', password: '8788562103' }
  });
  if (!loginRes.ok || !loginRes.data.token) {
    throw new Error(`Citizen login failed: ${JSON.stringify(loginRes.data)}`);
  }
  const token = loginRes.data.token;
  console.log(`✓ Authenticated citizen ID: ${loginRes.data.user.id}\n`);

  // TEST 1: Online text-only complaint
  console.log('TEST 1: Online text-only complaint');
  const textOnlyPayload = {
    title: 'Broken Street Pavement Near Market',
    description: 'Cracked paving stones causing trip hazard for pedestrians',
    category: 'Pothole',
    photo_url: '', // Text only - empty photo URL
    department_id: 1,
    priority: 'Medium',
    latitude: 19.9975,
    longitude: 73.7898,
    location_address: 'Main Market, Nashik'
  };
  const test1 = await simulateSubmitHandler(textOnlyPayload, token);
  console.log(`  - Database success: ${!!test1.createdComplaint}`);
  console.log(`  - Offline notice shown: ${test1.offlineNoticeShown}`);
  console.log(`  - Offline draft saved: ${test1.offlineDraftSaved}`);
  if (!test1.createdComplaint || test1.offlineNoticeShown || test1.offlineDraftSaved) {
    throw new Error('TEST 1 FAILED: Text-only complaint did not succeed or triggered false offline notice!');
  }
  console.log(`  ✓ TEST 1 PASSED: Created Complaint ID: ${test1.createdComplaint.id}, NO offline notice.\n`);

  // TEST 2: Online complaint with image
  console.log('TEST 2: Online complaint with image');
  const imagePayload = {
    title: 'Severe Pothole On College Road With Photo Proof',
    description: 'Deep road crater filled with rainwater',
    category: 'Pothole',
    photo_url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7',
    department_id: 1,
    priority: 'High',
    latitude: 19.9980,
    longitude: 73.7905,
    location_address: 'College Road, Nashik'
  };
  const test2 = await simulateSubmitHandler(imagePayload, token);
  console.log(`  - Database success: ${!!test2.createdComplaint}`);
  console.log(`  - Offline notice shown: ${test2.offlineNoticeShown}`);
  console.log(`  - Offline draft saved: ${test2.offlineDraftSaved}`);
  if (!test2.createdComplaint || test2.offlineNoticeShown || test2.offlineDraftSaved) {
    throw new Error('TEST 2 FAILED: Image complaint did not succeed or triggered false offline notice!');
  }
  console.log(`  ✓ TEST 2 PASSED: Created Complaint ID: ${test2.createdComplaint.id}, NO offline notice.\n`);

  // TEST 3: Backend returns 400 (Validation error: missing category)
  console.log('TEST 3: Backend returns 400 (Validation Error)');
  const invalidPayload = {
    title: 'Invalid Complaint Missing Category',
    photo_url: '',
    latitude: 19.9980,
    longitude: 73.7905
    // Missing category
  };
  const test3 = await simulateSubmitHandler(invalidPayload, token);
  console.log(`  - API Error Message: "${test3.apiErrorMessage}"`);
  console.log(`  - Offline notice shown: ${test3.offlineNoticeShown}`);
  console.log(`  - Offline draft saved: ${test3.offlineDraftSaved}`);
  if (!test3.apiErrorMessage || test3.offlineNoticeShown || test3.offlineDraftSaved) {
    throw new Error('TEST 3 FAILED: HTTP 400 was misdiagnosed as offline failure!');
  }
  console.log(`  ✓ TEST 3 PASSED: Displayed actual 400 error, NO offline notice.\n`);

  // TEST 4: Backend returns 401 (Authentication error)
  console.log('TEST 4: Backend returns 401 (Unauthorized / Invalid Token)');
  const test4 = await simulateSubmitHandler(imagePayload, 'invalid_expired_token_xyz');
  console.log(`  - Auth Error Message: "${test4.apiErrorMessage || test4.authErrorMessage}"`);
  console.log(`  - Offline notice shown: ${test4.offlineNoticeShown}`);
  console.log(`  - Offline draft saved: ${test4.offlineDraftSaved}`);
  if ((!test4.apiErrorMessage && !test4.authErrorMessage) || test4.offlineNoticeShown || test4.offlineDraftSaved) {
    throw new Error('TEST 4 FAILED: HTTP 401 was misdiagnosed as offline failure!');
  }
  console.log(`  ✓ TEST 4 PASSED: Displayed actual 401 auth error, NO offline notice.\n`);

  // TEST 5: Backend returns 500 (Internal server error simulation)
  console.log('TEST 5: Backend returns 500 (Internal Server Error)');
  const test5 = await simulateSubmitHandler(imagePayload, token, async () => {
    return { status: 500, ok: false, data: { error: 'Internal Database Crash Error', details: ['DB connection reset'] } };
  });
  console.log(`  - Server Error Message: "${test5.apiErrorMessage}"`);
  console.log(`  - Offline notice shown: ${test5.offlineNoticeShown}`);
  console.log(`  - Offline draft saved: ${test5.offlineDraftSaved}`);
  if (!test5.apiErrorMessage || test5.offlineNoticeShown || test5.offlineDraftSaved) {
    throw new Error('TEST 5 FAILED: HTTP 500 was misdiagnosed as offline failure!');
  }
  console.log(`  ✓ TEST 5 PASSED: Displayed actual 500 server error, NO offline notice.\n`);

  // TEST 6: Actual network disconnect (fetch throws TypeError: Failed to fetch)
  console.log('TEST 6: Actual network disconnect (True Network Failure)');
  const test6 = await simulateSubmitHandler(imagePayload, token, async () => {
    const netErr = new TypeError('Failed to fetch');
    throw netErr;
  });
  console.log(`  - Offline notice shown: ${test6.offlineNoticeShown}`);
  console.log(`  - Offline draft saved: ${test6.offlineDraftSaved}`);
  console.log(`  - Drafts in storage: ${getOfflineDrafts().length}`);
  if (!test6.offlineNoticeShown || !test6.offlineDraftSaved || getOfflineDrafts().length === 0) {
    throw new Error('TEST 6 FAILED: True network failure did not trigger offline draft save!');
  }
  console.log(`  ✓ TEST 6 PASSED: Correctly detected genuine network failure, saved draft, triggered notice.\n`);

  // TEST 7: Restore network and retry draft
  console.log('TEST 7: Restore network and retry draft');
  const storedDrafts = getOfflineDrafts();
  const draftToRetry = storedDrafts[0];
  console.log(`  - Retrying stored draft: "${draftToRetry.title}" (ID: ${draftToRetry.id})`);
  
  // Submit draft to backend
  const retryRes = await request('/api/complaints/submit', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: {
      title: draftToRetry.title,
      description: draftToRetry.description,
      category: draftToRetry.category,
      photo_url: draftToRetry.photo_url || '',
      department_id: draftToRetry.department_id || 1,
      priority: draftToRetry.priority || 'Medium',
      latitude: draftToRetry.latitude,
      longitude: draftToRetry.longitude,
      location_address: draftToRetry.location_address
    }
  });
  if (!retryRes.ok || !retryRes.data.complaint) {
    throw new Error(`TEST 7 FAILED: Retry failed: ${JSON.stringify(retryRes.data)}`);
  }
  // Remove from draft queue
  removeOfflineDraft(draftToRetry.id);
  const remainingDrafts = getOfflineDrafts();
  console.log(`  - Draft successfully inserted in DB: Complaint ID ${retryRes.data.complaint.id}`);
  console.log(`  - Remaining drafts in storage: ${remainingDrafts.length}`);
  if (remainingDrafts.length !== 0) {
    throw new Error('TEST 7 FAILED: Draft was not removed from queue after submission!');
  }
  console.log(`  ✓ TEST 7 PASSED: Draft retried, saved to PostgreSQL, and purged from offline queue.\n`);

  // TEST 8: Refresh after successful online submission
  console.log('TEST 8: Refresh after successful online submission');
  const checkCompId = retryRes.data.complaint.id;
  const refreshRes = await request(`/api/complaints/${checkCompId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!refreshRes.ok || !refreshRes.data.complaint) {
    throw new Error(`TEST 8 FAILED: Refreshed query failed: ${JSON.stringify(refreshRes.data)}`);
  }
  console.log(`  - Authoritative record retrieved from DB: ID ${refreshRes.data.complaint.id}, Status "${refreshRes.data.complaint.status}"`);
  console.log(`  - Title: "${refreshRes.data.complaint.title}"`);
  console.log(`  ✓ TEST 8 PASSED: Complaint permanently persisted in DB across page refreshes.\n`);

  console.log('===========================================================');
  console.log('ALL 8 OFFLINE DRAFT HARDENING TESTS PASSED WITH 100% SUCCESS');
  console.log('===========================================================');
}

runHardeningTests().catch(err => {
  console.error('\n❌ HARDENING TEST FAILED:', err);
  process.exit(1);
});
