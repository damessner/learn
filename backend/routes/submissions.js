const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db/init');
const { requireAuth, requireRole } = require('./auth');

const router = express.Router();
const MIN_SHORT_ANSWER_LENGTH = 20;
const CLARITY_LENGTH_TARGET = 30;

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function ensureGuestAssignmentAccess(req, res) {
  if (req.user.isGuest && String(req.user.assignmentId) !== String(req.params.assignmentId)) {
    res.status(403).json({ error: 'Guest token is restricted to one assignment' });
    return false;
  }
  return true;
}

/**
 * Returns a 403 response and false if a student is not enrolled in the assignment's class.
 * Only enforces enrollment when the assignment has a `class_id` (class-restricted assignments).
 * Returns true unconditionally for non-student users, guest users, or open (classless) assignments.
 */
function ensureClassEnrollment(req, res, db, assignment) {
  if (req.user.role === 'student' && !req.user.isGuest && assignment.class_id) {
    const enrolled = db.prepare(
      'SELECT 1 FROM class_students WHERE class_id = ? AND student_id = ?'
    ).get(assignment.class_id, req.user.userId);
    if (!enrolled) {
      res.status(403).json({ error: 'You are not enrolled in this class' });
      return false;
    }
  }
  return true;
}

// ─── Get my submission for an assignment ──────────────────────────────────────
router.get('/assignment/:assignmentId', requireAuth, (req, res) => {
  if (!ensureGuestAssignmentAccess(req, res)) return;
  const db = getDB();
  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.assignmentId);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
  if (!ensureClassEnrollment(req, res, db, assignment)) return;
  const submission = db.prepare(`
    SELECT * FROM submissions
    WHERE assignment_id = ? AND user_id = ?
  `).get(req.params.assignmentId, req.user.userId);

  if (!submission) return res.json(null);
  const attempts = db.prepare(`
    SELECT attempt_no, score, max_score, submitted_at
    FROM submission_attempts
    WHERE assignment_id = ? AND user_id = ?
    ORDER BY attempt_no DESC
  `).all(req.params.assignmentId, req.user.userId);
  res.json({ ...submission, answers: parseJson(submission.answers, {}), attempts });
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

  // Verify student is enrolled in the assignment's class (if class-restricted)
  if (!ensureClassEnrollment(req, res, db, assignment)) return;

  // Upsert submission (save progress, not submitted yet)
  const existing = db.prepare('SELECT id FROM submissions WHERE assignment_id = ? AND user_id = ?')
    .get(assignmentId, userId);

  if (existing) {
    db.prepare(`
      UPDATE submissions SET answers = ? WHERE assignment_id = ? AND user_id = ?
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

  // Verify student is enrolled in the assignment's class (if class-restricted)
  if (!ensureClassEnrollment(req, res, db, assignment)) return;

  const retryPolicy = assignment.retry_policy || 'single';
  const maxAttempts = Math.max(1, Number(assignment.max_attempts) || 1);
  const content = parseJson(assignment.content, null);
  if (!content || !Array.isArray(content.blocks)) {
    return res.status(500).json({ error: 'Stored worksheet content is invalid' });
  }
  const { score, maxScore, feedback } = scoreAnswers(content.blocks, answers);

  try {
    const result = db.transaction(() => {
      const existing = db.prepare(
        'SELECT * FROM submissions WHERE assignment_id = ? AND user_id = ?'
      ).get(assignmentId, userId);
      const attemptsSoFar = db.prepare(`
        SELECT COUNT(*) as cnt
        FROM submission_attempts
        WHERE assignment_id = ? AND user_id = ?
      `).get(assignmentId, userId).cnt || 0;

      if (retryPolicy === 'single' && attemptsSoFar >= 1) {
        const error = new Error('This assignment allows only one submission attempt.');
        error.statusCode = 409;
        throw error;
      }
      if (retryPolicy === 'capped' && attemptsSoFar >= maxAttempts) {
        const error = new Error(`Maximum attempts reached (${maxAttempts}).`);
        error.statusCode = 409;
        throw error;
      }

      const attemptNo = attemptsSoFar + 1;
      const submissionId = existing ? existing.id : uuidv4();
      const attemptId = uuidv4();

      db.prepare(`
        INSERT INTO submission_attempts (id, assignment_id, user_id, attempt_no, answers, score, max_score, submitted_at, feedback_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), ?)
      `).run(attemptId, assignmentId, userId, attemptNo, JSON.stringify(answers), score, maxScore, JSON.stringify(feedback || {}));

      let finalScore = score;
      let finalMaxScore = maxScore;
      let finalAnswers = answers;
      if (existing) {
        if (retryPolicy === 'best') {
          const existingPct = existing.max_score > 0 ? existing.score / existing.max_score : 0;
          const newPct = maxScore > 0 ? score / maxScore : 0;
          if (existingPct >= newPct) {
            finalScore = existing.score || 0;
            finalMaxScore = existing.max_score;
            finalAnswers = parseJson(existing.answers, {});
          }
        }
        db.prepare(`
          UPDATE submissions SET
            answers = ?, score = ?, max_score = ?, submitted_at = datetime('now')
          WHERE id = ?
        `).run(JSON.stringify(finalAnswers), finalScore, finalMaxScore, submissionId);
      } else {
        db.prepare(`
          INSERT INTO submissions (id, assignment_id, user_id, answers, score, max_score, submitted_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(submissionId, assignmentId, userId, JSON.stringify(finalAnswers), finalScore, finalMaxScore);
      }

      return {
        score: finalScore,
        maxScore: finalMaxScore,
        percentage: finalMaxScore > 0 ? Math.round((finalScore / finalMaxScore) * 100) : 0,
        feedback,
        attemptNo,
        retryPolicy,
        attemptsRemaining: retryPolicy === 'single' ? 0 : retryPolicy === 'capped' ? Math.max(0, maxAttempts - attemptNo) : null
      };
    })();

    res.json(result);
  } catch (err) {
    res.status(err.statusCode || 500).json({ error: err.message || 'Submission failed' });
  }
});

// ─── Scoring engine ───────────────────────────────────────────────────────────
function scoreAnswers(blocks, answers) {
  const answerMap = answers && typeof answers === 'object' ? answers : {};
  let score = 0;
  let maxScore = 0;
  const feedback = {};

  for (const block of blocks) {
    const blockPoints = block.points || 0;
    const studentAnswer = answerMap[block.id];

    if (!blockPoints || !block.id) continue;
    maxScore += blockPoints;

    if (!studentAnswer) continue;

    switch (block.type) {
      case 'gap_fill': {
        // Extract correct answers from template ((answer)) markers
        const correctAnswers = [];
        const regex = /\(\(([^)]+)\)\)/g;
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

      
      case 'flashcards':
      case 'memory_match': {
        const isCompleted = !!(studentAnswer && studentAnswer.completed);
        const earned = isCompleted ? blockPoints : 0;
        score += earned;
        feedback[block.id] = { correct: isCompleted, score: earned, maxScore: blockPoints };
        break;
      }

      case 'flow_challenge': {
        // flow challenge score is purely performance based
        let flowScore = 0;
        if (studentAnswer && typeof studentAnswer.score === 'number') {
           flowScore = studentAnswer.score;
        }
        const earned = Math.min(blockPoints, flowScore);
        score += earned;
        feedback[block.id] = { correct: earned > 0, score: earned, maxScore: blockPoints, details: studentAnswer };
        break;
      }

      case 'word_scramble': {
        const words = block.words || [];
        let scrambleScore = 0;
        words.forEach((item, idx) => {
          const correct = item.word.toLowerCase().trim();
          const student = (studentAnswer && studentAnswer[idx] || '').toLowerCase().trim();
          if (student === correct) scrambleScore++;
        });
        const earned = Math.round((scrambleScore / Math.max(words.length, 1)) * blockPoints);
        score += earned;
        feedback[block.id] = { correct: scrambleScore === words.length, score: earned, maxScore: blockPoints };
        break;
      }

      case 'semantic_sorter': {
        const categories = block.categories || [];
        let sortScore = 0;
        let totalWords = 0;
        
        categories.forEach(cat => {
          totalWords += cat.words.length;
          const studentCatList = (studentAnswer && studentAnswer[cat.name]) || [];
          cat.words.forEach(word => {
            if (studentCatList.some(sw => sw.toLowerCase().trim() === word.toLowerCase().trim())) {
              sortScore++;
            }
          });
        });
        
        const earned = Math.round((sortScore / Math.max(totalWords, 1)) * blockPoints);
        score += earned;
        feedback[block.id] = { correct: sortScore === totalWords, score: earned, maxScore: blockPoints };
        break;
      }

      case 'contextual_dialogue': {
        const messages = block.messages || [];
        let dialogueScore = 0;
        let gapCount = 0;
        
        messages.forEach((msg, idx) => {
          if (msg.isGap) {
            gapCount++;
            const correct = (msg.answer || '').toLowerCase().trim();
            const student = (studentAnswer && studentAnswer[idx] || '').toLowerCase().trim();
            if (student === correct || isAcceptableVariant(student, correct)) dialogueScore++;
          }
        });
        
        const earned = Math.round((dialogueScore / Math.max(gapCount, 1)) * blockPoints);
        score += earned;
        feedback[block.id] = { correct: dialogueScore === gapCount, score: earned, maxScore: blockPoints };
        break;
      }

      case 'vocabulary': {
        // studentAnswer: { completed: boolean, answersMap: { pairIndex: string } }
        const pairs = block.pairs || [];
        const studentAnswers = (studentAnswer && studentAnswer.answersMap) ? studentAnswer.answersMap : {};
        const isCompleted = !!(studentAnswer && studentAnswer.completed);

        let vocabScore = 0;
        pairs.forEach((pair, pIdx) => {
          const isL2R = block.direction === 'l2r' || (block.direction === 'mixed' && pIdx % 2 === 0);
          const correctAnswer = isL2R ? pair.r : pair.l;
          const student = (studentAnswers[pIdx] || '').trim();
          if (student.toLowerCase() === correctAnswer.toLowerCase() || isAcceptableVariant(student.toLowerCase(), correctAnswer.toLowerCase())) {
            vocabScore++;
          }
        });

        const earned = isCompleted ? blockPoints : Math.round((vocabScore / Math.max(pairs.length, 1)) * blockPoints);
        score += earned;
        feedback[block.id] = {
          correct: isCompleted || vocabScore === pairs.length,
          score: earned,
          maxScore: blockPoints,
          correctAnswers: pairs.map((pair, pIdx) => {
            const isL2R = block.direction === 'l2r' || (block.direction === 'mixed' && pIdx % 2 === 0);
            return isL2R ? pair.r : pair.l;
          })
        };
        break;
      }

      case 'short_answer': {
        const sampleAnswer = (block.sample_answer || '').toLowerCase().trim();
        const studentText = String(studentAnswer || '').trim();
        const studentLower = studentText.toLowerCase();
        const keywords = buildShortAnswerKeywords(block, sampleAnswer);
        const keywordHits = keywords.filter(k => studentLower.includes(k)).length;
        const coverage = keywords.length > 0 ? keywordHits / keywords.length : (studentText.length >= MIN_SHORT_ANSWER_LENGTH ? 1 : 0);
        const earned = Math.round(Math.max(0, Math.min(1, coverage)) * blockPoints);
        score += earned;

        const aiFeedback = {
          automatedPunctuationSignal: /[.!?]$/.test(studentText) ? 'Ends with punctuation.' : 'Add punctuation at the end of your response.',
          automatedLengthSignal: studentText.length >= CLARITY_LENGTH_TARGET ? 'Response length is detailed enough.' : 'Expand your response with more detail.',
          keyPointsCoverage: keywords.length === 0 ? 'No keyword target configured.' : `${keywordHits}/${keywords.length} expected key points covered.`
        };

        feedback[block.id] = {
          correct: coverage >= 0.8,
          score: earned,
          maxScore: blockPoints,
          aiFeedback,
          keywords
        };
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

function checkSTEMMatch(student, correct) {
  const sStr = student.toLowerCase().trim().replace(',', '.');
  const cStr = correct.toLowerCase().trim().replace(',', '.');
  
  if (sStr === cStr) return true;

  // Regex to match standard/scientific numbers (+-12.3e-4) and optional units (m/s^2, kg, etc.)
  const regex = /^([+-]?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\s*([a-z0-9\/\s\-*^]+)?$/;
  
  const sMatch = sStr.match(regex);
  const cMatch = cStr.match(regex);
  
  if (sMatch && cMatch) {
    const sVal = parseFloat(sMatch[1]);
    const cVal = parseFloat(cMatch[1]);
    
    const sUnit = (sMatch[2] || '').replace(/\s+/g, '');
    const cUnit = (cMatch[2] || '').replace(/\s+/g, '');
    
    if (sUnit === cUnit) {
      if (cVal === 0) return sVal === 0;
      const diff = Math.abs(sVal - cVal);
      const tolerance = Math.abs(cVal) * 0.02; // 2% tolerance
      if (diff <= tolerance) {
        return true;
      }
    }
  }
  return false;
}

function isAcceptableVariant(student, correct) {
  // Try STEM numerical and unit matching first
  if (checkSTEMMatch(student, correct)) return true;

  // Allow minor typos: check if 80%+ character overlap (simple)
  if (Math.abs(student.length - correct.length) > 2) return false;
  let matches = 0;
  for (let i = 0; i < Math.min(student.length, correct.length); i++) {
    if (student[i] === correct[i]) matches++;
  }
  return matches / correct.length >= 0.85;
}

function buildShortAnswerKeywords(block, sampleAnswer = '') {
  if (Array.isArray(block.keywords) && block.keywords.length > 0) {
    return block.keywords.map(k => String(k).toLowerCase()).filter(Boolean);
  }
  return sampleAnswer.split(/\W+/).filter(w => w.length > 4).slice(0, 5);
}

// ─── Teacher Feedback on Submission ──────────────────────────────────────────
router.post('/:id/feedback', requireAuth, requireRole('teacher', 'admin'), (req, res) => {
  const { feedback_text } = req.body;
  if (feedback_text === undefined) return res.status(400).json({ error: 'feedback_text is required' });
  const db = getDB();
  const submission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(req.params.id);
  if (!submission) return res.status(404).json({ error: 'Submission not found' });
  if (req.user.role !== 'admin') {
    const canGrade = db.prepare(`
      SELECT 1
      FROM assignments a
      JOIN worksheets w ON w.id = a.worksheet_id
      LEFT JOIN classes c ON c.id = a.class_id
      WHERE a.id = ?
        AND (a.created_by = ? OR w.created_by = ? OR c.created_by = ?)
      LIMIT 1
    `).get(submission.assignment_id, req.user.userId, req.user.userId, req.user.userId);
    if (!canGrade) return res.status(403).json({ error: 'Access denied' });
  }
  db.prepare('UPDATE submissions SET feedback_text = ? WHERE id = ?').run(feedback_text, req.params.id);
  res.json({ success: true });
});

// ─── Student Summary Stats ─────────────────────────────────────────────────────
router.get('/student/summary', requireAuth, (req, res) => {
  const db = getDB();
  const stats = db.prepare(`
    SELECT
      COUNT(*) as total_submitted,
      ROUND(AVG(CASE WHEN max_score > 0 THEN CAST(score AS REAL) / max_score * 100 ELSE NULL END), 1) as avg_percentage,
      SUM(CASE WHEN max_score > 0 AND CAST(score AS REAL) / max_score >= 0.6 THEN 1 ELSE 0 END) as passed_count,
      MAX(submitted_at) as last_submitted_at
    FROM submissions
    WHERE user_id = ? AND submitted_at IS NOT NULL
  `).get(req.user.userId);

  const pending = db.prepare(`
    SELECT COUNT(*) as cnt FROM assignments a
    JOIN class_students cs ON cs.class_id = a.class_id
    WHERE cs.student_id = ?
      AND NOT EXISTS (
        SELECT 1 FROM submissions s WHERE s.assignment_id = a.id AND s.user_id = ?
      )
  `).get(req.user.userId, req.user.userId);

  res.json({
    totalSubmitted: stats.total_submitted || 0,
    avgPercentage: stats.avg_percentage || 0,
    passedCount: stats.passed_count || 0,
    pendingAssignments: pending.cnt || 0
  });
});

router._checkSTEMMatch = checkSTEMMatch;
router._isAcceptableVariant = isAcceptableVariant;
module.exports = router;
