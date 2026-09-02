function sanitizeDbUrl(raw) {
  let u = (raw || '').trim();
  // Strip accidental wrapping quotes
  u = u.replace(/^["']|["']$/g, '').trim();
  // Strip accidental "DATABASE_URL=" prefix
  if (u.startsWith('DATABASE_URL=')) {
    u = u.slice('DATABASE_URL='.length).trim();
  }
  // Strip accidental "POSTGRES_URL=" prefix
  if (u.startsWith('POSTGRES_URL=')) {
    u = u.slice('POSTGRES_URL='.length).trim();
  }
  u = u.replace(/^["']|["']$/g, '').trim();
  return u;
}

const tests = [
  'DATABASE_URL=postgresql://postgres:pass@host:5432/db',
  '"postgresql://postgres:pass@host:5432/db"',
  '  postgresql://postgres:pass@host:5432/db  ',
  'database',
  'supabase'
];

for (const t of tests) {
  const clean = sanitizeDbUrl(t);
  const isValid = clean.startsWith('postgresql://') || clean.startsWith('postgres://');
  console.log(`Input: ${t} => Clean: "${clean}", Valid URI: ${isValid}`);
}
