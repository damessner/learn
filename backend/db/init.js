const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const rawDbPath = process.env.DB_PATH || './db/learnflow.db';
const DB_PATH = path.isAbsolute(rawDbPath)
  ? rawDbPath
  : path.resolve(__dirname, '..', rawDbPath);

let db;

const PBKDF2_ITERATIONS = 310000;

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, 64, 'sha512').toString('hex');
  return `${PBKDF2_ITERATIONS}:${salt}:${hash}`;
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
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      content TEXT NOT NULL DEFAULT '{"blocks":[]}',
      total_points INTEGER DEFAULT 0,
      is_published INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Assignments (worksheets assigned to classes)
    CREATE TABLE IF NOT EXISTS assignments (
      id TEXT PRIMARY KEY,
      worksheet_id TEXT NOT NULL REFERENCES worksheets(id) ON DELETE CASCADE,
      class_name TEXT NOT NULL,
      class_id TEXT REFERENCES classes(id) ON DELETE CASCADE,
      teams_assignment_id TEXT,
      due_date TEXT,
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Student submissions
    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      answers TEXT NOT NULL DEFAULT '{}',
      score INTEGER,
      max_score INTEGER,
      started_at TEXT DEFAULT (datetime('now')),
      submitted_at TEXT,
      grade_synced INTEGER DEFAULT 0,
      UNIQUE(assignment_id, user_id)
    );

    -- Submission attempts (for retry policies)
    CREATE TABLE IF NOT EXISTS submission_attempts (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      attempt_no INTEGER NOT NULL,
      answers TEXT NOT NULL DEFAULT '{}',
      score INTEGER DEFAULT 0,
      max_score INTEGER DEFAULT 0,
      submitted_at TEXT DEFAULT (datetime('now')),
      feedback_json TEXT DEFAULT '{}',
      UNIQUE(assignment_id, user_id, attempt_no)
    );

    -- Media files
    CREATE TABLE IF NOT EXISTS media_files (
      id TEXT PRIMARY KEY,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER,
      uploaded_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      url TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Classes / Groups
    CREATE TABLE IF NOT EXISTS classes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
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

    -- Courses (a collection of worksheets)
    CREATE TABLE IF NOT EXISTS courses (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Course Worksheets (maps worksheets to courses with order)
    CREATE TABLE IF NOT EXISTS course_worksheets (
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      worksheet_id TEXT NOT NULL REFERENCES worksheets(id) ON DELETE CASCADE,
      order_index INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (course_id, worksheet_id)
    );

    -- Course Assignments (courses assigned to classes)
    CREATE TABLE IF NOT EXISTS course_assignments (
      id TEXT PRIMARY KEY,
      course_id TEXT NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
      class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
      due_date TEXT,
      created_by TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Student planner tasks
    CREATE TABLE IF NOT EXISTS planner_items (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      notes TEXT DEFAULT '',
      due_date TEXT,
      estimated_minutes INTEGER DEFAULT 30,
      status TEXT DEFAULT 'pending' CHECK(status IN ('pending','done')),
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Peer reviews
    CREATE TABLE IF NOT EXISTS peer_reviews (
      id TEXT PRIMARY KEY,
      assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
      reviewer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      reviewee_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      rating INTEGER CHECK(rating BETWEEN 1 AND 5),
      comments TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(assignment_id, reviewer_id, reviewee_id)
    );

    -- Parent digest log
    CREATE TABLE IF NOT EXISTS parent_digests (
      id TEXT PRIMARY KEY,
      student_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      generated_by TEXT REFERENCES users(id),
      email_target TEXT,
      digest_json TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_assignments_worksheet_id ON assignments(worksheet_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_class_id ON assignments(class_id);
    CREATE INDEX IF NOT EXISTS idx_submissions_assignment_submitted_at ON submissions(assignment_id, submitted_at);
    CREATE INDEX IF NOT EXISTS idx_submission_attempts_assignment_user ON submission_attempts(assignment_id, user_id);
    CREATE INDEX IF NOT EXISTS idx_class_students_student_id ON class_students(student_id);
    CREATE INDEX IF NOT EXISTS idx_course_assignments_class_id ON course_assignments(class_id);
    CREATE INDEX IF NOT EXISTS idx_planner_items_user_due ON planner_items(user_id, due_date);
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
  try {
    database.exec("ALTER TABLE worksheets ADD COLUMN tags TEXT DEFAULT '';");
  } catch (e) {
    // Column already exists
  }
  try {
    database.exec("ALTER TABLE submissions ADD COLUMN feedback_text TEXT;");
  } catch (e) {
    // Column already exists
  }
  try {
    database.exec("ALTER TABLE worksheets ADD COLUMN rubric_json TEXT DEFAULT '{}';");
  } catch (e) {
    // Column already exists
  }
  try {
    database.exec("ALTER TABLE assignments ADD COLUMN retry_policy TEXT DEFAULT 'single';");
  } catch (e) {
    // Column already exists
  }
  try {
    database.exec("ALTER TABLE assignments ADD COLUMN max_attempts INTEGER DEFAULT 1;");
  } catch (e) {
    // Column already exists
  }
  try {
    database.exec("ALTER TABLE assignments ADD COLUMN peer_review_enabled INTEGER DEFAULT 0;");
  } catch (e) {
    // Column already exists
  }
  try {
    database.exec("ALTER TABLE assignments ADD COLUMN adaptive_difficulty TEXT DEFAULT 'auto';");
  } catch (e) {
    // Column already exists
  }
  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS announcements (
        id TEXT PRIMARY KEY,
        class_id TEXT NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
        created_by TEXT REFERENCES users(id),
        message TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now')),
        expires_at TEXT
      );
    `);
  } catch (e) {
    // Table already exists
  }
  try {
    database.exec("ALTER TABLE classes ADD COLUMN class_code TEXT;");
  } catch (e) {
    // Column already exists
  }
  try {
    database.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_classes_code ON classes(class_code) WHERE class_code IS NOT NULL;");
  } catch (e) {
    // Index already exists
  }

  // ─── New: library flag + source on worksheets ──────────────────────────────
  try {
    database.exec("ALTER TABLE worksheets ADD COLUMN in_library INTEGER DEFAULT 0;");
  } catch (e) {
    // Column already exists
  }
  try {
    database.exec("ALTER TABLE worksheets ADD COLUMN library_source TEXT DEFAULT '';");
  } catch (e) {
    // Column already exists
  }

  // ─── New: unified ratings table ────────────────────────────────────────────
  try {
    database.exec(`
      CREATE TABLE IF NOT EXISTS ratings (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        item_type TEXT NOT NULL CHECK(item_type IN ('worksheet', 'course')),
        item_id TEXT NOT NULL,
        rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
        rater_role TEXT NOT NULL DEFAULT 'student',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(user_id, item_type, item_id)
      );
    `);
    database.exec("CREATE INDEX IF NOT EXISTS idx_ratings_item ON ratings(item_type, item_id);");
  } catch (e) {
    // Table already exists
  }

  // Seed default settings
  database.prepare(`
    INSERT OR IGNORE INTO settings (key, value)
    VALUES ('auth_mode', 'local')
  `).run();

  database.prepare(`
    INSERT OR IGNORE INTO settings (key, value)
    VALUES ('ollama_base_url', 'http://localhost:11434')
  `).run();

  database.prepare(`
    INSERT OR IGNORE INTO settings (key, value)
    VALUES ('ollama_model', 'llama3.1')
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

if (require.main === module) {
  initDB();
}
