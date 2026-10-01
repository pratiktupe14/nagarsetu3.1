const test = require('node:test');
const assert = require('node:assert');

// In-memory offline draft store simulating IndexedDB storage
class MockOfflineDraftStore {
  constructor() {
    this.drafts = new Map();
    this.apiCalls = [];
  }

  async saveDraft(draft) {
    if (!draft.draft_id) {
      draft.draft_id = `draft_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    }
    draft.updated_at = new Date().toISOString();
    draft.draft_status = 'local_draft';
    this.drafts.set(draft.draft_id, JSON.parse(JSON.stringify(draft)));
    return draft.draft_id;
  }

  async getDraft(draftId) {
    return this.drafts.get(draftId) || null;
  }

  async getDrafts(citizenId) {
    const list = Array.from(this.drafts.values());
    if (citizenId) {
      return list.filter(d => !d.citizen_id || d.citizen_id === citizenId);
    }
    return list;
  }

  async updateDraft(draftId, updates) {
    const existing = await this.getDraft(draftId);
    if (!existing) throw new Error(`Draft ${draftId} not found`);
    const merged = {
      ...existing,
      ...updates,
      draft_id: draftId,
      // Strictly preserve original coordinates
      latitude: updates.latitude !== undefined ? updates.latitude : existing.latitude,
      longitude: updates.longitude !== undefined ? updates.longitude : existing.longitude,
      exif_gps: existing.exif_gps || updates.exif_gps,
      updated_at: new Date().toISOString()
    };
    this.drafts.set(draftId, merged);
  }

  async deleteDraft(draftId) {
    this.drafts.delete(draftId);
  }

  // Simulated backend submission handler
  async submitComplaintAPI(payload, isOnline = true, simulateStatus = 201) {
    if (!isOnline) {
      const err = new Error('No internet connection. Submission blocked.');
      err.status = 0;
      throw err;
    }
    this.apiCalls.push(payload);
    if (simulateStatus === 409) {
      const err = new Error('ISSUE_ALREADY_REPORTED_BY_CITIZEN');
      err.status = 409;
      err.data = { error: 'ISSUE_ALREADY_REPORTED_BY_CITIZEN' };
      throw err;
    }
    if (simulateStatus >= 400) {
      const err = new Error('Server error');
      err.status = simulateStatus;
      throw err;
    }
    return {
      id: `comp_${Date.now()}`,
      complaint_number: `NS-${Date.now()}`,
      status: 'Submitted'
    };
  }
}

// TEST 1: offline + photo + details -> Save Draft succeeds without API call
test('TEST 1: offline + photo + details -> Save Draft succeeds without API call', async () => {
  const store = new MockOfflineDraftStore();
  const draftData = {
    citizen_id: 'cit-101',
    title: 'Severe road pothole near Sector 4',
    description: 'Crater in middle lane damaging two-wheelers',
    category: 'Road Damage / Pothole',
    latitude: 20.0059,
    longitude: 73.7898,
    location_source: 'exif',
    images: [{
      angle: 'front',
      name: 'front-view.jpg',
      type: 'image/jpeg',
      size: 4096,
      blob: 'BINARY_BLOB_IMAGE_DATA'
    }]
  };

  const draftId = await store.saveDraft(draftData);
  assert.ok(draftId, 'Draft ID must be returned');
  assert.strictEqual(store.apiCalls.length, 0, 'No API call should be made when saving offline draft');
  assert.strictEqual(store.drafts.size, 1);
});

// TEST 2: page reload -> original photos/details restore
test('TEST 2: page reload -> original photos/details restore', async () => {
  const store = new MockOfflineDraftStore();
  const draftId = await store.saveDraft({
    draft_id: 'draft-test-2',
    citizen_id: 'cit-101',
    title: 'Broken streetlight',
    description: 'Lamp hanging dangerously',
    category: 'Streetlight / Electrical',
    latitude: 20.0100,
    longitude: 73.7900,
    images: [
      { angle: 'front', name: 'front.jpg', blob: 'FRONT_BLOB', type: 'image/jpeg', size: 1024 },
      { angle: 'left', name: 'left.jpg', blob: 'LEFT_BLOB', type: 'image/jpeg', size: 1024 }
    ]
  });

  // Simulate page reload by querying storage from scratch
  const restored = await store.getDraft(draftId);
  assert.ok(restored, 'Draft must be retrieved');
  assert.strictEqual(restored.title, 'Broken streetlight');
  assert.strictEqual(restored.images.length, 2);
  assert.strictEqual(restored.images[0].blob, 'FRONT_BLOB');
});

// TEST 3: draft retains original GPS coordinates
test('TEST 3: draft retains original GPS coordinates', async () => {
  const store = new MockOfflineDraftStore();
  const originalLat = 20.005912;
  const originalLng = 73.789845;

  const draftId = await store.saveDraft({
    draft_id: 'draft-gps-1',
    latitude: originalLat,
    longitude: originalLng,
    location_source: 'exif_gps',
    exif_gps: { latitude: originalLat, longitude: originalLng, altitude: 580 }
  });

  const saved = await store.getDraft(draftId);
  assert.strictEqual(saved.latitude, originalLat);
  assert.strictEqual(saved.longitude, originalLng);
  assert.strictEqual(saved.location_source, 'exif_gps');
  assert.strictEqual(saved.exif_gps.altitude, 580);
});

// TEST 4: citizen changes physical location before submission -> original issue-site coordinates are sent
test('TEST 4: citizen changes physical location before submission -> original issue-site coordinates are sent', async () => {
  const store = new MockOfflineDraftStore();
  const ISSUE_SITE_LAT = 20.005900;
  const ISSUE_SITE_LNG = 73.789800;
  const HOME_LOCATION_LAT = 20.050000; // 5km away
  const HOME_LOCATION_LNG = 73.820000;

  const draftId = await store.saveDraft({
    draft_id: 'draft-site-4',
    latitude: ISSUE_SITE_LAT,
    longitude: ISSUE_SITE_LNG,
    location_source: 'device_gps',
    title: 'Water pipe burst'
  });

  // Citizen arrives home (HOME_LOCATION). Submission must load the draft and use original site coordinates!
  const draftToSubmit = await store.getDraft(draftId);

  // Background GPS check might return HOME_LOCATION, but submission must strictly use draft's saved issue-site coordinates
  const submissionCoords = {
    latitude: draftToSubmit.latitude,
    longitude: draftToSubmit.longitude
  };

  assert.strictEqual(submissionCoords.latitude, ISSUE_SITE_LAT);
  assert.strictEqual(submissionCoords.longitude, ISSUE_SITE_LNG);
  assert.notStrictEqual(submissionCoords.latitude, HOME_LOCATION_LAT);
});

// TEST 5: network returns -> notification shown -> NO API call automatically
test('TEST 5: network returns -> notification shown -> NO API call automatically', async () => {
  const store = new MockOfflineDraftStore();
  await store.saveDraft({ draft_id: 'draft-5', title: 'Garbage pile' });

  // Simulate network restoration event
  const isOnline = true;
  const drafts = await store.getDrafts();
  let notificationMessage = null;

  if (isOnline && drafts.length > 0) {
    notificationMessage = `You're back online. You have ${drafts.length} saved complaint ready to submit.`;
    // MANDATORY RULE: No automatic API call
  }

  assert.strictEqual(notificationMessage, "You're back online. You have 1 saved complaint ready to submit.");
  assert.strictEqual(store.apiCalls.length, 0, 'No automatic API calls on network restoration');
});

// TEST 6: citizen does nothing after network returns -> draft remains untouched
test('TEST 6: citizen does nothing after network returns -> draft remains untouched', async () => {
  const store = new MockOfflineDraftStore();
  await store.saveDraft({ draft_id: 'draft-6', title: 'Open drain', draft_status: 'local_draft' });

  // Network returns, citizen does nothing
  const untouchedDraft = await store.getDraft('draft-6');
  assert.ok(untouchedDraft);
  assert.strictEqual(untouchedDraft.draft_status, 'local_draft');
  assert.strictEqual(store.drafts.size, 1);
  assert.strictEqual(store.apiCalls.length, 0);
});

// TEST 7: citizen manually presses Submit while online -> original complaint data uploaded
test('TEST 7: citizen manually presses Submit while online -> original complaint data uploaded', async () => {
  const store = new MockOfflineDraftStore();
  await store.saveDraft({
    draft_id: 'draft-7',
    title: 'Manhole cover displaced',
    latitude: 20.0070,
    longitude: 73.7880,
    images: [{ angle: 'front', name: 'manhole.jpg', blob: 'BLOB_DATA' }]
  });

  const draft = await store.getDraft('draft-7');
  const res = await store.submitComplaintAPI(draft, true, 201);

  assert.ok(res.id);
  assert.strictEqual(store.apiCalls.length, 1);
  assert.strictEqual(store.apiCalls[0].latitude, 20.0070);
  assert.strictEqual(store.apiCalls[0].title, 'Manhole cover displaced');
});

// TEST 8: manual submit while offline -> blocked -> draft retained
test('TEST 8: manual submit while offline -> blocked -> draft retained', async () => {
  const store = new MockOfflineDraftStore();
  await store.saveDraft({ draft_id: 'draft-8', title: 'Pothole' });

  let blocked = false;
  try {
    const draft = await store.getDraft('draft-8');
    await store.submitComplaintAPI(draft, false); // Offline
  } catch (err) {
    blocked = true;
  }

  assert.strictEqual(blocked, true, 'Submission must be blocked while offline');
  assert.ok(await store.getDraft('draft-8'), 'Draft must be retained in storage');
  assert.strictEqual(store.apiCalls.length, 0);
});

// TEST 9: successful backend response -> draft deleted
test('TEST 9: successful backend response -> draft deleted', async () => {
  const store = new MockOfflineDraftStore();
  await store.saveDraft({ draft_id: 'draft-9', title: 'Pothole' });

  const draft = await store.getDraft('draft-9');
  const res = await store.submitComplaintAPI(draft, true, 201);
  assert.ok(res.id);

  // Upon confirmed backend success, delete draft
  await store.deleteDraft('draft-9');
  assert.strictEqual(await store.getDraft('draft-9'), null);
});

// TEST 10: backend failure / 409 duplicate -> draft retained
test('TEST 10: backend failure / 409 duplicate -> draft retained', async () => {
  const store = new MockOfflineDraftStore();
  await store.saveDraft({ draft_id: 'draft-10', title: 'Duplicate issue' });

  let duplicateBlocked = false;
  try {
    const draft = await store.getDraft('draft-10');
    await store.submitComplaintAPI(draft, true, 409);
  } catch (err) {
    duplicateBlocked = true;
    assert.strictEqual(err.status, 409);
  }

  assert.strictEqual(duplicateBlocked, true);
  // Draft MUST be retained on failure or 409 duplicate
  const retained = await store.getDraft('draft-10');
  assert.ok(retained, 'Draft must be kept when backend returns duplicate or failure');
});

// TEST 11: editing/resaving existing draft -> updates same draft_id
test('TEST 11: editing/resaving existing draft -> updates same draft_id', async () => {
  const store = new MockOfflineDraftStore();
  const draftId = await store.saveDraft({
    draft_id: 'draft-11',
    title: 'Initial Title',
    description: 'Initial Description'
  });

  assert.strictEqual(store.drafts.size, 1);

  // Edit and resave
  await store.updateDraft(draftId, {
    title: 'Updated Title',
    description: 'Updated Description'
  });

  assert.strictEqual(store.drafts.size, 1, 'Should not create duplicate draft entries');
  const updated = await store.getDraft(draftId);
  assert.strictEqual(updated.title, 'Updated Title');
  assert.strictEqual(updated.description, 'Updated Description');
});
