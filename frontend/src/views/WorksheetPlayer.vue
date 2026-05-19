<template>
  <div class="worksheet-player">
    <div v-if="loading" class="loading-container">
      <div class="spinner"></div>
      <p>Loading worksheet...</p>
    </div>

    <div v-else-if="error" class="error-container">
      <span>⚠️</span>
      <p>{{ error }}</p>
      <router-link to="/student" class="btn btn-secondary">Go Back</router-link>
    </div>

    <div v-else class="player-layout">
      <!-- Sticky Student Progress Header -->
      <div class="sticky-progress-header glass">
        <div class="progress-details">
          <h2>{{ worksheet.title }}</h2>
          <span class="save-status" :class="{ 'saving': saving }">
            {{ saving ? 'Saving progress...' : 'Progress auto-saved' }}
          </span>
        </div>
        <div class="progress-stats">
          <div class="points-badge">{{ worksheet.total_points }} Points Max</div>
          <button 
            v-if="!isSubmitted" 
            @click="submitWorksheet" 
            :disabled="submitting" 
            class="btn btn-primary"
          >
            Submit Task 🚀
          </button>
          <router-link v-else to="/student" class="btn btn-secondary">
            Return to Dashboard
          </router-link>
        </div>
      </div>

      <!-- Graded Result Card -->
      <div v-if="isSubmitted && feedbackSummary" class="result-summary-card card glass">
        <div class="summary-emoji">🏆</div>
        <h3>Assignment Submitted!</h3>
        <p class="score-summary">
          You scored <strong>{{ feedbackSummary.score }}</strong> out of <strong>{{ feedbackSummary.maxScore }}</strong> points 
          ({{ feedbackSummary.percentage }}%).
        </p>
        <div class="progress-bar-large">
          <div class="progress-fill" :style="{ width: `${feedbackSummary.percentage}%` }"></div>
        </div>
        <p class="review-note">You can review your correct and incorrect answers below.</p>
      </div>

      <!-- Worksheet Content -->
      <div class="worksheet-body">
        <div 
          v-for="(block, idx) in worksheet.content.blocks" 
          :key="block.id || idx"
          class="block-container"
        >
          <!-- Dynamic Component Mapping -->
          <component 
            v-if="getExerciseComponent(block.type)"
            :is="getExerciseComponent(block.type)"
            v-model="answers[block.id]"
            :id="block.id"
            v-bind="block"
            :disabled="isSubmitted"
            :feedback="feedbackSummary?.feedback?.[block.id]"
            :correctAnswers="getCorrectAnswerData(block)"
            :correctAnswer="getSingleCorrectAnswerData(block)"
          />

          <!-- Static Text Block -->
          <div v-else-if="block.type === 'text'" class="text-card card" v-html="renderMarkdownSafe(block.content)"></div>
          
          <!-- Static Media/Audio Blocks -->
          <MediaBlock v-else-if="block.type === 'image'" v-bind="block" />
          <AudioBlock v-else-if="block.type === 'audio'" v-bind="block" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import GapFill from '../components/exercises/GapFill.vue'
import DragDrop from '../components/exercises/DragDrop.vue'
import MultipleChoice from '../components/exercises/MultipleChoice.vue'
import SingleChoice from '../components/exercises/SingleChoice.vue'
import Matching from '../components/exercises/Matching.vue'
import MediaBlock from '../components/exercises/MediaBlock.vue'
import AudioBlock from '../components/exercises/AudioBlock.vue'

const route = useRoute()
const worksheet = ref(null)
const answers = ref({})
const loading = ref(true)
const error = ref(null)
const saving = ref(false)
const submitting = ref(false)

const isSubmitted = ref(false)
const feedbackSummary = ref(null)

const API_BASE = 'http://localhost:3001/api'
let autosaveTimer = null

const fetchWorksheet = async () => {
  loading.value = true
  error.value = null
  const token = localStorage.getItem('token')
  const assignmentId = route.params.id

  try {
    // 1. Get user submission first to load saved draft or final results
    const subResp = await fetch(`${API_BASE}/submissions/assignment/${assignmentId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    const submission = await subResp.json()

    // 2. Fetch worksheet description and stripped structure
    const wsResp = await fetch(`${API_BASE}/worksheets/${assignmentId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!wsResp.ok) throw new Error('Worksheet not found or access denied')
    
    const wsData = await wsResp.json()
    worksheet.value = wsData

    // 3. Initialize answers object
    const initialAnswers = {}
    wsData.content.blocks.forEach(block => {
      if (['gap_fill', 'multiple_choice', 'single_choice', 'drag_drop', 'matching'].includes(block.type)) {
        // Init matching structure
        if (block.type === 'multiple_choice') {
          initialAnswers[block.id] = []
        } else if (['drag_drop', 'matching'].includes(block.type)) {
          initialAnswers[block.id] = {}
        } else if (block.type === 'gap_fill') {
          initialAnswers[block.id] = []
        } else {
          initialAnswers[block.id] = null
        }
      }
    })

    if (submission) {
      answers.value = { ...initialAnswers, ...submission.answers }
      if (submission.submitted_at) {
        isSubmitted.value = true
        // Fetch graded result feedback
        const gradeResp = await fetch(`${API_BASE}/submissions/assignment/${assignmentId}/submit`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ answers: answers.value })
        })
        const data = await gradeResp.json()
        feedbackSummary.value = data
      }
    } else {
      answers.value = initialAnswers
    }
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  fetchWorksheet().then(() => {
    if (!isSubmitted.value) {
      // Start auto-save loop
      autosaveTimer = setInterval(autoSave, 20000) // save every 20s
    }
  })
})

onUnmounted(() => {
  if (autosaveTimer) clearInterval(autosaveTimer)
})

const autoSave = async () => {
  if (isSubmitted.value || saving.value) return
  saving.value = true
  const token = localStorage.getItem('token')
  const assignmentId = route.params.id
  try {
    await fetch(`${API_BASE}/submissions/assignment/${assignmentId}/save`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ answers: answers.value })
    })
  } catch (err) {
    console.error('Autosave failed:', err)
  } finally {
    saving.value = false
  }
}

// Watch answers change and save progress
watch(answers, () => {
  // We can let the interval handle auto-saving to prevent server hammering.
}, { deep: true })

const submitWorksheet = async () => {
  if (!confirm('Are you sure you want to submit your worksheet? You cannot make changes afterwards.')) return
  
  if (autosaveTimer) clearInterval(autosaveTimer)
  submitting.value = true
  const token = localStorage.getItem('token')
  const assignmentId = route.params.id

  try {
    const resp = await fetch(`${API_BASE}/submissions/assignment/${assignmentId}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ answers: answers.value })
    })
    if (!resp.ok) throw new Error('Submission failed')

    const data = await resp.json()
    feedbackSummary.value = data
    isSubmitted.value = true
    window.scrollTo({ top: 0, behavior: 'smooth' })
  } catch (err) {
    alert(err.message)
  } finally {
    submitting.value = false
  }
}

// Map block types to Vue components
const getExerciseComponent = (type) => {
  switch (type) {
    case 'gap_fill': return GapFill
    case 'drag_drop': return DragDrop
    case 'multiple_choice': return MultipleChoice
    case 'single_choice': return SingleChoice
    case 'matching': return Matching
    default: return null
  }
}

// Extract correct answers from graded feedback
const getCorrectAnswerData = (block) => {
  if (!feedbackSummary.value || !feedbackSummary.value.feedback) return null
  const blockFeedback = feedbackSummary.value.feedback[block.id]
  return blockFeedback?.correctAnswers || null
}

const getSingleCorrectAnswerData = (block) => {
  if (!feedbackSummary.value || !feedbackSummary.value.feedback) return null
  const blockFeedback = feedbackSummary.value.feedback[block.id]
  return blockFeedback?.correctAnswer !== undefined ? blockFeedback.correctAnswer : null
}

const escapeHtml = (text = '') => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const renderMarkdownSafe = (text) => {
  // Escape first, then allow minimal formatting markers only.
  return escapeHtml(text || '')
    .replace(/\n/g, '<br />')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
}
</script>

<style scoped>
.worksheet-player {
  max-width: 800px;
  margin: 0 auto 100px auto;
}

.loading-container, .error-container {
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

.sticky-progress-header {
  position: sticky;
  top: 70px;
  z-index: 90;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  margin-bottom: 32px;
  box-shadow: var(--shadow-sm);
}

.progress-details h2 {
  font-size: 20px;
  font-weight: 700;
}

.save-status {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
}

.save-status.saving {
  color: var(--primary);
  font-weight: 700;
}

.progress-stats {
  display: flex;
  align-items: center;
  gap: 16px;
}

.points-badge {
  font-size: 13px;
  font-weight: 700;
  background-color: var(--bg-main);
  border: 1px solid var(--border-color);
  padding: 6px 12px;
  border-radius: 20px;
}

.worksheet-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.text-card {
  padding: 24px;
  font-size: 16px;
}

/* Graded Results Overview Header */
.result-summary-card {
  text-align: center;
  padding: 32px;
  border-radius: var(--radius-lg);
  border: 2px solid var(--success);
  margin-bottom: 32px;
  animation: slideDown 0.4s ease;
}

@keyframes slideDown {
  from { transform: translateY(-20px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.summary-emoji {
  font-size: 48px;
  margin-bottom: 12px;
}

.result-summary-card h3 {
  font-size: 24px;
  color: var(--success);
  margin-bottom: 8px;
}

.score-summary {
  font-size: 17px;
  margin-bottom: 20px;
}

.progress-bar-large {
  height: 12px;
  background-color: var(--border-color);
  border-radius: 6px;
  overflow: hidden;
  max-width: 400px;
  margin: 0 auto 16px auto;
}

.progress-fill {
  height: 100%;
  background-color: var(--success);
  border-radius: 6px;
}

.review-note {
  font-size: 14px;
  color: var(--text-muted);
  font-weight: 600;
}
</style>
