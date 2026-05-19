<template>
  <div class="student-dashboard">
    <header class="dashboard-header">
      <div>
        <h1>Welcome back, <span>{{ user?.name }}</span></h1>
        <p class="subtitle">Here are your active school assignments.</p>
      </div>
    </header>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading assignments...</p>
    </div>

    <div v-else-if="error" class="error-state">
      <span>⚠️</span>
      <p>{{ error }}</p>
      <button @click="fetchAssignments" class="btn btn-secondary">Try Again</button>
    </div>

    <div v-else-if="assignments.length === 0" class="empty-state card glass">
      <span class="empty-emoji">🎉</span>
      <h2>All caught up!</h2>
      <p>You have no pending worksheets assigned to you at the moment.</p>
    </div>

    <div v-else class="assignments-grid">
      <div v-for="assignment in assignments" :key="assignment.id" class="assignment-card card">
        <div class="card-badge" :class="statusClass(assignment)">
          {{ statusLabel(assignment) }}
        </div>
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
          <router-link 
            v-else 
            :to="`/student/assignment/${assignment.assignment_id}`" 
            class="btn btn-primary btn-play"
          >
            {{ assignment.score !== null ? 'Continue' : 'Start Task' }} 🚀
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const user = ref(JSON.parse(localStorage.getItem('user')))
const assignments = ref([])
const loading = ref(true)
const error = ref(null)

const API_BASE = 'http://localhost:3001/api'

const fetchAssignments = async () => {
  loading.value = true
  error.value = null
  try {
    const token = localStorage.getItem('token')
    const resp = await fetch(`${API_BASE}/worksheets`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    if (!resp.ok) throw new Error('Failed to load assignments')
    assignments.value = await resp.json()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

onMounted(fetchAssignments)

const formatDate = (dateStr) => {
  if (!dateStr) return 'No due date'
  const options = { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }
  return new Date(dateStr).toLocaleDateString(undefined, options)
}

const isOverdue = (dateStr) => {
  if (!dateStr) return false
  return new Date(dateStr) < new Date()
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

.dashboard-header h1 {
  font-size: 28px;
  font-weight: 800;
}

.dashboard-header h1 span {
  color: var(--primary);
}

.subtitle {
  color: var(--text-muted);
}

.loading-state, .error-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 40px;
  text-align: center;
  gap: 16px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid var(--border-color);
  border-top-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state {
  text-align: center;
  padding: 60px 40px;
  max-width: 480px;
  margin: 40px auto;
}

.empty-emoji {
  font-size: 48px;
  display: block;
  margin-bottom: 16px;
}

.empty-state h2 {
  font-size: 22px;
  margin-bottom: 8px;
}

.empty-state p {
  color: var(--text-muted);
}

.assignments-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 24px;
}

.assignment-card {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 250px;
}

.card-badge {
  position: absolute;
  top: 24px;
  right: 24px;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 20px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.status-completed {
  background-color: var(--success-light);
  color: var(--success);
}

.status-overdue {
  background-color: var(--danger-light);
  color: var(--danger);
}

.status-active {
  background-color: var(--primary-light);
  color: var(--primary);
}

.assignment-title {
  font-size: 18px;
  font-weight: 700;
  margin-top: 12px;
  margin-bottom: 8px;
  padding-right: 80px;
}

.assignment-desc {
  color: var(--text-muted);
  font-size: 14px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  margin-bottom: 16px;
}

.assignment-meta {
  border-top: 1px solid var(--border-color);
  padding-top: 16px;
  display: flex;
  justify-content: space-between;
  margin-bottom: 20px;
}

.meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.meta-label {
  font-size: 10px;
  text-transform: uppercase;
  color: var(--text-muted);
  font-weight: 700;
}

.meta-value {
  font-size: 13px;
  font-weight: 600;
}

.overdue {
  color: var(--danger);
}

.card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.btn-play {
  width: 100%;
  justify-content: center;
}

.score-display {
  width: 100%;
}

.score-label {
  font-size: 10px;
  text-transform: uppercase;
  color: var(--text-muted);
  font-weight: 700;
  display: block;
}

.score-value {
  font-size: 18px;
  font-weight: 800;
  color: var(--primary);
}

.score-bar {
  height: 6px;
  background-color: var(--border-color);
  border-radius: 3px;
  overflow: hidden;
  margin-top: 4px;
}

.score-fill {
  height: 100%;
  background-color: var(--primary);
  border-radius: 3px;
}
</style>
