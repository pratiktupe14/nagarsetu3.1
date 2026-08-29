import { createClient } from '@supabase/supabase-js';

export const SUPABASE_PROJECT_URL = import.meta.env.VITE_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    SUPABASE_PROJECT_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_PROJECT_URL.includes('placeholder') &&
    !SUPABASE_ANON_KEY.includes('placeholder')
  );
};

export const supabase = createClient(
  SUPABASE_PROJECT_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-anon-key'
);

export const isValidUuid = (val?: string | null): boolean => {
  if (!val || typeof val !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());
};

export const DEFAULT_CIVIC_IMAGE_PLACEHOLDER =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"><rect width="600" height="400" fill="%230f172a"/><g transform="translate(250, 130)"><rect x="10" y="10" width="80" height="80" rx="16" fill="%230284c7"/><path d="M30 65 L45 45 L55 55 L70 35 L80 65 Z" fill="%23ffffff"/><circle cx="40" cy="35" r="7" fill="%23f59e0b"/></g><text x="300" y="270" font-family="sans-serif" font-size="16" font-weight="600" fill="%2394a3b8" text-anchor="middle">NAGARSETU CIVIC PHOTO EVIDENCE</text></svg>';

export const getValidImageUrl = (url?: string | null): string => {
  if (!url || typeof url !== 'string') return DEFAULT_CIVIC_IMAGE_PLACEHOLDER;
  const trimmed = url.trim();
  if (!trimmed || trimmed === '' || trimmed === 'undefined' || trimmed === 'null') {
    return DEFAULT_CIVIC_IMAGE_PLACEHOLDER;
  }
  
  // Full URLs / Data URIs / Blobs
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }
  
  // Supabase Storage paths (e.g. "issues/uploads/...", "uploads/...")
  if (SUPABASE_PROJECT_URL && !SUPABASE_PROJECT_URL.includes('placeholder')) {
    const cleanProjectUrl = SUPABASE_PROJECT_URL.replace(/\/$/, '');
    if (trimmed.startsWith('issues/')) {
      return `${cleanProjectUrl}/storage/v1/object/public/${trimmed}`;
    }
    if (trimmed.startsWith('uploads/')) {
      return `${cleanProjectUrl}/storage/v1/object/public/issues/${trimmed}`;
    }
  }

  // Relative backend upload paths
  if (trimmed.startsWith('/uploads/') || trimmed.startsWith('uploads/')) {
    const apiBase = (import.meta.env.VITE_API_URL || '').trim();
    const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    if (apiBase && !apiBase.includes('localhost')) {
      return `${apiBase.replace(/\/$/, '')}${cleanPath}`;
    }
    return cleanPath;
  }
  
  return trimmed;
};



