/**
 * Centralized Date & Time Formatting Utilities for NagarSetu 3.1
 * Enforces Asia/Kolkata (IST) timezone across all portals and evidence photos.
 */

export function parseValidDate(value: string | number | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  if (isNaN(d.getTime())) return null;
  return d;
}

export function formatPortalDate(value: string | number | Date | null | undefined): string {
  const d = parseValidDate(value);
  if (!d) return 'N/A';

  try {
    return new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(d);
  } catch (e) {
    return 'N/A';
  }
}

export function formatPortalTime(value: string | number | Date | null | undefined, showSeconds: boolean = false): string {
  const d = parseValidDate(value);
  if (!d) return 'N/A';

  try {
    const formatted = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: 'numeric',
      minute: '2-digit',
      second: showSeconds ? '2-digit' : undefined,
      hour12: true
    }).format(d);
    return `${formatted} IST`;
  } catch (e) {
    return 'N/A';
  }
}

export function formatPortalDateTime(value: string | number | Date | null | undefined, showSeconds: boolean = false): string {
  const d = parseValidDate(value);
  if (!d) return 'N/A';

  try {
    const dateStr = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric',
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

    return `${dateStr}, ${timeStr} IST`;
  } catch (e) {
    return 'N/A';
  }
}

export function formatRelativeTimestamp(value: string | number | Date | null | undefined): string {
  return formatPortalDateTime(value, false);
}
