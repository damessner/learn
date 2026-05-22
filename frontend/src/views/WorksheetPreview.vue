<template>
  <div class="worksheet-player worksheet-preview">
    <div v-if="loading" class="loading-container">
      <div class="spinner"></div>
      <p>Loading preview...</p>
    </div>

    <div v-else-if="error" class="error-container">
      <span>⚠️</span>
      <p>{{ error }}</p>
      <button @click="goBack" class="btn btn-secondary">Go Back</button>
    </div>

    <div v-else class="player-layout">
      <!-- Sticky Progress Header -->
      <div class="sticky-progress-header glass" style="border-left: 4px solid var(--warning);">
        <div class="progress-details">
          <h2>{{ worksheet.title }} <span class="badge badge-warning" style="margin-left: 8px;">Preview Mode</span></h2>
          <span class="save-status">
            Answers are not saved.
          </span>
        </div>
        <div class="progress-stats">
          <div class="points-badge">{{ worksheet.total_points }} Points Max</div>
          <button 
            v-if="!isSubmitted" 
            @click="submitPreview" 
            class="btn btn-primary"
          >
            Grade Preview 🚀
          </button>
          <button v-else @click="resetPreview" class="btn btn-secondary">
            Reset Preview
          </button>
          <button @click="goBack" class="btn btn-secondary" style="margin-left: 8px;">
            Exit
          </button>
        </div>
      </div>

      <!-- Graded Result Card -->
      <div v-if="isSubmitted && feedbackSummary" class="result-summary-card card glass">
        <div class="summary-emoji">🏆</div>
        <h3>Preview Graded!</h3>
        <p class="score-summary">
          You scored <strong>{{ feedbackSummary.score }}</strong> out of <strong>{{ feedbackSummary.maxScore }}</strong> points 
          ({{ feedbackSummary.percentage }}%).
        </p>
        <div class="progress-bar-large">
          <div class="progress-fill" :style="{ width: `${feedbackSummary.percentage}%` }"></div>
        </div>
        <p class="review-note">You can review the correct and incorrect answers below.</p>
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
            :worksheetTitle="worksheet?.title"
          />

          <!-- Static Text Block -->
          <div v-else-if="block.type === 'text'" class="text-card card">{{ block.content || '' }}</div>
          
          <!-- Static Media/Audio/Video Blocks -->
          <MediaBlock v-else-if="block.type === 'image'" v-bind="block" />
          <AudioBlock v-else-if="block.type === 'audio'" v-bind="block" />
          <ReadAloudBlock v-else-if="block.type === 'tts_text'" v-bind="block" />
          <VideoBlock v-else-if="block.type === 'video'" v-bind="block" v-model="answers[block.id]" :disabled="isSubmitted" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import GapFill from '../components/exercises/GapFill.vue'
import DragDrop from '../components/exercises/DragDrop.vue'
import MultipleChoice from '../components/exercises/MultipleChoice.vue'
import SingleChoice from '../components/exercises/SingleChoice.vue'
import Matching from '../components/exercises/Matching.vue'
import MediaBlock from '../components/exercises/MediaBlock.vue'
import AudioBlock from '../components/exercises/AudioBlock.vue'
import ReadAloudBlock from '../components/exercises/ReadAloudBlock.vue'
import VideoBlock from '../components/exercises/VideoBlock.vue'
import Vocabulary from '../components/exercises/Vocabulary.vue'

const route = useRoute()
const router = useRouter()

const worksheet = ref(null)
const answers = ref({})
const loading = ref(true)
const error = ref(null)

const isSubmitted = ref(false)
const feedbackSummary = ref(null)

const API_BASE = '/api'

const goBack = () => {
  router.back()
}

const fetchWorksheet = async () => {
  loading.value = true
  error.value = null
  const token = localStorage.getItem('token')
  const worksheetId = route.params.id

  try {
    const wsResp = await fetch(`${API_BASE}/worksheets/${worksheetId}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
    if (!wsResp.ok) throw new Error('Worksheet not found or access denied')
    
    const wsData = await wsResp.json()
    worksheet.value = wsData

    initAnswers()
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

const initAnswers = () => {
  const initialAnswers = {}
  worksheet.value.content.blocks.forEach(block => {
    if (['gap_fill', 'multiple_choice', 'single_choice', 'drag_drop', 'matching', 'vocabulary', 'video'].includes(block.type)) {
      if (block.type === 'multiple_choice') {
        initialAnswers[block.id] = []
      } else if (['drag_drop', 'matching'].includes(block.type)) {
        initialAnswers[block.id] = {}
      } else if (block.type === 'vocabulary') {
        initialAnswers[block.id] = { completed: false, answersMap: {} }
      } else if (block.type === 'video') {
        initialAnswers[block.id] = []
      } else if (block.type === 'gap_fill') {
        initialAnswers[block.id] = []
      } else {
        initialAnswers[block.id] = null
      }
    }
  })
  answers.value = initialAnswers
}

onMounted(() => {
  fetchWorksheet()
})

const submitPreview = () => {
  // We grade the worksheet locally because we already have all correct answers in `worksheet.value`.
  let totalScore = 0
  let totalMaxScore = 0
  const feedback = {}

  worksheet.value.content.blocks.forEach(block => {
    if (!['gap_fill', 'drag_drop', 'multiple_choice', 'single_choice', 'matching', 'vocabulary', 'video'].includes(block.type)) return

    const pts = block.points || 1
    totalMaxScore += pts
    let blockScore = 0
    let isCorrect = false
    const blockFeedback = { correct: false }

    const studentAns = answers.value[block.id]

    if (block.type === 'gap_fill') {
      const template = block.template || ''
      const blanks = [...template.matchAll(/\{([^}]+)\}/g)].map(m => m[1])
      const totalGaps = blanks.length
      if (totalGaps === 0) {
        blockScore = pts
        isCorrect = true
      } else {
        let correctCount = 0
        const ansArr = Array.isArray(studentAns) ? studentAns : []
        const correctAnswers = []
        blanks.forEach((correctText, i) => {
          const ans = (ansArr[i] || '').trim().toLowerCase()
          if (ans === correctText.trim().toLowerCase()) correctCount++
          correctAnswers.push(correctText.trim())
        })
        blockScore = Math.round((correctCount / totalGaps) * pts)
        isCorrect = correctCount === totalGaps
        blockFeedback.correctAnswers = correctAnswers
      }
    } else if (block.type === 'drag_drop') {
      const targets = block.targets || []
      const correctDict = block.answers || {}
      const totalTargets = targets.length
      if (totalTargets === 0) {
        blockScore = pts
        isCorrect = true
      } else {
        let correctCount = 0
        const studentDict = studentAns || {}
        for (let i = 0; i < totalTargets; i++) {
          if (studentDict[i] === correctDict[i]) correctCount++
        }
        blockScore = Math.round((correctCount / totalTargets) * pts)
        isCorrect = correctCount === totalTargets
      }
    } else if (block.type === 'multiple_choice') {
      const correctArr = Array.isArray(block.correct) ? block.correct : []
      const studentArr = Array.isArray(studentAns) ? studentAns : []
      const isExactlySame = correctArr.length === studentArr.length && correctArr.every(v => studentArr.includes(v))
      if (isExactlySame) {
        blockScore = pts
        isCorrect = true
      }
      blockFeedback.correctAnswers = correctArr
    } else if (block.type === 'single_choice') {
      if (Number(studentAns) === Number(block.correct)) {
        blockScore = pts
        isCorrect = true
      }
      blockFeedback.correctAnswer = Number(block.correct)
    } else if (block.type === 'matching') {
      const pairs = block.pairs || []
      const totalPairs = pairs.length
      if (totalPairs === 0) {
        blockScore = pts
        isCorrect = true
      } else {
        let correctCount = 0
        const studentDict = studentAns || {}
        pairs.forEach(pair => {
          const left = pair[0]
          const right = pair[1]
          if (studentDict[left] === right) correctCount++
        })
        blockScore = Math.round((correctCount / totalPairs) * pts)
        isCorrect = correctCount === totalPairs
      }
    } else if (block.type === 'vocabulary') {
      const pairs = block.pairs || []
      const totalPairs = pairs.length
      if (totalPairs === 0) {
        blockScore = pts
        isCorrect = true
      } else {
        let correctCount = 0
        const ansMap = studentAns?.answersMap || {}
        pairs.forEach((pair, idx) => {
          const targetWord = (pair.r || '').trim().toLowerCase()
          const stWord = (ansMap[idx] || '').trim().toLowerCase()
          if (stWord === targetWord) correctCount++
        })
        blockScore = Math.round((correctCount / totalPairs) * pts)
        isCorrect = correctCount === totalPairs
      }
    } else if (block.type === 'video') {
      const questions = Array.isArray(block.questions) ? block.questions : []
      const answerList = Array.isArray(studentAns) ? studentAns : []
      let correctCount = 0
      const questionFeedback = []
      questions.forEach((q, idx) => {
        const type = q.type || 'short_answer'
        const answer = answerList[idx]
        let qCorrect = false
        if (type === 'single_choice') {
          qCorrect = Number(answer) === Number(q.correct)
        } else if (type === 'multiple_choice') {
          const expected = Array.isArray(q.correct) ? [...q.correct].sort().join(',') : ''
          const got = Array.isArray(answer) ? [...answer].sort().join(',') : ''
          qCorrect = expected === got
        } else if (type === 'gap_fill') {
          const expected = [...String(q.template || '').matchAll(/\(\(([^)]+)\)\)/g)].map(m => (m[1] || '').trim().toLowerCase())
          const got = Array.isArray(answer) ? answer.map(v => String(v || '').trim().toLowerCase()) : []
          qCorrect = expected.length > 0 && expected.every((val, i) => got[i] === val)
        } else {
          const sample = String(q.sample_answer || '').trim().toLowerCase()
          const got = String(answer || '').trim().toLowerCase()
          qCorrect = sample ? got === sample : got.length > 0
        }
        if (qCorrect) correctCount++
        questionFeedback.push({ correct: qCorrect })
      })
      const total = Math.max(questions.length, 1)
      blockScore = Math.round((correctCount / total) * pts)
      isCorrect = questions.length > 0 && correctCount === questions.length
      blockFeedback.questions = questionFeedback
    }

    blockFeedback.correct = isCorrect
    blockFeedback.pointsAwarded = blockScore
    feedback[block.id] = blockFeedback
    totalScore += blockScore
  })

  feedbackSummary.value = {
    score: totalScore,
    maxScore: totalMaxScore,
    percentage: totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0,
    feedback
  }
  isSubmitted.value = true
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

const resetPreview = () => {
  isSubmitted.value = false
  feedbackSummary.value = null
  initAnswers()
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

// Map block types to Vue components
const getExerciseComponent = (type) => {
  switch (type) {
    case 'gap_fill': return GapFill
    case 'drag_drop': return DragDrop
    case 'multiple_choice': return MultipleChoice
    case 'single_choice': return SingleChoice
    case 'matching': return Matching
    case 'vocabulary': return Vocabulary
    default: return null
  }
}

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
  white-space: pre-wrap;
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
