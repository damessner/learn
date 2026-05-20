const express = require('express');
const router = express.Router();
const { getDB } = require('../db/init');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_do_not_use_in_prod';

// Middleware for authentication
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

// ─── TEACHER: Get all courses created by the teacher ───
router.get('/', requireAuth, requireRole('teacher', 'admin'), (req, res) => {
  try {
    const db = getDB();
    const courses = db.prepare(`
      SELECT c.*, 
             (SELECT COUNT(*) FROM course_worksheets cw WHERE cw.course_id = c.id) as worksheet_count
      FROM courses c 
      WHERE c.created_by = ? 
      ORDER BY c.created_at DESC
    `).all(req.user.userId);
    res.json(courses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── TEACHER: Create a new course ───
router.post('/', requireAuth, requireRole('teacher', 'admin'), (req, res) => {
  const { title, description } = req.body;
  if (!title) return res.status(400).json({ error: 'Title is required' });

  const { v4: uuidv4 } = require('uuid');
  const courseId = uuidv4();

  try {
    const db = getDB();
    db.prepare(`
      INSERT INTO courses (id, title, description, created_by)
      VALUES (?, ?, ?, ?)
    `).run(courseId, title, description || '', req.user.userId);
    
    res.status(201).json({ id: courseId, title, description });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── TEACHER: Get course details and its worksheets ───
router.get('/:id', requireAuth, requireRole('teacher', 'admin'), (req, res) => {
  try {
    const db = getDB();
    const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });

    // Ensure teacher owns it (or is admin)
    if (req.user.role !== 'admin' && course.created_by !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const worksheets = db.prepare(`
      SELECT w.id, w.title, w.subject, w.total_points, cw.order_index
      FROM course_worksheets cw
      JOIN worksheets w ON cw.worksheet_id = w.id
      WHERE cw.course_id = ?
      ORDER BY cw.order_index ASC
    `).all(course.id);

    res.json({ ...course, worksheets });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── TEACHER: Add worksheet to course ───
router.post('/:id/worksheets', requireAuth, requireRole('teacher', 'admin'), (req, res) => {
  const { worksheet_id } = req.body;
  if (!worksheet_id) return res.status(400).json({ error: 'worksheet_id is required' });

  try {
    const db = getDB();
    
    // Check if course exists and belongs to user
    const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (req.user.role !== 'admin' && course.created_by !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Determine max order_index
    const maxOrderRow = db.prepare('SELECT MAX(order_index) as max_idx FROM course_worksheets WHERE course_id = ?').get(course.id);
    const newOrder = (maxOrderRow.max_idx !== null ? maxOrderRow.max_idx : -1) + 1;

    db.prepare(`
      INSERT INTO course_worksheets (course_id, worksheet_id, order_index)
      VALUES (?, ?, ?)
    `).run(course.id, worksheet_id, newOrder);

    res.status(201).json({ success: true });
  } catch (err) {
    // Check if constraint failed (already added)
    if (err.message.includes('UNIQUE constraint failed') || err.message.includes('PRIMARY KEY')) {
      return res.status(400).json({ error: 'Worksheet is already in this course' });
    }
    res.status(500).json({ error: err.message });
  }
});

// ─── TEACHER: Remove worksheet from course ───
router.delete('/:id/worksheets/:worksheetId', requireAuth, requireRole('teacher', 'admin'), (req, res) => {
  try {
    const db = getDB();
    const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (req.user.role !== 'admin' && course.created_by !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    db.prepare('DELETE FROM course_worksheets WHERE course_id = ? AND worksheet_id = ?').run(course.id, req.params.worksheetId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── TEACHER: Assign course to class ───
router.post('/:id/assign', requireAuth, requireRole('teacher', 'admin'), (req, res) => {
  const { class_id, due_date } = req.body;
  if (!class_id) return res.status(400).json({ error: 'class_id is required' });

  const { v4: uuidv4 } = require('uuid');
  const courseAssignmentId = uuidv4();

  try {
    const db = getDB();
    const course = db.prepare('SELECT * FROM courses WHERE id = ?').get(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    if (req.user.role !== 'admin' && course.created_by !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const cls = db.prepare('SELECT name FROM classes WHERE id = ?').get(class_id);
    if (!cls) return res.status(404).json({ error: 'Class not found' });

    // Begin transaction
    const assignTransaction = db.transaction(() => {
      // 1. Create course_assignments entry
      db.prepare(`
        INSERT INTO course_assignments (id, course_id, class_id, due_date, created_by)
        VALUES (?, ?, ?, ?, ?)
      `).run(courseAssignmentId, course.id, class_id, due_date || null, req.user.userId);

      // 2. Fetch all worksheets in this course
      const worksheets = db.prepare('SELECT worksheet_id FROM course_worksheets WHERE course_id = ?').all(course.id);

      // 3. Create individual assignments for each worksheet so students can submit them
      const insertAssignment = db.prepare(`
        INSERT INTO assignments (id, worksheet_id, class_name, class_id, due_date, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      for (const ws of worksheets) {
        // Note: We don't link these back to course_assignment_id directly in the DB schema to avoid migrating the assignments table. 
        // We can dynamically resolve them using class_id and worksheet_id.
        insertAssignment.run(uuidv4(), ws.worksheet_id, cls.name, class_id, due_date || null, req.user.userId);
      }
    });

    assignTransaction();
    
    res.status(201).json({ id: courseAssignmentId, success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── TEACHER: Get course assignments ───
router.get('/:id/assignments', requireAuth, requireRole('teacher', 'admin'), (req, res) => {
  try {
    const db = getDB();
    const assignments = db.prepare(`
      SELECT ca.id, ca.due_date, ca.created_at, cl.name as class_name, cl.id as class_id
      FROM course_assignments ca
      JOIN classes cl ON ca.class_id = cl.id
      WHERE ca.course_id = ?
      ORDER BY ca.created_at DESC
    `).all(req.params.id);
    res.json(assignments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── TEACHER: Delete Course ───
router.delete('/:id', requireAuth, requireRole('teacher', 'admin'), (req, res) => {
  try {
    const db = getDB();
    db.transaction(() => {
      db.prepare('DELETE FROM course_assignments WHERE course_id = ?').run(req.params.id);
      db.prepare('DELETE FROM course_worksheets WHERE course_id = ?').run(req.params.id);
      db.prepare('DELETE FROM courses WHERE id = ?').run(req.params.id);
    })();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── STUDENT: Get assigned courses ───
router.get('/student/assigned', requireAuth, requireRole('student'), (req, res) => {
  try {
    const db = getDB();
    const classes = db.prepare('SELECT class_id FROM class_students WHERE student_id = ?').all(req.user.userId);
    const classIds = classes.map(c => c.class_id);
    if (classIds.length === 0) return res.json([]);

    const placeholders = classIds.map(() => '?').join(',');
    
    const assignedCourses = db.prepare(`
      SELECT ca.id as course_assignment_id, ca.due_date, c.id as course_id, c.title, c.description,
             (SELECT COUNT(*) FROM course_worksheets cw WHERE cw.course_id = c.id) as total_worksheets,
             cl.name as class_name, cl.id as class_id
      FROM course_assignments ca
      JOIN courses c ON ca.course_id = c.id
      JOIN classes cl ON ca.class_id = cl.id
      WHERE ca.class_id IN (${placeholders})
      ORDER BY ca.created_at DESC
    `).all(...classIds);

    res.json(assignedCourses);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── STUDENT: Get full course details (with worksheets and progress) ───
router.get('/student/course/:courseAssignmentId', requireAuth, requireRole('student'), (req, res) => {
  try {
    const db = getDB();
    const courseAssignmentId = req.params.courseAssignmentId;
    
    const courseAssignment = db.prepare(`
      SELECT ca.*, c.title, c.description 
      FROM course_assignments ca
      JOIN courses c ON ca.course_id = c.id
      WHERE ca.id = ?
    `).get(courseAssignmentId);
    
    if (!courseAssignment) return res.status(404).json({ error: 'Course assignment not found' });

    // Ensure student is in the class
    const isInClass = db.prepare('SELECT 1 FROM class_students WHERE class_id = ? AND student_id = ?').get(courseAssignment.class_id, req.user.userId);
    if (!isInClass) return res.status(403).json({ error: 'Not enrolled in this course' });

    // Get worksheets in order
    const worksheets = db.prepare(`
      SELECT w.id as worksheet_id, w.title, w.subject, w.total_points, cw.order_index
      FROM course_worksheets cw
      JOIN worksheets w ON cw.worksheet_id = w.id
      WHERE cw.course_id = ?
      ORDER BY cw.order_index ASC
    `).all(courseAssignment.course_id);

    // Get the assignment IDs created for this class/worksheets
    const worksheetIds = worksheets.map(w => w.worksheet_id);
    if (worksheetIds.length === 0) {
      return res.json({ course: courseAssignment, worksheets: [] });
    }

    const wsPlaceholders = worksheetIds.map(() => '?').join(',');
    // Fetch the individual assignments for these worksheets assigned to this class
    const assignments = db.prepare(`
      SELECT id as assignment_id, worksheet_id 
      FROM assignments 
      WHERE class_id = ? AND worksheet_id IN (${wsPlaceholders})
    `).all(courseAssignment.class_id, ...worksheetIds);

    // Map them
    const assignMap = {};
    assignments.forEach(a => assignMap[a.worksheet_id] = a.assignment_id);

    // Fetch submissions for these assignments
    const assignIds = assignments.map(a => a.assignment_id);
    let subsMap = {};
    if (assignIds.length > 0) {
      const aPlaceholders = assignIds.map(() => '?').join(',');
      const submissions = db.prepare(`
        SELECT assignment_id, score, max_score, submitted_at, started_at
        FROM submissions
        WHERE user_id = ? AND assignment_id IN (${aPlaceholders})
      `).all(req.user.userId, ...assignIds);
      submissions.forEach(s => subsMap[s.assignment_id] = s);
    }

    // Attach assignment info to worksheets
    const finalWorksheets = worksheets.map(w => {
      const a_id = assignMap[w.worksheet_id] || null;
      const sub = a_id ? (subsMap[a_id] || null) : null;
      return {
        ...w,
        assignment_id: a_id,
        status: sub ? (sub.submitted_at ? 'completed' : 'in_progress') : 'not_started',
        score: sub ? sub.score : null,
        max_score: sub ? sub.max_score : null
      };
    });

    res.json({
      course: courseAssignment,
      worksheets: finalWorksheets
    });
    
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
