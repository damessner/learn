<template>
  <div class="video-block">
    <div v-if="embedUrl" class="video-wrapper">
      <iframe
        ref="playerFrame"
        :src="embedUrl"
        class="youtube-iframe"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen
        :title="caption || 'Video'"
      ></iframe>
    </div>
    <div v-else class="video-placeholder">
      <span>🎬</span>
      <p>No valid YouTube URL provided.</p>
    </div>
    <p v-if="caption" class="caption">{{ caption }}</p>

    <div v-if="normalizedQuestions.length > 0" ref="questionsContainer" class="video-questions">
      <h4 class="questions-heading">📋 Questions about this video</h4>
      <div
        v-for="(q, idx) in normalizedQuestions"
        :key="q.id"
        class="video-question-item"
        :data-question-index="idx"
        :class="{ active: activeQuestionIndex === idx }"
      >
        <div class="question-headline">
          <p class="question-text">{{ idx + 1 }}. {{ q.text || defaultQuestionTitle(q.type, idx) }}</p>
          <span class="question-meta" v-if="q.timeSeconds !== null">⏱ {{ formatTime(q.timeSeconds) }}</span>
        </div>

        <div v-if="!disabled && !isQuestionUnlocked(idx)" class="question-locked">
          This question unlocks when the video reaches {{ formatTime(q.timeSeconds) }}.
        </div>

        <template v-else>
          <textarea
            v-if="q.type === 'short_answer'"
            v-model="localAnswers[idx]"
            @input="emitAnswers"
            class="question-textarea"
            :placeholder="q.placeholder || 'Type your answer here...'"
            rows="2"
            :disabled="disabled"
          ></textarea>

          <div v-else-if="q.type === 'single_choice'" class="choice-list">
            <label v-for="(opt, oIdx) in q.options" :key="oIdx" class="choice-row">
              <input
                type="radio"
                :name="`video-q-${q.id}`"
                :checked="Number(localAnswers[idx]) === oIdx"
                :disabled="disabled"
                @change="setSingleChoice(idx, oIdx)"
              />
              <span>{{ opt }}</span>
            </label>
          </div>

          <div v-else-if="q.type === 'multiple_choice'" class="choice-list">
            <label v-for="(opt, oIdx) in q.options" :key="oIdx" class="choice-row">
              <input
                type="checkbox"
                :checked="isMultiChoiceSelected(idx, oIdx)"
                :disabled="disabled"
                @change="toggleMultipleChoice(idx, oIdx)"
              />
              <span>{{ opt }}</span>
            </label>
          </div>

          <div v-else-if="q.type === 'gap_fill'" class="gap-fill-question">
            <p class="gap-preview">{{ q.templatePreview }}</p>
            <div v-for="(gap, gIdx) in q.gaps" :key="gIdx" class="gap-row">
              <span>{{ gIdx + 1 }}.</span>
              <input
                type="text"
                :value="getGapAnswer(idx, gIdx)"
                :disabled="disabled"
                @input="setGapAnswer(idx, gIdx, $event.target.value)"
                placeholder="Fill gap"
              />
            </div>
          </div>

          <div v-if="disabled && feedback?.questions?.[idx]" class="question-feedback" :class="feedback.questions[idx].correct ? 'correct' : 'wrong'">
            {{ feedback.questions[idx].correct ? '✅ Correct' : '❌ Incorrect' }}
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  url: String,
  caption: String,
  questions: {
    type: Array,
    default: () => []
  },
  disabled: {
    type: Boolean,
    default: false
  },
  modelValue: {
    type: Array,
    default: () => []
  },
  feedback: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['update:modelValue'])

const localAnswers = ref(Array.isArray(props.modelValue) ? [...props.modelValue] : [])
const unlockedQuestions = ref(new Set())
const activeQuestionIndex = ref(null)
const playerFrame = ref(null)
const questionsContainer = ref(null)
let pollTimer = null

watch(() => props.modelValue, (val) => {
  if (Array.isArray(val)) localAnswers.value = [...val]
}, { deep: true })

watch(() => props.disabled, (isDisabled) => {
  if (isDisabled) {
    unlockedQuestions.value = new Set(normalizedQuestions.value.map((_, idx) => idx))
  }
})

const emitAnswers = () => {
  emit('update:modelValue', [...localAnswers.value])
}

function extractYouTubeId(url) {
  if (!url) return null
  const shortMatch = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/)
  if (shortMatch) return shortMatch[1]
  const watchMatch = url.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
  if (watchMatch) return watchMatch[1]
  const embedMatch = url.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/)
  if (embedMatch) return embedMatch[1]
  return null
}

const embedUrl = computed(() => {
  const id = extractYouTubeId(props.url)
  if (!id) return null
  const origin = encodeURIComponent(window.location.origin)
  return `https://www.youtube.com/embed/${id}?enablejsapi=1&origin=${origin}&rel=0`
})

const normalizedQuestions = computed(() => {
  return (Array.isArray(props.questions) ? props.questions : []).map((q, idx) => {
    const type = q?.type || 'short_answer'
    const template = q?.template || ''
    const gaps = [...template.matchAll(/\(\(([^)]+)\)\)/g)].map(m => m[1])
    return {
      id: q?.id || `${idx}`,
      text: q?.text || '',
      type,
      options: Array.isArray(q?.options) ? q.options : [],
      timeSeconds: Number.isFinite(Number(q?.timeSeconds)) ? Math.max(0, Number(q.timeSeconds)) : null,
      template,
      templatePreview: template.replace(/\(\([^)]+\)\)/g, '______'),
      gaps
    }
  })
})

const isQuestionUnlocked = (idx) => {
  if (props.disabled) return true
  const q = normalizedQuestions.value[idx]
  if (!q) return true
  if (q.timeSeconds === null) return true
  return unlockedQuestions.value.has(idx)
}

const postPlayerCommand = (func, args = []) => {
  if (!playerFrame.value?.contentWindow) return
  playerFrame.value.contentWindow.postMessage(JSON.stringify({
    event: 'command',
    func,
    args
  }), '*')
}

const requestCurrentTime = () => {
  if (props.disabled) return
  postPlayerCommand('getCurrentTime')
}

const pauseAndFocusQuestion = (idx) => {
  postPlayerCommand('pauseVideo')
  activeQuestionIndex.value = idx
  setTimeout(() => {
    const node = questionsContainer.value?.querySelector(`[data-question-index=\"${idx}\"]`)
    if (node) node.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, 100)
}

const onPlayerMessage = (event) => {
  if (typeof event.data !== 'string' || event.data.indexOf('infoDelivery') === -1) return
  let payload
  try {
    payload = JSON.parse(event.data)
  } catch {
    return
  }
  const currentTime = Number(payload?.info?.currentTime)
  if (!Number.isFinite(currentTime) || props.disabled) return

  normalizedQuestions.value.forEach((q, idx) => {
    if (q.timeSeconds === null) return
    if (unlockedQuestions.value.has(idx)) return
    if (currentTime >= q.timeSeconds) {
      unlockedQuestions.value.add(idx)
      pauseAndFocusQuestion(idx)
    }
  })
}

onMounted(() => {
  if (props.disabled) {
    unlockedQuestions.value = new Set(normalizedQuestions.value.map((_, idx) => idx))
  }
  window.addEventListener('message', onPlayerMessage)
  pollTimer = setInterval(requestCurrentTime, 2000)
})

onUnmounted(() => {
  window.removeEventListener('message', onPlayerMessage)
  if (pollTimer) clearInterval(pollTimer)
})

const formatTime = (secs) => {
  const total = Math.max(0, Number(secs) || 0)
  const m = Math.floor(total / 60)
  const s = Math.floor(total % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

const defaultQuestionTitle = (type, idx) => {
  const labels = {
    short_answer: 'Short answer question',
    single_choice: 'Choose one answer',
    multiple_choice: 'Choose all correct answers',
    gap_fill: 'Fill in the missing words'
  }
  return labels[type] || `Question ${idx + 1}`
}

const setSingleChoice = (qIdx, optionIdx) => {
  localAnswers.value[qIdx] = optionIdx
  emitAnswers()
}

const isMultiChoiceSelected = (qIdx, optionIdx) => {
  const selected = localAnswers.value[qIdx]
  return Array.isArray(selected) ? selected.includes(optionIdx) : false
}

const toggleMultipleChoice = (qIdx, optionIdx) => {
  const selected = Array.isArray(localAnswers.value[qIdx]) ? [...localAnswers.value[qIdx]] : []
  const pos = selected.indexOf(optionIdx)
  if (pos >= 0) selected.splice(pos, 1)
  else selected.push(optionIdx)
  localAnswers.value[qIdx] = selected
  emitAnswers()
}

const getGapAnswer = (qIdx, gIdx) => {
  const value = localAnswers.value[qIdx]
  return Array.isArray(value) ? (value[gIdx] || '') : ''
}

const setGapAnswer = (qIdx, gIdx, value) => {
  const current = Array.isArray(localAnswers.value[qIdx]) ? [...localAnswers.value[qIdx]] : []
  current[gIdx] = value
  localAnswers.value[qIdx] = current
  emitAnswers()
}
</script>

<style scoped>
.video-block {
  margin-bottom: 24px;
}

.video-wrapper {
  position: relative;
  padding-top: 56.25%;
  border-radius: var(--radius-md);
  overflow: hidden;
  border: 1px solid var(--border-color);
  box-shadow: var(--shadow-sm);
  background: #000;
}

.youtube-iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.video-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-muted);
  gap: 8px;
  font-size: 0.9rem;
}

.video-placeholder span {
  font-size: 2rem;
}

.caption {
  font-size: 14px;
  color: var(--text-muted);
  margin-top: 8px;
  font-style: italic;
  text-align: center;
}

.video-questions {
  margin-top: 20px;
  padding: 16px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
}

.questions-heading {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--text-main);
}

.video-question-item {
  margin-bottom: 14px;
  border: 1px solid transparent;
  border-radius: 8px;
  padding: 8px;
}

.video-question-item.active {
  border-color: var(--primary);
  background: rgba(99, 102, 241, 0.08);
}

.question-headline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.question-meta {
  font-size: 12px;
  color: var(--text-muted);
}

.question-text {
  font-size: 0.95rem;
  font-weight: 500;
  margin-bottom: 6px;
  color: var(--text-main);
}

.question-locked {
  font-size: 0.85rem;
  color: var(--text-muted);
  padding: 8px 10px;
  border: 1px dashed var(--border-color);
  border-radius: 6px;
}

.question-textarea,
.gap-row input {
  width: 100%;
  padding: 8px 12px;
  border-radius: 6px;
  border: 1px solid var(--border-color);
  background: var(--bg-card);
  color: var(--text-main);
  font-size: 0.9rem;
  box-sizing: border-box;
}

.choice-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.choice-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.gap-fill-question {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.gap-preview {
  margin: 0;
  font-size: 0.9rem;
}

.gap-row {
  display: flex;
  gap: 8px;
  align-items: center;
}

.question-feedback {
  margin-top: 8px;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 0.85rem;
}

.question-feedback.correct {
  background: rgba(34, 197, 94, 0.12);
  color: #22c55e;
}

.question-feedback.wrong {
  background: rgba(239, 68, 68, 0.12);
  color: #ef4444;
}
</style>
