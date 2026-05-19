const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/init');
const { requireAuth } = require('./auth');

const router = express.Router();

function ensureGuestAssignmentAccess(req, res) {
  if (req.user.isGuest && String(req.user.assignmentId) !== String(req.params.assignmentId)) {
    res.status(403).json({ error: 'Guest token is restricted to one assignment' });
    return false;
  }
  return true;
}

// ─── Get my submission for an assignment ──────────────────────────────────────
router.get('/assignment/:assignmentId', requireAuth, (req, res) => {
  if (!ensureGuestAssignmentAccess(req, res)) return;
  const db = getDB();
  const submission = db.prepare(`
    SELECT * FROM submissions
    WHERE assignment_id = ? AND user_id = ?
  `).get(req.params.assignmentId, req.user.userId);

  if (!submission) return res.json(null);
  res.json({ ...submission, answers: JSON.parse(submission.answers) });
});

// ─── Save progress (auto-save, not final) ─────────────────────────────────────
router.post('/assignment/:assignmentId/save', requireAuth, (req, res) => {
  if (!ensureGuestAssignmentAccess(req, res)) return;
  const db = getDB();
  const { answers } = req.body;
  const { assignmentId } = req.params;
  const userId = req.user.userId;

  // Check assignment exists
  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

  // Upsert submission (save progress, not submitted yet)
  const existing = db.prepare('SELECT id FROM submissions WHERE assignment_id = ? AND user_id = ?')
    .get(assignmentId, userId);

  if (existing) {
    db.prepare(`
      UPDATE submissions SET answers = ? WHERE assignment_id = ? AND user_id = ? AND submitted_at IS NULL
    `).run(JSON.stringify(answers), assignmentId, userId);
  } else {
    db.prepare(`
      INSERT INTO submissions (id, assignment_id, user_id, answers)
      VALUES (?, ?, ?, ?)
    `).run(uuidv4(), assignmentId, userId, JSON.stringify(answers));
  }

  res.json({ saved: true });
});

// ─── Final submit ──────────────────────────────────────────────────────────────
router.post('/assignment/:assignmentId/submit', requireAuth, (req, res) => {
  if (!ensureGuestAssignmentAccess(req, res)) return;
  const db = getDB();
  const { answers } = req.body;
  const { assignmentId } = req.params;
  const userId = req.user.userId;

  // Check assignment and worksheet
  const assignment = db.prepare(`
    SELECT a.*, w.content, w.total_points FROM assignments a
    JOIN worksheets w ON w.id = a.worksheet_id
    WHERE a.id = ?
  `).get(assignmentId);

  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

  // Check not already submitted
  const existing = db.prepare(
    'SELECT * FROM submissions WHERE assignment_id = ? AND user_id = ?'
  ).get(assignmentId, userId);

  if (existing && existing.submitted_at) {
    return res.status(409).json({ error: 'Already submitted', submission: { ...existing, answers: JSON.parse(existing.answers) } });
  }

  // Score the submission
  const content = JSON.parse(assignment.content);
  const { score, maxScore, feedback } = scoreAnswers(content.blocks, answers);

  const submissionId = existing ? existing.id : uuidv4();

  if (existing) {
    db.prepare(`
      UPDATE submissions SET
        answers = ?, score = ?, max_score = ?, submitted_at = datetime('now')
      WHERE id = ?
    `).run(JSON.stringify(answers), score, maxScore, submissionId);
  } else {
    db.prepare(`
      INSERT INTO submissions (id, assignment_id, user_id, answers, score, max_score, submitted_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    `).run(submissionId, assignmentId, userId, JSON.stringify(answers), score, maxScore);
  }

  res.json({ score, maxScore, percentage: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0, feedback });
});

// ─── Scoring engine ───────────────────────────────────────────────────────────
function scoreAnswers(blocks, answers) {
  let score = 0;
  let maxScore = 0;
  const feedback = {};

  for (const block of blocks) {
    const blockPoints = block.points || 0;
    const studentAnswer = answers[block.id];

    if (!blockPoints || !block.id) continue;
    maxScore += blockPoints;

    if (!studentAnswer) continue;

    switch (block.type) {
      case 'gap_fill': {
        // Extract correct answers from template {answer} markers
        const correctAnswers = [];
        const regex = /\{([^}]+)\}/g;
        let match;
        while ((match = regex.exec(block.template)) !== null) {
          correctAnswers.push(match[1].toLowerCase().trim());
        }
        const studentAnswers = Array.isArray(studentAnswer) ? studentAnswer : [studentAnswer];
        let gapScore = 0;
        correctAnswers.forEach((correct, i) => {
          const student = (studentAnswers[i] || '').toLowerCase().trim();
          if (student === correct || isAcceptableVariant(student, correct)) gapScore++;
        });
        const earned = Math.round((gapScore / Math.max(correctAnswers.length, 1)) * blockPoints);
        score += earned;
        feedback[block.id] = {
          correct: gapScore === correctAnswers.length,
          score: earned,
          maxScore: blockPoints,
          correctAnswers
        };
        break;
      }

      case 'multiple_choice': {
        const correct = new Set(block.correct || []);
        const student = new Set(Array.isArray(studentAnswer) ? studentAnswer : [studentAnswer]);
        const isCorrect = setsEqual(correct, student);
        if (isCorrect) score += blockPoints;
        feedback[block.id] = { correct: isCorrect, score: isCorrect ? blockPoints : 0, maxScore: blockPoints, correctAnswers: block.correct };
        break;
      }

      case 'single_choice': {
        const isCorrect = studentAnswer === block.correct;
        if (isCorrect) score += blockPoints;
        feedback[block.id] = { correct: isCorrect, score: isCorrect ? blockPoints : 0, maxScore: blockPoints, correctAnswer: block.correct };
        break;
      }

      case 'drag_drop': {
        // studentAnswer: { targetIndex: draggedItem }
        const correct = block.answers || {}; // { "0": "have", "1": "has" }
        let dragScore = 0;
        const totalTargets = Object.keys(correct).length;
        for (const [targetIdx, correctItem] of Object.entries(correct)) {
          if ((studentAnswer[targetIdx] || '').toLowerCase() === correctItem.toLowerCase()) dragScore++;
        }
        const earned = Math.round((dragScore / Math.max(totalTargets, 1)) * blockPoints);
        score += earned;
        feedback[block.id] = { correct: dragScore === totalTargets, score: earned, maxScore: blockPoints };
        break;
      }

      case 'matching': {
        // studentAnswer: { leftIndex: rightIndex }
        const correctPairs = block.pairs || [];
        let matchScore = 0;
        for (let i = 0; i < correctPairs.length; i++) {
          const [left, right] = correctPairs[i];
          if (studentAnswer[String(i)] === right) matchScore++;
        }
        const earned = Math.round((matchScore / Math.max(correctPairs.length, 1)) * blockPoints);
        score += earned;
        feedback[block.id] = { correct: matchScore === correctPairs.length, score: earned, maxScore: blockPoints };
        break;
      }
    }
  }

  return { score, maxScore, feedback };
}

function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const item of a) if (!b.has(item)) return false;
  return true;
}

function isAcceptableVariant(student, correct) {
  // Allow minor typos: check if 80%+ character overlap (simple)
  if (Math.abs(student.length - correct.length) > 2) return false;
  let matches = 0;
  for (let i = 0; i < Math.min(student.length, correct.length); i++) {
    if (student[i] === correct[i]) matches++;
  }
  return matches / correct.length >= 0.85;
}

module.exports = router;
