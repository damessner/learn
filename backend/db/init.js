const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './db/learnflow.db';

let db;

function getDB() {
  if (!db) {
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
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
  `);

  // Seed a default admin/teacher if none exists
  const existing = database.prepare('SELECT id FROM users WHERE role = ? LIMIT 1').get('admin');
  if (!existing) {
    const { v4: uuidv4 } = require('uuid');
    database.prepare(`
      INSERT OR IGNORE INTO users (id, ms_id, name, email, role)
      VALUES (?, ?, ?, ?, ?)
    `).run(uuidv4(), null, 'Administrator', 'admin@school.local', 'admin');
  }

  console.log('✅ Database initialized at', DB_PATH);
  return database;
}

module.exports = { getDB, initDB };
