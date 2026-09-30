const test = require('node:test');
const assert = require('node:assert');
const {
  resolveGeolocationTier,
  calculateDistanceMeters,
  isValidCoordinate
} = require('../src/services/locationService');

// 1. valid EXIF GPS -> chosen as priority 1
test('1. valid EXIF GPS -> chosen as priority 1', () => {
  const result = resolveGeolocationTier({
    exifGps: { latitude: 20.0059, longitude: 73.7898 },
    deviceGps: null,
    mapPin: null
  });
  assert.strictEqual(result.accepted, true);
  assert.strictEqual(result.location_source, 'exif');
  assert.strictEqual(result.latitude, 20.0059);
  assert.strictEqual(result.longitude, 73.7898);
  assert.strictEqual(result.requiresConfirmation, false);
});

// 2. no EXIF + device GPS accuracy 30m -> device GPS accepted
test('2. no EXIF + device GPS accuracy 30m -> device GPS accepted', () => {
  const result = resolveGeolocationTier({
    exifGps: null,
    deviceGps: { latitude: 20.0059, longitude: 73.7898, accuracy: 30 },
    mapPin: null
  });
  assert.strictEqual(result.accepted, true);
  assert.strictEqual(result.location_source, 'device_gps');
  assert.strictEqual(result.location_accuracy_m, 30);
  assert.strictEqual(result.requiresConfirmation, false);
});

// 3. no EXIF + device GPS accuracy 150m -> map confirmation required
test('3. no EXIF + device GPS accuracy 150m -> map confirmation required', () => {
  const result = resolveGeolocationTier({
    exifGps: null,
    deviceGps: { latitude: 20.0059, longitude: 73.7898, accuracy: 150 },
    mapPin: null
  });
  assert.strictEqual(result.accepted, false);
  assert.strictEqual(result.requiresConfirmation, true);
  assert.strictEqual(result.lowAccuracy, true);
});

// 4. EXIF vs device difference 60m -> accepted
test('4. EXIF vs device difference ~60m -> accepted', () => {
  // Lat delta of 0.00054 deg at Nashik latitude is ~60m
  const dist = calculateDistanceMeters(20.00000, 73.00000, 20.00054, 73.00000);
  assert.ok(dist <= 100, `Expected distance <= 100m, got ${dist}`);

  const result = resolveGeolocationTier({
    exifGps: { latitude: 20.00000, longitude: 73.00000 },
    deviceGps: { latitude: 20.00054, longitude: 73.00000, accuracy: 20 }
  });
  assert.strictEqual(result.accepted, true);
  assert.strictEqual(result.location_source, 'exif');
  assert.strictEqual(result.requiresConfirmation, false);
});

// 5. EXIF vs device difference 180m -> conflict / confirmation required
test('5. EXIF vs device difference ~180m -> conflict / confirmation required', () => {
  // Lat delta of 0.00162 deg at Nashik latitude is ~180m
  const dist = calculateDistanceMeters(20.00000, 73.00000, 20.00162, 73.00000);
  assert.ok(dist > 100, `Expected distance > 100m, got ${dist}`);

  const result = resolveGeolocationTier({
    exifGps: { latitude: 20.00000, longitude: 73.00000 },
    deviceGps: { latitude: 20.00162, longitude: 73.00000, accuracy: 20 }
  });
  assert.strictEqual(result.accepted, false);
  assert.strictEqual(result.requiresConfirmation, true);
  assert.strictEqual(result.conflict, 'exif_vs_device');
  assert.ok(result.distanceMeters > 100);
});

// 6. map pin confirmed -> accepted
test('6. map pin confirmed -> accepted', () => {
  const result = resolveGeolocationTier({
    exifGps: null,
    deviceGps: { latitude: 20.0000, longitude: 73.0000, accuracy: 150 },
    mapPin: { latitude: 20.0050, longitude: 73.0050 },
    mapPinConfirmed: true
  });
  assert.strictEqual(result.accepted, true);
  assert.strictEqual(result.location_source, 'map_pin_confirmed');
  assert.strictEqual(result.latitude, 20.0050);
  assert.strictEqual(result.longitude, 73.0050);
  assert.strictEqual(result.requiresConfirmation, false);
});

// 7. invalid latitude/longitude -> rejected
test('7. invalid latitude/longitude -> rejected', () => {
  const invalidLat = resolveGeolocationTier({
    exifGps: { latitude: 120.0, longitude: 73.0 }
  });
  assert.strictEqual(invalidLat.accepted, false);
  assert.strictEqual(invalidLat.error, 'INVALID_COORDINATES');

  const invalidLng = resolveGeolocationTier({
    deviceGps: { latitude: 20.0, longitude: -250.0 }
  });
  assert.strictEqual(invalidLng.accepted, false);
  assert.strictEqual(invalidLng.error, 'INVALID_COORDINATES');
});

// 8. no valid location -> complaint submission blocked
test('8. no valid location -> complaint submission blocked', () => {
  const result = resolveGeolocationTier({
    exifGps: null,
    deviceGps: null,
    mapPin: null
  });
  assert.strictEqual(result.accepted, false);
  assert.strictEqual(result.requiresConfirmation, true);
  assert.strictEqual(result.latitude, null);
  assert.strictEqual(result.longitude, null);
  assert.strictEqual(result.location_source, null);
});
