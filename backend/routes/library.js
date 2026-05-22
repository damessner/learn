const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/init');
const { requireAuth, requireRole } = require('./auth');

const router = express.Router();

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function serializeWorksheetRow(row) {
  return {
    ...row,
    content: parseJson(row.content, { blocks: [] }),
    rubric: row.rubric_json ? parseJson(row.rubric_json, { criteria: [] }) : { criteria: [] }
  };
}

// ─── Get rating aggregates for an item ───────────────────────────────────────
function getRatingAggregates(db, itemType, itemId) {
  const rows = db.prepare(`
    SELECT rater_role, AVG(rating) as avg_rating, COUNT(*) as count
    FROM ratings
    WHERE item_type = ? AND item_id = ?
    GROUP BY rater_role
  `).all(itemType, itemId);

  const result = { student_avg: null, student_count: 0, teacher_avg: null, teacher_count: 0 };
  for (const row of rows) {
    if (row.rater_role === 'student') {
      result.student_avg = Math.round(row.avg_rating * 10) / 10;
      result.student_count = row.count;
    } else if (row.rater_role === 'teacher') {
      result.teacher_avg = Math.round(row.avg_rating * 10) / 10;
      result.teacher_count = row.count;
    }
  }
  return result;
}

// ─── Browse system library ────────────────────────────────────────────────────
// GET /api/library/worksheets?search=&sortBy=student_rating|teacher_rating|title&order=desc
router.get('/worksheets', requireAuth, (req, res) => {
  const db = getDB();
  const { search, sortBy, order } = req.query;

  const sortOrder = order === 'asc' ? 'ASC' : 'DESC';
  let orderClause;
  if (sortBy === 'teacher_rating') {
    orderClause = `teacher_avg ${sortOrder} NULLS LAST, w.updated_at DESC`;
  } else if (sortBy === 'title') {
    orderClause = `w.title ${sortOrder}`;
  } else {
    // default: sort by student rating
    orderClause = `student_avg ${sortOrder} NULLS LAST, w.updated_at DESC`;
  }

  const searchParam = search ? `%${search.trim()}%` : '%';

  const rows = db.prepare(`
    SELECT
      w.id, w.title, w.description, w.subject, w.grade_level,
      w.total_points, w.tags, w.is_published, w.library_source,
      w.created_at, w.updated_at,
      u.name as author_name,
      ROUND(AVG(CASE WHEN r.rater_role = 'student' THEN r.rating END), 1) AS student_avg,
      COUNT(CASE WHEN r.rater_role = 'student' THEN 1 END) AS student_count,
      ROUND(AVG(CASE WHEN r.rater_role = 'teacher' THEN r.rating END), 1) AS teacher_avg,
      COUNT(CASE WHEN r.rater_role = 'teacher' THEN 1 END) AS teacher_count
    FROM worksheets w
    JOIN users u ON u.id = w.created_by
    LEFT JOIN ratings r ON r.item_type = 'worksheet' AND r.item_id = w.id
    WHERE w.in_library = 1 AND w.is_published = 1
      AND (w.title LIKE ? OR w.subject LIKE ? OR w.tags LIKE ?)
    GROUP BY w.id
    ORDER BY ${orderClause}
  `).all(searchParam, searchParam, searchParam);

  res.json(rows);
});

// ─── Publish worksheet to library ─────────────────────────────────────────────
// POST /api/library/worksheets/:id/publish
router.post('/worksheets/:id/publish', requireAuth, requireRole('teacher', 'admin'), (req, res) => {
  const db = getDB();
  const worksheet = db.prepare('SELECT * FROM worksheets WHERE id = ?').get(req.params.id);
  if (!worksheet) return res.status(404).json({ error: 'Worksheet not found' });

  if (req.user.role === 'teacher' && worksheet.created_by !== req.user.userId) {
    return res.status(403).json({ error: 'Not your worksheet' });
  }

  const source = req.body.source || 'teacher';
  db.prepare(`
    UPDATE worksheets SET in_library = 1, library_source = ?, is_published = 1, updated_at = datetime('now')
    WHERE id = ?
  `).run(source, req.params.id);

  res.json({ success: true });
});

// ─── Remove worksheet from library ────────────────────────────────────────────
// POST /api/library/worksheets/:id/unpublish
router.post('/worksheets/:id/unpublish', requireAuth, requireRole('teacher', 'admin'), (req, res) => {
  const db = getDB();
  const worksheet = db.prepare('SELECT * FROM worksheets WHERE id = ?').get(req.params.id);
  if (!worksheet) return res.status(404).json({ error: 'Worksheet not found' });

  if (req.user.role === 'teacher' && worksheet.created_by !== req.user.userId) {
    return res.status(403).json({ error: 'Not your worksheet' });
  }

  db.prepare(`
    UPDATE worksheets SET in_library = 0, updated_at = datetime('now')
    WHERE id = ?
  `).run(req.params.id);

  res.json({ success: true });
});

// ─── Clone worksheet from library to own worksheets ───────────────────────────
// POST /api/library/worksheets/:id/clone
router.post('/worksheets/:id/clone', requireAuth, requireRole('teacher', 'admin'), (req, res) => {
  const db = getDB();
  const source = db.prepare('SELECT * FROM worksheets WHERE id = ? AND in_library = 1').get(req.params.id);
  if (!source) return res.status(404).json({ error: 'Library worksheet not found' });

  const newId = uuidv4();
  db.prepare(`
    INSERT INTO worksheets (id, title, description, subject, grade_level, created_by, content, total_points, tags, rubric_json, in_library, library_source)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'cloned')
  `).run(
    newId,
    source.title,
    source.description || '',
    source.subject || '',
    source.grade_level || '',
    req.user.userId,
    source.content,
    source.total_points,
    source.tags || '',
    source.rubric_json || '{}'
  );

  const cloned = db.prepare('SELECT * FROM worksheets WHERE id = ?').get(newId);
  res.status(201).json(serializeWorksheetRow(cloned));
});

// ─── Get ratings for a worksheet or course ────────────────────────────────────
// GET /api/library/ratings/:type/:id
router.get('/ratings/:type/:id', requireAuth, (req, res) => {
  const { type, id } = req.params;
  if (!['worksheet', 'course'].includes(type)) {
    return res.status(400).json({ error: 'Invalid item type' });
  }
  const db = getDB();
  const aggregates = getRatingAggregates(db, type, id);

  // Also return the caller's own rating if any
  const own = db.prepare(
    'SELECT rating FROM ratings WHERE user_id = ? AND item_type = ? AND item_id = ?'
  ).get(req.user.userId, type, id);

  res.json({ ...aggregates, my_rating: own ? own.rating : null });
});

// ─── Submit or update a rating ────────────────────────────────────────────────
// POST /api/library/ratings/:type/:id   body: { rating: 1-5 }
router.post('/ratings/:type/:id', requireAuth, (req, res) => {
  const { type, id } = req.params;
  if (!['worksheet', 'course'].includes(type)) {
    return res.status(400).json({ error: 'Invalid item type' });
  }
  const rating = parseInt(req.body.rating, 10);
  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({ error: 'Rating must be between 1 and 5' });
  }

  const db = getDB();
  const raterRole = req.user.role === 'teacher' || req.user.role === 'admin' ? 'teacher' : 'student';
  const ratingId = uuidv4();

  db.prepare(`
    INSERT INTO ratings (id, user_id, item_type, item_id, rating, rater_role)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id, item_type, item_id)
    DO UPDATE SET rating = excluded.rating, rater_role = excluded.rater_role, updated_at = datetime('now')
  `).run(ratingId, req.user.userId, type, id, rating, raterRole);

  const aggregates = getRatingAggregates(db, type, id);
  res.json({ ...aggregates, my_rating: rating });
});

module.exports = router;
