const express = require('express');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const rateLimit = require('express-rate-limit');
const { getDB } = require('../db/init');
const { verifyMicrosoftIdToken } = require('../services/microsoftAuth');

const router = express.Router();
const DEV_JWT_SECRET_PLACEHOLDER = 'dev-secret-change-in-production-long-secret-key-64-chars-minimum';
const DEV_MS_LOGIN_SECRET_PLACEHOLDER = 'change_me_for_dev';
const JWT_SECRET = process.env.JWT_SECRET || DEV_JWT_SECRET_PLACEHOLDER;
const JWT_EXPIRES = '24h';
const ALLOW_INSECURE_MS_LOGIN = process.env.ALLOW_INSECURE_MS_LOGIN === 'true' && process.env.NODE_ENV !== 'production';
const DEV_MS_LOGIN_SECRET = (
  process.env.DEV_MS_LOGIN_SECRET &&
  process.env.DEV_MS_LOGIN_SECRET.trim() &&
  process.env.DEV_MS_LOGIN_SECRET !== DEV_MS_LOGIN_SECRET_PLACEHOLDER
)
  ? process.env.DEV_MS_LOGIN_SECRET
  : null;

// Stricter rate limit specifically for login endpoints to limit brute-force attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

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

const PBKDF2_ITERATIONS = 310000;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
  return `${PBKDF2_ITERATIONS}:${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash) return false;
  const parts = storedHash.split(':');
  let iterations, salt, hash;
  if (parts.length === 3) {
    // Current format: iterations:salt:hash
    iterations = parseInt(parts[0], 10);
    salt = parts[1];
    hash = parts[2];
  } else if (parts.length === 2) {
    // Legacy format: salt:hash (1000 iterations)
    iterations = 1000;
    salt = parts[0];
    hash = parts[1];
  } else {
    return false;
  }
  if (!salt || !hash || !iterations) return false;
  try {
    const verifyHash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
    const hashBuf = Buffer.from(hash, 'hex');
    const verifyBuf = Buffer.from(verifyHash, 'hex');
    if (hashBuf.length !== verifyBuf.length) return false;
    return crypto.timingSafeEqual(hashBuf, verifyBuf);
  } catch {
    return false;
  }
}

// ─── Public Config Endpoint ───────────────────────────────────────────────
router.get('/config', (req, res) => {
  try {
    const db = getDB();
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'auth_mode'").get();
    const authMode = setting ? setting.value : 'local';
    res.json({ authMode });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Local Login Endpoint ───────────────────────────────────────────────
router.post('/login', loginLimiter, (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  try {
    const db = getDB();
    
    // First, verify that local login is the active auth mode
    const setting = db.prepare("SELECT value FROM settings WHERE key = 'auth_mode'").get();
    const authMode = setting ? setting.value : 'local';
    if (authMode !== 'local') {
      return res.status(400).json({ error: 'Local login is disabled. Please use Microsoft Sign In.' });
    }

    // Search by username or email
    const trimmedUser = username.trim();
    const loweredUser = trimmedUser.toLowerCase();
    const user = db.prepare(`
      SELECT * FROM users
      WHERE LOWER(username) = ? OR LOWER(email) = ?
    `).get(loweredUser, loweredUser);
    
    if (!user || !user.password_hash) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (!verifyPassword(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Issue JWT
    const token = jwt.sign(
      { userId: user.id, name: user.name, role: user.role, username: user.username },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES }
    );

    // Update last login
    db.prepare("UPDATE users SET last_login = datetime('now') WHERE id = ?").run(user.id);

    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role, username: user.username }
    });
  } catch (err) {
    console.error('[AUTH] Local login error:', err);
    res.status(500).json({ error: 'Authentication failed' });
  }
});

// ─── Microsoft OAuth2 callback ───────────────────────────────────────────────
// After MSAL client-side auth, the frontend sends us the id_token.
// We verify it and create/update the user in our DB.
router.post('/microsoft', loginLimiter, async (req, res) => {
  try {
    const {
      idToken,
      fallbackName,
      fallbackEmail,
      name: bodyName,
      email: bodyEmail,
      devSecret
    } = req.body;
    const effectiveFallbackName = fallbackName || bodyName;
    const effectiveFallbackEmail = fallbackEmail || bodyEmail;
    let profile;

    if (idToken) {
      profile = await verifyMicrosoftIdToken(idToken);
    } else if (ALLOW_INSECURE_MS_LOGIN) {
      if (DEV_MS_LOGIN_SECRET && !safeSecretEquals(DEV_MS_LOGIN_SECRET, devSecret)) {
        return res.status(401).json({ error: 'Invalid development login secret' });
      }
      if (!effectiveFallbackName || effectiveFallbackName.trim().length < 2) {
        return res.status(400).json({ error: 'Name is required for development Microsoft login' });
      }
      const safeName = effectiveFallbackName.trim();
      const safeEmail = (effectiveFallbackEmail || '').trim();
      const devIdentitySeed = JSON.stringify([safeName.toLowerCase(), safeEmail.toLowerCase()]);
      const devMsId = `dev_${crypto.createHash('sha256').update(devIdentitySeed).digest('hex').slice(0, 24)}`;
      profile = { msId: devMsId, name: safeName, email: safeEmail };
    } else {
      return res.status(400).json({ error: 'Microsoft idToken is required' });
    }

    const { name, email, msId } = profile;

    const db = getDB();

    let user = db.prepare('SELECT * FROM users WHERE ms_id = ?').get(msId);
    if (!user && email) {
      user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
      if (user) {
        db.prepare('UPDATE users SET ms_id = ?, last_login = datetime(\'now\') WHERE id = ?').run(msId, user.id);
        user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
      }
    }

    if (!user) {
      const userId = uuidv4();
      db.prepare(`
        INSERT INTO users (id, ms_id, name, email, role, last_login)
        VALUES (?, ?, ?, ?, 'student', datetime('now'))
      `).run(userId, msId, name, email);
      user = db.prepare('SELECT * FROM users WHERE ms_id = ?').get(msId);
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

// ─── List all users (admin/teacher only) ──────────────────────────────────────────────
router.get('/users', requireAuth, requireRole('admin', 'teacher'), (req, res) => {
  const db = getDB();
  const users = db.prepare('SELECT id, name, email, username, role, created_at, last_login FROM users ORDER BY name').all();
  res.json(users);
});

// ─── Create User (admin/teacher only) ──────────────────────────────────────────
router.post('/users', requireAuth, requireRole('admin', 'teacher'), (req, res) => {
  const { name, email, username, role, password } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!role || !['student', 'teacher', 'admin'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  
  // Only admin can create another admin or teacher
  if (role !== 'student' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Only administrators can create educators or admins.' });
  }

  try {
    const db = getDB();
    
    // Verify username/email unique
    if (username && username.trim()) {
      const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
      if (existingUser) return res.status(400).json({ error: 'Username already in use' });
    }
    if (email && email.trim()) {
      const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
      if (existingEmail) return res.status(400).json({ error: 'Email already in use' });
    }

    const id = uuidv4();
    const passHash = password ? hashPassword(password) : hashPassword('learnflow123');
    
    db.prepare(`
      INSERT INTO users (id, ms_id, username, password_hash, name, email, role)
      VALUES (?, NULL, ?, ?, ?, ?, ?)
    `).run(
      id,
      username ? username.trim() : null,
      passHash,
      name.trim(),
      email ? email.trim().toLowerCase() : null,
      role
    );

    const user = db.prepare('SELECT id, name, email, username, role FROM users WHERE id = ?').get(id);
    res.status(201).json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Update User (admin/teacher only) ──────────────────────────────────────────
router.put('/users/:id', requireAuth, requireRole('admin', 'teacher'), (req, res) => {
  const { name, email, username, role, password } = req.body;
  
  try {
    const db = getDB();
    const targetUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    // Role protection
    if (targetUser.role === 'admin' && req.user.userId !== targetUser.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized to edit admin user' });
    }
    if (role && role !== targetUser.role && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can modify user roles' });
    }

    // Uniqueness checks
    if (username && username.trim() && username.trim() !== targetUser.username) {
      const existingUser = db.prepare('SELECT id FROM users WHERE username = ?').get(username.trim());
      if (existingUser) return res.status(400).json({ error: 'Username already in use' });
    }
    if (email && email.trim() && email.trim().toLowerCase() !== targetUser.email) {
      const existingEmail = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim().toLowerCase());
      if (existingEmail) return res.status(400).json({ error: 'Email already in use' });
    }

    const updatedRole = role || targetUser.role;
    const updatedName = name ? name.trim() : targetUser.name;
    const updatedEmail = email !== undefined ? (email ? email.trim().toLowerCase() : null) : targetUser.email;
    const updatedUsername = username !== undefined ? (username ? username.trim() : null) : targetUser.username;

    if (password) {
      const newHash = hashPassword(password);
      db.prepare(`
        UPDATE users 
        SET name = ?, email = ?, username = ?, role = ?, password_hash = ?
        WHERE id = ?
      `).run(updatedName, updatedEmail, updatedUsername, updatedRole, newHash, req.params.id);
    } else {
      db.prepare(`
        UPDATE users 
        SET name = ?, email = ?, username = ?, role = ?
        WHERE id = ?
      `).run(updatedName, updatedEmail, updatedUsername, updatedRole, req.params.id);
    }

    const user = db.prepare('SELECT id, name, email, username, role FROM users WHERE id = ?').get(req.params.id);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Delete User (admin only) ─────────────────────────────────────────────────
router.delete('/users/:id', requireAuth, requireRole('admin'), (req, res) => {
  if (req.params.id === req.user.userId) {
    return res.status(400).json({ error: 'Cannot delete your own admin account.' });
  }
  try {
    const db = getDB();
    // Check if user has worksheets created_by them
    const hasWorksheets = db.prepare('SELECT COUNT(*) as cnt FROM worksheets WHERE created_by = ?').get(req.params.id);
    if (hasWorksheets && hasWorksheets.cnt > 0) {
      return res.status(409).json({ error: `Cannot delete user: they have ${hasWorksheets.cnt} worksheets. Reassign or delete their worksheets first.` });
    }
    // Check if user has classes created_by them
    const hasClasses = db.prepare('SELECT COUNT(*) as cnt FROM classes WHERE created_by = ?').get(req.params.id);
    if (hasClasses && hasClasses.cnt > 0) {
      return res.status(409).json({ error: `Cannot delete user: they own ${hasClasses.cnt} classes. Delete or reassign their classes first.` });
    }
    db.transaction(() => {
      db.prepare('DELETE FROM class_students WHERE student_id = ?').run(req.params.id);
      db.prepare('DELETE FROM submissions WHERE user_id = ?').run(req.params.id);
      db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    })();
    res.json({ success: true });
  } catch (err) {
    if (err.message && err.message.includes('FOREIGN KEY')) {
      return res.status(409).json({ error: 'Cannot delete user due to related data. Please remove their worksheets or assignments first.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ─── Get Settings (admin only) ────────────────────────────────────────────────
router.get('/settings', requireAuth, requireRole('admin'), (req, res) => {
  try {
    const db = getDB();
    const settings = db.prepare('SELECT * FROM settings').all();
    const settingsObj = {};
    settings.forEach(s => {
      settingsObj[s.key] = s.value;
    });
    res.json(settingsObj);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Update Settings (admin only) ─────────────────────────────────────────────
router.post('/settings', requireAuth, requireRole('admin'), (req, res) => {
  const updates = req.body;
  try {
    const db = getDB();
    const updateStmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    const transaction = db.transaction((items) => {
      for (const [key, val] of Object.entries(items)) {
        updateStmt.run(key, String(val));
      }
    });
    transaction(updates);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Change Password (authenticated user changes own password) ────────────────
router.post('/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ error: 'currentPassword and newPassword are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  try {
    const db = getDB();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (!verifyPassword(currentPassword, user.password_hash)) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
    const newHash = hashPassword(newPassword);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.user.userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
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
module.exports.hashPassword = hashPassword;
