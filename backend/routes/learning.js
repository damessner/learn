const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/init');
const { requireAuth, requireRole } = require('./auth');

const router = express.Router();
router.use(requireAuth);

const SKILL_PASS_RATIO = Number.isFinite(Number(process.env.SKILL_PASS_RATIO))
  ? Math.max(0.3, Math.min(0.95, Number(process.env.SKILL_PASS_RATIO)))
  : 0.65;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseJson(value, fallback = {}) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function buildMasteryMap(db, userId) {
  const rows = db.prepare(`
    SELECT w.subject, s.score, s.max_score, s.submitted_at
    FROM submissions s
    JOIN assignments a ON a.id = s.assignment_id
    JOIN worksheets w ON w.id = a.worksheet_id
    WHERE s.user_id = ? AND s.submitted_at IS NOT NULL
    ORDER BY s.submitted_at DESC
  `).all(userId);

  const bySubject = new Map();
  for (const row of rows) {
    const subject = row.subject || 'General';
    if (!bySubject.has(subject)) bySubject.set(subject, { attempts: 0, score: 0, max: 0, lastSubmittedAt: null });
    const item = bySubject.get(subject);
    item.attempts += 1;
    item.score += row.score || 0;
    item.max += row.max_score || 0;
    item.lastSubmittedAt = item.lastSubmittedAt || row.submitted_at;
  }

  return [...bySubject.entries()].map(([subject, item]) => {
    const ratio = item.max > 0 ? item.score / item.max : 0;
    const percent = Math.round(ratio * 100);
    return {
      subject,
      attempts: item.attempts,
      percent,
      masteryLevel: percent >= 85 ? 'mastered' : percent >= 65 ? 'developing' : 'needs_support',
      lastSubmittedAt: item.lastSubmittedAt
    };
  }).sort((a, b) => a.percent - b.percent);
}

router.get('/student/mastery', (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' });
  const db = getDB();
  const mastery = buildMasteryMap(db, req.user.userId);
  res.json(mastery);
});

router.get('/student/spaced-queue', (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' });
  const db = getDB();
  const mastery = buildMasteryMap(db, req.user.userId);
  const queue = mastery
    .filter(m => m.percent < 80)
    .map((m, idx) => ({
      subject: m.subject,
      priority: m.percent < 60 ? 'high' : 'medium',
      nextPracticeAt: new Date(Date.now() + (idx + 1) * 24 * 60 * 60 * 1000).toISOString(),
      rationale: m.percent < 60 ? 'Recent low performance detected' : 'Reinforcement recommended'
    }));
  res.json(queue);
});

router.get('/student/recommendations', (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' });
  const db = getDB();
  const recent = db.prepare(`
    SELECT s.score, s.max_score
    FROM submissions s
    WHERE s.user_id = ? AND s.submitted_at IS NOT NULL
    ORDER BY s.submitted_at DESC
    LIMIT 5
  `).all(req.user.userId);
  const totalScore = recent.reduce((sum, r) => sum + (r.score || 0), 0);
  const totalMax = recent.reduce((sum, r) => sum + (r.max_score || 0), 0);
  const ratio = totalMax > 0 ? totalScore / totalMax : 0;
  const recommendedDifficulty = ratio >= 0.85 ? 'advanced' : ratio >= 0.6 ? 'standard' : 'support';

  const plannerLoad = db.prepare(`
    SELECT COUNT(*) as pendingCount, COALESCE(SUM(estimated_minutes),0) as pendingMinutes
    FROM planner_items
    WHERE user_id = ? AND status = 'pending'
  `).get(req.user.userId);

  res.json({
    recommendedDifficulty,
    rationale: ratio >= 0.85 ? 'Excellent recent performance' : ratio >= 0.6 ? 'Balanced progression suggested' : 'Focus on reinforcement and guided practice',
    pendingPlannerItems: plannerLoad.pendingCount || 0,
    estimatedPendingMinutes: plannerLoad.pendingMinutes || 0
  });
});

router.get('/student/planner', (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' });
  const db = getDB();
  const items = db.prepare(`
    SELECT * FROM planner_items
    WHERE user_id = ?
    ORDER BY status ASC, COALESCE(due_date, '9999-12-31') ASC, created_at DESC
  `).all(req.user.userId);
  res.json(items);
});

router.post('/student/planner', (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' });
  const { title, notes, due_date, estimated_minutes } = req.body || {};
  if (!title || !String(title).trim()) return res.status(400).json({ error: 'title is required' });
  const db = getDB();
  const id = uuidv4();
  db.prepare(`
    INSERT INTO planner_items (id, user_id, title, notes, due_date, estimated_minutes)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    id,
    req.user.userId,
    String(title).trim(),
    notes ? String(notes) : '',
    due_date || null,
    Number.isFinite(Number(estimated_minutes)) ? Math.max(5, Number(estimated_minutes)) : 30
  );
  res.status(201).json(db.prepare('SELECT * FROM planner_items WHERE id = ?').get(id));
});

router.patch('/student/planner/:id', (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' });
  const { status, title, notes, due_date, estimated_minutes } = req.body || {};
  const db = getDB();
  const existing = db.prepare('SELECT * FROM planner_items WHERE id = ? AND user_id = ?').get(req.params.id, req.user.userId);
  if (!existing) return res.status(404).json({ error: 'Planner item not found' });
  db.prepare(`
    UPDATE planner_items
    SET
      status = COALESCE(?, status),
      title = COALESCE(?, title),
      notes = COALESCE(?, notes),
      due_date = COALESCE(?, due_date),
      estimated_minutes = COALESCE(?, estimated_minutes)
    WHERE id = ? AND user_id = ?
  `).run(
    ['pending', 'done'].includes(status) ? status : null,
    title !== undefined ? String(title) : null,
    notes !== undefined ? String(notes) : null,
    due_date !== undefined ? due_date : null,
    estimated_minutes !== undefined ? Math.max(5, Number(estimated_minutes) || 30) : null,
    req.params.id,
    req.user.userId
  );
  res.json(db.prepare('SELECT * FROM planner_items WHERE id = ?').get(req.params.id));
});

router.get('/student/gamification', (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' });
  const db = getDB();
  const streakRows = db.prepare(`
    SELECT DATE(submitted_at) as d
    FROM submissions
    WHERE user_id = ? AND submitted_at IS NOT NULL
    GROUP BY DATE(submitted_at)
    ORDER BY d DESC
  `).all(req.user.userId);
  let streak = 0;
  let expected = new Date();
  expected.setHours(0, 0, 0, 0);
  for (const row of streakRows) {
    const day = new Date(`${row.d}T00:00:00`);
    const delta = Math.round((expected - day) / MS_PER_DAY);
    if (delta === 0) {
      streak += 1;
      expected = new Date(expected.getTime() - MS_PER_DAY);
    } else if (delta === 1 && streak === 0) {
      expected = day;
    } else {
      break;
    }
  }
  const completed = db.prepare(`SELECT COUNT(*) as cnt FROM submissions WHERE user_id = ? AND submitted_at IS NOT NULL`).get(req.user.userId).cnt || 0;
  const badges = [
    { key: 'starter', title: 'Starter', unlocked: completed >= 1 },
    { key: 'consistent', title: 'Consistent Learner', unlocked: streak >= 3 },
    { key: 'focused', title: 'Focused Finisher', unlocked: completed >= 10 }
  ];
  res.json({ streakDays: streak, completedAssignments: completed, badges });
});

router.get('/student/peer-review/:assignmentId', (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' });
  const db = getDB();
  const reviews = db.prepare(`
    SELECT pr.*, u.name as reviewer_name
    FROM peer_reviews pr
    JOIN users u ON u.id = pr.reviewer_id
    WHERE pr.assignment_id = ? AND pr.reviewee_id = ?
    ORDER BY pr.created_at DESC
  `).all(req.params.assignmentId, req.user.userId);
  res.json(reviews);
});

router.post('/student/peer-review/:assignmentId', (req, res) => {
  if (req.user.role !== 'student') return res.status(403).json({ error: 'Students only' });
  const { reviewee_id, rating, comments } = req.body || {};
  if (!reviewee_id) return res.status(400).json({ error: 'reviewee_id is required' });
  if (!Number.isInteger(Number(rating)) || Number(rating) < 1 || Number(rating) > 5) {
    return res.status(400).json({ error: 'rating must be an integer between 1 and 5' });
  }
  const safeRating = Number(rating);
  const db = getDB();
  const id = uuidv4();
  db.prepare(`
    INSERT OR REPLACE INTO peer_reviews (id, assignment_id, reviewer_id, reviewee_id, rating, comments)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, req.params.assignmentId, req.user.userId, reviewee_id, safeRating, comments ? String(comments) : '');
  res.status(201).json({ success: true, id });
});

router.use(requireRole('teacher', 'admin'));

router.get('/teacher/at-risk', (req, res) => {
  const db = getDB();
  const rows = db.prepare(`
    SELECT
      u.id as student_id,
      u.name as student_name,
      c.name as class_name,
      ROUND(AVG(CASE WHEN s.max_score > 0 THEN CAST(s.score AS REAL) / s.max_score ELSE NULL END), 3) as avg_ratio,
      SUM(CASE WHEN s.submitted_at IS NULL THEN 1 ELSE 0 END) as in_progress_count
    FROM class_students cs
    JOIN users u ON u.id = cs.student_id
    JOIN classes c ON c.id = cs.class_id
    LEFT JOIN assignments a ON a.class_id = c.id
    LEFT JOIN submissions s ON s.assignment_id = a.id AND s.user_id = u.id
    WHERE c.created_by = ?
    GROUP BY u.id, c.id
    ORDER BY avg_ratio ASC
  `).all(req.user.userId);
  const atRisk = rows
    .filter(r => (r.avg_ratio === null) || r.avg_ratio < SKILL_PASS_RATIO || (r.in_progress_count || 0) >= 2)
    .map(r => ({
      studentId: r.student_id,
      studentName: r.student_name,
      className: r.class_name,
      averagePercent: r.avg_ratio === null ? 0 : Math.round(r.avg_ratio * 100),
      reason: r.avg_ratio === null ? 'No scored submissions yet' : r.avg_ratio < SKILL_PASS_RATIO ? 'Low average score' : 'Multiple unfinished tasks'
    }));
  res.json(atRisk);
});

router.get('/teacher/interventions', (req, res) => {
  const db = getDB();
  const rows = db.prepare(`
    SELECT
      c.id as class_id,
      c.name as class_name,
      w.subject,
      u.id as student_id,
      u.name as student_name,
      ROUND(AVG(CASE WHEN s.max_score > 0 THEN CAST(s.score AS REAL) / s.max_score ELSE NULL END), 3) as avg_ratio
    FROM classes c
    JOIN class_students cs ON cs.class_id = c.id
    JOIN users u ON u.id = cs.student_id
    JOIN assignments a ON a.class_id = c.id
    JOIN worksheets w ON w.id = a.worksheet_id
    LEFT JOIN submissions s ON s.assignment_id = a.id AND s.user_id = u.id
    WHERE c.created_by = ?
    GROUP BY c.id, w.subject, u.id
  `).all(req.user.userId);

  const groups = {};
  rows.forEach(r => {
    const key = `${r.class_id}::${r.subject || 'General'}`;
    if (!groups[key]) {
      groups[key] = {
        classId: r.class_id,
        className: r.class_name,
        focusSubject: r.subject || 'General',
        students: []
      };
    }
    if ((r.avg_ratio ?? 1) < SKILL_PASS_RATIO) {
      groups[key].students.push({ studentId: r.student_id, studentName: r.student_name, averagePercent: Math.round((r.avg_ratio || 0) * 100) });
    }
  });
  res.json(Object.values(groups).filter(g => g.students.length > 0));
});

router.get('/teacher/analytics', (req, res) => {
  const db = getDB();
  const overview = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM classes WHERE created_by = ?) as classesCount,
      (SELECT COUNT(*) FROM worksheets WHERE created_by = ?) as worksheetCount,
      (SELECT COUNT(*) FROM assignments WHERE created_by = ?) as assignmentCount,
      (SELECT COUNT(*) FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE a.created_by = ? AND s.submitted_at IS NOT NULL) as completedSubmissions
  `).get(req.user.userId, req.user.userId, req.user.userId, req.user.userId);

  const subjectPerformance = db.prepare(`
    SELECT w.subject, ROUND(AVG(CASE WHEN s.max_score > 0 THEN CAST(s.score AS REAL)/s.max_score * 100 END), 1) as avg_percentage
    FROM submissions s
    JOIN assignments a ON a.id = s.assignment_id
    JOIN worksheets w ON w.id = a.worksheet_id
    WHERE a.created_by = ? AND s.submitted_at IS NOT NULL
    GROUP BY w.subject
    ORDER BY avg_percentage ASC
  `).all(req.user.userId);

  res.json({ overview, subjectPerformance });
});

router.post('/teacher/parent-digest/:studentId', (req, res) => {
  const db = getDB();
  const student = db.prepare(`SELECT id, name, email FROM users WHERE id = ? AND role = 'student'`).get(req.params.studentId);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const summary = db.prepare(`
    SELECT
      COUNT(*) as submissions,
      ROUND(AVG(CASE WHEN max_score > 0 THEN CAST(score AS REAL) / max_score * 100 END), 1) as avg_percent,
      MAX(submitted_at) as last_submission
    FROM submissions
    WHERE user_id = ? AND submitted_at IS NOT NULL
  `).get(student.id);

  const digest = {
    student: { id: student.id, name: student.name, email: student.email },
    generatedAt: new Date().toISOString(),
    summary: {
      submissions: summary.submissions || 0,
      averagePercent: summary.avg_percent || 0,
      lastSubmission: summary.last_submission
    }
  };

  const id = uuidv4();
  db.prepare(`
    INSERT INTO parent_digests (id, student_id, generated_by, email_target, digest_json)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, student.id, req.user.userId, req.body?.email_target || student.email || null, JSON.stringify(digest));

  res.status(201).json({ id, digest });
});

router.get('/teacher/parent-digest/:studentId/latest', (req, res) => {
  const db = getDB();
  const row = db.prepare(`
    SELECT * FROM parent_digests
    WHERE student_id = ?
    ORDER BY created_at DESC
    LIMIT 1
  `).get(req.params.studentId);
  if (!row) return res.status(404).json({ error: 'No digest found' });
  res.json({ ...row, digest: parseJson(row.digest_json, {}) });
});

module.exports = router;
