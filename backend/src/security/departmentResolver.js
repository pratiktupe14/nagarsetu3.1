const { query } = require('../config/db');

/**
 * Canonical Database-Backed Department Resolver
 * Resolves department inputs (numeric ID, text ID, code, name, user_id, email, employee_id)
 * into a canonical { id, code } object.
 */
async function getCanonicalDepartmentId(deptInput) {
  if (deptInput === null || deptInput === undefined || deptInput === '') return null;
  const inputStr = String(deptInput).trim();
  if (!inputStr) return null;

  const codeMap = {
    '1': 'PWD', 'pwd': 'PWD',
    '2': 'SAN', 'san': 'SAN',
    '3': 'WTR', 'wtr': 'WTR',
    '4': 'DRN', 'drn': 'DRN',
    '5': 'ELE', 'ele': 'ELE',
    '6': 'TRF', 'trf': 'TRF',
    '7': 'MNT', 'mnt': 'MNT'
  };

  const candidateCode = codeMap[inputStr.toLowerCase()] || inputStr;

  try {
    // 1. Direct match in departments table by exact Code, Name, or ID (PostgreSQL UUID or Integer or String)
    let resDept = await query(
      `SELECT id, code FROM departments 
       WHERE UPPER(code) = UPPER($1) 
          OR UPPER(code) = UPPER($2) 
          OR UPPER(name) = UPPER($1) 
          OR CAST(id AS TEXT) = $1`,
      [inputStr, candidateCode]
    );
    if (resDept.rows && resDept.rows.length > 0) {
      return { id: String(resDept.rows[0].id), code: String(resDept.rows[0].code).toUpperCase() };
    }

    // 2. Structured pattern extractions (e.g. "dept-1", "dept-PWD", "PWD-01", "Roads & Public Works (PWD)")
    let cleanVal = inputStr;
    if (cleanVal.toLowerCase().startsWith('dept-')) {
      cleanVal = cleanVal.slice(5).trim();
    }
    const matchParen = inputStr.match(/\(([^)]+)\)/);
    if (matchParen && matchParen[1]) {
      const insideParen = matchParen[1].trim();
      let resParen = await query(
        'SELECT id, code FROM departments WHERE UPPER(code) = UPPER($1) OR CAST(id AS TEXT) = $1 OR UPPER(name) = UPPER($1)',
        [insideParen]
      );
      if (resParen.rows && resParen.rows.length === 1) {
        return { id: String(resParen.rows[0].id), code: String(resParen.rows[0].code).toUpperCase() };
      }
    }

    if (cleanVal && cleanVal !== inputStr) {
      let resClean = await query(
        'SELECT id, code FROM departments WHERE UPPER(code) = UPPER($1) OR CAST(id AS TEXT) = $1 OR UPPER(name) = UPPER($1)',
        [cleanVal]
      );
      if (resClean.rows && resClean.rows.length === 1) {
        return { id: String(resClean.rows[0].id), code: String(resClean.rows[0].code).toUpperCase() };
      }
    }

    // 3. Email, Employee ID, or User ID lookups in department_heads table
    let resDh = await query(
      `SELECT dh.department_id, d.id as d_id, d.code as d_code FROM department_heads dh 
       LEFT JOIN departments d ON (
         CAST(d.id AS TEXT) = CAST(dh.department_id AS TEXT)
         OR UPPER(d.code) = UPPER(CAST(dh.department_id AS TEXT))
         OR LOWER(d.name) = LOWER(CAST(dh.department_id AS TEXT))
       ) 
       WHERE LOWER(dh.email) = LOWER($1)
          OR (dh.employee_id IS NOT NULL AND dh.employee_id != '' AND dh.employee_id = $1)
          OR CAST(dh.user_id AS TEXT) = $1
       ORDER BY dh.id DESC LIMIT 1`,
      [inputStr]
    );
    if (resDh.rows && resDh.rows.length > 0) {
      const row = resDh.rows[0];
      if (row.d_id && row.d_code) return { id: String(row.d_id), code: String(row.d_code).toUpperCase() };
      if (row.department_id) {
        const subRes = await getCanonicalDepartmentId(row.department_id);
        if (subRes) return subRes;
      }
    }

    // 4. Email, Employee ID, or User ID lookups in field_staff table
    let resFs = await query(
      `SELECT fs.department_id, d.id as d_id, d.code as d_code FROM field_staff fs 
       LEFT JOIN departments d ON (
         CAST(d.id AS TEXT) = CAST(fs.department_id AS TEXT)
         OR UPPER(d.code) = UPPER(CAST(fs.department_id AS TEXT))
         OR LOWER(d.name) = LOWER(CAST(fs.department_id AS TEXT))
       ) 
       WHERE LOWER(fs.email) = LOWER($1)
          OR (fs.employee_id IS NOT NULL AND fs.employee_id != '' AND fs.employee_id = $1)
          OR CAST(fs.user_id AS TEXT) = $1
       ORDER BY fs.id DESC LIMIT 1`,
      [inputStr]
    );
    if (resFs.rows && resFs.rows.length > 0) {
      const row = resFs.rows[0];
      if (row.d_id && row.d_code) return { id: String(row.d_id), code: String(row.d_code).toUpperCase() };
      if (row.department_id) {
        const subRes = await getCanonicalDepartmentId(row.department_id);
        if (subRes) return subRes;
      }
    }

    // 5. Lookups in users table
    let resUsers = await query(
      `SELECT u.department_id, d.id as d_id, d.code as d_code FROM users u 
       LEFT JOIN departments d ON (
         CAST(d.id AS TEXT) = CAST(u.department_id AS TEXT)
         OR UPPER(d.code) = UPPER(CAST(u.department_id AS TEXT))
         OR LOWER(d.name) = LOWER(CAST(u.department_id AS TEXT))
       ) 
       WHERE (CAST(u.id AS TEXT) = $1 OR LOWER(u.email) = LOWER($1) OR u.employee_id = $1)
         AND u.department_id IS NOT NULL AND u.department_id != ''
       ORDER BY u.id DESC LIMIT 1`,
      [inputStr]
    );
    if (resUsers.rows && resUsers.rows.length > 0) {
      const row = resUsers.rows[0];
      if (row.d_id && row.d_code) return { id: String(row.d_id), code: String(row.d_code).toUpperCase() };
      if (row.department_id) {
        const subRes = await getCanonicalDepartmentId(row.department_id);
        if (subRes) return subRes;
      }
    }

  } catch (e) {
    console.error('getCanonicalDepartmentId error', e);
  }

  return null;
}

/**
 * Resolves the authenticated user's department canonically from req.user context.
 */
async function resolveUserDepartment(req) {
  if (!req || !req.user) return { userDeptId: null, userDeptCode: null, canonical: null };
  const user = req.user;

  // 1. If user is department_head, query department_heads by user.id or user.email
  if (user.id || user.email) {
    let resDh = await query(
      `SELECT dh.department_id, d.id as d_id, d.code as d_code FROM department_heads dh 
       LEFT JOIN departments d ON (
         CAST(d.id AS TEXT) = CAST(dh.department_id AS TEXT)
         OR UPPER(d.code) = UPPER(CAST(dh.department_id AS TEXT))
         OR LOWER(d.name) = LOWER(CAST(dh.department_id AS TEXT))
       ) 
       WHERE (CAST(dh.user_id AS TEXT) = CAST($1 AS TEXT) OR LOWER(dh.email) = LOWER($2))
       ORDER BY dh.id DESC LIMIT 1`,
      [String(user.id || ''), String(user.email || '').toLowerCase()]
    );
    if (resDh.rows && resDh.rows.length > 0) {
      const row = resDh.rows[0];
      if (row.d_id && row.d_code) {
        const canonical = { id: String(row.d_id), code: String(row.d_code).toUpperCase() };
        return { userDeptId: canonical.id, userDeptCode: canonical.code, canonical };
      }
      if (row.department_id) {
        const res = await getCanonicalDepartmentId(row.department_id);
        if (res) return { userDeptId: res.id, userDeptCode: res.code, canonical: res };
      }
    }
  }

  // 2. Query users table
  if (user.id || user.email) {
    let resU = await query(
      `SELECT u.department_id, d.id as d_id, d.code as d_code FROM users u 
       LEFT JOIN departments d ON (
         CAST(d.id AS TEXT) = CAST(u.department_id AS TEXT)
         OR UPPER(d.code) = UPPER(CAST(u.department_id AS TEXT))
         OR LOWER(d.name) = LOWER(CAST(u.department_id AS TEXT))
       ) 
       WHERE (CAST(u.id AS TEXT) = CAST($1 AS TEXT) OR LOWER(u.email) = LOWER($2))
         AND u.department_id IS NOT NULL AND u.department_id != ''
       ORDER BY u.id DESC LIMIT 1`,
      [String(user.id || ''), String(user.email || '').toLowerCase()]
    );
    if (resU.rows && resU.rows.length > 0) {
      const row = resU.rows[0];
      if (row.d_id && row.d_code) {
        const canonical = { id: String(row.d_id), code: String(row.d_code).toUpperCase() };
        return { userDeptId: canonical.id, userDeptCode: canonical.code, canonical };
      }
      if (row.department_id) {
        const res = await getCanonicalDepartmentId(row.department_id);
        if (res) return { userDeptId: res.id, userDeptCode: res.code, canonical: res };
      }
    }
  }

  if (user.department_id) {
    const res = await getCanonicalDepartmentId(user.department_id);
    if (res) return { userDeptId: res.id, userDeptCode: res.code, canonical: res };
  }
  return { userDeptId: null, userDeptCode: null, canonical: null };
}

/**
 * Fail-closed security guard checking whether two department inputs resolve to the same canonical department.
 */
async function isDeptMatch(deptA, deptB) {
  if (deptA === null || deptA === undefined || deptA === '') return false;
  if (deptB === null || deptB === undefined || deptB === '') return false;
  
  const objA = await getCanonicalDepartmentId(deptA);
  const objB = await getCanonicalDepartmentId(deptB);
  
  if (objA && objB) {
    if (String(objA.id) === String(objB.id) || String(objA.code).toUpperCase() === String(objB.code).toUpperCase()) {
      return true;
    }
  }

  const normFallback = (d) => {
    const s = String(d || '').trim().toLowerCase();
    if (s === '1' || s === 'pwd' || s.includes('pwd') || s.includes('public works') || s.startsWith('pwd-')) return 'PWD';
    if (s === '2' || s === 'san' || s.includes('san') || s.includes('waste') || s.includes('sanitat') || s.startsWith('san-')) return 'SAN';
    if (s === '3' || s === 'wtr' || s.includes('wtr') || s.includes('water') || s.includes('sewerage') || s.startsWith('wtr-')) return 'WTR';
    if (s === '4' || s === 'drn' || s.includes('drn') || s.includes('drain') || s.includes('sewage') || s.startsWith('drn-')) return 'DRN';
    if (s === '5' || s === 'ele' || s.includes('ele') || s.includes('electric') || s.includes('light') || s.startsWith('ele-')) return 'ELE';
    if (s === '6' || s === 'trf' || s.includes('trf') || s.includes('traffic') || s.startsWith('trf-')) return 'TRF';
    if (s === '7' || s === 'mnt' || s.includes('mnt') || s.includes('maint') || s.startsWith('mnt-')) return 'MNT';
    return s.toUpperCase();
  };

  const c1 = normFallback(deptA);
  const c2 = normFallback(deptB);
  if (c1 && c2 && c1 !== 'UNASSIGNED' && c2 !== 'UNASSIGNED') {
    return c1 === c2;
  }

  return false;
}

module.exports = {
  getCanonicalDepartmentId,
  resolveUserDepartment,
  isDeptMatch
};
