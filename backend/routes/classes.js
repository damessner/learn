const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/init');
const { requireAuth, requireRole, hashPassword } = require('./auth');

const router = express.Router();

// Apply auth and role protection to all routes in this router
router.use(requireAuth);

// Student check for enrollment status (accessible by student role)
router.get('/student-status', (req, res) => {
  try {
    const db = getDB();
    const enrolled = db.prepare(`
      SELECT COUNT(*) as count 
      FROM class_students 
      WHERE student_id = ?
    `).get(req.user.userId);
    
    const classes = db.prepare(`
      SELECT c.name 
      FROM classes c
      JOIN class_students cs ON cs.class_id = c.id
      WHERE cs.student_id = ?
    `).all(req.user.userId);

    res.json({
      enrolled: (enrolled ? enrolled.count : 0) > 0,
      classes: classes.map(c => c.name)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Join Class by Code (student) ─────────────────────────────────────────────
router.post('/join', (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' });
  const { class_code } = req.body;
  if (!class_code) return res.status(400).json({ error: 'class_code is required' });
  try {
    const db = getDB();
    const cls = db.prepare('SELECT * FROM classes WHERE class_code = ?').get(class_code.trim().toUpperCase());
    if (!cls) return res.status(404).json({ error: 'Class code not found' });
    const already = db.prepare('SELECT 1 FROM class_students WHERE class_id = ? AND student_id = ?').get(cls.id, req.user.userId);
    if (already) return res.status(409).json({ error: 'Already enrolled in this class' });
    db.prepare('INSERT INTO class_students (class_id, student_id) VALUES (?, ?)').run(cls.id, req.user.userId);
    res.json({ success: true, class: { id: cls.id, name: cls.name } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Student Announcements (student sees announcements for their classes) ─────
router.get('/student/announcements', (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' });
  try {
    const db = getDB();
    const announcements = db.prepare(`
      SELECT a.id, a.message, a.created_at, a.expires_at, c.name as class_name
      FROM announcements a
      JOIN classes c ON c.id = a.class_id
      JOIN class_students cs ON cs.class_id = a.class_id
      WHERE cs.student_id = ?
        AND (a.expires_at IS NULL OR a.expires_at > datetime('now'))
      ORDER BY a.created_at DESC
    `).all(req.user.userId);
    res.json(announcements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.use(requireRole('teacher', 'admin'));

// ─── List Classes ─────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const db = getDB();
    const classes = db.prepare(`
      SELECT c.*, COUNT(cs.student_id) as student_count
      FROM classes c
      LEFT JOIN class_students cs ON cs.class_id = c.id
      WHERE c.created_by = ?
      GROUP BY c.id
      ORDER BY c.name ASC
    `).all(req.user.userId);
    res.json(classes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Create Class ─────────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Class name is required' });
  }

  try {
    const db = getDB();
    const id = uuidv4();
    // Generate a unique 6-char class code
    const genCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();
    let classCode = genCode();
    while (db.prepare('SELECT 1 FROM classes WHERE class_code = ?').get(classCode)) {
      classCode = genCode();
    }
    db.prepare(`
      INSERT INTO classes (id, name, created_by, class_code)
      VALUES (?, ?, ?, ?)
    `).run(id, name.trim(), req.user.userId, classCode);

    const newClass = db.prepare('SELECT * FROM classes WHERE id = ?').get(id);
    res.status(201).json(newClass);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Delete Class ─────────────────────────────────────────────────────────────
router.delete('/:id', (req, res) => {
  try {
    const db = getDB();
    // Verify ownership
    const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id);
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    if (cls.created_by !== req.user.userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    db.prepare('DELETE FROM classes WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── List Students in Class ───────────────────────────────────────────────────
router.get('/:id/students', (req, res) => {
  try {
    const db = getDB();
    const students = db.prepare(`
      SELECT u.id, u.name, u.email, u.last_login
      FROM users u
      JOIN class_students cs ON cs.student_id = u.id
      WHERE cs.class_id = ?
      ORDER BY u.name ASC
    `).all(req.params.id);
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Add Students to Class ────────────────────────────────────────────────────
router.post('/:id/students', (req, res) => {
  const { studentIds } = req.body;
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return res.status(400).json({ error: 'studentIds array is required' });
  }

  try {
    const db = getDB();
    const insert = db.prepare(`
      INSERT OR IGNORE INTO class_students (class_id, student_id)
      VALUES (?, ?)
    `);

    const transaction = db.transaction((classId, ids) => {
      for (const id of ids) {
        insert.run(classId, id);
      }
    });

    transaction(req.params.id, studentIds);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Remove Student from Class ────────────────────────────────────────────────
router.delete('/:id/students/:studentId', (req, res) => {
  try {
    const db = getDB();
    db.prepare(`
      DELETE FROM class_students
      WHERE class_id = ? AND student_id = ?
    `).run(req.params.id, req.params.studentId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── List All Registered Students (filtered by role = 'student') ───────────────
router.get('/students/all', (req, res) => {
  try {
    const db = getDB();
    const students = db.prepare(`
      SELECT id, name, email, last_login
      FROM users
      WHERE role = 'student'
      ORDER BY name ASC
    `).all();
    res.json(students);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Class Progress Matrix ────────────────────────────────────────────────────
router.get('/:id/progress', (req, res) => {
  try {
    const db = getDB();

    // 1. Get class details
    const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id);
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    // 2. Get all students in the class
    const students = db.prepare(`
      SELECT u.id, u.name, u.email
      FROM users u
      JOIN class_students cs ON cs.student_id = u.id
      WHERE cs.class_id = ?
      ORDER BY u.name ASC
    `).all(req.params.id);

    // 3. Get all assignments for this class
    const assignments = db.prepare(`
      SELECT a.id as assignment_id, a.due_date, w.id as worksheet_id, w.title, w.total_points
      FROM assignments a
      JOIN worksheets w ON w.id = a.worksheet_id
      WHERE a.class_id = ?
      ORDER BY a.created_at ASC
    `).all(req.params.id);

    // 4. Get all submissions for these assignments
    const submissions = db.prepare(`
      SELECT s.id as submission_id, s.assignment_id, s.user_id, s.score, s.max_score, s.started_at, s.submitted_at
      FROM submissions s
      WHERE s.assignment_id IN (
        SELECT id FROM assignments WHERE class_id = ?
      )
    `).all(req.params.id);

    // Build the matrix
    const matrix = students.map(student => {
      const studentSubmissions = {};
      
      assignments.forEach(assign => {
        const sub = submissions.find(s => s.assignment_id === assign.assignment_id && s.user_id === student.id);
        studentSubmissions[assign.assignment_id] = sub ? {
          submission_id: sub.submission_id,
          score: sub.score,
          max_score: sub.max_score,
          started_at: sub.started_at,
          submitted_at: sub.submitted_at,
          status: sub.submitted_at ? 'completed' : 'in_progress'
        } : {
          status: 'not_started'
        };
      });

      return {
        student_id: student.id,
        name: student.name,
        email: student.email,
        submissions: studentSubmissions
      };
    });

    res.json({
      class: cls,
      assignments,
      matrix
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Create Student/User Manually ─────────────────────────────────────────────
router.post('/students/manual', (req, res) => {
  const { name, email, username, role, class_id, password } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  if (!email || !email.trim()) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const userRole = role || 'student';
  if (!['student', 'teacher', 'admin'].includes(userRole)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const db = getDB();
    
    // Check if user already exists by email
    const existing = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim().toLowerCase());
    if (existing) {
      if (class_id) {
        const inClass = db.prepare('SELECT * FROM class_students WHERE class_id = ? AND student_id = ?').get(class_id, existing.id);
        if (inClass) {
          return res.status(400).json({ error: 'A student with this email is already registered and enrolled in this class.' });
        }
        db.prepare('INSERT INTO class_students (class_id, student_id) VALUES (?, ?)').run(class_id, existing.id);
        return res.json({ success: true, message: 'Existing student assigned to class', user: existing });
      }
      return res.status(400).json({ error: 'A user with this email is already registered.' });
    }

    const userUsername = username ? username.trim() : email.trim().toLowerCase().split('@')[0];
    const existingUsername = db.prepare('SELECT * FROM users WHERE username = ?').get(userUsername);
    if (existingUsername) {
      return res.status(400).json({ error: 'A user with this username is already registered.' });
    }

    const userPassword = password || 'learnflow123';
    const passHash = hashPassword(userPassword);

    const userId = uuidv4();
    db.prepare(`
      INSERT INTO users (id, ms_id, username, password_hash, name, email, role)
      VALUES (?, NULL, ?, ?, ?, ?, ?)
    `).run(userId, userUsername, passHash, name.trim(), email.trim().toLowerCase(), userRole);

    if (userRole === 'student' && class_id) {
      db.prepare(`
        INSERT INTO class_students (class_id, student_id)
        VALUES (?, ?)
      `).run(class_id, userId);
    }

    const newUser = db.prepare('SELECT id, name, email, username, role FROM users WHERE id = ?').get(userId);
    res.status(201).json(newUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Announcements CRUD ─────────────────────────────────────────────────────
router.get('/:id/announcements', (req, res) => {
  try {
    const db = getDB();
    const cls = db.prepare('SELECT * FROM classes WHERE id = ? AND created_by = ?').get(req.params.id, req.user.userId);
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    const announcements = db.prepare(`
      SELECT a.*, u.name as author_name FROM announcements a
      LEFT JOIN users u ON u.id = a.created_by
      WHERE a.class_id = ? ORDER BY a.created_at DESC
    `).all(req.params.id);
    res.json(announcements);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/announcements', (req, res) => {
  const { message, expires_at } = req.body;
  if (!message || !message.trim()) return res.status(400).json({ error: 'message is required' });
  try {
    const db = getDB();
    const cls = db.prepare('SELECT * FROM classes WHERE id = ? AND created_by = ?').get(req.params.id, req.user.userId);
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    const id = uuidv4();
    db.prepare('INSERT INTO announcements (id, class_id, created_by, message, expires_at) VALUES (?, ?, ?, ?, ?)').run(id, req.params.id, req.user.userId, message.trim(), expires_at || null);
    res.status(201).json(db.prepare('SELECT * FROM announcements WHERE id = ?').get(id));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id/announcements/:announcementId', (req, res) => {
  try {
    const db = getDB();
    const cls = db.prepare('SELECT * FROM classes WHERE id = ? AND created_by = ?').get(req.params.id, req.user.userId);
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    db.prepare('DELETE FROM announcements WHERE id = ? AND class_id = ?').run(req.params.announcementId, req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Export Class CSV ──────────────────────────────────────────────────────────
router.get('/:id/export-csv', (req, res) => {
  try {
    const db = getDB();
    const cls = db.prepare('SELECT * FROM classes WHERE id = ? AND created_by = ?').get(req.params.id, req.user.userId);
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    const students = db.prepare(`
      SELECT u.name, u.email, u.username,
        COUNT(DISTINCT s.id) as total_submissions,
        ROUND(AVG(CASE WHEN s.max_score > 0 THEN CAST(s.score AS REAL)/s.max_score*100 ELSE NULL END), 1) as avg_pct
      FROM class_students cs
      JOIN users u ON u.id = cs.student_id
      LEFT JOIN submissions s ON s.user_id = u.id AND s.submitted_at IS NOT NULL
        AND s.assignment_id IN (SELECT id FROM assignments WHERE class_id = ?)
      WHERE cs.class_id = ?
      GROUP BY u.id
      ORDER BY u.name
    `).all(req.params.id, req.params.id);

    const lines = ['Name,Email,Username,Submissions,Avg %'];
    students.forEach(s => {
      lines.push(`"${s.name}","${s.email}","${s.username}",${s.total_submissions},${s.avg_pct ?? ''}`);
    });
    const csv = lines.join('\n');
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${cls.name.replace(/[^a-z0-9]/gi, '_')}_students.csv"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Class Stats ───────────────────────────────────────────────────────────────
router.get('/:id/stats', (req, res) => {
  try {
    const db = getDB();
    const cls = db.prepare('SELECT * FROM classes WHERE id = ? AND created_by = ?').get(req.params.id, req.user.userId);
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    const totalStudents = db.prepare('SELECT COUNT(*) as cnt FROM class_students WHERE class_id = ?').get(req.params.id).cnt;
    const assignments = db.prepare('SELECT COUNT(*) as cnt FROM assignments WHERE class_id = ?').get(req.params.id).cnt;
    const submissions = db.prepare(`
      SELECT COUNT(*) as cnt,
        ROUND(AVG(CASE WHEN max_score > 0 THEN CAST(score AS REAL)/max_score*100 ELSE NULL END), 1) as avg_pct
      FROM submissions s
      JOIN assignments a ON a.id = s.assignment_id
      WHERE a.class_id = ? AND s.submitted_at IS NOT NULL
    `).get(req.params.id);

    res.json({
      totalStudents,
      assignments,
      totalSubmissions: submissions.cnt,
      avgPercentage: submissions.avg_pct || 0
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
