const express = require('express');
const fs = require('fs');
const os = require('os');
const path = require('path');
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
    const { page, pageSize, offset } = getPagination(req, 50, 200);
    const announcements = db.prepare(`
      SELECT a.id, a.message, a.created_at, a.expires_at, c.name as class_name
      FROM announcements a
      JOIN classes c ON c.id = a.class_id
      JOIN class_students cs ON cs.class_id = a.class_id
        WHERE cs.student_id = ?
        AND (a.expires_at IS NULL OR a.expires_at > datetime('now'))
      ORDER BY a.created_at DESC
      LIMIT ? OFFSET ?
    `).all(req.user.userId, pageSize, offset);
    if (!hasPaginationQuery(req)) return res.json(announcements);

    const total = db.prepare(`
      SELECT COUNT(*) as cnt
      FROM announcements a
      JOIN class_students cs ON cs.class_id = a.class_id
      WHERE cs.student_id = ?
        AND (a.expires_at IS NULL OR a.expires_at > datetime('now'))
    `).get(req.user.userId).cnt || 0;
    res.json({ data: announcements, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.use(requireRole('teacher', 'admin'));

function canAccessClass(req, classRow) {
  if (!classRow) return false;
  return req.user.role === 'admin' || classRow.created_by === req.user.userId;
}

function getPagination(req, defaultPageSize = 100, maxPageSize = 500) {
  const pageRaw = Number(req.query.page);
  const pageSizeRaw = Number(req.query.pageSize);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
    ? Math.min(Math.floor(pageSizeRaw), maxPageSize)
    : defaultPageSize;
  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

function hasPaginationQuery(req) {
  return req.query.page !== undefined || req.query.pageSize !== undefined;
}

// ─── List Classes ─────────────────────────────────────────────────────────────
router.get('/', (req, res) => {
  try {
    const db = getDB();
    const { page, pageSize, offset } = getPagination(req);
    let classes;
    let total;
    if (req.user.role === 'admin') {
      classes = db.prepare(`
        SELECT c.*, COUNT(cs.student_id) as student_count, u.name as teacher_name
        FROM classes c
        LEFT JOIN class_students cs ON cs.class_id = c.id
        LEFT JOIN users u ON u.id = c.created_by
        GROUP BY c.id
        ORDER BY c.name ASC
        LIMIT ? OFFSET ?
      `).all(pageSize, offset);
      total = db.prepare('SELECT COUNT(*) as cnt FROM classes').get().cnt || 0;
    } else {
      classes = db.prepare(`
        SELECT c.*, COUNT(cs.student_id) as student_count
        FROM classes c
        LEFT JOIN class_students cs ON cs.class_id = c.id
        WHERE c.created_by = ?
        GROUP BY c.id
        ORDER BY c.name ASC
        LIMIT ? OFFSET ?
      `).all(req.user.userId, pageSize, offset);
      total = db.prepare('SELECT COUNT(*) as cnt FROM classes WHERE created_by = ?').get(req.user.userId).cnt || 0;
    }
    if (!hasPaginationQuery(req)) return res.json(classes);
    res.json({ data: classes, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Utility: generate a random uppercase 6-char alphanumeric class code ───────
function generateClassCode() {
  return Math.random().toString(36).substring(2).padEnd(6, '0').substring(0, 6).toUpperCase();
}

// ─── Create Class ─────────────────────────────────────────────────────────────
router.post('/', (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Class name is required' });
  }

  try {
    const db = getDB();
    const id = uuidv4();
    let classCode = generateClassCode();
    let attempts = 0;
    while (db.prepare('SELECT 1 FROM classes WHERE class_code = ?').get(classCode)) {
      if (++attempts > 10) throw new Error('Could not generate a unique class code. Please try again.');
      classCode = generateClassCode();
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
    if (!canAccessClass(req, cls)) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    db.transaction(() => {
      const assignmentIds = db.prepare('SELECT id FROM assignments WHERE class_id = ?').all(req.params.id).map(r => r.id);
      if (assignmentIds.length > 0) {
        const placeholders = assignmentIds.map(() => '?').join(',');
        db.prepare(`DELETE FROM peer_reviews WHERE assignment_id IN (${placeholders})`).run(...assignmentIds);
        db.prepare(`DELETE FROM submission_attempts WHERE assignment_id IN (${placeholders})`).run(...assignmentIds);
        db.prepare(`DELETE FROM submissions WHERE assignment_id IN (${placeholders})`).run(...assignmentIds);
        db.prepare(`DELETE FROM assignments WHERE id IN (${placeholders})`).run(...assignmentIds);
      }
      db.prepare('DELETE FROM announcements WHERE class_id = ?').run(req.params.id);
      db.prepare('DELETE FROM class_students WHERE class_id = ?').run(req.params.id);
      db.prepare('DELETE FROM course_assignments WHERE class_id = ?').run(req.params.id);
      db.prepare('DELETE FROM classes WHERE id = ?').run(req.params.id);
    })();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── List Students in Class ───────────────────────────────────────────────────
router.get('/:id/students', (req, res) => {
  try {
    const db = getDB();
    const cls = db.prepare('SELECT id, created_by FROM classes WHERE id = ?').get(req.params.id);
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    if (!canAccessClass(req, cls)) return res.status(403).json({ error: 'Unauthorized' });
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
    const cls = db.prepare('SELECT id, created_by FROM classes WHERE id = ?').get(req.params.id);
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    if (!canAccessClass(req, cls)) return res.status(403).json({ error: 'Unauthorized' });
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
    const cls = db.prepare('SELECT id, created_by FROM classes WHERE id = ?').get(req.params.id);
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    if (!canAccessClass(req, cls)) return res.status(403).json({ error: 'Unauthorized' });
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
    const { page, pageSize, offset } = getPagination(req, 200, 1000);
    const students = db.prepare(`
      SELECT id, name, email, last_login
      FROM users
      WHERE role = 'student'
      ORDER BY name ASC
      LIMIT ? OFFSET ?
    `).all(pageSize, offset);
    const total = db.prepare("SELECT COUNT(*) as cnt FROM users WHERE role = 'student'").get().cnt || 0;
    if (!hasPaginationQuery(req)) return res.json(students);
    res.json({ data: students, pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) } });
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
    if (!canAccessClass(req, cls)) return res.status(403).json({ error: 'Unauthorized' });

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
    const submissionMap = new Map(
      submissions.map(s => [`${s.assignment_id}::${s.user_id}`, s])
    );

    // Build the matrix
    const matrix = students.map(student => {
      const studentSubmissions = {};
      
      assignments.forEach(assign => {
        const sub = submissionMap.get(`${assign.assignment_id}::${student.id}`);
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
        const cls = db.prepare('SELECT id, created_by FROM classes WHERE id = ?').get(class_id);
        if (!cls) return res.status(404).json({ error: 'Class not found' });
        if (!canAccessClass(req, cls)) return res.status(403).json({ error: 'Unauthorized' });
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
      const cls = db.prepare('SELECT id, created_by FROM classes WHERE id = ?').get(class_id);
      if (!cls) return res.status(404).json({ error: 'Class not found' });
      if (!canAccessClass(req, cls)) return res.status(403).json({ error: 'Unauthorized' });
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
    const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id);
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    if (!canAccessClass(req, cls)) return res.status(403).json({ error: 'Unauthorized' });
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
    const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id);
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    if (!canAccessClass(req, cls)) return res.status(403).json({ error: 'Unauthorized' });
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
    const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id);
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    if (!canAccessClass(req, cls)) return res.status(403).json({ error: 'Unauthorized' });
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
    const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id);
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    if (!canAccessClass(req, cls)) return res.status(403).json({ error: 'Unauthorized' });

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
    const cls = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id);
    if (!cls) return res.status(404).json({ error: 'Class not found' });
    if (!canAccessClass(req, cls)) return res.status(403).json({ error: 'Unauthorized' });

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


// ─── Import Classes and Students from PDF ─────────────────────────────
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

router.post('/import-pdf', requireAuth, requireRole('admin', 'teacher'), upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  let tempPath = null;
  try {
    // Dynamic import for ES module pdf-parse or fallback to exec
    let text = '';
    try {
      const { PDFParse } = require('pdf-parse');
      const parser = new PDFParse({ data: req.file.buffer });
      let data;
      try {
        data = await parser.getText();
      } finally {
        await parser.destroy();
      }
      text = data.text;
    } catch (e) {
      tempPath = path.join(os.tmpdir(), `learnflow-import-${uuidv4()}.pdf`);
      fs.writeFileSync(tempPath, req.file.buffer);
      throw e;
    }

    const classesData = [];
    let currentClass = null;
    const lines = text.split('\n');
    for (let line of lines) {
      line = line.trim();
      if (!line) continue;
      
      const classMatch = line.match(/^Namensliste der\s+(.+)$/i);
      if (classMatch) {
        currentClass = { name: classMatch[1], students: [] };
        classesData.push(currentClass);
        continue;
      }
      
      if (currentClass) {
        const studentMatch = line.match(/^(\d+)([^\d].*)$/);
        if (studentMatch && 
            !line.includes('SchülerInnen') && 
            !line.includes('Klassenvorständin') && 
            !line.includes('Klassenvorstand') && 
            !line.includes('Schuljahr') && 
            !line.includes('22.05.2026') && 
            !line.startsWith('NrName') && 
            !line.includes('05262/62062') && 
            !line.includes('Weißenbachgasse') && 
            !line.includes('Dr. Aloys Weissenbach')) {
            
            let name = studentMatch[2].trim();
            currentClass.students.push(name);
        }
      }
    }

    if (classesData.length === 0) {
      return res.status(400).json({ error: 'No classes found in the PDF. Please check the format.' });
    }

    const db = require('../db/init').getDB();
    const crypto = require('crypto');
    const defaultPasswordHash = hashPassword('changeme123');
    
    const results = { classesCreated: 0, studentsCreated: 0, classesExisting: 0, studentsExisting: 0 };
    
    db.transaction(() => {
      for (const cls of classesData) {
        let classRecord = db.prepare('SELECT id FROM classes WHERE name = ?').get(cls.name);
        let classId;
        
        if (!classRecord) {
          classId = uuidv4();
          let code = crypto.randomBytes(3).toString('hex').toUpperCase();
          while (db.prepare('SELECT 1 FROM classes WHERE class_code = ?').get(code)) {
            code = crypto.randomBytes(3).toString('hex').toUpperCase();
          }
          db.prepare('INSERT INTO classes (id, name, class_code, created_by) VALUES (?, ?, ?, ?)')
            .run(classId, cls.name, code, req.user.userId);
          results.classesCreated++;
        } else {
          classId = classRecord.id;
          const existingClass = db.prepare('SELECT id, created_by FROM classes WHERE id = ?').get(classId);
          if (!canAccessClass(req, existingClass)) {
            const error = new Error(`You do not have permission to import students into class "${cls.name}"`);
            error.statusCode = 403;
            throw error;
          }
          results.classesExisting++;
        }

        for (const studentName of cls.students) {
          // generate username: first initial + last name lowercase, e.g. "lauer" for "Linus Auer"
          // Or just use name lowercase stripped of spaces
          const cleanName = studentName.replace(/[^a-zA-ZäöüßÄÖÜ]/g, '').toLowerCase();
          const username = cleanName + crypto.randomBytes(2).toString('hex');
          
          let studentRecord = db.prepare('SELECT id FROM users WHERE name = ? AND role = \'student\'').get(studentName);
          let studentId;
          
          if (!studentRecord) {
            studentId = uuidv4();
            db.prepare(`
              INSERT INTO users (id, name, username, password_hash, role, last_login) 
              VALUES (?, ?, ?, ?, 'student', datetime('now'))
            `).run(studentId, studentName, username, defaultPasswordHash);
            results.studentsCreated++;
          } else {
            studentId = studentRecord.id;
            results.studentsExisting++;
          }
          
          // Enroll student in class
          const enrollment = db.prepare('SELECT student_id FROM class_students WHERE class_id = ? AND student_id = ?').get(classId, studentId);
          if (!enrollment) {
            db.prepare('INSERT INTO class_students (class_id, student_id) VALUES (?, ?)').run(classId, studentId);
          }
        }
      }
    })();
    
    res.json({ message: 'Import successful', results, data: classesData });
  } catch (err) {
    console.error('[CLASSES] PDF Import error:', err);
    res.status(err.statusCode || 500).json({ error: 'Failed to process PDF file: ' + err.message });
  } finally {
    if (tempPath && fs.existsSync(tempPath)) {
      try { fs.unlinkSync(tempPath); } catch {}
    }
  }
});

module.exports = router;
