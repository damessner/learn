const express = require('express');
const { getDB } = require('../db/init');
const { requireAuth, requireRole } = require('./auth');

const router = express.Router();

const MS_TENANT_ID = process.env.MS_TENANT_ID;
const MS_CLIENT_ID = process.env.MS_CLIENT_ID;
const MS_CLIENT_SECRET = process.env.MS_CLIENT_SECRET;
const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';
const GRAPH_TIMEOUT_MS = parseInt(process.env.GRAPH_TIMEOUT_MS || '12000', 10);
const GRAPH_MAX_RETRIES = parseInt(process.env.GRAPH_MAX_RETRIES || '2', 10);
const GRAPH_MAX_BACKOFF_MS = parseInt(process.env.GRAPH_MAX_BACKOFF_MS || '5000', 10);

async function fetchWithTimeout(url, options = {}, timeoutMs = GRAPH_TIMEOUT_MS) {
  // Using native global fetch
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function waitForRetryDelay(attempt) {
  const delayMs = Math.min(Math.pow(2, attempt) * 1000, GRAPH_MAX_BACKOFF_MS);
  await new Promise(resolve => setTimeout(resolve, delayMs));
}

// Get an app-level access token for Graph API
async function getAppToken() {
  if (!MS_TENANT_ID || !MS_CLIENT_ID || !MS_CLIENT_SECRET) {
    throw new Error('Microsoft Graph API not configured. Set MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET in .env');
  }
  const params = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: MS_CLIENT_ID,
    client_secret: MS_CLIENT_SECRET,
    scope: 'https://graph.microsoft.com/.default'
  });
  const resp = await fetchWithTimeout(`https://login.microsoftonline.com/${MS_TENANT_ID}/oauth2/v2.0/token`, {
    method: 'POST',
    body: params
  });
  const data = await resp.json();
  if (!data.access_token) throw new Error('Failed to get app token: ' + JSON.stringify(data));
  return data.access_token;
}

async function graphRequest(token, method, path, body) {
  let lastErr;
  for (let attempt = 0; attempt <= GRAPH_MAX_RETRIES; attempt++) {
    try {
      const resp = await fetchWithTimeout(`${GRAPH_BASE}${path}`, {
        method,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : undefined
      });
      if (!resp.ok) {
        const errText = await resp.text();
        const retryable = resp.status === 429 || resp.status >= 500;
        if (retryable && attempt < GRAPH_MAX_RETRIES) {
          await waitForRetryDelay(attempt);
          continue;
        }
        throw new Error(`Graph API ${method} ${path} failed: ${resp.status} ${errText}`);
      }
      return resp.status === 204 ? null : resp.json();
    } catch (err) {
      lastErr = err;
      if (attempt < GRAPH_MAX_RETRIES) {
        await waitForRetryDelay(attempt);
      }
      if (attempt >= GRAPH_MAX_RETRIES) break;
    }
  }
  throw lastErr;
}

// ─── Check if Teams integration is configured ─────────────────────────────────
router.get('/status', (req, res) => {
  const configured = !!(MS_TENANT_ID && MS_CLIENT_ID && MS_CLIENT_SECRET);
  res.json({
    configured,
    message: configured
      ? 'Microsoft Graph API is configured'
      : 'Configure MS_TENANT_ID, MS_CLIENT_ID, MS_CLIENT_SECRET in .env to enable Teams sync'
  });
});

// ─── List education classes (for assignment creation) ─────────────────────────
router.get('/classes', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const token = await getAppToken();
    const data = await graphRequest(token, 'GET', '/education/classes?$top=50');
    res.json(data.value || []);
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// ─── Create Teams assignment for a worksheet assignment ───────────────────────
router.post('/assignment/:assignmentId/create-teams', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  const db = getDB();
  const assignment = db.prepare(`
    SELECT a.*, w.title, w.description, w.total_points FROM assignments a
    JOIN worksheets w ON w.id = a.worksheet_id
    WHERE a.id = ?
  `).get(req.params.assignmentId);

  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
  if (!assignment.class_id) return res.status(400).json({ error: 'Assignment has no Teams class_id' });
  if (assignment.teams_assignment_id) return res.status(409).json({ error: 'Teams assignment already created' });

  try {
    const token = await getAppToken();
    const baseUrl = process.env.BASE_URL || 'http://localhost:3001';
    const teamsAssignment = await graphRequest(token, 'POST', `/education/classes/${assignment.class_id}/assignments`, {
      displayName: assignment.title,
      instructions: {
        content: assignment.description || 'Complete the worksheet below.',
        contentType: 'text'
      },
      dueDateTime: assignment.due_date ? new Date(assignment.due_date).toISOString() : null,
      grading: {
        '@odata.type': '#microsoft.graph.educationAssignmentPointsGradeType',
        maxPoints: assignment.total_points || 100
      },
      resources: [{
        distributeForStudentWork: false,
        resource: {
          '@odata.type': '#microsoft.graph.educationLinkResource',
          displayName: `Open in LearnFlow: ${assignment.title}`,
          link: `${baseUrl}/student/assignment/${assignment.id}`
        }
      }]
    });

    // Publish the assignment
    await graphRequest(token, 'POST', `/education/classes/${assignment.class_id}/assignments/${teamsAssignment.id}/publish`);

    // Store Teams assignment ID
    db.prepare('UPDATE assignments SET teams_assignment_id = ? WHERE id = ?')
      .run(teamsAssignment.id, req.params.assignmentId);

    res.json({ success: true, teamsAssignmentId: teamsAssignment.id });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

// ─── Push grades to Teams ─────────────────────────────────────────────────────
router.post('/assignment/:assignmentId/push-grades', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  const db = getDB();
  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.assignmentId);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });
  if (!assignment.teams_assignment_id) return res.status(400).json({ error: 'No Teams assignment linked yet' });
  if (!assignment.class_id) return res.status(400).json({ error: 'No Teams class linked' });

  const submissions = db.prepare(`
    SELECT s.*, u.ms_id FROM submissions s
    JOIN users u ON u.id = s.user_id
    WHERE s.assignment_id = ? AND s.submitted_at IS NOT NULL AND s.grade_synced = 0
  `).all(req.params.assignmentId);

  const results = [];
  try {
    const token = await getAppToken();
    const { class_id, teams_assignment_id } = assignment;

    // Get all submissions from Teams side
    const teamsSubmissions = await graphRequest(token, 'GET',
      `/education/classes/${class_id}/assignments/${teams_assignment_id}/submissions`);
    const submissionMap = {};
    for (const ts of (teamsSubmissions.value || [])) {
      if (ts.submittedBy?.user?.id) submissionMap[ts.submittedBy.user.id] = ts;
    }

    for (const sub of submissions) {
      if (!sub.ms_id || !submissionMap[sub.ms_id]) {
        results.push({ userId: sub.user_id, status: 'no_teams_submission' });
        continue;
      }

      const ts = submissionMap[sub.ms_id];
      try {
        // Get outcomes for this submission
        const outcomes = await graphRequest(token, 'GET',
          `/education/classes/${class_id}/assignments/${teams_assignment_id}/submissions/${ts.id}/outcomes`);
        const pointsOutcome = (outcomes.value || []).find(o => o['@odata.type'] === '#microsoft.graph.educationPointsOutcome');

        if (pointsOutcome) {
          await graphRequest(token, 'PATCH',
            `/education/classes/${class_id}/assignments/${teams_assignment_id}/submissions/${ts.id}/outcomes/${pointsOutcome.id}`,
            {
              '@odata.type': '#microsoft.graph.educationPointsOutcome',
              points: { '@odata.type': '#microsoft.graph.educationAssignmentPointsGrade', points: sub.score }
            });
          db.prepare('UPDATE submissions SET grade_synced = 1 WHERE id = ?').run(sub.id);
          results.push({ userId: sub.user_id, status: 'synced', score: sub.score });
        }
      } catch (err) {
        results.push({ userId: sub.user_id, status: 'error', error: err.message });
      }
    }

    res.json({ results, synced: results.filter(r => r.status === 'synced').length });
  } catch (err) {
    res.status(503).json({ error: err.message });
  }
});

module.exports = router;
