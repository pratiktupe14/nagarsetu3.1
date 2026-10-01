/**
 * Centralized Date & Time Formatting Utilities for NagarSetu 3.1
 * Enforces Asia/Kolkata (IST) timezone across all portals and evidence photos.
 */

export function parseValidDate(value: string | number | Date | null | undefined): Date | null {
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
    // If backend timestamp has no timezone offset (e.g. "2026-10-01 00:30:00" or "2026-10-01T00:30:00")
    // Parse it explicitly as UTC
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

function getLocale(lang?: string): string {
  const current = lang || (typeof window !== 'undefined' ? localStorage.getItem('nagarsetu_lang') : 'en') || 'en';
  if (current === 'hi') return 'hi-IN';
  if (current === 'mr') return 'mr-IN';
  return 'en-IN';
}

export function formatPortalDate(value: string | number | Date | null | undefined, lang?: string): string {
  const d = parseValidDate(value);
  if (!d) return 'N/A';

  try {
    return new Intl.DateTimeFormat(getLocale(lang), {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(d);
  } catch (e) {
    return 'N/A';
  }
}

export function formatPortalTime(value: string | number | Date | null | undefined, showSeconds: boolean = false, lang?: string): string {
  const d = parseValidDate(value);
  if (!d) return 'N/A';

  try {
    const formatted = new Intl.DateTimeFormat(getLocale(lang), {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      second: showSeconds ? '2-digit' : undefined,
      hour12: true
    }).format(d);
    const upperTime = formatted.replace(/\b(am|pm)\b/gi, (m) => m.toUpperCase());
    return `${upperTime} IST`;
  } catch (e) {
    return 'N/A';
  }
}

export function formatPortalDateTime(value: string | number | Date | null | undefined, showSeconds: boolean = false, lang?: string): string {
  const d = parseValidDate(value);
  if (!d) return 'N/A';

  try {
    const locale = getLocale(lang);
    const dateStr = new Intl.DateTimeFormat(locale, {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).format(d);

    const timeStr = new Intl.DateTimeFormat(locale, {
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

export function formatRelativeTimestamp(value: string | number | Date | null | undefined, lang?: string): string {
  return formatPortalDateTime(value, false, lang);
}
