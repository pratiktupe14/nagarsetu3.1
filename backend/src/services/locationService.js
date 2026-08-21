const exifr = require('exifr');
const { query } = require('../config/db');

// Calculate distance in meters between two lat/lng pairs using Haversine formula
function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius of Earth in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Server-side EXIF GPS extraction using exifr
async function extractExifGps(filePath) {
  try {
    const gps = await exifr.gps(filePath);
    if (gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number') {
      return {
        latitude: gps.latitude,
        longitude: gps.longitude,
        hasExif: true
      };
    }
  } catch (err) {
    console.log('EXIF GPS extraction note:', err.message);
  }
  return { latitude: null, longitude: null, hasExif: false };
}

/**
 * Priority Location Resolver
 * Inputs:
 * - filePath: String path to uploaded image file
 * - liveLat, liveLng: optional numbers passed from client browser Geolocation API
 * - manualLat, manualLng: optional numbers if user manually dropped pin
 */
async function resolveLocation(filePath, liveLat, liveLng, manualLat, manualLng) {
  const exif = await extractExifGps(filePath);
  
  const hasLive = typeof liveLat === 'number' && typeof liveLng === 'number' && !isNaN(liveLat) && !isNaN(liveLng);
  const hasExif = exif.hasExif;
  const hasManual = typeof manualLat === 'number' && typeof manualLng === 'number' && !isNaN(manualLat) && !isNaN(manualLng);

  // Scenario 4: Both Live GPS and EXIF GPS exist & disagree significantly (>500m)
  if (hasLive && hasExif) {
    const dist = calculateDistanceMeters(liveLat, liveLng, exif.latitude, exif.longitude);
    if (dist > 500) {
      return {
        requiresUserChoice: true,
        options: {
          liveGps: { latitude: liveLat, longitude: liveLng, label: 'Current Device Location (Live GPS)' },
          exifGps: { latitude: exif.latitude, longitude: exif.longitude, label: 'Photo Location (EXIF Metadata)' }
        },
        distanceMeters: Math.round(dist),
        message: 'The photo location metadata differs significantly from your current location (>500m). Please select which location is correct.'
      };
    }
  }

  // Priority 1: Live in-app camera capture (passed from frontend as live_gps)
  if (hasLive && !hasManual) {
    return {
      latitude: liveLat,
      longitude: liveLng,
      location_source: 'live_gps',
      requiresUserChoice: false,
      requiresManualPin: false
    };
  }

  // Priority 2: Gallery photo with EXIF GPS intact
  if (hasExif && !hasManual) {
    return {
      latitude: exif.latitude,
      longitude: exif.longitude,
      location_source: 'exif_gps',
      requiresUserChoice: false,
      requiresManualPin: false
    };
  }

  // Priority 3: Manual Pin Drop (provided by user after prompt)
  if (hasManual) {
    return {
      latitude: manualLat,
      longitude: manualLng,
      location_source: 'manual_pin',
      requiresUserChoice: false,
      requiresManualPin: false
    };
  }

  // Fallback / Priority 3 trigger: EXIF stripped & no live GPS -> Prompt user for pin drop
  return {
    requiresManualPin: true,
    requiresUserChoice: false,
    message: "We couldn't detect the location for this photo. Please tap on the map to mark exactly where the issue is.",
    latitude: null,
    longitude: null
  };
}

// Find potential duplicate open complaints within radius (e.g. 100 meters)
async function checkForDuplicates(latitude, longitude, category, radiusMeters = 100) {
  try {
    // Fetch all active/open complaints
    const sql = `
      SELECT id, title, category, priority, status, latitude, longitude, created_at
      FROM complaints
      WHERE status NOT IN ('Resolved', 'Rejected')
    `;
    const res = await query(sql);
    const duplicates = [];

    for (const row of res.rows) {
      const dist = calculateDistanceMeters(latitude, longitude, row.latitude, row.longitude);
      if (dist <= radiusMeters) {
        duplicates.push({
          complaint_id: row.id,
          title: row.title,
          category: row.category,
          status: row.status,
          distanceMeters: Math.round(dist)
        });
      }
    }

    return duplicates;
  } catch (err) {
    console.error('Error checking duplicates:', err);
    return [];
  }
}

module.exports = {
  calculateDistanceMeters,
  extractExifGps,
  resolveLocation,
  checkForDuplicates
};
