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

