<template>
  <div class="course-view">
    <header class="course-header card glass">
      <div class="back-link">
        <router-link to="/student" class="btn btn-secondary btn-sm">← Back to Dashboard</router-link>
      </div>
      
      <div v-if="loading" class="spinner-container">
        <div class="spinner"></div>
      </div>
      
      <div v-else-if="error" class="error-state">
        <span>⚠️</span> {{ error }}
      </div>
      
      <div v-else-if="courseData">
        <h1>{{ courseData.course.title }}</h1>
        <p class="course-desc">{{ courseData.course.description || 'Complete the worksheets in order to finish the course.' }}</p>
        
        <div class="course-progress">
          <div class="progress-meta">
            <span>Progress: {{ completedCount }} / {{ courseData.worksheets.length }}</span>
            <span class="progress-percent">{{ progressPercent }}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${progressPercent}%` }"></div>
          </div>
        </div>
      </div>
    </header>

    <div v-if="!loading && courseData" class="course-modules">
      <div 
        v-for="(ws, index) in courseData.worksheets" 
        :key="ws.worksheet_id"
        :class="['module-card', 'card', { 
          'locked': isLocked(index), 
          'completed': ws.status === 'completed',
          'active': isActive(index) 
        }]"
      >
        <div class="module-number">{{ index + 1 }}</div>
        
        <div class="module-info">
          <h3>{{ ws.title }}</h3>
          <div class="module-meta">
            <span class="badge" :class="statusClass(ws.status)">{{ statusLabel(ws.status) }}</span>
            <span v-if="ws.status === 'completed'" class="score-badge">
              {{ ws.score }} / {{ ws.max_score }} pts
            </span>
            <span v-else class="points-badge">{{ ws.total_points }} pts</span>
          </div>
        </div>

        <div class="module-action">
          <button v-if="isLocked(index)" class="btn btn-secondary" disabled>
            🔒 Locked
          </button>
          
          <router-link 
            v-else-if="ws.status !== 'completed'"
            :to="`/student/assignment/${ws.assignment_id}`" 
            class="btn btn-primary"
          >
            {{ ws.status === 'in_progress' ? 'Continue' : 'Start Task' }} 🚀
          </router-link>
          
          <router-link 
            v-else
            :to="`/student/assignment/${ws.assignment_id}`" 
            class="btn btn-secondary"
          >
            View Result
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()
const courseAssignmentId = route.params.id

const loading = ref(true)
const error = ref(null)
const courseData = ref(null)

const API_BASE = '/api'

const fetchCourse = async () => {
  loading.value = true
  error.value = null
  const token = localStorage.getItem('token')
  
  try {
    const res = await fetch(`${API_BASE}/courses/student/course/${courseAssignmentId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    
    if (!res.ok) throw new Error('Failed to load course details')
    
    courseData.value = await res.json()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

onMounted(fetchCourse)

const completedCount = computed(() => {
  if (!courseData.value) return 0
  return courseData.value.worksheets.filter(w => w.status === 'completed').length
})

const progressPercent = computed(() => {
  if (!courseData.value || courseData.value.worksheets.length === 0) return 0
  return Math.round((completedCount.value / courseData.value.worksheets.length) * 100)
})

// Option B strict sequential logic:
// A worksheet is locked if the previous worksheet is not completed.
const isLocked = (index) => {
  if (index === 0) return false // First is always unlocked
  if (!courseData.value) return true
  // Check if previous is completed
  const prev = courseData.value.worksheets[index - 1]
  return prev.status !== 'completed'
}

const isActive = (index) => {
  if (isLocked(index)) return false
  if (courseData.value.worksheets[index].status === 'completed') return false
  return true // Unlocked but not completed
}

const statusLabel = (status) => {
  if (status === 'completed') return 'Completed'
  if (status === 'in_progress') return 'In Progress'
  return 'Not Started'
}

const statusClass = (status) => {
  if (status === 'completed') return 'badge-success'
  if (status === 'in_progress') return 'badge-warning'
  return 'badge-secondary'
}
</script>

<style scoped>
.course-view {
  max-width: 800px;
  margin: 0 auto;
  padding-bottom: 60px;
}

.course-header {
  padding: 30px;
  margin-bottom: 30px;
  position: relative;
  overflow: hidden;
}

.back-link {
  margin-bottom: 20px;
}

.course-header h1 {
  font-size: 28px;
  margin-bottom: 8px;
  font-weight: 800;
}

.course-desc {
  color: var(--text-muted);
  font-size: 16px;
  margin-bottom: 24px;
  line-height: 1.5;
}

.course-progress {
  background: rgba(0,0,0,0.2);
  padding: 16px;
  border-radius: 12px;
}

.progress-meta {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  font-weight: 600;
  font-size: 14px;
}

.progress-percent {
  color: var(--primary);
  font-weight: 700;
}

.progress-bar {
  height: 8px;
  background-color: var(--border-color);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: var(--primary);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.course-modules {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.module-card {
  display: flex;
  align-items: center;
  padding: 24px;
  gap: 20px;
  transition: transform 0.2s, box-shadow 0.2s;
  border: 1px solid var(--border-color);
}

.module-card.active {
  border-color: var(--primary);
  box-shadow: 0 4px 20px rgba(59, 130, 246, 0.15);
  transform: translateY(-2px);
}

.module-card.locked {
  opacity: 0.6;
  background: var(--bg-color);
}

.module-number {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: var(--surface-light);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 800;
  color: var(--text-muted);
  flex-shrink: 0;
}

.active .module-number {
  background: var(--primary-light);
  color: var(--primary);
}

.completed .module-number {
  background: var(--success-light);
  color: var(--success);
}

.module-info {
  flex: 1;
}

.module-info h3 {
  font-size: 18px;
  margin: 0 0 8px 0;
}

.module-meta {
  display: flex;
  gap: 12px;
  align-items: center;
}

.score-badge {
  font-weight: 700;
  color: var(--success);
  font-size: 14px;
}

.points-badge {
  color: var(--text-muted);
  font-size: 14px;
}

.module-action {
  flex-shrink: 0;
}

.spinner-container {
  display: flex;
  justify-content: center;
  padding: 40px;
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

@media (max-width: 600px) {
  .module-card {
    flex-direction: column;
    align-items: flex-start;
    padding: 20px;
  }
  
  .module-action {
    width: 100%;
  }
  
  .module-action .btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
