<template>
  <div class="exercise-card vocabulary-exercise">
    <div class="exercise-header">
      <span class="exercise-badge">Vocabulary Training</span>
      <span class="points">{{ points }} pts</span>
    </div>

    <div class="instruction">{{ instruction }}</div>

    <!-- Active Practice Loop -->
    <div v-if="!isCompleted && activeWord" class="practice-container card glass">
      <!-- Progress Bar -->
      <div class="progress-section">
        <div class="progress-text">
          <span>Progress</span>
          <span>{{ masteredCount }} / {{ totalWords }} words ({{ progressPercentage }}%)</span>
        </div>
        <div class="progress-bar-container">
          <div class="progress-bar-fill" :style="{ width: `${progressPercentage}%` }"></div>
        </div>
      </div>

      <!-- Question Card -->
      <div class="vocab-card">
        <div class="direction-hint">
          Translate from <span class="lang-tag">{{ activeWord.promptLang === 'left' ? 'English' : 'German' }}</span> to <span class="lang-tag">{{ activeWord.promptLang === 'left' ? 'German' : 'English' }}</span>:
        </div>
        <div class="clue-word">{{ activeWord.clue }}</div>

        <!-- Answer Input -->
        <div class="input-container">
          <input
            ref="inputField"
            type="text"
            v-model="studentInput"
            :disabled="disabled || showFeedback"
            placeholder="Type your translation..."
            autocorrect="off"
            autocapitalize="none"
            autocomplete="off"
            spellcheck="false"
            class="vocab-input"
            @keydown.enter="handleEnterKey"
          />
        </div>

        <!-- Feedback Messages -->
        <div v-if="showFeedback" class="feedback-msg" :class="feedbackType">
          <span class="feedback-icon">{{ feedbackType === 'correct' ? '✅' : '❌' }}</span>
          <div class="feedback-text">
            <span v-if="feedbackType === 'correct'" class="msg-title">Correct! Excellent work.</span>
            <template v-else>
              <span class="msg-title">Not quite right!</span>
              <span class="correct-reveal">Correct answer: <strong>{{ activeWord.answer }}</strong></span>
              <span class="requeue-notice">This word is pushed back into the deck to practice again.</span>
            </template>
          </div>
        </div>

        <!-- Action Button -->
        <div class="action-row">
          <button v-if="!showFeedback" @click="checkAnswer" :disabled="!studentInput.trim()" class="btn btn-primary">
            Check Answer ➔
          </button>
          <button v-else ref="continueBtn" @click="nextWord" class="btn btn-secondary">
            {{ activeQueue.length > 0 ? 'Continue ➔' : 'Show Results 🏆' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Completed / Results Screen -->
    <div v-else class="completed-container card glass">
      <div class="celebration-emoji">🎓</div>
      <h2>Exercise Completed!</h2>
      <p class="subtitle">You have successfully mastered all vocabulary words in this deck.</p>

      <div class="stats-summary">
        <div class="stat-card">
          <span class="stat-val">{{ totalWords }}</span>
          <span class="stat-lbl">Words Known</span>
        </div>
        <div class="stat-card">
          <span class="stat-val">{{ formatTime(timeSpent) }}</span>
          <span class="stat-lbl">Time Spent</span>
        </div>
        <div class="stat-card">
          <span class="stat-val">{{ difficultWords.length }}</span>
          <span class="stat-lbl">Challenging Words</span>
        </div>
      </div>

      <!-- Difficult Words List -->
      <div v-if="difficultWords.length > 0" class="difficult-words-section">
        <h3>Words that required extra practice:</h3>
        <ul class="diff-list">
          <li v-for="word in difficultWords.slice(0, 5)" :key="word.id" class="diff-item">
            <span class="diff-clue">{{ word.clue }}</span>
            <span class="diff-arrow">➔</span>
            <span class="diff-ans">{{ word.answer }}</span>
            <span class="diff-badge">{{ word.mistakes }} mistakes</span>
          </li>
        </ul>
      </div>
      <div v-else class="perfect-run-banner">
        🌟 Perfect Run! You made zero mistakes!
      </div>

      <!-- Certificate Download -->
      <div class="certificate-action">
        <button @click="downloadCertificate" class="btn btn-primary btn-cert">
          Download Certificate 🏆
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'

const props = defineProps({
  id: String,
  points: Number,
  instruction: String,
  words: {
    type: Array,
    default: () => []
  },
  disabled: Boolean,
  feedback: Object, // backend feedback if already submitted
  worksheetTitle: {
    type: String,
    default: 'Vocabulary Sheet'
  },
  modelValue: {
    type: Object,
    default: () => ({})
  }
})

const emit = defineEmits(['update:modelValue'])

const activeQueue = ref([])
const masteredCount = ref(0)
const studentInput = ref('')
const showFeedback = ref(false)
const feedbackType = ref('correct') // 'correct' or 'incorrect'
const mistakesCount = ref({})
const answersMap = ref({})
const studentName = ref('Student')
const inputField = ref(null)
const continueBtn = ref(null)

const timeStart = ref(null)
const timeSpent = ref(0)
const isCompleted = ref(false)

const totalWords = computed(() => props.words.length)
const activeWord = computed(() => activeQueue.value[0] || null)

const progressPercentage = computed(() => {
  if (totalWords.value === 0) return 0
  return Math.round((masteredCount.value / totalWords.value) * 100)
})

// Sort and get difficult words
const difficultWords = computed(() => {
  return props.words
    .map(w => ({
      ...w,
      mistakes: mistakesCount.value[w.id] || 0
    }))
    .filter(w => w.mistakes > 0)
    .sort((a, b) => b.mistakes - a.mistakes)
})

onMounted(() => {
  // Retrieve student name
  try {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const u = JSON.parse(userStr)
      if (u && u.name) studentName.value = u.name
    }
  } catch (e) {
    console.error(e)
  }

  // Load existing submission state or initialize new
  if (props.feedback || props.modelValue.completed) {
    isCompleted.value = true
    timeSpent.value = props.modelValue.timeSpentSeconds || 0
    mistakesCount.value = props.modelValue.mistakes || {}
    answersMap.value = props.modelValue.answersMap || {}
  } else {
    initDeck()
  }
})

const initDeck = () => {
  timeStart.value = Date.now()
  masteredCount.value = 0
  mistakesCount.value = {}
  answersMap.value = {}
  isCompleted.value = false

  // Populate and shuffle active queue
  const queue = [...props.words]
  // Fisher-Yates Shuffle
  for (let i = queue.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]]
  }
  activeQueue.value = queue
  focusInput()
}

const focusInput = () => {
  nextTick(() => {
    if (inputField.value) inputField.value.focus()
  })
}

const focusContinue = () => {
  nextTick(() => {
    if (continueBtn.value) continueBtn.value.focus()
  })
}

const handleEnterKey = (e) => {
  if (showFeedback.value) {
    nextWord()
  } else if (studentInput.value.trim()) {
    checkAnswer()
  }
}

// Typo tolerance checker
const isAcceptableVariant = (student, correct) => {
  if (Math.abs(student.length - correct.length) > 2) return false
  let matches = 0
  for (let i = 0; i < Math.min(student.length, correct.length); i++) {
    if (student[i] === correct[i]) matches++
  }
  return matches / correct.length >= 0.85
}

const checkAnswer = () => {
  if (!activeWord.value) return

  const input = studentInput.value.trim().toLowerCase()
  const correct = activeWord.value.answer.trim().toLowerCase()

  const isCorrect = input === correct || isAcceptableVariant(input, correct)

  showFeedback.value = true
  if (isCorrect) {
    feedbackType.value = 'correct'
    answersMap.value[activeWord.value.id] = studentInput.value.trim()
  } else {
    feedbackType.value = 'incorrect'
    mistakesCount.value[activeWord.value.id] = (mistakesCount.value[activeWord.value.id] || 0) + 1
  }

  focusContinue()
}

const nextWord = () => {
  const current = activeQueue.value.shift()

  if (feedbackType.value === 'correct') {
    masteredCount.value++
  } else {
    // Put back at the end of the queue
    activeQueue.value.push(current)
  }

  studentInput.value = ''
  showFeedback.value = false

  if (activeQueue.value.length === 0) {
    // Completed!
    isCompleted.value = true
    timeSpent.value = Math.round((Date.now() - timeStart.value) / 1000)
    saveState()
  } else {
    focusInput()
  }
}

const saveState = () => {
  emit('update:modelValue', {
    completed: isCompleted.value,
    answersMap: answersMap.value,
    timeSpentSeconds: timeSpent.value,
    mistakes: mistakesCount.value,
    totalWords: totalWords.value
  })
}

const formatTime = (seconds) => {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins === 0) return `${secs}s`
  return `${mins}m ${secs}s`
}

const downloadCertificate = () => {
  const canvas = document.createElement('canvas')
  canvas.width = 800
  canvas.height = 600
  const ctx = canvas.getContext('2d')

  // Background gradient
  const bgGrad = ctx.createLinearGradient(0, 0, 800, 600)
  bgGrad.addColorStop(0, '#0b0f19')
  bgGrad.addColorStop(1, '#1e1b4b')
  ctx.fillStyle = bgGrad
  ctx.fillRect(0, 0, 800, 600)

  // Decorative border
  ctx.strokeStyle = '#d97706' // amber-600
  ctx.lineWidth = 8
  ctx.strokeRect(20, 20, 760, 560)
  ctx.strokeStyle = '#f59e0b' // amber-500
  ctx.lineWidth = 2
  ctx.strokeRect(32, 32, 736, 536)

  // Double thin gold lines in corners
  const drawGoldCorner = (x, y, dx, dy) => {
    ctx.strokeStyle = '#f59e0b'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(x, y + dy * 35)
    ctx.lineTo(x, y)
    ctx.lineTo(x + dx * 35, y)
    ctx.stroke()
  }
  drawGoldCorner(38, 38, 1, 1)
  drawGoldCorner(762, 38, -1, 1)
  drawGoldCorner(38, 562, 1, -1)
  drawGoldCorner(762, 562, -1, -1)

  // Heading
  ctx.fillStyle = '#f59e0b'
  ctx.textAlign = 'center'
  ctx.font = 'bold 36px sans-serif'
  ctx.fillText('VOCABULARY MASTER CERTIFICATE', 400, 100)

  ctx.fillStyle = '#94a3b8'
  ctx.font = '20px sans-serif'
  ctx.fillText('Awarded by LearnFlow', 400, 140)

  // Certificate main text
  ctx.fillStyle = '#f8fafc'
  ctx.font = 'italic 22px serif'
  ctx.fillText('This is proudly presented to', 400, 210)

  // Student Name
  ctx.fillStyle = '#38bdf8'
  ctx.font = 'bold 38px sans-serif'
  ctx.fillText(studentName.value || 'Diligent Student', 400, 260)

  ctx.fillStyle = '#f8fafc'
  ctx.font = '18px sans-serif'
  ctx.fillText('for successfully completing the vocabulary training for:', 400, 310)

  ctx.fillStyle = '#a78bfa'
  ctx.font = 'bold 24px sans-serif'
  ctx.fillText(props.worksheetTitle || 'Interactive Worksheet', 400, 350)

  // Divider
  ctx.strokeStyle = '#334155'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(150, 390)
  ctx.lineTo(650, 390)
  ctx.stroke()

  // Summary header
  ctx.fillStyle = '#f8fafc'
  ctx.font = 'bold 16px sans-serif'
  ctx.fillText('PERFORMANCE SUMMARY', 400, 420)

  // Stats block (left side)
  ctx.textAlign = 'left'
  ctx.font = '15px sans-serif'
  ctx.fillStyle = '#94a3b8'
  ctx.fillText('Words Mastered:', 140, 455)
  ctx.fillStyle = '#f8fafc'
  ctx.fillText(`${totalWords.value}`, 280, 455)

  ctx.fillStyle = '#94a3b8'
  ctx.fillText('Time Spent:', 140, 485)
  ctx.fillStyle = '#f8fafc'
  ctx.fillText(`${formatTime(timeSpent.value)}`, 280, 485)

  // Hard words (right side)
  ctx.fillStyle = '#94a3b8'
  ctx.fillText('Most Challenging Words:', 420, 455)

  ctx.fillStyle = '#fca5a5'
  if (difficultWords.value.length === 0) {
    ctx.fillText('None! Perfect run! 🌟', 420, 485)
  } else {
    difficultWords.value.slice(0, 3).forEach((word, idx) => {
      ctx.fillText(`• ${word.clue} ➔ ${word.answer} (${word.mistakes} retries)`, 420, 485 + idx * 25)
    })
  }

  // Footer / Date
  ctx.textAlign = 'center'
  ctx.fillStyle = '#64748b'
  ctx.font = '13px sans-serif'
  ctx.fillText(`Date: ${new Date().toLocaleDateString()}`, 400, 555)

  // Download trigger
  const dataUrl = canvas.toDataURL('image/png')
  const link = document.createElement('a')
  link.download = `vocabulary_certificate_${props.id}.png`
  link.href = dataUrl
  link.click()
}
</script>

<style scoped>
.vocabulary-exercise {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 24px;
}

.exercise-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.exercise-badge {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  background-color: var(--primary-light);
  color: var(--primary);
  padding: 4px 8px;
  border-radius: 20px;
}

.points {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted);
}

.instruction {
  font-weight: 600;
  margin-bottom: 20px;
  font-size: 15px;
}

.practice-container {
  padding: 24px;
}

.progress-section {
  margin-bottom: 24px;
}

.progress-text {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted);
  margin-bottom: 8px;
}

.progress-bar-container {
  height: 8px;
  background-color: var(--border-color);
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background-color: var(--primary);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.vocab-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  padding: 10px 0;
}

.direction-hint {
  font-size: 13px;
  color: var(--text-muted);
  font-weight: 600;
}

.lang-tag {
  background-color: var(--border-color);
  color: var(--text-main);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  text-transform: uppercase;
  font-weight: 800;
}

.clue-word {
  font-size: 36px;
  font-weight: 800;
  color: var(--text-main);
  font-family: var(--font-title);
  letter-spacing: -0.02em;
  margin: 10px 0;
}

.input-container {
  width: 100%;
  max-width: 400px;
}

.vocab-input {
  text-align: center;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.action-row {
  margin-top: 10px;
}

/* Feedback Messages */
.feedback-msg {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
  border-radius: var(--radius-md);
  width: 100%;
  max-width: 400px;
  text-align: left;
  animation: slideIn 0.25s ease;
}

@keyframes slideIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.feedback-icon {
  font-size: 20px;
}

.feedback-text {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.msg-title {
  font-weight: 700;
  font-size: 14px;
}

.correct-reveal {
  font-size: 14px;
}

.requeue-notice {
  font-size: 11px;
  opacity: 0.8;
  font-style: italic;
}

.feedback-msg.correct {
  background-color: var(--success-light);
  color: var(--success);
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.feedback-msg.incorrect {
  background-color: var(--danger-light);
  color: var(--danger);
  border: 1px solid rgba(239, 68, 68, 0.2);
}

/* Completed Screen */
.completed-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 40px 24px;
}

.celebration-emoji {
  font-size: 64px;
  margin-bottom: 16px;
  animation: bounce 1s infinite alternate;
}

@keyframes bounce {
  from { transform: translateY(0); }
  to { transform: translateY(-10px); }
}

.completed-container h2 {
  font-size: 28px;
  margin-bottom: 8px;
}

.completed-container .subtitle {
  color: var(--text-muted);
  font-size: 15px;
  margin-bottom: 32px;
}

.stats-summary {
  display: flex;
  justify-content: center;
  gap: 16px;
  width: 100%;
  max-width: 500px;
  margin-bottom: 32px;
}

.stat-card {
  flex: 1;
  background-color: var(--bg-main);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.stat-val {
  font-size: 24px;
  font-weight: 800;
  color: var(--primary);
  font-family: var(--font-title);
}

.stat-lbl {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
}

.difficult-words-section {
  width: 100%;
  max-width: 500px;
  text-align: left;
  margin-bottom: 32px;
}

.difficult-words-section h3 {
  font-size: 15px;
  margin-bottom: 12px;
  color: var(--text-muted);
}

.diff-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.diff-item {
  display: flex;
  align-items: center;
  background-color: var(--danger-light);
  border: 1px solid rgba(239, 68, 68, 0.1);
  color: var(--text-main);
  padding: 10px 16px;
  border-radius: var(--radius-sm);
  font-size: 14px;
}

.diff-clue {
  font-weight: 700;
}

.diff-arrow {
  margin: 0 8px;
  opacity: 0.6;
}

.diff-badge {
  margin-left: auto;
  font-size: 11px;
  font-weight: 700;
  background-color: var(--danger);
  color: white;
  padding: 2px 8px;
  border-radius: 20px;
}

.perfect-run-banner {
  background-color: var(--success-light);
  color: var(--success);
  border: 1px solid rgba(16, 185, 129, 0.2);
  padding: 12px 24px;
  border-radius: var(--radius-md);
  font-weight: 700;
  margin-bottom: 32px;
}

.certificate-action {
  margin-top: 8px;
}

.btn-cert {
  font-size: 16px;
  padding: 12px 28px;
}
</style>
