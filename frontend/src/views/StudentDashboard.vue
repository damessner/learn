<template>
  <div class="student-dashboard">
    <header class="dashboard-header">
      <div>
        <h1>Welcome back, <span>{{ user?.name }}</span></h1>
        <p class="subtitle">Here are your active school assignments.</p>
      </div>
      <button v-if="!user?.isGuest" @click="showJoinModal = true" class="btn btn-secondary">+ Join Class</button>
    </header>

    <!-- Summary Stats Card -->
    <div v-if="summary && !user?.isGuest" class="summary-card card glass animate-fade-in">
      <div class="summary-item">
        <span class="summary-num">{{ summary.totalSubmitted }}</span>
        <span class="summary-label">Submitted</span>
      </div>
      <div class="summary-divider"></div>
      <div class="summary-item">
        <span class="summary-num">{{ summary.avgPercentage }}%</span>
        <span class="summary-label">Avg Score</span>
      </div>
      <div class="summary-divider"></div>
      <div class="summary-item">
        <span class="summary-num">{{ summary.passedCount }}</span>
        <span class="summary-label">Passed</span>
      </div>
      <div class="summary-divider"></div>
      <div class="summary-item">
        <span class="summary-num">{{ summary.pendingAssignments }}</span>
        <span class="summary-label">Pending</span>
      </div>
    </div>

    <!-- Announcements from teacher -->
    <div v-if="announcements.length > 0" class="announcements-section">
      <div v-for="ann in announcements" :key="ann.id" class="announcement-banner card glass animate-fade-in">
        <span class="ann-icon">📢</span>
        <div class="ann-body">
          <strong>{{ ann.class_name }}:</strong> {{ ann.message }}
          <span class="ann-date">{{ formatDate(ann.created_at) }}</span>
        </div>
      </div>
    </div>

    <!-- Unassigned / Unenrolled Banner -->
    <div v-if="!loading && !isEnrolled" class="unassigned-banner card glass animate-fade-in">
      <div class="banner-icon">🔔</div>
      <div class="banner-body">
        <h3>Class Enrollment Pending</h3>
        <p>You haven't been assigned to any school classes yet. Ask your teacher for a class code or use the "Join Class" button above.</p>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading assignments...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <span>⚠️</span>
      <p>{{ error }}</p>
      <button @click="fetchAssignments" class="btn btn-secondary">Try Again</button>
    </div>

    <div v-else-if="assignments.length === 0 && courses.length === 0" class="empty-state card glass">
      <span class="empty-emoji">🎉</span>
      <h2>All caught up!</h2>
      <p>You have no pending worksheets or courses assigned to you at the moment.</p>
    </div>

    <div v-else>
      <!-- Courses Section -->
      <div class="section-container" v-if="courses.length > 0">
        <h2 class="section-title">📚 Assigned Courses</h2>
        <div class="assignments-grid courses-grid">
          <div v-for="course in courses" :key="course.course_assignment_id" class="assignment-card card course-card">
            <h3 class="assignment-title">{{ course.title }}</h3>
            <p class="assignment-desc">{{ course.description || 'Complete these worksheets in order.' }}</p>
            <div class="assignment-meta">
              <div class="meta-item">
                <span class="meta-label">Worksheets</span>
                <span class="meta-value">{{ course.total_worksheets }} items</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Due Date</span>
                <span class="meta-value" :class="{ 'overdue': isOverdue(course.due_date) }">
                  {{ formatDate(course.due_date) }}
                </span>
              </div>
            </div>
            <!-- Course progress bar -->
            <div class="course-progress" v-if="course.completed_worksheets !== undefined">
              <div class="progress-bar-small">
                <div class="progress-fill-small" :style="{ width: `${(course.completed_worksheets / (course.total_worksheets || 1)) * 100}%` }"></div>
              </div>
              <span class="progress-label">{{ course.completed_worksheets }}/{{ course.total_worksheets }} done</span>
            </div>
            <div class="card-footer">
              <router-link :to="`/student/course/${course.course_assignment_id}`" class="btn btn-primary btn-play">Open Course ➔</router-link>
            </div>
          </div>
        </div>
      </div>

      <!-- Assignments Section -->
      <div class="section-container" v-if="assignments.length > 0">
        <h2 class="section-title">📝 Individual Worksheets</h2>
        <div class="assignments-grid">
          <div v-for="assignment in assignments" :key="assignment.id" class="assignment-card card">
            <div class="card-badge" :class="statusClass(assignment)">{{ statusLabel(assignment) }}</div>
            <!-- Due Soon badge -->
            <div v-if="isDueSoon(assignment) && !assignment.submitted_at" class="due-soon-badge">⏰ Due soon</div>
            <h3 class="assignment-title">{{ assignment.title }}</h3>
            <p class="assignment-desc">{{ assignment.description || 'No description provided.' }}</p>
            <div class="assignment-meta">
              <div class="meta-item">
                <span class="meta-label">Subject</span>
                <span class="meta-value">{{ assignment.subject || 'General' }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Due Date</span>
                <span class="meta-value" :class="{ 'overdue': isOverdue(assignment.due_date) && !assignment.submitted_at }">
                  {{ formatDate(assignment.due_date) }}
                </span>
              </div>
            </div>
            <div class="card-footer">
              <div v-if="assignment.submitted_at" class="score-display">
                <span class="score-label">Score</span>
                <span class="score-value">{{ assignment.score }} / {{ assignment.total_points }}</span>
                <div class="score-bar">
                  <div class="score-fill" :style="{ width: `${(assignment.score / assignment.total_points) * 100}%` }"></div>
                </div>
              </div>
              <router-link v-else :to="`/student/assignment/${assignment.assignment_id}`" class="btn btn-primary btn-play">
                {{ assignment.score !== null ? 'Continue' : 'Start Task' }} 🚀
              </router-link>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Join Class Modal -->
    <div v-if="showJoinModal" class="modal-overlay" @click.self="showJoinModal = false">
      <div class="modal-box">
        <h3>Join a Class</h3>
        <p class="modal-sub">Enter the class code provided by your teacher.</p>
        <div class="form-group">
          <input type="text" v-model="joinCode" placeholder="e.g. ABC123" style="text-transform:uppercase" maxlength="10" />
        </div>
        <p v-if="joinError" class="error-msg">{{ joinError }}</p>
        <div class="modal-actions">
          <button @click="showJoinModal = false" class="btn btn-secondary">Cancel</button>
          <button @click="joinClass" class="btn btn-primary" :disabled="joiningClass">{{ joiningClass ? 'Joining...' : 'Join Class' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useToast } from '../composables/useToast.js'

const user = ref(JSON.parse(localStorage.getItem('user')))
const assignments = ref([])
const courses = ref([])
const loading = ref(true)
const error = ref(null)
const isEnrolled = ref(true)
const studentClasses = ref([])
const summary = ref(null)
const announcements = ref([])
const showJoinModal = ref(false)
const joinCode = ref('')
const joinError = ref('')
const joiningClass = ref(false)

const { showToast } = useToast()
const API_BASE = window.location.origin.includes('localhost') ? 'http://localhost:3001/api' : '/api'

const fetchAssignments = async () => {
  loading.value = true
  error.value = null
  try {
    const token = localStorage.getItem('token')

    const [assignResp, statusResp, summaryResp, annResp] = await Promise.all([
      fetch(`${API_BASE}/worksheets`, { headers: { 'Authorization': `Bearer ${token}` } }),
      user.value && !user.value.isGuest ? fetch(`${API_BASE}/classes/student-status`, { headers: { 'Authorization': `Bearer ${token}` } }) : Promise.resolve(null),
      user.value && !user.value.isGuest ? fetch(`${API_BASE}/submissions/student/summary`, { headers: { 'Authorization': `Bearer ${token}` } }) : Promise.resolve(null),
      user.value && !user.value.isGuest ? fetch(`${API_BASE}/classes/student/announcements`, { headers: { 'Authorization': `Bearer ${token}` } }) : Promise.resolve(null)
    ])

    if (!assignResp.ok) throw new Error('Failed to load assignments')
    assignments.value = await assignResp.json()

    if (statusResp && statusResp.ok) {
      const statusData = await statusResp.json()
      isEnrolled.value = statusData.enrolled
      studentClasses.value = statusData.classes

      if (isEnrolled.value) {
        const courseResp = await fetch(`${API_BASE}/courses/student/assigned`, { headers: { 'Authorization': `Bearer ${token}` } })
        if (courseResp.ok) courses.value = await courseResp.json()
      }
    }

    if (summaryResp && summaryResp.ok) summary.value = await summaryResp.json()
    if (annResp && annResp.ok) announcements.value = await annResp.json()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const joinClass = async () => {
  joinError.value = ''
  if (!joinCode.value.trim()) { joinError.value = 'Please enter a class code'; return }
  joiningClass.value = true
  try {
    const token = localStorage.getItem('token')
    const res = await fetch(`${API_BASE}/classes/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ class_code: joinCode.value.trim() })
    })
    const data = await res.json()
    if (!res.ok) { joinError.value = data.error || 'Failed to join class'; return }
    showJoinModal.value = false
    joinCode.value = ''
    showToast(`Joined class: ${data.class.name}`, 'success')
    await fetchAssignments()
  } catch (e) {
    joinError.value = 'Network error'
  } finally {
    joiningClass.value = false
  }
}

onMounted(fetchAssignments)

const formatDate = (dateStr) => {
  if (!dateStr) return 'No due date'
  return new Date(dateStr).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

const dueInHours = (dateStr) => {
  if (!dateStr) return Infinity
  return (new Date(dateStr) - Date.now()) / 36e5
}

const isOverdue = (dateStr) => {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
}

const isDueSoon = (assignment) => {
  const h = dueInHours(assignment.due_date)
  return h >= 0 && h <= 48
}

const statusLabel = (assignment) => {
  if (assignment.submitted_at) return 'Completed'
  if (isOverdue(assignment.due_date)) return 'Overdue'
  return 'Active'
}

const statusClass = (assignment) => {
  if (assignment.submitted_at) return 'status-completed'
  if (isOverdue(assignment.due_date)) return 'status-overdue'
  return 'status-active'
}
</script>

<style scoped>
.student-dashboard {
  max-width: 1000px;
  margin: 0 auto;
}

.dashboard-header {
  margin-bottom: 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.dashboard-header h1 { font-size: 28px; font-weight: 800; }
.dashboard-header h1 span { color: var(--primary); }
.subtitle { color: var(--text-muted); }

/* Summary Card */
.summary-card {
  display: flex;
  align-items: center;
  justify-content: space-around;
  padding: 20px 32px;
  margin-bottom: 24px;
  border-radius: var(--radius-md);
}
.summary-item { display: flex; flex-direction: column; align-items: center; gap: 4px; }
.summary-num { font-size: 28px; font-weight: 800; color: var(--primary); }
.summary-label { font-size: 11px; text-transform: uppercase; font-weight: 700; color: var(--text-muted); }
.summary-divider { width: 1px; height: 48px; background: var(--border-color); }

/* Announcements */
.announcements-section { margin-bottom: 24px; display: flex; flex-direction: column; gap: 10px; }
.announcement-banner {
  display: flex; align-items: flex-start; gap: 14px; padding: 14px 20px;
  background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(99, 102, 241, 0.02));
  border: 1px solid rgba(99, 102, 241, 0.2); border-radius: 12px;
}
.ann-icon { font-size: 20px; }
.ann-body { font-size: 14px; flex: 1; }
.ann-date { display: block; font-size: 11px; color: var(--text-muted); margin-top: 2px; }

.loading-state, .error-state {
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: 80px 40px; text-align: center; gap: 16px;
}

.spinner {
  width: 40px; height: 40px;
  border: 4px solid var(--border-color);
  border-top-color: var(--primary);
  border-radius: 50%; animation: spin 1s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.empty-state {
  text-align: center; padding: 60px 40px; max-width: 480px; margin: 40px auto;
}
.empty-emoji { font-size: 48px; display: block; margin-bottom: 16px; }
.empty-state h2 { font-size: 22px; margin-bottom: 8px; }
.empty-state p { color: var(--text-muted); }

.section-container { margin-bottom: 40px; }
.section-title {
  font-size: 20px; margin-bottom: 16px;
  padding-bottom: 8px; border-bottom: 1px solid var(--border-color);
}

.assignments-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px;
}

.courses-grid .course-card {
  background: linear-gradient(to bottom right, var(--surface-light), rgba(59, 130, 246, 0.05));
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.assignment-card {
  position: relative; display: flex; flex-direction: column;
  justify-content: space-between; min-height: 250px;
}

.card-badge {
  position: absolute; top: 24px; right: 24px;
  font-size: 11px; font-weight: 700; padding: 4px 10px;
  border-radius: 20px; text-transform: uppercase; letter-spacing: 0.05em;
}
.status-completed { background-color: var(--success-light); color: var(--success); }
.status-overdue   { background-color: var(--danger-light); color: var(--danger); }
.status-active    { background-color: var(--primary-light); color: var(--primary); }

.due-soon-badge {
  display: inline-block; margin-bottom: 6px;
  font-size: 11px; font-weight: 700; padding: 2px 8px;
  background: var(--warning-light); color: var(--warning);
  border-radius: 20px;
}

.assignment-title {
  font-size: 18px; font-weight: 700; margin-top: 12px;
  margin-bottom: 8px; padding-right: 80px;
}

.assignment-desc {
  color: var(--text-muted); font-size: 14px;
  display: -webkit-box; -webkit-line-clamp: 2;
  -webkit-box-orient: vertical; overflow: hidden; margin-bottom: 16px;
}

.assignment-meta {
  border-top: 1px solid var(--border-color); padding-top: 16px;
  display: flex; justify-content: space-between; margin-bottom: 20px;
}

.meta-item { display: flex; flex-direction: column; gap: 2px; }
.meta-label { font-size: 10px; text-transform: uppercase; color: var(--text-muted); font-weight: 700; }
.meta-value { font-size: 13px; font-weight: 600; }
.overdue { color: var(--danger); }

.card-footer { display: flex; align-items: center; justify-content: space-between; width: 100%; }
.btn-play { width: 100%; justify-content: center; }

.score-display { width: 100%; }
.score-label { font-size: 10px; text-transform: uppercase; color: var(--text-muted); font-weight: 700; display: block; }
.score-value { font-size: 18px; font-weight: 800; color: var(--primary); }
.score-bar { height: 6px; background-color: var(--border-color); border-radius: 3px; overflow: hidden; margin-top: 4px; }
.score-fill { height: 100%; background-color: var(--primary); border-radius: 3px; }

/* Course progress bar */
.course-progress { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.progress-bar-small { flex: 1; height: 6px; background: var(--border-color); border-radius: 3px; overflow: hidden; }
.progress-fill-small { height: 100%; background: var(--primary); border-radius: 3px; transition: width 0.3s; }
.progress-label { font-size: 11px; color: var(--text-muted); font-weight: 600; white-space: nowrap; }

.unassigned-banner {
  display: flex; align-items: center; gap: 20px; padding: 24px;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.08) 0%, rgba(245, 158, 11, 0.03) 100%);
  border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 16px; margin-bottom: 32px;
}
.banner-icon {
  font-size: 32px; background: rgba(245, 158, 11, 0.12);
  width: 54px; height: 54px; display: flex; align-items: center; justify-content: center;
  border-radius: 50%;
}
.banner-body h3 { font-size: 17px; font-weight: 700; color: #d97706; margin: 0 0 4px 0; }
.banner-body p { font-size: 14px; color: var(--text-color); opacity: 0.85; margin: 0; line-height: 1.5; }

/* Join Class Modal */
.modal-overlay {
  position: fixed; inset: 0; background: rgba(0,0,0,0.5);
  z-index: 300; display: flex; align-items: center; justify-content: center;
}
.modal-box {
  background: var(--bg-card); border-radius: var(--radius-lg); padding: 32px;
  width: 100%; max-width: 380px; box-shadow: var(--shadow-lg);
}
.modal-box h3 { margin-bottom: 8px; }
.modal-sub { color: var(--text-muted); font-size: 14px; margin-bottom: 20px; }
.form-group { margin-bottom: 14px; }
.form-group input {
  width: 100%; padding: 10px 12px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-main); color: var(--text-main); font-size: 16px;
  letter-spacing: 2px; text-align: center;
}
.error-msg { color: var(--danger); font-size: 13px; margin-bottom: 12px; }
.modal-actions { display: flex; gap: 12px; justify-content: flex-end; }
.btn-primary { background: var(--primary); color: white; padding: 10px 20px; border-radius: var(--radius-sm); border: none; cursor: pointer; font-weight: 600; }
.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
.btn-secondary { background: var(--bg-main); color: var(--text-main); border: 1px solid var(--border-color); padding: 10px 20px; border-radius: var(--radius-sm); cursor: pointer; font-weight: 600; }

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
.animate-fade-in { animation: fadeIn 0.4s ease forwards; }
</style>
