const { createClient } = require('@supabase/supabase-js');

const supabaseUrl =
  process.env.SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.PUBLIC_SUPABASE_URL ||
  'https://ozeiymkbxtrqqdoxtmhm.supabase.co';

const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96ZWl5bWtieHRycXFkb3h0bWhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyMjk1MzEsImV4cCI6MjEwMjgwNTUzMX0.6nQemY46XsG89kK5f_ONpAvrmI_buXX-VlpgLRY_sqs';

let supabase = null;

if (supabaseUrl && supabaseKey && !supabaseUrl.includes('placeholder')) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
  } catch (e) {
    console.warn('[SUPABASE STORAGE] Initialization note:', e.message);
  }
}

/**
 * Uploads a file buffer to Supabase Storage bucket (default 'issues')
 * and returns the full public HTTPS URL.
 * 
 * @param {Buffer} buffer 
 * @param {string} filename 
 * @param {string} mimetype 
 * @param {string} bucketName 
 * @returns {Promise<{ publicUrl: string, filePath: string }>}
 */
async function uploadBufferToSupabase(buffer, filename, mimetype = 'image/jpeg', bucketName = 'issues') {
  if (!supabase) {
    throw new Error('Supabase client is not configured on the backend. Check SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  }

  const cleanFilename = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  const filePath = `uploads/${cleanFilename}`;

  const { data, error } = await supabase.storage
    .from(bucketName)
    .upload(filePath, buffer, {
      contentType: mimetype,
      cacheControl: '3600',
      upsert: true
    });

  if (error) {
    console.error('[SUPABASE STORAGE ERROR]', error.message);
    throw new Error(`Supabase Storage upload failed: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from(bucketName)
    .getPublicUrl(filePath);

  if (!publicUrlData || !publicUrlData.publicUrl) {
    throw new Error('Failed to retrieve public URL from Supabase Storage.');
  }

  return {
    publicUrl: publicUrlData.publicUrl,
    filePath: data.path || filePath
  };
}

module.exports = {
  supabase,
  uploadBufferToSupabase
};
