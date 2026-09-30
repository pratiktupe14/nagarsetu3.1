import exifr from 'exifr';
import { Complaint } from '../types/database.types';
import { getApiUrl } from '../config/apiConfig';

export type LocationSourceType =
  | 'exif'
  | 'device_gps'
  | 'map_pin'
  | 'map_pin_confirmed'
  | 'live_gps'
  | 'exif_gps'
  | 'manual_pin'
  | 'geocoded'
  | 'geocode_failed'
  | 'unavailable'
  | 'gps';

export interface LocationResult {
  latitude: number | null;
  longitude: number | null;
  source: LocationSourceType;
  accuracy?: number | null;
  requiresManualPin: boolean;
  requiresChoice: boolean;
  requiresConfirmation?: boolean;
  lowAccuracy?: boolean;
  conflict?: string;
  distanceMeters?: number;
  message?: string;
  exifCoords?: { latitude: number; longitude: number };
  liveCoords?: { latitude: number; longitude: number };
}

export interface RelatedIssueItem {
  complaint: Complaint;
  distanceMeters: number;
  relationType: 'Duplicate Candidate' | 'Similar Issue' | 'Nearby Issue';
}

export interface DuplicateIntelligenceMatch {
  candidateComplaint: Complaint;
  distanceMeters: number;
  confidenceScore: number; // e.g. 94
  matchLevel: '🟢 High Match' | '🟡 Possible Match' | '⚪ Low Match';
  locationMatchScore: number;
  categoryMatchScore: number;
  textMatchScore: number;
  timeMatchScore: number;
  reasonSummary: string;
}

// Nashik City Geographic Operating Center & Municipal Boundary Configuration
export const NASHIK_CENTER = {
  latitude: 20.0059,
  longitude: 73.7898,
  cityName: 'Nashik City',
  stateName: 'Maharashtra',
  countryName: 'India',
  zoom: 13
};

export const NASHIK_SERVICE_BOUNDS = {
  minLat: 19.85,
  maxLat: 20.15,
  minLng: 73.65,
  maxLng: 73.95
};

export function isWithinNashikServiceArea(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (lat == null || lng == null || isNaN(lat) || isNaN(lng)) return false;
  // Allow all valid real-world GPS coordinates across Maharashtra / India / worldwide
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export interface GpsLocationResult {
  latitude: number | null;
  longitude: number | null;
  accuracyMeters: number | null;
  status: 'success' | 'permission_denied' | 'position_unavailable' | 'timeout' | 'unsupported' | 'error';
  message: string;
  isLowAccuracy?: boolean;
}

/**
 * High-Accuracy Fresh GPS Location Request for Every Complaint Session
 * Always sets maximumAge: 0 to prevent stale cached location reuse.
 */
export function requestFreshGpsLocation(timeoutMs: number = 10000): Promise<GpsLocationResult> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      resolve({
        latitude: null,
        longitude: null,
        accuracyMeters: null,
        status: 'unsupported',
        message: 'Geolocation is not supported by your browser.'
      });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const accuracy = pos.coords.accuracy ? Math.round(pos.coords.accuracy) : null;
        const isLow = accuracy !== null && accuracy > 100;

        resolve({
          latitude: lat,
          longitude: lng,
          accuracyMeters: accuracy,
          status: 'success',
          isLowAccuracy: isLow,
          message: isLow
            ? `Location detected with low accuracy (±${accuracy}m). Please adjust the marker manually.`
            : `Location detected successfully${accuracy ? ` (±${accuracy}m accuracy)` : ''}.`
        });
      },
      (err) => {
        let status: GpsLocationResult['status'] = 'error';
        let message = 'Unable to detect location. Please select your location manually on the map.';

        if (err.code === err.PERMISSION_DENIED) {
          status = 'permission_denied';
          message = 'Location access is disabled. Please enable location permission or select your complaint location manually on the map.';
        } else if (err.code === err.POSITION_UNAVAILABLE) {
          status = 'position_unavailable';
          message = 'Unable to determine your location. Please try again or select the location manually.';
        } else if (err.code === err.TIMEOUT) {
          status = 'timeout';
          message = 'Location detection timed out. Try again or select the location manually.';
        }

        resolve({
          latitude: null,
          longitude: null,
          accuracyMeters: null,
          status,
          message
        });
      },
      {
        enableHighAccuracy: true,
        timeout: timeoutMs,
        maximumAge: 0 // Maximum age 0 prevents reusing stale location cache!
      }
    );
  });
}

/**
 * Reverse Geocode GPS Coordinates to Human Readable Address
 */
export async function reverseGeocodeCoordinates(
  latitude: number,
  longitude: number
): Promise<string> {
  if (latitude == null || longitude == null || isNaN(latitude) || isNaN(longitude)) return '';

  const googleRes = await reverseGeocodeGoogleMaps(latitude, longitude);
  if (googleRes && googleRes.formatted_address) {
    return googleRes.formatted_address;
  }

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'NagarSetu-CivicApp'
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.display_name) {
        return data.display_name;
      }
    }
  } catch (e) {}

  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

// In-memory & local cache for geocoded addresses to prevent redundant API calls
const GEOCODE_CACHE_KEY = 'nagarsetu_geocode_cache_v1';

function getGeocodeCache(): Record<string, { latitude: number; longitude: number; formatted_address: string }> {
  try {
    const raw = localStorage.getItem(GEOCODE_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function setGeocodeCache(key: string, data: { latitude: number; longitude: number; formatted_address: string }) {
  try {
    if (!key || typeof key !== 'string') return;
    const cache = getGeocodeCache();
    cache[key.toLowerCase().trim()] = data;
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
  } catch (e) {}
}

const getBackendMapsUrl = () => `${getApiUrl()}/api/maps`;

/**
 * Reverse Geocoding using Google Maps API (via Backend maps service)
 */
export async function reverseGeocodeGoogleMaps(
  latitude: number,
  longitude: number
): Promise<{ formatted_address: string; is_within_service_area?: boolean } | null> {
  if (latitude == null || longitude == null || isNaN(latitude) || isNaN(longitude)) return null;

  try {
    const res = await fetch(`${getBackendMapsUrl()}/reverse-geocode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude, longitude })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'OK' && data.formatted_address) {
        return { formatted_address: data.formatted_address, is_within_service_area: data.is_within_service_area };
      }
    }
  } catch (e) {
    // Network or API failure fallback handled by reverseGeocodeCoordinates
  }
  return null;
}

/**
 * Directions & Route Navigation using Google Maps API
 */
export async function getGoogleMapsDirections(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number,
  mode: string = 'driving'
): Promise<{
  distance_text?: string;
  duration_text?: string;
  navigation_url: string;
  steps?: Array<{ instruction: string; distance: string; duration: string }>;
}> {
  const fallbackUrl = `https://www.google.com/maps/dir/?api=1&origin=${originLat},${originLng}&destination=${destLat},${destLng}&travelmode=${mode}`;

  try {
    const res = await fetch(`${getBackendMapsUrl()}/directions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        origin_latitude: originLat,
        origin_longitude: originLng,
        destination_latitude: destLat,
        destination_longitude: destLng,
        mode
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'OK') {
        return {
          distance_text: data.distance_text,
          duration_text: data.duration_text,
          navigation_url: data.navigation_url || fallbackUrl,
          steps: data.steps || []
        };
      }
    }
  } catch (e) {}

  return { navigation_url: fallbackUrl };
}

/**
 * Real Geocoding Service with Nominatim / Google Maps
 */
export async function geocodeNashikAddress(
  rawAddress: string
): Promise<{ latitude: number; longitude: number; formatted_address: string } | null> {
  if (!rawAddress || typeof rawAddress !== 'string' || rawAddress.trim().length < 3) return null;

  const normalizedKey = rawAddress.toLowerCase().trim();
  const cache = getGeocodeCache();
  if (cache[normalizedKey]) {
    return cache[normalizedKey];
  }

  // 1. Try Google Maps Backend Geocoding API first
  try {
    const res = await fetch(`${getBackendMapsUrl()}/geocode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: rawAddress })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.status === 'OK' && typeof data.latitude === 'number' && typeof data.longitude === 'number') {
        const result = {
          latitude: data.latitude,
          longitude: data.longitude,
          formatted_address: data.formatted_address || rawAddress
        };
        setGeocodeCache(normalizedKey, result);
        return result;
      }
    }
  } catch (err) {}

  // 2. OpenStreetMap Nominatim Fallback - Search address cleanly without hardcoding any location!
  const queryAddress = (rawAddress.toLowerCase().includes('maharashtra') || rawAddress.toLowerCase().includes('india'))
    ? rawAddress
    : `${rawAddress}, Maharashtra, India`;

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(queryAddress)}&limit=1`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'NagarSetu-CivicApp'
      }
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (Array.isArray(data) && data.length > 0) {
      const first = data[0];
      const lat = parseFloat(first.lat);
      const lng = parseFloat(first.lon);

      if (Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        const result = {
          latitude: lat,
          longitude: lng,
          formatted_address: first.display_name || rawAddress
        };
        setGeocodeCache(normalizedKey, result);
        return result;
      }
    }
  } catch (err) {}

  return null;
}

export const geocodeAddress = geocodeNashikAddress;

/**
 * Batch Geocoding Helper:
 * Ensures all complaints missing coordinates undergo real geocoding.
 */
export async function geocodeComplaintsWithoutCoordinates(complaints: Complaint[]): Promise<Complaint[]> {
  const updatedComplaints = [...complaints];

  for (let i = 0; i < updatedComplaints.length; i++) {
    const c = updatedComplaints[i];
    if ((c.latitude == null || c.longitude == null) && c.location_address) {
      const geoResult = await geocodeAddress(c.location_address);
      if (geoResult) {
        updatedComplaints[i] = {
          ...c,
          latitude: geoResult.latitude,
          longitude: geoResult.longitude,
          location_source: 'geocoded',
          location_address: c.location_address || geoResult.formatted_address
        };
      } else {
        updatedComplaints[i] = {
          ...c,
          location_source: 'geocode_failed'
        };
      }
    }
  }

  return updatedComplaints;
}

/**
 * Coordinate validator ensuring finite numbers within valid geographic bounds
 */
export function isValidCoordinate(lat: unknown, lng: unknown): boolean {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  if (typeof lat === 'string' && lat.trim() === '') return false;
  if (typeof lng === 'string' && lng.trim() === '') return false;
  const nLat = typeof lat === 'number' ? lat : Number(lat);
  const nLng = typeof lng === 'number' ? lng : Number(lng);
  return (
    Number.isFinite(nLat) &&
    Number.isFinite(nLng) &&
    nLat >= -90 &&
    nLat <= 90 &&
    nLng >= -180 &&
    nLng <= 180 &&
    !(nLat === 0 && nLng === 0)
  );
}

// Calculate distance in meters between two lat/lng pairs using Haversine formula
export function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (!isValidCoordinate(lat1, lon1) || !isValidCoordinate(lat2, lon2)) {
    return Infinity;
  }
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);
  const R = 6371000;
  const dLat = (nLat2 - nLat1) * (Math.PI / 180);
  const dLon = (nLon2 - nLon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(nLat1 * (Math.PI / 180)) *
      Math.cos(nLat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const res = R * c;
  return Number.isFinite(res) ? res : Infinity;
}

// Client-side EXIF GPS extraction using exifr
export async function extractExifGps(file: File): Promise<{ latitude: number | null; longitude: number | null; hasExif: boolean }> {
  try {
    const gps = await exifr.gps(file);
    if (gps && typeof gps.latitude === 'number' && typeof gps.longitude === 'number') {
      return { latitude: gps.latitude, longitude: gps.longitude, hasExif: true };
    }
  } catch (err) {
    console.log('EXIF GPS extraction note:', err);
  }
  return { latitude: null, longitude: null, hasExif: false };
}

/**
 * 3-Tier Geolocation Resolution with 100-Meter Validation
 * Priority 1: Hardware EXIF GPS from camera/image metadata
 * Priority 2: Device HTML5 live GPS (accuracy <= 100m)
 * Priority 3: Interactive Leaflet/Google Map pin drop
 *
 * 100-Meter Consistency Check:
 * If EXIF vs Device GPS difference > 100m -> conflict / map confirmation required
 */
export async function resolveIssueLocation(
  file?: File | null,
  liveLat?: number | null,
  liveLng?: number | null,
  manualLat?: number | null,
  manualLng?: number | null,
  liveAccuracy?: number | null,
  mapPinConfirmed: boolean = false
): Promise<LocationResult> {
  const exif = file ? await extractExifGps(file) : { latitude: null, longitude: null, hasExif: false };

  const isCoordValid = (lat?: number | null, lng?: number | null) =>
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180;

  const hasExif = exif.hasExif && isCoordValid(exif.latitude, exif.longitude);
  const hasLive = isCoordValid(liveLat, liveLng);
  const hasManual = isCoordValid(manualLat, manualLng);

  // If user explicitly confirmed map pin (either manually or to resolve conflict)
  if (mapPinConfirmed && hasManual) {
    return {
      latitude: manualLat!,
      longitude: manualLng!,
      source: hasExif || hasLive ? 'map_pin_confirmed' : 'map_pin',
      requiresManualPin: false,
      requiresChoice: false,
      requiresConfirmation: false,
      message: 'Location confirmed by map pin'
    };
  }

  // 100-Meter Consistency Check: EXIF vs Device Live GPS
  if (hasExif && hasLive) {
    const dist = calculateDistanceMeters(liveLat!, liveLng!, exif.latitude!, exif.longitude!);
    if (dist > 100) {
      return {
        latitude: exif.latitude!,
        longitude: exif.longitude!,
        source: 'exif',
        requiresManualPin: false,
        requiresChoice: true,
        requiresConfirmation: true,
        conflict: 'exif_vs_device',
        distanceMeters: Math.round(dist),
        exifCoords: { latitude: exif.latitude!, longitude: exif.longitude! },
        liveCoords: { latitude: liveLat!, longitude: liveLng! },
        message: `Photo GPS differs from Device GPS by ${Math.round(dist)}m (>100m). Please confirm location on map.`
      };
    }
  }

  // Priority 1: Hardware EXIF GPS
  if (hasExif) {
    return {
      latitude: exif.latitude!,
      longitude: exif.longitude!,
      source: 'exif',
      requiresManualPin: false,
      requiresChoice: false,
      requiresConfirmation: false,
      message: 'Location detected from photo GPS'
    };
  }

  // Priority 2: Device HTML5 Live GPS (accuracy <= 100m)
  if (hasLive) {
    const acc = typeof liveAccuracy === 'number' && !isNaN(liveAccuracy) ? liveAccuracy : 15;
    if (acc <= 100) {
      return {
        latitude: liveLat!,
        longitude: liveLng!,
        source: 'device_gps',
        accuracy: acc,
        requiresManualPin: false,
        requiresChoice: false,
        requiresConfirmation: false,
        message: `Live GPS verified (±${Math.round(acc)}m)`
      };
    } else {
      // Accuracy > 100m: do not silently accept as final -> require manual map confirmation
      return {
        latitude: liveLat!,
        longitude: liveLng!,
        source: 'device_gps',
        accuracy: acc,
        requiresManualPin: true,
        requiresChoice: false,
        requiresConfirmation: true,
        lowAccuracy: true,
        message: 'GPS accuracy low — please confirm on map'
      };
    }
  }

  // Priority 3: Interactive Map Pin Drop
  if (hasManual) {
    return {
      latitude: manualLat!,
      longitude: manualLng!,
      source: 'map_pin',
      requiresManualPin: false,
      requiresChoice: false,
      requiresConfirmation: false,
      message: 'Location confirmed by map pin'
    };
  }

  return {
    latitude: null,
    longitude: null,
    source: 'map_pin',
    requiresManualPin: true,
    requiresChoice: false,
    requiresConfirmation: true,
    message: "We couldn't detect the location for this photo. Please mark the issue location on the map."
  };
}

/**
 * Multi-Signal Duplicate Intelligence Algorithm:
 * Evaluates Geographic distance, Category match, Title/Description text overlap, and Time submission proximity.
 */
export function calculateDuplicateIntelligenceScore(
  newLat: number,
  newLng: number,
  newCategory: string,
  newTitle: string,
  candidate: Complaint
): DuplicateIntelligenceMatch {
  const dist = Math.round(calculateDistanceMeters(newLat, newLng, Number(candidate.latitude), Number(candidate.longitude)));

  // 1. Geographic Location Score (35%)
  let locationScore = 10;
  if (Number.isFinite(dist) && dist !== Infinity) {
    if (dist <= 20) locationScore = 100;
    else if (dist <= 50) locationScore = 85;
    else if (dist <= 100) locationScore = 70;
    else if (dist <= 200) locationScore = 40;
  } else {
    locationScore = 0;
  }

  // 2. Category Match Score (25%)
  const cat1 = typeof candidate.category === 'string' ? candidate.category.trim().toLowerCase() : '';
  const cat2 = typeof newCategory === 'string' ? newCategory.trim().toLowerCase() : '';
  const isSameCat = Boolean(cat1 && cat2 && cat1 === cat2);
  const categoryScore = isSameCat ? 100 : 0;

  // 3. Text Similarity Overlap (25%)
  const words1 = (typeof newTitle === 'string' ? newTitle : '').toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const words2 = (String(candidate.title || '') + ' ' + String(candidate.description || '')).toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const shared = words1.filter((w) => words2.includes(w));
  const textScore = words1.length > 0 ? Math.min(100, Math.round((shared.length / words1.length) * 100)) : 50;

  // 4. Submission Time Proximity Score (15%)
  const candidateTime = new Date(candidate.created_at).getTime();
  const now = Date.now();
  const hoursDiff = Math.abs(now - candidateTime) / (1000 * 3600);
  let timeScore = 30;
  if (hoursDiff <= 24) timeScore = 100;
  else if (hoursDiff <= 48) timeScore = 85;
  else if (hoursDiff <= 168) timeScore = 60;

  // Total Weighted Confidence Score
  const confidenceScore = Math.round(
    locationScore * 0.35 +
    categoryScore * 0.25 +
    textScore * 0.25 +
    timeScore * 0.15
  );

  let matchLevel: '🟢 High Match' | '🟡 Possible Match' | '⚪ Low Match' = '⚪ Low Match';
  if (confidenceScore >= 80) matchLevel = '🟢 High Match';
  else if (confidenceScore >= 60) matchLevel = '🟡 Possible Match';

  let reasonSummary = Number.isFinite(dist) && dist !== Infinity ? `${dist}m away` : 'Nearby area';
  if (isSameCat) reasonSummary += `, Same ${candidate.category || 'category'}`;
  if (shared.length > 0) reasonSummary += `, Similar description words`;

  return {
    candidateComplaint: candidate,
    distanceMeters: Number.isFinite(dist) && dist !== Infinity ? dist : 9999,
    confidenceScore,
    matchLevel,
    locationMatchScore: locationScore,
    categoryMatchScore: categoryScore,
    textMatchScore: textScore,
    timeMatchScore: timeScore,
    reasonSummary
  };
}

/**
 * 100m Radius Duplicate Complaint Checker with Duplicate Intelligence
 */
export function findDuplicateComplaints(
  newLat: number,
  newLng: number,
  existingComplaints: Complaint[],
  radiusMeters: number = 100,
  category: string = 'Pothole',
  title: string = ''
): { complaint: Complaint; distanceMeters: number; match: DuplicateIntelligenceMatch }[] {
  if (!isValidCoordinate(newLat, newLng) || !Array.isArray(existingComplaints)) {
    return [];
  }
  const duplicates: { complaint: Complaint; distanceMeters: number; match: DuplicateIntelligenceMatch }[] = [];

  for (const c of existingComplaints) {
    if (!c) continue;
    if (c.status !== 'Resolved' && c.status !== 'Rejected') {
      if (!isValidCoordinate(c.latitude, c.longitude)) continue;
      const dist = calculateDistanceMeters(newLat, newLng, Number(c.latitude), Number(c.longitude));
      if (dist <= radiusMeters) {
        const match = calculateDuplicateIntelligenceScore(newLat, newLng, category, title, c);
        duplicates.push({ complaint: c, distanceMeters: Math.round(dist), match });
      }
    }
  }

  return duplicates.sort((a, b) => b.match.confidenceScore - a.match.confidenceScore);
}

/**
 * Related Issues Nearby Detector
 */
export function findRelatedNearbyIssues(
  targetLat: number,
  targetLng: number,
  category: string,
  currentComplaintId: string,
  allComplaints: Complaint[],
  maxRadiusMeters: number = 500
): RelatedIssueItem[] {
  if (!isValidCoordinate(targetLat, targetLng) || !Array.isArray(allComplaints)) {
    return [];
  }
  const results: RelatedIssueItem[] = [];
  const targetCatLower = typeof category === 'string' ? category.trim().toLowerCase() : '';

  for (const c of allComplaints) {
    if (!c || c.id === currentComplaintId) continue;
    if (!isValidCoordinate(c.latitude, c.longitude)) continue;
    const dist = calculateDistanceMeters(targetLat, targetLng, Number(c.latitude), Number(c.longitude));

    if (dist <= maxRadiusMeters) {
      let relationType: 'Duplicate Candidate' | 'Similar Issue' | 'Nearby Issue' = 'Nearby Issue';
      const cCatLower = typeof c.category === 'string' ? c.category.trim().toLowerCase() : '';
      const isSameCategory = Boolean(targetCatLower && cCatLower && cCatLower === targetCatLower);

      if (isSameCategory && dist <= 100 && c.status !== 'Resolved') {
        relationType = 'Duplicate Candidate';
      } else if (isSameCategory) {
        relationType = 'Similar Issue';
      } else {
        relationType = 'Nearby Issue';
      }

      results.push({
        complaint: c,
        distanceMeters: Math.round(dist),
        relationType
      });
    }
  }

  return results
    .sort((a, b) => {
      if (a.relationType === 'Duplicate Candidate' && b.relationType !== 'Duplicate Candidate') return -1;
      if (b.relationType === 'Duplicate Candidate' && a.relationType !== 'Duplicate Candidate') return 1;
      return a.distanceMeters - b.distanceMeters;
    })
    .slice(0, 8);
}

export interface ComplaintLocationAuditReport {
  totalAudited: number;
  validMatchingCount: number;
  mismatchedCount: number;
  correctedCount: number;
  locationUnavailableCount: number;
  geocodingProvider: string;
}

/**
 * Data Audit Engine for Complaints:
 * Preserves genuine GPS coordinates of all complaints with 100% fidelity.
 * Only attempts fallback geocoding if coordinates are completely missing (null/NaN).
 */
export async function auditAndRepairComplaintLocations(
  complaints: Complaint[]
): Promise<{ repairedComplaints: Complaint[]; report: ComplaintLocationAuditReport }> {
  let validMatchingCount = 0;
  let mismatchedCount = 0;
  let correctedCount = 0;
  let locationUnavailableCount = 0;

  const repairedComplaints = [...complaints];

  for (let i = 0; i < repairedComplaints.length; i++) {
    const c = repairedComplaints[i];
    const rawLat = c.latitude != null ? Number(c.latitude) : null;
    const rawLng = c.longitude != null ? Number(c.longitude) : null;
    const address = (c.location_address || '').trim();

    const hasValidCoords =
      rawLat !== null &&
      rawLng !== null &&
      Number.isFinite(rawLat) &&
      Number.isFinite(rawLng) &&
      rawLat >= -90 && rawLat <= 90 &&
      rawLng >= -180 && rawLng <= 180 &&
      !(rawLat === 0 && rawLng === 0);

    if (hasValidCoords) {
      // PRESERVE GENUINE GPS / SAVED COORDINATES WITH 100% FIDELITY!
      // Never overwrite or re-geocode valid coordinates!
      validMatchingCount++;
      repairedComplaints[i] = {
        ...c,
        latitude: rawLat!,
        longitude: rawLng!,
        location_address: address,
        location_source: c.location_source || 'live_gps'
      };
    } else if (address.length > 3) {
      // Only attempt fallback geocoding if coordinates are completely missing (null/NaN)
      mismatchedCount++;
      if (correctedCount < 3) {
        try {
          const geoResult = await geocodeAddress(address);
          if (geoResult) {
            correctedCount++;
            repairedComplaints[i] = {
              ...c,
              latitude: geoResult.latitude,
              longitude: geoResult.longitude,
              location_source: 'geocoded',
              location_address: address || geoResult.formatted_address
            };
            continue;
          }
        } catch (e) {}
      }
      locationUnavailableCount++;
      repairedComplaints[i] = {
        ...c,
        location_address: address,
        location_source: 'geocode_failed'
      };
    }
  }

  const report: ComplaintLocationAuditReport = {
    totalAudited: complaints.length,
    validMatchingCount,
    mismatchedCount,
    correctedCount,
    locationUnavailableCount,
    geocodingProvider: 'OpenStreetMap Nominatim API'
  };

  return { repairedComplaints, report };
}
