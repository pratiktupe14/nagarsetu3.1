import { createClient } from '@supabase/supabase-js';
import { getApiUrl } from '../config/apiConfig';

const FALLBACK_SUPABASE_URL = 'https://ozeiymkbxtrqqdoxtmhm.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96ZWl5bWtieHRycXFkb3h0bWhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyMjk1MzEsImV4cCI6MjEwMjgwNTUzMX0.6nQemY46XsG89kK5f_ONpAvrmI_buXX-VlpgLRY_sqs';

const rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

export const SUPABASE_PROJECT_URL =
  (rawUrl && !rawUrl.includes('placeholder'))
    ? rawUrl
    : FALLBACK_SUPABASE_URL;

export const SUPABASE_ANON_KEY =
  (rawKey && !rawKey.includes('placeholder'))
    ? rawKey
    : FALLBACK_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    SUPABASE_PROJECT_URL &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_PROJECT_URL.includes('placeholder') &&
    !SUPABASE_ANON_KEY.includes('placeholder')
  );
};

export const supabase = createClient(
  SUPABASE_PROJECT_URL,
  SUPABASE_ANON_KEY
);

export const isValidUuid = (val?: string | null): boolean => {
  if (!val || typeof val !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val.trim());
};

export const DEFAULT_CIVIC_IMAGE_PLACEHOLDER = '/uploads/civic-default.jpg';

export const getValidImageUrl = (url?: string | null): string => {
  const getDefault = () => {
    const apiBase = getApiUrl();
    return apiBase ? `${apiBase.replace(/\/$/, '')}${DEFAULT_CIVIC_IMAGE_PLACEHOLDER}` : DEFAULT_CIVIC_IMAGE_PLACEHOLDER;
  };

  if (!url || typeof url !== 'string') return getDefault();
  const trimmed = url.trim();
  if (!trimmed || trimmed === '' || trimmed === 'undefined' || trimmed === 'null' || trimmed.startsWith('blob:')) {
    return getDefault();
  }
  
  // Full HTTP/HTTPS URLs or Base64 Data URIs
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image/')) {
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
    const apiBase = getApiUrl();
    const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
    if (apiBase) {
      return `${apiBase.replace(/\/$/, '')}${cleanPath}`;
    }
    return cleanPath;
  }
  
  return trimmed;
};



