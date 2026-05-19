const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/init');

const router = express.Router();
const DEFAULT_DEV_SECRET = 'dev-secret-change-in-production';
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_DEV_SECRET;
const JWT_EXPIRES = '24h';
const MS_TENANT_ID = process.env.MS_TENANT_ID;
const MS_CLIENT_ID = process.env.MS_CLIENT_ID;
const ALLOW_INSECURE_MS_LOGIN = process.env.ALLOW_INSECURE_MS_LOGIN === 'true' && process.env.NODE_ENV !== 'production';

if (process.env.NODE_ENV === 'production' && JWT_SECRET === DEFAULT_DEV_SECRET) {
  throw new Error('JWT_SECRET must be set in production.');
}

let cachedOpenIdConfig = null;
let cachedJwks = null;

function base64UrlDecode(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - normalized.length % 4) % 4);
  return Buffer.from(padded, 'base64').toString('utf8');
}

function parseJwtSegment(token, segmentIndex) {
  const parts = (token || '').split('.');
  if (parts.length !== 3 || !parts[segmentIndex]) {
    throw new Error('Malformed token');
  }
  return JSON.parse(base64UrlDecode(parts[segmentIndex]));
}

async function getOpenIdConfig() {
  if (cachedOpenIdConfig) return cachedOpenIdConfig;
  if (!MS_TENANT_ID) throw new Error('MS_TENANT_ID is required for Microsoft login');
  const { default: fetch } = await import('node-fetch');
  const resp = await fetch(`https://login.microsoftonline.com/${MS_TENANT_ID}/v2.0/.well-known/openid-configuration`);
  if (!resp.ok) throw new Error(`Failed to load OpenID config: ${resp.status}`);
  cachedOpenIdConfig = await resp.json();
  return cachedOpenIdConfig;
}

async function getJwks() {
  if (cachedJwks) return cachedJwks;
  const { default: fetch } = await import('node-fetch');
  const config = await getOpenIdConfig();
  const resp = await fetch(config.jwks_uri);
  if (!resp.ok) throw new Error(`Failed to load Microsoft JWKS: ${resp.status}`);
  cachedJwks = await resp.json();
  return cachedJwks;
}

function certToPem(cert) {
  const lines = cert.match(/.{1,64}/g) || [];
  return `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----`;
}

async function verifyMicrosoftIdToken(idToken) {
  if (!idToken) throw new Error('Missing Microsoft idToken');
  if (!MS_CLIENT_ID || !MS_TENANT_ID) throw new Error('Microsoft login is not configured');

  const header = parseJwtSegment(idToken, 0);
  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Unsupported token signing algorithm');
  }

  const jwks = await getJwks();
  const key = (jwks.keys || []).find(k => k.kid === header.kid);
  if (!key || !key.x5c || !key.x5c[0]) {
    throw new Error('Signing key not found for Microsoft token');
  }

  const publicKey = crypto.createPublicKey(certToPem(key.x5c[0]));
  const payload = jwt.verify(idToken, publicKey, {
    algorithms: ['RS256'],
    audience: MS_CLIENT_ID,
    issuer: [
      `https://login.microsoftonline.com/${MS_TENANT_ID}/v2.0`,
      `https://sts.windows.net/${MS_TENANT_ID}/`
    ]
  });

  if (payload.tid && payload.tid !== MS_TENANT_ID) {
    throw new Error('Token tenant mismatch');
  }

  return {
    msId: payload.oid || payload.sub,
    name: payload.name || payload.preferred_username,
    email: payload.email || payload.preferred_username || ''
  };
}

// ─── Microsoft OAuth2 callback ───────────────────────────────────────────────
// After MSAL client-side auth, the frontend sends us the id_token.
// We verify it and create/update the user in our DB.
router.post('/microsoft', async (req, res) => {
  try {
    const { idToken, name: fallbackName, email: fallbackEmail, msId: fallbackMsId } = req.body;
    let profile;

    if (idToken) {
      profile = await verifyMicrosoftIdToken(idToken);
    } else if (ALLOW_INSECURE_MS_LOGIN) {
      profile = { msId: fallbackMsId, name: fallbackName, email: fallbackEmail };
    } else {
      return res.status(400).json({ error: 'Microsoft idToken is required' });
    }

    const { name, email, msId } = profile;

    if (!msId || !name) {
      return res.status(400).json({ error: 'Missing required fields from Microsoft token' });
    }

    const db = getDB();

    // Upsert user
    let user = db.prepare('SELECT * FROM users WHERE ms_id = ?').get(msId);
    if (!user) {
      const id = uuidv4();
      // New users are students by default; teachers can be promoted in admin panel
      db.prepare(`
        INSERT INTO users (id, ms_id, name, email, role, last_login)
        VALUES (?, ?, ?, ?, 'student', datetime('now'))
      `).run(id, msId, name, email || '');
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    } else {
      db.prepare('UPDATE users SET last_login = datetime(\'now\'), name = ?, email = ? WHERE ms_id = ?')
        .run(name, email || user.email, msId);
      user = db.prepare('SELECT * FROM users WHERE ms_id = ?').get(msId);
    }

    // Issue our own JWT
    const token = jwt.sign(
      { userId: user.id, name: user.name, role: user.role, msId: user.ms_id },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('[AUTH] Microsoft login error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// ─── Guest / Name-only login ──────────────────────────────────────────────────
// For schools where IT admin setup is not yet done
router.post('/guest', async (req, res) => {
  try {
    const { name, classCode } = req.body;
    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: 'Name must be at least 2 characters' });
    }
    if (!classCode) {
      return res.status(400).json({ error: 'Class code required' });
    }

    const db = getDB();

    // Check class code is valid (must match an active assignment)
    const assignment = db.prepare('SELECT id FROM assignments WHERE id = ?').get(classCode);
    if (!assignment) {
      return res.status(404).json({ error: 'Invalid assignment code' });
    }

    const userId = `guest_${uuidv4()}`;
    const safeName = name.trim();
    const guestEmail = `${safeName.toLowerCase().replace(/[^a-z0-9]/g, '')}_${userId.substring(6, 14)}@guest.school.local`;

    // Insert guest user to database so submissions foreign key works
    db.prepare(`
      INSERT INTO users (id, ms_id, name, email, role, last_login)
      VALUES (?, NULL, ?, ?, 'student', datetime('now'))
    `).run(userId, safeName, guestEmail);

    const token = jwt.sign(
      {
        userId: userId,
        name: safeName,
        role: 'student',
        isGuest: true,
        assignmentId: classCode
      },
      JWT_SECRET,
      { expiresIn: '8h' } // One school day
    );

    res.json({
      token,
      user: { id: userId, name: safeName, role: 'student', isGuest: true }
    });
  } catch (err) {
    console.error('[AUTH] Guest login error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// ─── Verify token ─────────────────────────────────────────────────────────────
router.get('/verify', requireAuth, (req, res) => {
  const db = getDB();
  const user = req.user.isGuest
    ? req.user
    : db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(req.user.userId);

  if (!user) return res.status(401).json({ error: 'User not found' });
  res.json({ user });
});

// ─── Promote user to teacher (admin only) ─────────────────────────────────────
router.patch('/users/:id/role', requireAuth, requireRole('admin'), (req, res) => {
  const { role } = req.body;
  if (!['teacher', 'student', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  const db = getDB();
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  res.json({ success: true });
});

// ─── List all users (admin only) ──────────────────────────────────────────────
router.get('/users', requireAuth, requireRole('admin', 'teacher'), (req, res) => {
  const db = getDB();
  const users = db.prepare('SELECT id, name, email, role, created_at, last_login FROM users ORDER BY name').all();
  res.json(users);
});

// ─── Middleware ────────────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}

module.exports = router;
module.exports.requireAuth = requireAuth;
module.exports.requireRole = requireRole;
