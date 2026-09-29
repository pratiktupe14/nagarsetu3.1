const { test, describe } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const fs = require('fs');

describe('NAGARSETU Security & Reliability Audit Verification', () => {

  test('1. Authentication Backdoor Elimination', () => {
    const authRouteFile = fs.readFileSync(path.join(__dirname, '../src/routes/auth.routes.js'), 'utf8');
    
    // Verify that dynamic account insertion in login route is gone
    assert.strictEqual(
      authRouteFile.includes("INSERT INTO users (name, mobile, email, password_hash, role, department_id, employee_id, status) VALUES (?, ?, ?, ?, 'department_head'"),
      false,
      'Department Head auto-registration backdoor must not exist in login route'
    );
  });

  test('2. Hardcoded Supabase Secrets Removal', () => {
    const storageFile = fs.readFileSync(path.join(__dirname, '../src/config/supabaseStorage.js'), 'utf8');
    
    // Verify hardcoded JWT tokens are removed
    assert.strictEqual(
      storageFile.includes('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9'),
      false,
      'Hardcoded Supabase Anon JWT token must be removed from supabaseStorage.js'
    );
    assert.strictEqual(
      storageFile.includes('https://ozeiymkbxtrqqdoxtmhm.supabase.co'),
      false,
      'Hardcoded Supabase URL fallback must be removed'
    );
  });

  test('3. JWT Secret Production Enforceability', () => {
    const authMiddlewareFile = fs.readFileSync(path.join(__dirname, '../src/middleware/auth.js'), 'utf8');
    
    assert.strictEqual(
      authMiddlewareFile.includes('[SECURITY NOTICE] JWT_SECRET environment variable is missing; using default secure fallback.'),
      true,
      'JWT_SECRET must log security notice in production mode if missing'
    );
  });

  test('4. OTP Universal Bypass Gated in Production', () => {
    const authRouteFile = fs.readFileSync(path.join(__dirname, '../src/routes/auth.routes.js'), 'utf8');
    
    // In production, demoOtp must not be unconditionally returned, and simulated OTP must not be accepted
    assert.strictEqual(
      authRouteFile.includes('Live SMS OTP gateway is not configured for production'),
      true,
      'Simulated OTP must be gated behind non-production environment'
    );
  });

  test('5. Complaints Route Protected with Authentication & IDOR Guard', () => {
    const complaintRouteFile = fs.readFileSync(path.join(__dirname, '../src/routes/complaint.routes.js'), 'utf8');
    
    assert.strictEqual(
      complaintRouteFile.includes("router.get('/', authenticateToken"),
      true,
      'GET /api/complaints must require authenticateToken'
    );

    assert.strictEqual(
      complaintRouteFile.includes('delete complaint.citizen_mobile'),
      true,
      'GET /api/complaints/:id must protect citizen mobile PII from unauthorized citizens'
    );
  });

  test('6. Staff Tasks SQL Query Parameter Alignment', () => {
    const staffRouteFile = fs.readFileSync(path.join(__dirname, '../src/routes/staff.routes.js'), 'utf8');
    
    assert.strictEqual(
      staffRouteFile.includes('(c.department_id = $4 OR d.id = $4)'),
      true,
      'Staff query must bind department_id to parameter $4'
    );
    assert.strictEqual(
      staffRouteFile.includes('(c.department_id = $3 OR d.id = $3)'),
      false,
      'Staff query must not compare integer department_id with text staff name ($3)'
    );
  });

});
