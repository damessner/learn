<template>
  <div class="teacher-dashboard">
    <header class="dashboard-header">
      <div>
        <h1>Educator <span>Portal</span></h1>
        <p class="subtitle">Design interactive worksheets, assign tasks, and sync grades to Teams.</p>
      </div>
      <router-link to="/teacher/builder" class="btn btn-primary">
        <span>＋</span> Create Worksheet
      </router-link>
    </header>

    <div v-if="error" class="error-banner">
      <span>⚠️</span> {{ error }}
    </div>

    <!-- Main Navigation tabs -->
    <div class="tabs">
      <button 
        v-for="tab in ['worksheets', 'assignments']" 
        :key="tab"
        @click="activeTab = tab"
        :class="['tab-btn', { active: activeTab === tab }]"
      >
        {{ tab.charAt(0).toUpperCase() + tab.slice(1) }}
      </button>
    </div>

    <!-- Worksheets Tab -->
    <div v-if="activeTab === 'worksheets'" class="tab-content">
      <div v-if="loading" class="spinner-container">
        <div class="spinner"></div>
      </div>
      <div v-else-if="worksheets.length === 0" class="empty-state card glass">
        <span>📝</span>
        <h3>No Worksheets Yet</h3>
        <p>Start by creating your first interactive exercise sheet.</p>
        <router-link to="/teacher/builder" class="btn btn-primary btn-centered">Create One Now</router-link>
      </div>
      <div v-else class="table-container card">
        <table class="data-table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Subject</th>
              <th>Level</th>
              <th>Total Points</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="sheet in worksheets" :key="sheet.id">
              <td class="font-bold">{{ sheet.title }}</td>
              <td>{{ sheet.subject || 'General' }}</td>
              <td>{{ sheet.grade_level || 'All' }}</td>
              <td>{{ sheet.total_points }} pts</td>
              <td>
                <span :class="['badge', sheet.is_published ? 'badge-success' : 'badge-warning']">
                  {{ sheet.is_published ? 'Published' : 'Draft' }}
                </span>
              </td>
              <td>
                <div class="action-buttons">
                  <button @click="openAssignModal(sheet)" class="btn-icon" title="Assign to Class">
                    <span>📢</span>
                  </button>
                  <router-link :to="`/teacher/builder/${sheet.id}`" class="btn-icon" title="Edit Worksheet">
                    <span>✏️</span>
                  </router-link>
                  <button @click="deleteWorksheet(sheet.id)" class="btn-icon btn-icon-danger" title="Delete">
                    <span>🗑️</span>
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Assignments Tab -->
    <div v-if="activeTab === 'assignments'" class="tab-content">
      <div v-if="loading" class="spinner-container">
        <div class="spinner"></div>
      </div>
      <div v-else-if="assignments.length === 0" class="empty-state card glass">
        <span>📢</span>
        <h3>No Active Assignments</h3>
        <p>Assign a worksheet to a class or channel to see it here.</p>
      </div>
      <div v-else class="assignments-list">
        <div v-for="assignment in assignments" :key="assignment.id" class="assignment-item card">
          <div class="assignment-info">
            <h3>{{ assignment.worksheet_title || 'Worksheet Task' }}</h3>
            <p class="class-info">Class: <strong>{{ assignment.class_name }}</strong></p>
            <p class="due-info">Due: <strong>{{ formatDate(assignment.due_date) }}</strong></p>
            <p class="code-info">Share code with students: <code class="share-code">{{ assignment.id }}</code></p>
          </div>

          <div class="assignment-stats">
            <div class="stat">
              <span class="stat-num">{{ assignment.submission_count || 0 }}</span>
              <span class="stat-label">Submissions</span>
            </div>
            <div class="stat-actions">
              <button @click="viewResults(assignment.id)" class="btn btn-secondary btn-sm">
                View Results 📊
              </button>
              <button 
                v-if="assignment.teams_assignment_id" 
                @click="syncGrades(assignment.id)" 
                class="btn btn-primary btn-sm"
              >
                Sync to Teams 🔄
              </button>
              <button 
                v-else 
                @click="createTeamsAssignment(assignment.id)" 
                class="btn btn-secondary btn-sm btn-outline-teams"
              >
                Link to Teams 📁
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Assign Worksheet Modal -->
    <div v-if="showAssignModal" class="modal-overlay">
      <div class="modal card">
        <h2>Assign Worksheet: <span>{{ selectedSheet?.title }}</span></h2>
        <form @submit.prevent="submitAssign" class="modal-form">
          <div class="form-group">
            <label>School Class Name</label>
            <input type="text" v-model="assignForm.class_name" placeholder="e.g. 3a English" required />
          </div>
          <div class="form-group">
            <label>Teams Class ID (Optional - for Teams Sync)</label>
            <input type="text" v-model="assignForm.class_id" placeholder="Copy Teams class ID" />
          </div>
          <div class="form-group">
            <label>Due Date</label>
            <input type="datetime-local" v-model="assignForm.due_date" required />
          </div>
          <div class="modal-buttons">
            <button type="button" @click="showAssignModal = false" class="btn btn-secondary">Cancel</button>
            <button type="submit" class="btn btn-primary">Assign Worksheet</button>
          </div>
        </form>
      </div>
    </div>

    <!-- View Results Modal -->
    <div v-if="showResultsModal" class="modal-overlay">
      <div class="modal modal-lg card">
        <div class="modal-header">
          <h2>Student Submissions</h2>
          <button @click="showResultsModal = false" class="btn-close">×</button>
        </div>
        <div class="results-table-container">
          <table class="data-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Status</th>
                <th>Score</th>
                <th>Synced</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="res in currentResults" :key="res.id">
                <td>{{ res.student_name }}</td>
                <td>
                  <span class="badge badge-success">Submitted</span>
                </td>
                <td>{{ res.score }} / {{ res.max_score }}</td>
                <td>
                  <span :class="['badge', res.grade_synced ? 'badge-success' : 'badge-warning']">
                    {{ res.grade_synced ? 'Synced' : 'Local Only' }}
                  </span>
                </td>
                <td>
                  <button @click="viewSingleAnswers(res)" class="btn btn-secondary btn-sm">Inspect</button>
                </td>
              </tr>
              <tr v-if="currentResults.length === 0">
                <td colspan="5" class="text-center">No submissions yet for this assignment.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const worksheets = ref([])
const assignments = ref([])
const loading = ref(true)
const error = ref(null)
const activeTab = ref('worksheets')

const showAssignModal = ref(false)
const selectedSheet = ref(null)
const assignForm = ref({ class_name: '', class_id: '', due_date: '' })

const showResultsModal = ref(false)
const currentResults = ref([])

const API_BASE = 'http://localhost:3001/api'

const fetchData = async () => {
  loading.value = true
  error.value = null
  const token = localStorage.getItem('token')
  try {
    // Worksheets
    const wsResp = await fetch(`${API_BASE}/worksheets`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    worksheets.value = await wsResp.json()

    // Assignments
    const assignList = []
    for (const ws of worksheets.value) {
      const aResp = await fetch(`${API_BASE}/worksheets/${ws.id}/assignments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      const data = await aResp.json()
      data.forEach(item => {
        assignList.push({
          ...item,
          worksheet_title: ws.title
        })
      })
    }
    assignments.value = assignList
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

onMounted(fetchData)

const openAssignModal = (sheet) => {
  selectedSheet.value = sheet
  assignForm.value = { class_name: '', class_id: '', due_date: '' }
  showAssignModal.value = true
}

const submitAssign = async () => {
  const token = localStorage.getItem('token')
  try {
    const resp = await fetch(`${API_BASE}/worksheets/${selectedSheet.value.id}/assignments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(assignForm.value)
    })
    if (!resp.ok) throw new Error('Failed to create assignment')
    showAssignModal.value = false
    fetchData()
  } catch (err) {
    alert(err.message)
  }
}

const deleteWorksheet = async (id) => {
  if (!confirm('Are you sure you want to delete this worksheet?')) return
  const token = localStorage.getItem('token')
  try {
    await fetch(`${API_BASE}/worksheets/${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    fetchData()
  } catch (err) {
    alert(err.message)
  }
}

const createTeamsAssignment = async (assignId) => {
  const token = localStorage.getItem('token')
  try {
    const resp = await fetch(`${API_BASE}/teams/assignment/${assignId}/create-teams`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!resp.ok) {
      const data = await resp.json()
      throw new Error(data.error || 'Failed to create Teams assignment')
    }
    alert('Assignment successfully linked and published in Teams!')
    fetchData()
  } catch (err) {
    alert(err.message)
  }
}

const syncGrades = async (assignId) => {
  const token = localStorage.getItem('token')
  try {
    const resp = await fetch(`${API_BASE}/teams/assignment/${assignId}/push-grades`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const data = await resp.json()
    alert(`Grade Sync Complete! Synced: ${data.synced} grades successfully.`)
    fetchData()
  } catch (err) {
    alert(err.message)
  }
}

const viewResults = async (assignId) => {
  const token = localStorage.getItem('token')
  try {
    const resp = await fetch(`${API_BASE}/worksheets/assignments/${assignId}/results`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    currentResults.value = await resp.json()
    showResultsModal.value = true
  } catch (err) {
    alert(err.message)
  }
}

const viewSingleAnswers = (sub) => {
  alert(JSON.stringify(sub.answers, null, 2))
}

const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A'
  return new Date(dateStr).toLocaleString()
}
</script>

<style scoped>
.teacher-dashboard {
  max-width: 1200px;
  margin: 0 auto;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 32px;
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

.tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  border-bottom: 2px solid var(--border-color);
  padding-bottom: 8px;
}

.tab-btn {
  background: none;
  border: none;
  box-shadow: none;
  min-height: auto;
  font-size: 16px;
  color: var(--text-muted);
  cursor: pointer;
  padding: 8px 16px;
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
}

.tab-btn.active {
  color: var(--primary);
  background-color: var(--primary-light);
  font-weight: 700;
}

.table-container {
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.data-table th, .data-table td {
  padding: 16px;
  border-bottom: 1px solid var(--border-color);
}

.data-table th {
  font-weight: 700;
  color: var(--text-muted);
  font-size: 13px;
  text-transform: uppercase;
}

.font-bold {
  font-weight: 600;
}

.badge {
  display: inline-block;
  font-size: 11px;
  font-weight: 700;
  padding: 4px 8px;
  border-radius: 20px;
}

.badge-success {
  background-color: var(--success-light);
  color: var(--success);
}

.badge-warning {
  background-color: var(--warning-light);
  color: var(--warning);
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.btn-icon {
  background: none;
  border: 1px solid var(--border-color);
  width: 36px;
  height: 36px;
  border-radius: var(--radius-sm);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
  min-height: auto;
  box-shadow: none;
}

.btn-icon:hover {
  background-color: var(--primary-light);
  border-color: var(--primary);
}

.btn-icon-danger:hover {
  background-color: var(--danger-light);
  border-color: var(--danger);
}

.assignments-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.assignment-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
}

.assignment-info h3 {
  font-size: 18px;
  margin-bottom: 6px;
}

.assignment-info p {
  font-size: 14px;
  color: var(--text-muted);
}

.share-code {
  background-color: var(--primary-light);
  color: var(--primary);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  font-weight: 700;
}

.assignment-stats {
  display: flex;
  align-items: center;
  gap: 32px;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-num {
  font-size: 24px;
  font-weight: 800;
  color: var(--primary);
}

.stat-label {
  font-size: 11px;
  color: var(--text-muted);
  font-weight: 700;
}

.stat-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.btn-sm {
  font-size: 12px;
  padding: 6px 12px;
  min-height: auto;
}

/* Modal styling */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(4px);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.modal {
  width: 100%;
  max-width: 500px;
  animation: modalIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.modal-lg {
  max-width: 800px;
}

@keyframes modalIn {
  from { transform: scale(0.9); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.modal-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-top: 20px;
}

.modal-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 8px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.btn-close {
  background: none;
  border: none;
  font-size: 24px;
  color: var(--text-muted);
  cursor: pointer;
  min-height: auto;
  box-shadow: none;
}
</style>
