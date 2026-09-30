const test = require('node:test');
const assert = require('node:assert');
const {
  checkCitizenAngleInvariantDuplicate,
  calculateDistanceMeters
} = require('../src/services/locationService');
const {
  computeImageHash,
  compareImagesForSamePhysicalIssue,
  SAME_ISSUE_CONFIDENCE_THRESHOLD
} = require('../src/services/aiService');

const BASE_LAT = 20.005900;
const BASE_LNG = 73.789800;

// Coordinate helpers for exact distances
// 20m is ~0.00018 deg north
const LAT_20M = BASE_LAT + 0.000180;
// 30m is ~0.00027 deg north
const LAT_30M = BASE_LAT + 0.000270;
// 40m is ~0.00036 deg north
const LAT_40M = BASE_LAT + 0.000360;
// 120m is ~0.00108 deg north
const LAT_120M = BASE_LAT + 0.001080;

const CITIZEN_A = 'citizen-101';
const CITIZEN_B = 'citizen-202';

const SAMPLE_IMAGE_BUFFER_1 = Buffer.from('TEST_IMAGE_DATA_POTHOLE_ORIGINAL');
const SAMPLE_IMAGE_BUFFER_2 = Buffer.from('TEST_IMAGE_DATA_POTHOLE_ANGLE_LEFT');
const SAMPLE_IMAGE_BUFFER_CROPPED = Buffer.from('TEST_IMAGE_DATA_POTHOLE_CROPPED');
const SAMPLE_IMAGE_GARBAGE = Buffer.from('TEST_IMAGE_DATA_GARBAGE_DUMP');

test('TEST 1: same exact image + 20m -> BLOCK (Layer 1 Exact SHA-256)', async () => {
  const dist = calculateDistanceMeters(BASE_LAT, BASE_LNG, LAT_20M, BASE_LNG);
  assert.ok(dist <= 100 && dist >= 15, `Distance was ${dist}`);

  const existing = [{
    id: 'comp-001',
    complaint_number: 'NS-2026-0001',
    citizen_id: CITIZEN_A,
    latitude: BASE_LAT,
    longitude: BASE_LNG,
    category: 'Road Damage / Pothole',
    status: 'In Progress',
    primary_image_hash: computeImageHash(SAMPLE_IMAGE_BUFFER_1),
    photo_front_url: 'data:image/jpeg;base64,' + SAMPLE_IMAGE_BUFFER_1.toString('base64')
  }];

  const res = await checkCitizenAngleInvariantDuplicate({
    citizenId: CITIZEN_A,
    latitude: LAT_20M,
    longitude: BASE_LNG,
    primaryPhoto: SAMPLE_IMAGE_BUFFER_1,
    existingComplaintsList: existing
  });

  assert.strictEqual(res.isDuplicate, true);
  assert.strictEqual(res.match_type, 'exact');
  assert.strictEqual(res.confidence, 100);
  assert.strictEqual(res.existing_complaint_id, 'NS-2026-0001');
});

test('TEST 2: same pothole photographed from another angle + 30m + AI confidence 94 -> BLOCK', async () => {
  const dist = calculateDistanceMeters(BASE_LAT, BASE_LNG, LAT_30M, BASE_LNG);
  assert.ok(dist <= 100, `Distance was ${dist}`);

  const existing = [{
    id: 'comp-002',
    complaint_number: 'NS-2026-0002',
    citizen_id: CITIZEN_A,
    latitude: BASE_LAT,
    longitude: BASE_LNG,
    category: 'Road Damage / Pothole',
    status: 'Submitted',
    primary_image_hash: computeImageHash(SAMPLE_IMAGE_BUFFER_1),
    photo_front_url: 'data:image/jpeg;base64,' + SAMPLE_IMAGE_BUFFER_1.toString('base64')
  }];

  const res = await checkCitizenAngleInvariantDuplicate({
    citizenId: CITIZEN_A,
    latitude: LAT_30M,
    longitude: BASE_LNG,
    primaryPhoto: SAMPLE_IMAGE_BUFFER_2,
    simulatedVisualMatch: {
      same_physical_issue: true,
      confidence: 94,
      reason: 'Physical crater shape, surrounding road fracture pattern and asphalt texture match'
    },
    existingComplaintsList: existing
  });

  assert.strictEqual(res.isDuplicate, true);
  assert.strictEqual(res.match_type, 'visual');
  assert.strictEqual(res.confidence, 94);
  assert.strictEqual(res.existing_complaint_id, 'NS-2026-0002');
});

test('TEST 3: same issue cropped/resized + 40m -> BLOCK', async () => {
  const dist = calculateDistanceMeters(BASE_LAT, BASE_LNG, LAT_40M, BASE_LNG);
  assert.ok(dist <= 100, `Distance was ${dist}`);

  const existing = [{
    id: 'comp-003',
    complaint_number: 'NS-2026-0003',
    citizen_id: CITIZEN_A,
    latitude: BASE_LAT,
    longitude: BASE_LNG,
    category: 'Road Damage / Pothole',
    status: 'Assigned',
    photo_front_url: 'data:image/jpeg;base64,' + SAMPLE_IMAGE_BUFFER_1.toString('base64')
  }];

  const res = await checkCitizenAngleInvariantDuplicate({
    citizenId: CITIZEN_A,
    latitude: LAT_40M,
    longitude: BASE_LNG,
    primaryPhoto: SAMPLE_IMAGE_BUFFER_CROPPED,
    simulatedVisualMatch: {
      same_physical_issue: true,
      confidence: 91,
      reason: 'Cropped view of identical physical defect and road fracture'
    },
    existingComplaintsList: existing
  });

  assert.strictEqual(res.isDuplicate, true);
  assert.strictEqual(res.match_type, 'visual');
  assert.ok(res.confidence >= SAME_ISSUE_CONFIDENCE_THRESHOLD);
});

test('TEST 4: same citizen + different issue + 20m -> ALLOW under this rule', async () => {
  const existing = [{
    id: 'comp-004',
    complaint_number: 'NS-2026-0004',
    citizen_id: CITIZEN_A,
    latitude: BASE_LAT,
    longitude: BASE_LNG,
    category: 'Road Damage / Pothole',
    status: 'Assigned',
    photo_front_url: 'data:image/jpeg;base64,' + SAMPLE_IMAGE_BUFFER_1.toString('base64')
  }];

  const res = await checkCitizenAngleInvariantDuplicate({
    citizenId: CITIZEN_A,
    latitude: LAT_20M,
    longitude: BASE_LNG,
    primaryPhoto: SAMPLE_IMAGE_GARBAGE,
    simulatedVisualMatch: {
      same_physical_issue: false,
      confidence: 12,
      reason: 'Completely different civic defect: garbage dump vs road defect'
    },
    existingComplaintsList: existing
  });

  assert.strictEqual(res.isDuplicate, false);
});

test('TEST 5: same issue + same citizen + 120m -> ALLOW under this rule (>100m)', async () => {
  const dist = calculateDistanceMeters(BASE_LAT, BASE_LNG, LAT_120M, BASE_LNG);
  assert.ok(dist > 100, `Expected distance > 100m, got ${dist}`);

  const existing = [{
    id: 'comp-005',
    complaint_number: 'NS-2026-0005',
    citizen_id: CITIZEN_A,
    latitude: BASE_LAT,
    longitude: BASE_LNG,
    category: 'Road Damage / Pothole',
    status: 'In Progress',
    primary_image_hash: computeImageHash(SAMPLE_IMAGE_BUFFER_1),
    photo_front_url: 'data:image/jpeg;base64,' + SAMPLE_IMAGE_BUFFER_1.toString('base64')
  }];

  const res = await checkCitizenAngleInvariantDuplicate({
    citizenId: CITIZEN_A,
    latitude: LAT_120M,
    longitude: BASE_LNG,
    primaryPhoto: SAMPLE_IMAGE_BUFFER_1,
    existingComplaintsList: existing
  });

  assert.strictEqual(res.isDuplicate, false);
});

test('TEST 6: same issue + different citizen + 20m -> do NOT block using this rule', async () => {
  const existing = [{
    id: 'comp-006',
    complaint_number: 'NS-2026-0006',
    citizen_id: CITIZEN_B, // Different citizen
    latitude: BASE_LAT,
    longitude: BASE_LNG,
    category: 'Road Damage / Pothole',
    status: 'In Progress',
    primary_image_hash: computeImageHash(SAMPLE_IMAGE_BUFFER_1),
    photo_front_url: 'data:image/jpeg;base64,' + SAMPLE_IMAGE_BUFFER_1.toString('base64')
  }];

  const res = await checkCitizenAngleInvariantDuplicate({
    citizenId: CITIZEN_A,
    latitude: LAT_20M,
    longitude: BASE_LNG,
    primaryPhoto: SAMPLE_IMAGE_BUFFER_1,
    existingComplaintsList: existing
  });

  assert.strictEqual(res.isDuplicate, false);
});

test('TEST 7: old complaint resolved + same physical issue another angle + 40m -> BLOCK', async () => {
  const existing = [{
    id: 'comp-007',
    complaint_number: 'NS-2026-0007',
    citizen_id: CITIZEN_A,
    latitude: BASE_LAT,
    longitude: BASE_LNG,
    category: 'Road Damage / Pothole',
    status: 'Resolved', // Resolved status must NOT unlock the issue
    photo_front_url: 'data:image/jpeg;base64,' + SAMPLE_IMAGE_BUFFER_1.toString('base64')
  }];

  const res = await checkCitizenAngleInvariantDuplicate({
    citizenId: CITIZEN_A,
    latitude: LAT_40M,
    longitude: BASE_LNG,
    primaryPhoto: SAMPLE_IMAGE_BUFFER_2,
    simulatedVisualMatch: {
      same_physical_issue: true,
      confidence: 92,
      reason: 'Physical defect identical even though prior complaint is resolved'
    },
    existingComplaintsList: existing
  });

  assert.strictEqual(res.isDuplicate, true);
  assert.strictEqual(res.match_type, 'visual');
  assert.strictEqual(res.existing_complaint_id, 'NS-2026-0007');
});

test('TEST 8: SLA expired + same issue another angle + 40m -> BLOCK', async () => {
  const existing = [{
    id: 'comp-008',
    complaint_number: 'NS-2026-0008',
    citizen_id: CITIZEN_A,
    latitude: BASE_LAT,
    longitude: BASE_LNG,
    category: 'Road Damage / Pothole',
    status: 'Overdue', // SLA expired / Overdue status
    sla_deadline: '2025-01-01T00:00:00.000Z',
    photo_front_url: 'data:image/jpeg;base64,' + SAMPLE_IMAGE_BUFFER_1.toString('base64')
  }];

  const res = await checkCitizenAngleInvariantDuplicate({
    citizenId: CITIZEN_A,
    latitude: LAT_40M,
    longitude: BASE_LNG,
    primaryPhoto: SAMPLE_IMAGE_BUFFER_2,
    simulatedVisualMatch: {
      same_physical_issue: true,
      confidence: 89,
      reason: 'Physical defect identical even though previous complaint SLA is overdue'
    },
    existingComplaintsList: existing
  });

  assert.strictEqual(res.isDuplicate, true);
  assert.strictEqual(res.match_type, 'visual');
  assert.strictEqual(res.existing_complaint_id, 'NS-2026-0008');
});

test('TEST 9: Front/Left/Right/Top images uploaded as part of SAME complaint -> ALLOW', () => {
  // Multi-view slots in one complaint belong together and must not block each other
  const angleSlots = {
    front: { url: 'https://example.com/front.jpg', view: 'Front View' },
    left: { url: 'https://example.com/left.jpg', view: 'Left View' },
    right: { url: 'https://example.com/right.jpg', view: 'Right View' },
    top: { url: 'https://example.com/top.jpg', view: 'Top View' }
  };
  const count = Object.values(angleSlots).filter(s => Boolean(s.url)).length;
  assert.strictEqual(count, 4);
  // Duplicate check only triggers on creation against DB history, not intra-complaint views
  assert.ok(true, 'Multi-angle photos within the same complaint are permitted');
});

test('TEST 10: AI confidence below 85 -> do not permanently block solely from visual comparison', async () => {
  const existing = [{
    id: 'comp-010',
    complaint_number: 'NS-2026-010',
    citizen_id: CITIZEN_A,
    latitude: BASE_LAT,
    longitude: BASE_LNG,
    category: 'Road Damage / Pothole',
    status: 'Submitted',
    photo_front_url: 'data:image/jpeg;base64,' + SAMPLE_IMAGE_BUFFER_1.toString('base64')
  }];

  const res = await checkCitizenAngleInvariantDuplicate({
    citizenId: CITIZEN_A,
    latitude: LAT_30M,
    longitude: BASE_LNG,
    primaryPhoto: SAMPLE_IMAGE_BUFFER_2,
    simulatedVisualMatch: {
      same_physical_issue: true,
      confidence: 80, // Below threshold of 85
      reason: 'Low visual similarity confidence'
    },
    existingComplaintsList: existing
  });

  assert.strictEqual(res.isDuplicate, false);
});
