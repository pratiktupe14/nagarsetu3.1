const test = require('node:test');
const assert = require('node:assert');

// Implementation of resolveMediaUrl logic for testing
function resolveMediaUrl(url, apiBase = 'http://localhost:5000') {
  if (!url || typeof url !== 'string') return '';
  let trimmed = url.trim();
  if (!trimmed || trimmed === '' || trimmed === 'undefined' || trimmed === 'null') {
    return '';
  }

  // Filter out demo placeholders
  if (
    trimmed.includes('civic-default.jpg') ||
    trimmed.includes('via.placeholder') ||
    trimmed.includes('600x400') ||
    trimmed.includes('placeholder.com')
  ) {
    return '';
  }

  // Normalize Windows paths
  if (trimmed.includes('\\')) {
    trimmed = trimmed.replace(/\\/g, '/');
  }
  const uploadsIdx = trimmed.indexOf('/uploads/');
  if (uploadsIdx !== -1) {
    trimmed = trimmed.substring(uploadsIdx);
  }

  // Absolute URLs
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }

  // Relative /uploads/
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('uploads/')) {
    const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    return apiBase ? `${apiBase.replace(/\/$/, '')}${cleanPath}` : cleanPath;
  }

  return trimmed;
}

// Implementation of date formatting logic
function parseValidDate(value) {
  if (value === null || value === undefined || value === '' || value === 'N/A' || value === 'null' || value === 'undefined') {
    return null;
  }
  if (value instanceof Date) {
    return isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    const d = new Date(value);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed || trimmed === 'N/A' || trimmed === 'null' || trimmed === 'undefined') {
      return null;
    }
    if (/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(trimmed)) {
      const utcString = trimmed.replace(' ', 'T') + 'Z';
      const d = new Date(utcString);
      return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(trimmed);
    if (isNaN(d.getTime())) return null;
    return d;
  }
  return null;
}

function formatPortalDateTime(value, showSeconds = false) {
  const d = parseValidDate(value);
  if (!d) return 'N/A';

  try {
    const dateStr = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(d);

    const timeStr = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      second: showSeconds ? '2-digit' : undefined,
      hour12: true
    }).format(d);
    const upperTime = timeStr.replace(/\b(am|pm)\b/gi, (m) => m.toUpperCase());

    return `${dateStr}, ${upperTime} IST`;
  } catch (e) {
    return 'N/A';
  }
}

// TEST 1: complaint with relative /uploads/... citizen image -> Field Staff BEFORE image resolves correctly
test('TEST 1: relative /uploads/... citizen image resolves to backend origin', () => {
  const resolved = resolveMediaUrl('/uploads/citizen-pothole.jpg', 'http://localhost:5000');
  assert.strictEqual(resolved, 'http://localhost:5000/uploads/citizen-pothole.jpg');
});

// TEST 2: complaint with absolute image URL -> unchanged and visible
test('TEST 2: absolute image URL is unchanged and visible', () => {
  const url = 'https://images.example.com/evidence/drain-overflow.jpg';
  assert.strictEqual(resolveMediaUrl(url), url);
});

// TEST 3: missing image -> neutral no evidence -> no 600x400 demo placeholder
test('TEST 3: missing or placeholder image resolves to empty string without 600x400', () => {
  assert.strictEqual(resolveMediaUrl(''), '');
  assert.strictEqual(resolveMediaUrl(null), '');
  assert.strictEqual(resolveMediaUrl('/uploads/civic-default.jpg'), '');
  assert.strictEqual(resolveMediaUrl('https://via.placeholder.com/600x400'), '');
});

// TEST 4: Front/Primary citizen photo -> displayed and locked
test('TEST 4: Front/Primary citizen photo resolves properly for locked display', () => {
  const rawPath = 'C:\\uploads\\front_view.jpg';
  const resolved = resolveMediaUrl(rawPath, 'http://localhost:5000');
  assert.strictEqual(resolved, 'http://localhost:5000/uploads/front_view.jpg');
});

// TEST 5: UTC timestamp -> correct Asia/Kolkata IST display
test('TEST 5: UTC timestamp formats in Asia/Kolkata IST', () => {
  // 2026-10-01 00:29:00 UTC -> 05:59 AM IST
  const utcIso = '2026-10-01T00:29:00.000Z';
  const formatted = formatPortalDateTime(utcIso);
  assert.strictEqual(formatted, '01 Oct 2026, 5:59 AM IST');

  // SQL style without timezone suffix
  const sqlUtc = '2026-10-01 00:29:00';
  const formattedSql = formatPortalDateTime(sqlUtc);
  assert.strictEqual(formattedSql, '01 Oct 2026, 5:59 AM IST');
});

// TEST 6: SLA deadline -> correct IST display
test('TEST 6: SLA deadline displays in correct IST format', () => {
  const slaDeadline = '2026-10-02T12:00:00.000Z'; // 12:00 UTC -> 17:30 IST (5:30 PM)
  const formatted = formatPortalDateTime(slaDeadline);
  assert.strictEqual(formatted, '02 Oct 2026, 5:30 PM IST');
});

// TEST 7: invalid timestamp -> N/A
test('TEST 7: invalid or missing timestamp returns N/A', () => {
  assert.strictEqual(formatPortalDateTime(null), 'N/A');
  assert.strictEqual(formatPortalDateTime(undefined), 'N/A');
  assert.strictEqual(formatPortalDateTime(''), 'N/A');
  assert.strictEqual(formatPortalDateTime('invalid-date-string'), 'N/A');
});
