const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

describe('Citizen Portal Runtime Safety Regression Suite', () => {
  const i18nPath = path.join(__dirname, '../../frontend/src/utils/i18n.ts');
  const locationServicePath = path.join(__dirname, '../../frontend/src/services/locationService.ts');
  const complaintServicePath = path.join(__dirname, '../../frontend/src/services/complaintService.ts');
  const locationMapPickerPath = path.join(__dirname, '../../frontend/src/components/LocationMapPicker.tsx');
  const relatedIssuesPath = path.join(__dirname, '../../frontend/src/components/RelatedIssuesSection.tsx');
  const nearbyIssuesPath = path.join(__dirname, '../../frontend/src/pages/citizen/NearbyIssuesPage.tsx');
  const myComplaintsPath = path.join(__dirname, '../../frontend/src/pages/citizen/MyComplaintsPage.tsx');

  test('1. i18n translation functions safely guard against undefined and non-string inputs', () => {
    assert.ok(fs.existsSync(i18nPath), 'i18n.ts must exist');
    const content = fs.readFileSync(i18nPath, 'utf8');

    // translateCategory
    assert.ok(
      content.includes("if (!catName || typeof catName !== 'string') return '';"),
      'translateCategory must safely return empty string on undefined/non-string'
    );

    // translateStatus
    assert.ok(
      content.includes("if (!status || typeof status !== 'string') return '';"),
      'translateStatus must safely return empty string on undefined/non-string'
    );

    // translatePriority
    assert.ok(
      content.includes("if (!priority || typeof priority !== 'string') return '';"),
      'translatePriority must safely return empty string on undefined/non-string'
    );

    // translateDepartment
    assert.ok(
      content.includes("if (!deptName || typeof deptName !== 'string') return '';"),
      'translateDepartment must safely return empty string on undefined/non-string'
    );
  });

  test('2. locationService exports isValidCoordinate and protects calculateDistanceMeters against NaN', () => {
    assert.ok(fs.existsSync(locationServicePath), 'locationService.ts must exist');
    const content = fs.readFileSync(locationServicePath, 'utf8');

    assert.ok(content.includes('export function isValidCoordinate'), 'Must export isValidCoordinate');
    assert.ok(content.includes('Number.isFinite(nLat) &&'), 'Must check Number.isFinite for latitude');
    assert.ok(content.includes('Number.isFinite(nLng) &&'), 'Must check Number.isFinite for longitude');
    assert.ok(content.includes('nLat >= -90 &&'), 'Must check latitude bounds >= -90');
    assert.ok(content.includes('nLat <= 90 &&'), 'Must check latitude bounds <= 90');
    assert.ok(content.includes('nLng >= -180 &&'), 'Must check longitude bounds >= -180');
    assert.ok(content.includes('nLng <= 180 &&'), 'Must check longitude bounds <= 180');
    assert.ok(content.includes('!(nLat === 0 && nLng === 0)'), 'Must disallow fake (0,0) coordinates');

    // calculateDistanceMeters
    assert.ok(
      content.includes('if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2))'),
      'calculateDistanceMeters must validate coordinates before formula'
    );
    assert.ok(
      content.includes('return Number.isFinite(res) ? res : Infinity;'),
      'calculateDistanceMeters must return Infinity (never NaN) on non-finite result'
    );
  });

  test('3. complaintService normalizes coordinates and string fields on all fetch operations', () => {
    assert.ok(fs.existsSync(complaintServicePath), 'complaintService.ts must exist');
    const content = fs.readFileSync(complaintServicePath, 'utf8');

    assert.ok(content.includes('export function normalizeComplaint'), 'Must export normalizeComplaint');
    assert.ok(content.includes('Number.isFinite(parsedLat) && parsedLat >= -90 && parsedLat <= 90'), 'normalizeComplaint must validate lat');
    assert.ok(content.includes('Number.isFinite(parsedLng) && parsedLng >= -180 && parsedLng <= 180'), 'normalizeComplaint must validate lng');
    assert.ok(content.includes('return finalComplaints.map(normalizeComplaint);'), 'getAllComplaints must normalize');
    assert.ok(content.includes('return cleanList.map(normalizeComplaint);'), 'getCitizenComplaints must normalize');
    assert.ok(content.includes('return normalizeComplaint(comp);'), 'getComplaintById must normalize');
  });

  test('4. LocationMapPicker prevents NaN LatLng from reaching Leaflet and renders fallback UI', () => {
    assert.ok(fs.existsSync(locationMapPickerPath), 'LocationMapPicker.tsx must exist');
    const content = fs.readFileSync(locationMapPickerPath, 'utf8');

    assert.ok(content.includes('isValidCoordinate'), 'LocationMapPicker must import and use isValidCoordinate');
    assert.ok(content.includes('hasValidPosition'), 'LocationMapPicker must maintain hasValidPosition guard');
    assert.ok(content.includes('Location Pin Unavailable'), 'LocationMapPicker must show clear unavailable UI when coordinates are invalid');
    assert.ok(content.includes('Turn On / Detect Location'), 'LocationMapPicker must allow detecting location via GPS');
    assert.ok(content.includes('requestFreshGpsLocation'), 'LocationMapPicker must use existing requestFreshGpsLocation');
  });

  test('5. RelatedIssuesSection guards MapContainer and Marker against invalid coordinates', () => {
    assert.ok(fs.existsSync(relatedIssuesPath), 'RelatedIssuesSection.tsx must exist');
    const content = fs.readFileSync(relatedIssuesPath, 'utf8');

    assert.ok(content.includes('isValidCoordinate'), 'RelatedIssuesSection must import and use isValidCoordinate');
    assert.ok(content.includes('hasValidCoords'), 'RelatedIssuesSection must check hasValidCoords before rendering MapContainer');
    assert.ok(content.includes('Location Pin Not Available'), 'RelatedIssuesSection must render fallback when coordinates are missing');
    assert.ok(content.includes('item.complaint && isValidCoordinate(item.complaint.latitude, item.complaint.longitude)'), 'RelatedIssuesSection must filter markers with valid coordinates');
  });

  test('6. NearbyIssuesPage and MyComplaintsPage safely filter strings without toLowerCase crashes', () => {
    const nearbyContent = fs.readFileSync(nearbyIssuesPath, 'utf8');
    assert.ok(nearbyContent.includes("typeof searchQuery === 'string' ? searchQuery.trim().toLowerCase() : ''"), 'NearbyIssuesPage must safe guard searchQuery');
    assert.ok(nearbyContent.includes("typeof c.complaint_number === 'string' ? c.complaint_number.toLowerCase() : ''"), 'NearbyIssuesPage must safe guard complaint_number');
    assert.ok(nearbyContent.includes("typeof c.title === 'string' ? c.title.toLowerCase() : ''"), 'NearbyIssuesPage must safe guard title');
    assert.ok(nearbyContent.includes("typeof c.category === 'string' ? c.category.toLowerCase() : ''"), 'NearbyIssuesPage must safe guard category');

    const myComplaintsContent = fs.readFileSync(myComplaintsPath, 'utf8');
    assert.ok(myComplaintsContent.includes("typeof searchQuery === 'string' ? searchQuery.trim().toLowerCase() : ''"), 'MyComplaintsPage must safe guard searchQuery');
    assert.ok(myComplaintsContent.includes("typeof c.complaint_number === 'string' ? c.complaint_number.toLowerCase() : ''"), 'MyComplaintsPage must safe guard complaint_number');
    assert.ok(myComplaintsContent.includes("typeof c.title === 'string' ? c.title.toLowerCase() : ''"), 'MyComplaintsPage must safe guard title');
    assert.ok(myComplaintsContent.includes("typeof c.category === 'string' ? c.category.toLowerCase() : ''"), 'MyComplaintsPage must safe guard category');
    assert.ok(myComplaintsContent.includes("isValidCoordinate(c.latitude, c.longitude)"), 'MyComplaintsPage must check isValidCoordinate before distance calculation');
  });

  test('7. Universal Priority Color System enforces consistent semantic colors and safe normalization', () => {
    const priorityBadgePath = path.join(__dirname, '../../frontend/src/components/PriorityBadge.tsx');
    assert.ok(fs.existsSync(priorityBadgePath), 'PriorityBadge.tsx must exist');
    const badgeContent = fs.readFileSync(priorityBadgePath, 'utf8');

    // Semantic color mappings
    assert.ok(badgeContent.includes("Critical: {"), 'Critical configuration must be defined');
    assert.ok(badgeContent.includes("bg-red-50") && badgeContent.includes("text-red-900"), 'Critical must use Red');
    assert.ok(badgeContent.includes("High: {"), 'High configuration must be defined');
    assert.ok(badgeContent.includes("bg-orange-50") && badgeContent.includes("text-orange-900"), 'High must use Orange');
    assert.ok(badgeContent.includes("Medium: {"), 'Medium configuration must be defined');
    assert.ok(badgeContent.includes("bg-yellow-50") && badgeContent.includes("text-yellow-900"), 'Medium must use Yellow');
    assert.ok(badgeContent.includes("Low: {"), 'Low configuration must be defined');
    assert.ok(badgeContent.includes("bg-emerald-50") && badgeContent.includes("text-emerald-800"), 'Low must use Green/Emerald');

    // Safe normalization
    assert.ok(badgeContent.includes("export function normalizePriority"), 'Must export normalizePriority');
    assert.ok(badgeContent.includes("export function getPriorityConfig"), 'Must export getPriorityConfig');
    assert.ok(badgeContent.includes("if (typeof priority !== 'string') return 'Medium';"), 'Must safely default non-strings to Medium');
  });
});
