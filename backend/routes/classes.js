const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/init');
const { requireAuth, requireRole } = require('./auth');

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
    db.prepare(`
      INSERT INTO classes (id, name, created_by)
      VALUES (?, ?, ?)
    `).run(id, name.trim(), req.user.userId);

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
  const { name, email, role, class_id } = req.body;
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
    
    // Check if user already exists
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

    const userId = uuidv4();
    db.prepare(`
      INSERT INTO users (id, ms_id, name, email, role)
      VALUES (?, NULL, ?, ?, ?)
    `).run(userId, name.trim(), email.trim().toLowerCase(), userRole);

    if (userRole === 'student' && class_id) {
      db.prepare(`
        INSERT INTO class_students (class_id, student_id)
        VALUES (?, ?)
      `).run(class_id, userId);
    }

    const newUser = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    res.status(201).json(newUser);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
