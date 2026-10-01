import { getApiUrl } from '../config/apiConfig';

/**
 * Normalizes complaint and evidence image URLs across all portals.
 * - Absolute URLs (http://, https://, blob:, data:) are returned unchanged.
 * - Relative /uploads/... or uploads/... are prepended with configured backend API origin.
 * - Windows backslashes are normalized to forward slashes.
 * - Mock/placeholder 600x400 and civic-default images are filtered to empty string.
 */
export function resolveMediaUrl(url?: string | null): string {
  if (!url || typeof url !== 'string') return '';
  let trimmed = url.trim();
  if (!trimmed || trimmed === '' || trimmed === 'undefined' || trimmed === 'null') {
    return '';
  }

  // Filter out demo 600x400 placeholders
  if (
    trimmed.includes('civic-default.jpg') ||
    trimmed.includes('via.placeholder') ||
    trimmed.includes('600x400') ||
    trimmed.includes('placeholder.com')
  ) {
    return '';
  }

  // Normalize Windows paths: e.g. D:\path\to\uploads\photo.jpg -> /uploads/photo.jpg
  if (trimmed.includes('\\')) {
    trimmed = trimmed.replace(/\\/g, '/');
  }
  const uploadsIdx = trimmed.indexOf('/uploads/');
  if (uploadsIdx !== -1) {
    trimmed = trimmed.substring(uploadsIdx);
  }

  // http://, https://, blob:, data: -> use unchanged
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }

  // Prepend backend API origin to relative /uploads/ or uploads/
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('uploads/')) {
    const apiBase = getApiUrl();
    const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    if (apiBase) {
      return `${apiBase.replace(/\/$/, '')}${cleanPath}`;
    }
    return cleanPath;
  }

  return trimmed;
}
