const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/init');
const { verifyMicrosoftIdToken } = require('../services/microsoftAuth');

const router = express.Router();
const DEV_JWT_SECRET_PLACEHOLDER = 'dev-secret-change-in-production-long-secret-key-64-chars-minimum';
const JWT_SECRET = process.env.JWT_SECRET || DEV_JWT_SECRET_PLACEHOLDER;
const JWT_EXPIRES = '24h';
const ALLOW_INSECURE_MS_LOGIN = process.env.ALLOW_INSECURE_MS_LOGIN === 'true' && process.env.NODE_ENV !== 'production';
const DEV_MS_LOGIN_SECRET = process.env.DEV_MS_LOGIN_SECRET;

if (process.env.NODE_ENV === 'production') {
  if (
    !process.env.JWT_SECRET ||
    process.env.JWT_SECRET.length < 32 ||
    process.env.JWT_SECRET === DEV_JWT_SECRET_PLACEHOLDER
  ) {
    throw new Error('FATAL: JWT_SECRET is required in production, must be at least 32 characters, and cannot use the development placeholder value.');
  }
}

function safeSecretEquals(expected, provided) {
  const expectedBuf = Buffer.from(expected || '', 'utf8');
  const providedBuf = Buffer.from(provided || '', 'utf8');
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

// ─── Microsoft OAuth2 callback ───────────────────────────────────────────────
// After MSAL client-side auth, the frontend sends us the id_token.
// We verify it and create/update the user in our DB.
router.post('/microsoft', async (req, res) => {
  try {
    const { idToken, name: fallbackName, email: fallbackEmail, devSecret } = req.body;
    let profile;

    if (idToken) {
      profile = await verifyMicrosoftIdToken(idToken);
    } else if (ALLOW_INSECURE_MS_LOGIN) {
      if (DEV_MS_LOGIN_SECRET && !safeSecretEquals(DEV_MS_LOGIN_SECRET, devSecret)) {
        return res.status(401).json({ error: 'Invalid development login secret' });
      }
      if (!fallbackName || fallbackName.trim().length < 2) {
        return res.status(400).json({ error: 'Name is required for development Microsoft login' });
      }
      const safeName = fallbackName.trim();
      const safeEmail = (fallbackEmail || '').trim();
      const devIdentitySeed = JSON.stringify([safeName.toLowerCase(), safeEmail.toLowerCase()]);
      const devMsId = `dev_${crypto.createHash('sha256').update(devIdentitySeed).digest('hex').slice(0, 24)}`;
      profile = { msId: devMsId, name: safeName, email: safeEmail };
    } else {
      return res.status(400).json({ error: 'Microsoft idToken is required' });
    }

    const { name, email, msId } = profile;

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
    const isAuthFailure = /token|tenant|signing|microsoft|idtoken|malformed|unsupported|expired|configured/i.test(err.message || '');
    res.status(isAuthFailure ? 401 : 500).json({
      error: isAuthFailure
        ? 'Microsoft authentication failed. Please sign in again or contact support.'
        : 'Authentication service error. Please try again later.'
    });
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
