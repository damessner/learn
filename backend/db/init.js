const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const DB_PATH = process.env.DB_PATH || './db/learnflow.db';

let db;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function getDB() {
  if (!db) {
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');
    db.pragma('busy_timeout = 5000');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

async function initDB() {
  const database = getDB();

  database.exec(`
    -- Users (teachers and students)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      ms_id TEXT UNIQUE,
      username TEXT UNIQUE,
      password_hash TEXT,
      name TEXT NOT NULL,
      email TEXT,
      role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('teacher','student','admin')),
      created_at TEXT DEFAULT (datetime('now')),
      last_login TEXT
    );

    -- Worksheets (exercise definitions)
    CREATE TABLE IF NOT EXISTS worksheets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      subject TEXT DEFAULT '',
      grade_level TEXT DEFAULT '',
      created_by TEXT NOT NULL REFERENCES users(id),
      content TEXT NOT NULL DEFAULT '{"blocks":[]}',
      total_points INTEGER DEFAULT 0,
      is_published INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Assignments (worksheets assigned to classes)
    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      worksheet_id TEXT NOT NULL REFERENCES worksheets(id),
      class_name TEXT NOT NULL,
      class_id TEXT,
      teams_assignment_id TEXT,
      due_date TEXT,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Student submissions
    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL REFERENCES assignments(id),
      user_id TEXT NOT NULL REFERENCES users(id),
      answers TEXT NOT NULL DEFAULT '{}',
      score INTEGER,
      max_score INTEGER,
      started_at TEXT DEFAULT (datetime('now')),
      submitted_at TEXT,
      grade_synced INTEGER DEFAULT 0,
      UNIQUE(assignment_id, user_id)
    );

    -- Media files
    CREATE TABLE IF NOT EXISTS media_files (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER,
      uploaded_by TEXT REFERENCES users(id),
      url TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Classes / Groups
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Class Membership
    CREATE TABLE IF NOT EXISTS class_students (
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (class_id, student_id)
    );

    -- Settings
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_assignments_worksheet_id ON assignments(worksheet_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_class_id ON assignments(class_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_assignment_submitted_at ON submissions(assignment_id, submitted_at);
    CREATE INDEX IF NOT EXISTS idx_class_students_student_id ON class_students(student_id);
  `);

  // Migrate existing databases to have username/password_hash if they were created before
  try {
    database.exec("ALTER TABLE users ADD COLUMN username TEXT;");
  } catch (e) {
    // Column already exists
  }
  try {
    database.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username);");
  } catch (e) {
    // Index already exists
  }
  try {
    database.exec("ALTER TABLE users ADD COLUMN password_hash TEXT;");
  } catch (e) {
    // Column already exists
  }

  // Seed default settings
  database.prepare(`
    INSERT OR IGNORE INTO settings (key, value)
    VALUES ('auth_mode', 'local')
  `).run();

  // Seed a default admin/teacher if none exists
  const existing = database.prepare('SELECT id FROM users WHERE role = ? LIMIT 1').get('admin');
  if (!existing) {
    const { v4: uuidv4 } = require('uuid');
    const adminPassHash = hashPassword('admin123');
    database.prepare(`
      INSERT OR IGNORE INTO users (id, ms_id, username, password_hash, name, email, role)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(uuidv4(), null, 'admin', adminPassHash, 'Administrator', 'admin@school.local', 'admin');
  }

  console.log('✅ Database initialized at', DB_PATH);
  return database;
}

module.exports = { getDB, initDB };
