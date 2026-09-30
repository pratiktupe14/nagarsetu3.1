process.env.NODE_ENV = process.env.NODE_ENV || 'test';
const { test, describe } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const { authenticateToken, requireRole, JWT_SECRET } = require('../src/middleware/auth');

describe('NAGARSETU Cryptographic Authentication Security Audit', () => {

  test('1. Missing Token must be rejected with 401', async () => {
    let statusCode = null;
    let responseBody = null;
    const req = { headers: {} };
    const res = {
      status: (code) => {
        statusCode = code;
        return {
          json: (body) => { responseBody = body; }
        };
      }
    };
    let nextCalled = false;

    await authenticateToken(req, res, () => { nextCalled = true; });

    assert.strictEqual(statusCode, 401, 'Missing token must return HTTP 401');
    assert.strictEqual(nextCalled, false, 'next() must not be called when token is missing');
    assert.strictEqual(responseBody?.error, 'Access token required');
  });

  test('2. Valid Express JWT must be accepted with 200/next()', async () => {
    const validExpressToken = jwt.sign(
      { id: '1', role: 'city_admin', email: 'admin@nagarsetu.gov.in', name: 'Municipal Admin' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    const req = { headers: { authorization: `Bearer ${validExpressToken}` } };
    const res = { status: () => ({ json: () => {} }) };
    let nextCalled = false;

    await authenticateToken(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true, 'Valid Express JWT must invoke next()');
    assert.strictEqual(req.user?.role, 'city_admin');
    assert.strictEqual(req.user?.email, 'admin@nagarsetu.gov.in');
  });

  test('3. Expired Express JWT must be rejected with 403', async () => {
    const expiredExpressToken = jwt.sign(
      { id: '1', role: 'city_admin' },
      JWT_SECRET,
      { expiresIn: '-10s' }
    );
    let statusCode = null;
    const req = { headers: { authorization: `Bearer ${expiredExpressToken}` } };
    const res = {
      status: (code) => {
        statusCode = code;
        return { json: () => {} };
      }
    };
    let nextCalled = false;

    await authenticateToken(req, res, () => { nextCalled = true; });

    assert.strictEqual(statusCode, 403, 'Expired Express token must return HTTP 403');
    assert.strictEqual(nextCalled, false, 'next() must not be called on expired token');
  });

  test('4. Self-Signed / Decode-Only Fake JWT Bypass must be rejected with 403', async () => {
    // Attacker crafts a token claiming to be admin from official Supabase issuer, but signed with attacker key
    const forgedToken = jwt.sign(
      {
        sub: 'fake-admin-uuid',
        email: 'attacker@evil.com',
        role: 'city_admin',
        aud: 'authenticated',
        iss: 'https://ozeiymkbxtrqqdoxtmhm.supabase.co/auth/v1'
      },
      'attacker-secret-key-cannot-bypass-crypto-check',
      { expiresIn: '1h' }
    );
    let statusCode = null;
    const req = { headers: { authorization: `Bearer ${forgedToken}` } };
    const res = {
      status: (code) => {
        statusCode = code;
        return { json: () => {} };
      }
    };
    let nextCalled = false;

    await authenticateToken(req, res, () => { nextCalled = true; });

    assert.strictEqual(statusCode, 403, 'Cryptographically unverified fake JWT must return HTTP 403');
    assert.strictEqual(nextCalled, false, 'Attacker token must not reach next()');
  });

  test('5. Wrong Audience must be rejected with 403', async () => {
    const wrongAudToken = jwt.sign(
      {
        sub: 'user-uuid',
        aud: 'wrong-audience',
        iss: 'https://ozeiymkbxtrqqdoxtmhm.supabase.co/auth/v1'
      },
      'somekey',
      { expiresIn: '1h' }
    );
    let statusCode = null;
    const req = { headers: { authorization: `Bearer ${wrongAudToken}` } };
    const res = {
      status: (code) => {
        statusCode = code;
        return { json: () => {} };
      }
    };
    let nextCalled = false;

    await authenticateToken(req, res, () => { nextCalled = true; });

    assert.strictEqual(statusCode, 403, 'Wrong audience token must return HTTP 403');
    assert.strictEqual(nextCalled, false);
  });

  test('6. Wrong Issuer must be rejected with 403', async () => {
    const wrongIssToken = jwt.sign(
      {
        sub: 'user-uuid',
        aud: 'authenticated',
        iss: 'https://unauthorized-project.supabase.co/auth/v1'
      },
      'somekey',
      { expiresIn: '1h' }
    );
    let statusCode = null;
    const req = { headers: { authorization: `Bearer ${wrongIssToken}` } };
    const res = {
      status: (code) => {
        statusCode = code;
        return { json: () => {} };
      }
    };
    let nextCalled = false;

    await authenticateToken(req, res, () => { nextCalled = true; });

    assert.strictEqual(statusCode, 403, 'Wrong issuer token must return HTTP 403');
    assert.strictEqual(nextCalled, false);
  });

  test('7. Role Escalation Prevention: requireRole rejects unauthorized role with 403', () => {
    const req = { user: { id: 'citizen-1', role: 'citizen' } };
    let statusCode = null;
    const res = {
      status: (code) => {
        statusCode = code;
        return { json: () => {} };
      }
    };
    let nextCalled = false;

    const middleware = requireRole(['city_admin']);
    middleware(req, res, () => { nextCalled = true; });

    assert.strictEqual(statusCode, 403, 'Citizen must not be authorized for city_admin role');
    assert.strictEqual(nextCalled, false);
  });

  test('8. Role Authorization: requireRole allows authorized role with next()', () => {
    const req = { user: { id: 'admin-1', role: 'city_admin' } };
    let nextCalled = false;
    const res = { status: () => ({ json: () => {} }) };

    const middleware = requireRole(['city_admin', 'admin']);
    middleware(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true, 'city_admin role must be granted access');
  });

  test('9. Recognized Demo Tokens must authenticate citizen with next() and valid profile', async () => {
    const req = { headers: { authorization: 'Bearer demo-token-citizen' } };
    const res = { status: () => ({ json: () => {} }) };
    let nextCalled = false;

    await authenticateToken(req, res, () => { nextCalled = true; });

    assert.strictEqual(nextCalled, true, 'demo-token-citizen must invoke next()');
    assert.strictEqual(req.user?.role, 'citizen');
    assert.strictEqual(req.user?.email, 'citizen8788@nagarsetu.gov.in');
    assert.strictEqual(req.user?.mobile, '8788562103');
  });

  test('10. In Production: Hardcoded demo bearer tokens must be rejected with 403', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const demoTokens = [
        'demo-token',
        'demo-token-citizen',
        'demo-token-city-admin',
        'demo-token-dept-head',
        'demo-token-service-staff'
      ];

      for (const dToken of demoTokens) {
        let statusCode = null;
        const req = { headers: { authorization: `Bearer ${dToken}` } };
        const res = {
          status: (code) => {
            statusCode = code;
            return { json: () => {} };
          }
        };
        let nextCalled = false;

        await authenticateToken(req, res, () => { nextCalled = true; });

        assert.strictEqual(statusCode, 403, `In production, ${dToken} must be rejected with HTTP 403`);
        assert.strictEqual(nextCalled, false, `In production, ${dToken} must not call next()`);
        assert.strictEqual(req.user, undefined, `In production, ${dToken} must not set req.user`);
      }
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

  test('11. In Production: POST /api/auth/demo-token must return 404 Not Found', async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const express = require('express');
      const http = require('http');
      const authRoutes = require('../src/routes/auth.routes');
      const app = express();
      app.use(express.json());
      app.use('/api/auth', authRoutes);

      let server;
      let baseUrl;
      await new Promise((resolve) => {
        server = http.createServer(app);
        server.listen(0, '127.0.0.1', () => {
          baseUrl = `http://127.0.0.1:${server.address().port}`;
          resolve();
        });
      });

      try {
        const res = await fetch(`${baseUrl}/api/auth/demo-token`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: 'citizen' })
        });

        assert.strictEqual(res.status, 404, 'In production, /api/auth/demo-token must return HTTP 404');
        const data = await res.json();
        assert.strictEqual(data.error, 'Not found');
      } finally {
        await new Promise((resolve) => server.close(resolve));
      }
    } finally {
      process.env.NODE_ENV = origEnv;
    }
  });

});
