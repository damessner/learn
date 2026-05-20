const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/init');
const { requireAuth, requireRole } = require('./auth');
const { generateWorksheetFromAI } = require('../services/aiWorksheet');

const router = express.Router();

// ─── AI Worksheet Generation ────────────────────────────────────────────────────
router.post('/ai/generate', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const { provider, prompt } = req.body || {};
    if (!prompt || String(prompt).trim().length < 8) {
      return res.status(400).json({ error: 'Prompt must be at least 8 characters' });
    }

    const worksheet = await generateWorksheetFromAI({
      provider: provider || 'gemini',
      prompt: String(prompt).trim()
    });

    res.json(worksheet);
  } catch (err) {
    const msg = err?.message || 'AI generation failed';
    const status = /required|unsupported|invalid|configured|Prompt/i.test(msg) ? 400 : 502;
    res.status(status).json({ error: msg });
  }
});

// ─── List worksheets ───────────────────────────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  const db = getDB();
  const { role, userId } = req.user;

  let worksheets;
  if (req.user.isGuest) {
    worksheets = db.prepare(`
      SELECT w.id, w.title, w.description, w.subject, w.grade_level,
             w.total_points, w.created_at,
             a.id as assignment_id, a.due_date, a.class_name,
             s.score, s.submitted_at
      FROM worksheets w
      JOIN assignments a ON a.worksheet_id = w.id
      LEFT JOIN submissions s ON s.assignment_id = a.id AND s.user_id = ?
      WHERE a.id = ?
      ORDER BY a.due_date ASC
    `).all(userId, req.user.assignmentId);
  } else if (role === 'student') {
    // Students see worksheets assigned to them via active assignments matching their class memberships
    worksheets = db.prepare(`
      SELECT w.id, w.title, w.description, w.subject, w.grade_level,
             w.total_points, w.created_at,
             a.id as assignment_id, a.due_date, a.class_name, a.class_id,
             s.score, s.submitted_at
      FROM worksheets w
      JOIN assignments a ON a.worksheet_id = w.id
      LEFT JOIN submissions s ON s.assignment_id = a.id AND s.user_id = ?
      WHERE w.is_published = 1 AND (
        a.class_id IS NULL OR
        a.class_id IN (SELECT class_id FROM class_students WHERE student_id = ?)
      )
      ORDER BY a.due_date ASC
    `).all(userId, userId);
  } else {
    // Teachers/admins see all their worksheets
    const filter = role === 'admin' ? '1=1' : 'w.created_by = ?';
    const params = role === 'admin' ? [] : [userId];
    worksheets = db.prepare(`
      SELECT w.*, u.name as author_name
      FROM worksheets w
      JOIN users u ON u.id = w.created_by
      WHERE ${filter}
      ORDER BY w.updated_at DESC
    `).all(...params);
  }

  res.json(worksheets);
});

// ─── List templates ──────────────────────────────────────────────────────────
router.get('/templates', requireAuth, requireRole('teacher', 'admin'), (req, res) => {
  try {
    const templates = require('../db/templates.json');
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: 'Failed to load templates' });
  }
});

// ─── Clone template ─────────────────────────────────────────────────────────
router.post('/templates/:id/clone', requireAuth, requireRole('teacher', 'admin'), (req, res) => {
  try {
    const templates = require('../db/templates.json');
    const template = templates.find(t => t.id === req.params.id);
    if (!template) return res.status(404).json({ error: 'Template not found' });

    const db = getDB();
    const id = uuidv4();
    const totalPoints = calculatePoints(template.content);

    db.prepare(`
      INSERT INTO worksheets (id, title, description, subject, grade_level, created_by, content, total_points)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      template.title,
      template.description,
      template.subject,
      template.grade_level,
      req.user.userId,
      JSON.stringify(template.content),
      totalPoints
    );

    const cloned = db.prepare('SELECT * FROM worksheets WHERE id = ?').get(id);
    res.status(201).json({ ...cloned, content: JSON.parse(cloned.content) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── Get single worksheet ──────────────────────────────────────────────────────
router.get('/:id', requireAuth, (req, res) => {
  const db = getDB();
  if (req.user.isGuest) {
    const assignment = db.prepare('SELECT id, worksheet_id FROM assignments WHERE id = ?').get(req.user.assignmentId);
    if (!assignment) return res.status(403).json({ error: 'Guest assignment not found' });
    if (String(req.params.id) !== String(assignment.id) && String(req.params.id) !== String(assignment.worksheet_id)) {
      return res.status(403).json({ error: 'Guest token is restricted to one assignment' });
    }
  }

  let worksheet = db.prepare('SELECT * FROM worksheets WHERE id = ?').get(req.params.id);

  if (!worksheet) {
    // Try to lookup worksheet via assignment ID (since students navigate by assignment ID)
    worksheet = db.prepare(`
      SELECT w.*
      FROM worksheets w
      JOIN assignments a ON a.worksheet_id = w.id
      WHERE a.id = ?
    `).get(req.params.id);
  }

  if (!worksheet) return res.status(404).json({ error: 'Worksheet not found' });

  // Students get a version with correct answers stripped
  if (req.user.role === 'student') {
    const content = JSON.parse(worksheet.content);
    content.blocks = content.blocks.map(block => {
      const stripped = { ...block };
      if (block.type === 'gap_fill') {
        // Replace {answer} markers with ____ for display, keep structure
        stripped.template_display = block.template.replace(/\{[^}]+\}/g, '____');
        delete stripped.template; // Don't expose answers
        delete stripped.answers;
      }
      if (['multiple_choice', 'single_choice'].includes(block.type)) {
        delete stripped.correct; // Don't expose correct answers
      }
      if (block.type === 'matching') {
        // Shuffle right side
        stripped.right = [...block.pairs.map(p => p[1])].sort(() => Math.random() - 0.5);
        stripped.left = block.pairs.map(p => p[0]);
        delete stripped.pairs;
      }
      if (block.type === 'drag_drop') {
        // Shuffle draggable items
        stripped.items = [...block.items].sort(() => Math.random() - 0.5);
      }
      if (block.type === 'vocabulary') {
        const pairs = block.pairs || [];
        stripped.words = pairs.map((pair, pIdx) => {
          const isL2R = block.direction === 'l2r' || (block.direction === 'mixed' && pIdx % 2 === 0);
          return {
            id: pIdx,
            clue: isL2R ? pair.l : pair.r,
            answer: isL2R ? pair.r : pair.l,
            promptLang: isL2R ? 'left' : 'right'
          };
        });
        delete stripped.pairs;
        delete stripped.rawText;
      }
      return stripped;
    });
    worksheet.content = JSON.stringify(content);
  }

  res.json({ ...worksheet, content: JSON.parse(worksheet.content) });
});

// ─── Create worksheet ──────────────────────────────────────────────────────────
router.post('/', requireAuth, requireRole('teacher', 'admin'), (req, res) => {
  const { title, description, subject, grade_level, content, tags } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }

  const db = getDB();
  const id = uuidv4();
  const contentStr = JSON.stringify(content || { blocks: [] });
  const totalPoints = calculatePoints(content);

  db.prepare(`
    INSERT INTO worksheets (id, title, description, subject, grade_level, created_by, content, total_points, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, title.trim(), description || '', subject || '', grade_level || '', req.user.userId, contentStr, totalPoints, tags || '');

  const worksheet = db.prepare('SELECT * FROM worksheets WHERE id = ?').get(id);
  res.status(201).json({ ...worksheet, content: JSON.parse(worksheet.content) });
});

// ─── Update worksheet ──────────────────────────────────────────────────────────
router.put('/:id', requireAuth, requireRole('teacher', 'admin'), (req, res) => {
  const db = getDB();
  const existing = db.prepare('SELECT * FROM worksheets WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Worksheet not found' });

  // Teachers can only edit their own worksheets
  if (req.user.role === 'teacher' && existing.created_by !== req.user.userId) {
    return res.status(403).json({ error: 'Not your worksheet' });
  }

  const { title, description, subject, grade_level, content, is_published, tags } = req.body;
  const totalPoints = content !== undefined ? calculatePoints(content) : existing.total_points;

  db.prepare(`
    UPDATE worksheets SET
      title = COALESCE(?, title),
      description = COALESCE(?, description),
      subject = COALESCE(?, subject),
      grade_level = COALESCE(?, grade_level),
      content = COALESCE(?, content),
      total_points = COALESCE(?, total_points),
      is_published = COALESCE(?, is_published),
      tags = COALESCE(?, tags),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(
    title, description, subject, grade_level,
    content !== undefined ? JSON.stringify(content) : null,
    content !== undefined ? totalPoints : null,
    is_published !== undefined ? (is_published ? 1 : 0) : null,
    tags !== undefined ? (tags || '') : null,
    req.params.id
  );

  const updated = db.prepare('SELECT * FROM worksheets WHERE id = ?').get(req.params.id);
  res.json({ ...updated, content: JSON.parse(updated.content) });
});

// ─── Delete worksheet ──────────────────────────────────────────────────────────
router.delete('/:id', requireAuth, requireRole('teacher', 'admin'), (req, res) => {
  const db = getDB();
  const existing = db.prepare('SELECT * FROM worksheets WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Worksheet not found' });

  if (req.user.role === 'teacher' && existing.created_by !== req.user.userId) {
    return res.status(403).json({ error: 'Not your worksheet' });
  }

  db.prepare('DELETE FROM worksheets WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// ─── Assignments ───────────────────────────────────────────────────────────────
router.get('/:id/assignments', requireAuth, requireRole('teacher', 'admin'), (req, res) => {
  const db = getDB();
  const assignments = db.prepare(`
    SELECT a.*, COUNT(s.id) as submission_count
    FROM assignments a
    LEFT JOIN submissions s ON s.assignment_id = a.id
    WHERE a.worksheet_id = ?
    GROUP BY a.id
    ORDER BY a.created_at DESC
  `).all(req.params.id);
  res.json(assignments);
});

router.post('/:id/assignments', requireAuth, requireRole('teacher', 'admin'), (req, res) => {
  const { class_name, class_id, due_date } = req.body;
  if (!class_name) return res.status(400).json({ error: 'class_name required' });

  const db = getDB();
  const id = uuidv4();
  db.prepare(`
    INSERT INTO assignments (id, worksheet_id, class_name, class_id, due_date, created_by)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, req.params.id, class_name, class_id || null, due_date || null, req.user.userId);

  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(id);
  res.status(201).json(assignment);
});

router.delete('/:id/assignments/:assignmentId', requireAuth, requireRole('teacher', 'admin'), (req, res) => {
  const db = getDB();
  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ? AND worksheet_id = ?').get(req.params.assignmentId, req.params.id);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
  db.prepare('DELETE FROM assignments WHERE id = ?').run(req.params.assignmentId);
  res.json({ success: true });
});

// ─── Assignment results (teacher view) ────────────────────────────────────────
router.get('/assignments/:assignmentId/results', requireAuth, requireRole('teacher', 'admin'), (req, res) => {
  const db = getDB();
  const results = db.prepare(`
    SELECT s.*, u.name as student_name, u.email as student_email
    FROM submissions s
    JOIN users u ON u.id = s.user_id
    WHERE s.assignment_id = ?
    ORDER BY u.name
  `).all(req.params.assignmentId);
  res.json(results.map(r => ({ ...r, answers: JSON.parse(r.answers) })));
});

// ─── Duplicate worksheet ──────────────────────────────────────────────────────────
router.post('/:id/duplicate', requireAuth, requireRole('teacher', 'admin'), (req, res) => {
  const db = getDB();
  const existing = db.prepare('SELECT * FROM worksheets WHERE id = ?').get(req.params.id);
  if (!existing) return res.status(404).json({ error: 'Worksheet not found' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO worksheets (id, title, description, subject, grade_level, created_by, content, total_points, is_published, tags)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
  `).run(
    id,
    'Copy of ' + existing.title,
    existing.description,
    existing.subject,
    existing.grade_level,
    req.user.userId,
    existing.content,
    existing.total_points,
    existing.tags || ''
  );

  const cloned = db.prepare('SELECT * FROM worksheets WHERE id = ?').get(id);
  res.status(201).json({ ...cloned, content: JSON.parse(cloned.content) });
});

// ─── Assignment Statistics ─────────────────────────────────────────────────────
router.get('/assignments/:assignmentId/stats', requireAuth, requireRole('teacher', 'admin'), (req, res) => {
  const db = getDB();
  const assignment = db.prepare(`
    SELECT a.*, w.total_points, c.name as class_name,
           (SELECT COUNT(*) FROM class_students cs WHERE cs.class_id = a.class_id) as total_students
    FROM assignments a
    JOIN worksheets w ON w.id = a.worksheet_id
    LEFT JOIN classes c ON c.id = a.class_id
    WHERE a.id = ?
  `).get(req.params.assignmentId);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

  const submissions = db.prepare(`
    SELECT score, max_score FROM submissions
    WHERE assignment_id = ? AND submitted_at IS NOT NULL
  `).all(req.params.assignmentId);

  const submitted = submissions.length;
  const totalStudents = assignment.total_students || 0;
  let totalScore = 0, totalMax = 0, passCount = 0;
  const distribution = { '0-20': 0, '21-40': 0, '41-60': 0, '61-80': 0, '81-100': 0 };

  submissions.forEach(s => {
    totalScore += s.score || 0;
    totalMax += s.max_score || 0;
    const pct = s.max_score > 0 ? Math.round((s.score / s.max_score) * 100) : 0;
    if (pct >= 60) passCount++;
    if (pct <= 20) distribution['0-20']++;
    else if (pct <= 40) distribution['21-40']++;
    else if (pct <= 60) distribution['41-60']++;
    else if (pct <= 80) distribution['61-80']++;
    else distribution['81-100']++;
  });

  const avgScore = submitted > 0 ? Math.round(totalScore / submitted) : 0;
  const avgPercentage = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
  const passRate = submitted > 0 ? Math.round((passCount / submitted) * 100) : 0;

  res.json({ totalStudents, submitted, avgScore, avgPercentage, passRate, scoreDistribution: distribution });
});

// ─── Helper: calculate total points from content ───────────────────────────────
function calculatePoints(content) {
  if (!content || !content.blocks) return 0;
  return content.blocks.reduce((sum, block) => sum + (block.points || 0), 0);
}

module.exports = router;
