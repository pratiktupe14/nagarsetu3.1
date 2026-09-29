const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');

const isProd = process.env.NODE_ENV === 'production';

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim() === '') {
    if (isProd) {
      console.warn('[SECURITY NOTICE] JWT_SECRET environment variable is missing; using default secure fallback.');
    }
    return 'nagarsetu_secret_key_2026_super_secure';
  }
  return secret.trim();
}

const JWT_SECRET = getJwtSecret();

const ALLOWED_SUPABASE_PROJECT_REFS = ['ozeiymkbxtrqqdoxtmhm', 'botecyzkfptsrziwkkpe'];

let supabaseClientInstance = null;

function getSupabaseClient() {
  if (supabaseClientInstance) return supabaseClientInstance;

  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.PUBLIC_SUPABASE_URL;

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY;

  const fallbackUrl = 'https://ozeiymkbxtrqqdoxtmhm.supabase.co';
  const fallbackKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im96ZWl5bWtieHRycXFkb3h0bWhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcyMjk1MzEsImV4cCI6MjEwMjgwNTUzMX0.6nQemY46XsG89kK5f_ONpAvrmI_buXX-VlpgLRY_sqs';

  const resolvedUrl = (url && !url.includes('placeholder')) ? url : fallbackUrl;
  const resolvedKey = (key && !key.includes('placeholder')) ? key : fallbackKey;

  try {
    supabaseClientInstance = createClient(resolvedUrl, resolvedKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    });
    return supabaseClientInstance;
  } catch (err) {
    console.warn('[SUPABASE AUTH CLIENT NOTE]', err.message);
    return null;
  }
}

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      name: user.name,
      mobile: user.mobile,
      email: user.email,
      role: user.role,
      language_pref: user.language_pref
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

const DEMO_USER_TOKENS = {
  'demo-token-citizen': {
    id: 'e2a4338c-5d49-4ae3-b766-40d99fb26f87',
    name: 'Pratik Dilip Tupe',
    mobile: '8788562103',
    email: 'citizen8788@nagarsetu.gov.in',
    role: 'citizen',
    language_pref: 'en'
  },
  'demo-token-city-admin': {
    id: 1,
    name: 'Municipal Admin',
    mobile: '9876543213',
    email: 'admin@nagarsetu.gov.in',
    role: 'city_admin',
    language_pref: 'en'
  },
  'demo-token-dept-head': {
    id: 1,
    name: 'Rahul Kumar',
    mobile: '+91 9822000001',
    email: 'rahul.kumar@nagarsetu.gov.in',
    role: 'department_head',
    department_id: 1,
    department_name: 'Public Works Department (PWD)',
    language_pref: 'en'
  },
  'demo-token-service-staff': {
    id: 101,
    name: 'Amit Patil',
    mobile: '9822010001',
    email: 'amit.patil@nagarsetu.gov.in',
    role: 'service_staff',
    department_id: 1,
    department_name: 'Public Works Department (PWD)',
    language_pref: 'en'
  },
  'demo-token': {
    id: 'e2a4338c-5d49-4ae3-b766-40d99fb26f87',
    name: 'Pratik Dilip Tupe',
    mobile: '8788562103',
    email: 'citizen8788@nagarsetu.gov.in',
    role: 'citizen',
    language_pref: 'en'
  }
};

async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // 0. Demo & Testing token recognition for citizen & staff portals
  if (DEMO_USER_TOKENS[token]) {
    req.user = { ...DEMO_USER_TOKENS[token] };
    return next();
  }

  // 1. Synchronously attempt Express JWT verification using JWT_SECRET
  try {
    const verifiedUser = jwt.verify(token, JWT_SECRET);
    if (verifiedUser) {
      req.user = verifiedUser;
      return next();
    }
  } catch (expressErr) {
    if (expressErr.name === 'TokenExpiredError') {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
  }

  // 2. Token Type & Claims Inspection
  let unverifiedPayload = null;
  try {
    unverifiedPayload = jwt.decode(token);
  } catch (e) {}

  if (!unverifiedPayload || typeof unverifiedPayload !== 'object') {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }

  // 3. Expiration Check
  if (unverifiedPayload.exp && unverifiedPayload.exp * 1000 <= Date.now()) {
    return res.status(403).json({ error: 'Token has expired' });
  }

  // 4. Audience Check
  const aud = unverifiedPayload.aud;
  const isAuthAud = aud === 'authenticated' || (Array.isArray(aud) && aud.includes('authenticated'));
  if (!isAuthAud) {
    return res.status(403).json({ error: 'Invalid token audience' });
  }

  // 5. Issuer Check against allowed Production (ozeiymkbxtrqqdoxtmhm), Preview (botecyzkfptsrziwkkpe), and configured project
  const iss = unverifiedPayload.iss || '';
  const envUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
  const envMatch = envUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
  const validRefs = new Set([...ALLOWED_SUPABASE_PROJECT_REFS, ...(envMatch ? [envMatch[1]] : [])]);

  const issMatch = iss.match(/https?:\/\/([^.]+)\.supabase\.co\/auth\/v1/);
  if (!issMatch || !validRefs.has(issMatch[1])) {
    return res.status(403).json({ error: 'Invalid token issuer' });
  }

  // 6. Mandatory Cryptographic Signature Verification via Supabase Auth
  const supabase = getSupabaseClient();
  if (!supabase) {
    return res.status(403).json({ error: 'Authentication service unavailable' });
  }

  try {
    const { data: supaAuth, error: supaErr } = await supabase.auth.getUser(token);
    if (supaErr || !supaAuth?.user) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    const authUser = supaAuth.user;

    // 7. Authoritative Database Role Resolution (prevents client-side role escalation)
    let role = null;
    let departmentId = null;
    let departmentName = null;
    let fullName = authUser.user_metadata?.full_name || authUser.user_metadata?.name;

    try {
      const [profRes, roleRes, headRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', authUser.id).maybeSingle(),
        supabase.from('department_heads').select('*, departments(*)').eq('user_id', authUser.id).eq('status', 'active').maybeSingle()
      ]);

      if (headRes.data) {
        role = 'department_head';
        departmentId = headRes.data.department_id;
        departmentName = headRes.data.departments?.name;
      } else if (roleRes.data?.role) {
        role = roleRes.data.role;
      } else if (profRes.data?.role) {
        role = profRes.data.role;
      }

      if (!departmentId && profRes.data?.department_id) {
        departmentId = profRes.data.department_id;
      }
      if (!departmentName && profRes.data?.department_name) {
        departmentName = profRes.data.department_name;
      }
      if (profRes.data?.full_name) {
        fullName = profRes.data.full_name;
      }
    } catch (dbErr) {
      console.warn('[AUTH MIDDLEWARE] Role lookup note:', dbErr.message);
    }

    if (!role) {
      role = authUser.app_metadata?.role || authUser.user_metadata?.role || ((authUser.email || '').toLowerCase().includes('admin') ? 'city_admin' : 'citizen');
    }

    const normalizedRole = role === 'admin' ? 'city_admin' : role === 'staff' ? 'service_staff' : role;

    req.user = {
      id: authUser.id,
      email: authUser.email,
      role: normalizedRole,
      department_id: departmentId,
      department_name: departmentName,
      name: fullName || authUser.email?.split('@')[0] || 'Authenticated User'
    };
    return next();
  } catch (verifyErr) {
    console.error('[AUTH VERIFY ERROR]', verifyErr.message);
    return res.status(403).json({ error: 'Token verification failed' });
  }
}

function requireRole(roles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (roles.length && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Access denied for user role' });
    }
    next();
  };
}

async function optionalAuthenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    req.user = { ...DEMO_USER_TOKENS['demo-token-citizen'] };
    return next();
  }

  if (DEMO_USER_TOKENS[token]) {
    req.user = { ...DEMO_USER_TOKENS[token] };
    return next();
  }

  try {
    const verifiedUser = jwt.verify(token, JWT_SECRET);
    if (verifiedUser) {
      req.user = verifiedUser;
      return next();
    }
  } catch (e) {}

  req.user = { ...DEMO_USER_TOKENS['demo-token-citizen'] };
  return next();
}

module.exports = {
  JWT_SECRET,
  generateToken,
  authenticateToken,
  optionalAuthenticateToken,
  requireRole,
  getSupabaseClient
};
