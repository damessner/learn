<template>
  <div class="exercise-card matching-exercise" ref="exerciseRef">
    <div class="exercise-header">
      <span class="exercise-badge">Matching / Connect</span>
      <span class="points">{{ points }} pts</span>
    </div>

    <div class="instruction">{{ instruction }}</div>

    <div class="matching-container" ref="canvasHostRef">
      <!-- SVG Canvas for Lines -->
      <svg class="connections-canvas">
        <line 
          v-for="(line, idx) in drawnLines" 
          :key="idx"
          :x1="line.x1" 
          :y1="line.y1" 
          :x2="line.x2" 
          :y2="line.y2"
          :class="['connection-line', line.statusClass]"
        />
      </svg>

      <!-- Left Column (Static order) -->
      <div class="matching-column left-column">
        <div 
          v-for="(text, idx) in left" 
          :key="'left-' + idx"
          :ref="el => leftRefs[idx] = el"
          class="match-node match-node-left"
          :class="{ 
            'selected': selectedLeft === idx,
            'matched': isLeftMatched(idx),
            'correct': isGraded && isLeftCorrect(idx),
            'incorrect': isGraded && !isLeftCorrect(idx)
          }"
          @click="selectLeftNode(idx)"
        >
          {{ text }}
        </div>
      </div>

      <!-- Right Column (Shuffled order) -->
      <div class="matching-column right-column">
        <div 
          v-for="(text, idx) in right" 
          :key="'right-' + idx"
          :ref="el => rightRefs[idx] = el"
          class="match-node match-node-right"
          :class="{ 
            'selected': selectedRight === idx,
            'matched': isRightMatched(idx),
            'correct': isGraded && isRightCorrect(idx),
            'incorrect': isGraded && !isRightCorrect(idx)
          }"
          @click="selectRightNode(idx)"
        >
          {{ text }}
        </div>
      </div>
    </div>

    <div v-if="isGraded" class="solutions-legend">
      <h4>Correct Connections:</h4>
      <ul>
        <li v-for="(pair, idx) in feedbackPairs" :key="idx">
          <strong>{{ pair[0] }}</strong> connects to <strong>{{ pair[1] }}</strong>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'

const props = defineProps({
  id: String,
  left: Array,   // Left texts in order: ["just", "already", "yet"]
  right: Array,  // Shuffled right texts: ["very recently", "before expected time", "negatives"]
  pairs: Array,  // Original pairs [ ["just", "very recently"] ] (present if graded feedback is active)
  points: Number,
  instruction: {
    type: String,
    default: 'Connect the corresponding items by tapping one from the left and one from the right.'
  },
  modelValue: {
    type: Object,
    default: () => ({}) // Map of leftIndex -> rightIndex
  },
  disabled: Boolean,
  feedback: Object
})

const emit = defineEmits(['update:modelValue'])

const answers = ref({ ...props.modelValue }) // { "0": 1, "1": 0 } where key is leftIdx, val is rightIdx
const selectedLeft = ref(null)
const selectedRight = ref(null)

const leftRefs = ref([])
const rightRefs = ref([])
const exerciseRef = ref(null)
const canvasHostRef = ref(null)
const drawnLines = ref([])
let resizeObserver = null
let redrawRaf = null

const isGraded = computed(() => !!props.feedback)

// Helper to find if left/right are matched
const isLeftMatched = (idx) => answers.value[String(idx)] !== undefined
const isRightMatched = (idx) => Object.values(answers.value).includes(idx)

// Selection actions
const selectLeftNode = (idx) => {
  if (props.disabled || isGraded.value) return
  
  if (selectedLeft.value === idx) {
    selectedLeft.value = null // Deselect
  } else {
    selectedLeft.value = idx
    // If left is already connected, disconnect it first
    if (isLeftMatched(idx)) {
      delete answers.value[String(idx)]
      triggerRedraw()
    }
    checkAndMatch()
  }
}

const selectRightNode = (idx) => {
  if (props.disabled || isGraded.value) return

  if (selectedRight.value === idx) {
    selectedRight.value = null
  } else {
    selectedRight.value = idx
    // If right is already connected, disconnect it
    const connectedLeftKey = Object.keys(answers.value).find(key => answers.value[key] === idx)
    if (connectedLeftKey) {
      delete answers.value[connectedLeftKey]
      triggerRedraw()
    }
    checkAndMatch()
  }
}

const checkAndMatch = () => {
  if (selectedLeft.value !== null && selectedRight.value !== null) {
    answers.value[String(selectedLeft.value)] = selectedRight.value
    selectedLeft.value = null
    selectedRight.value = null
    triggerRedraw()
  }
}

// Draw connection lines on SVG
const calculateLines = () => {
  if (!canvasHostRef.value) return
  const rect = canvasHostRef.value.getBoundingClientRect()
  const lines = []

  for (const [leftIdxStr, rightIdx] of Object.entries(answers.value)) {
    const leftIdx = parseInt(leftIdxStr)
    const leftEl = leftRefs.value[leftIdx]
    const rightEl = rightRefs.value[rightIdx]

    if (leftEl && rightEl) {
      const leftRect = leftEl.getBoundingClientRect()
      const rightRect = rightEl.getBoundingClientRect()

      // Calculate relative coordinates in SVG space
      const x1 = (leftRect.right - rect.left)
      const y1 = (leftRect.top + leftRect.height / 2 - rect.top)
      const x2 = (rightRect.left - rect.left)
      const y2 = (rightRect.top + rightRect.height / 2 - rect.top)

      let statusClass = 'pending'
      if (isGraded.value) {
        statusClass = isLeftCorrect(leftIdx) ? 'correct' : 'incorrect'
      }

      lines.push({ x1, y1, x2, y2, statusClass })
    }
  }
  drawnLines.value = lines
}

const scheduleCalculateLines = () => {
  if (redrawRaf) return
  redrawRaf = requestAnimationFrame(() => {
    redrawRaf = null
    calculateLines()
  })
}

const triggerRedraw = () => {
  nextTick(() => {
    scheduleCalculateLines()
  })
}

// Check grading for nodes
const isLeftCorrect = (leftIdx) => {
  if (!props.feedback || !props.pairs) return false
  const leftText = props.left[leftIdx]
  const rightText = props.right[answers.value[String(leftIdx)]]
  if (!leftText || !rightText) return false
  
  return props.pairs.some(p => p[0] === leftText && p[1] === rightText)
}

const isRightCorrect = (rightIdx) => {
  const leftKey = Object.keys(answers.value).find(key => answers.value[key] === rightIdx)
  if (!leftKey) return false
  return isLeftCorrect(parseInt(leftKey))
}

const feedbackPairs = computed(() => {
  if (props.pairs) return props.pairs
  if (props.feedback && props.feedback.correctAnswers) return props.feedback.correctAnswers
  return []
})

// Listen to windows events for resizing
watch(answers, (newVal) => {
  emit('update:modelValue', newVal)
  triggerRedraw()
}, { deep: true })

onMounted(() => {
  window.addEventListener('resize', scheduleCalculateLines, { passive: true })
  window.addEventListener('scroll', scheduleCalculateLines, { passive: true })
  window.visualViewport?.addEventListener('resize', scheduleCalculateLines, { passive: true })
  window.visualViewport?.addEventListener('scroll', scheduleCalculateLines, { passive: true })
  if (typeof ResizeObserver !== 'undefined') {
    resizeObserver = new ResizeObserver(() => scheduleCalculateLines())
    if (canvasHostRef.value) resizeObserver.observe(canvasHostRef.value)
  }
  triggerRedraw()
})

onUnmounted(() => {
  window.removeEventListener('resize', scheduleCalculateLines)
  window.removeEventListener('scroll', scheduleCalculateLines)
  window.visualViewport?.removeEventListener('resize', scheduleCalculateLines)
  window.visualViewport?.removeEventListener('scroll', scheduleCalculateLines)
  if (resizeObserver) resizeObserver.disconnect()
  if (redrawRaf) cancelAnimationFrame(redrawRaf)
})
</script>

<style scoped>
.exercise-card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 20px;
  margin-bottom: 24px;
  position: relative;
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
  margin-bottom: 24px;
  font-size: 15px;
}

.matching-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 80px; /* Space for the lines */
  position: relative;
  margin-bottom: 20px;
}

.connections-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 5;
}

.connection-line {
  stroke-width: 4;
  stroke-linecap: round;
  transition: stroke 0.3s ease;
}

.connection-line.pending {
  stroke: var(--primary);
  stroke-dasharray: 2, 2;
  animation: lineDash 15s linear infinite;
}

@keyframes lineDash {
  to {
    stroke-dashoffset: -100;
  }
}

.connection-line.correct {
  stroke: var(--success);
}

.connection-line.incorrect {
  stroke: var(--danger);
}

.matching-column {
  display: flex;
  flex-direction: column;
  gap: 16px;
  z-index: 10;
}

.match-node {
  padding: 14px 18px;
  border: 1px solid var(--border-color);
  background-color: var(--bg-main);
  border-radius: var(--radius-md);
  font-weight: 600;
  font-size: 15px;
  cursor: pointer;
  user-select: none;
  min-height: 48px;
  display: flex;
  align-items: center;
  transition: all 0.25s ease;
}

.match-node-left {
  text-align: left;
  justify-content: flex-start;
}

.match-node-right {
  text-align: right;
  justify-content: flex-end;
}

.match-node:hover:not(.disabled) {
  border-color: var(--primary);
  background-color: var(--bg-card);
}

.match-node.selected {
  border-color: var(--primary);
  background-color: var(--primary-light);
  color: var(--primary);
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.2);
}

.match-node.matched {
  background-color: var(--bg-card);
  border-color: var(--border-color);
}

.match-node.correct {
  border-color: var(--success);
  background-color: var(--success-light);
  color: var(--success);
}

.match-node.incorrect {
  border-color: var(--danger);
  background-color: var(--danger-light);
  color: var(--danger);
}

.solutions-legend {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid var(--border-color);
}

.solutions-legend h4 {
  font-size: 14px;
  margin-bottom: 8px;
  color: var(--text-muted);
}

.solutions-legend ul {
  list-style: none;
  font-size: 14px;
}

.solutions-legend li {
  margin-bottom: 4px;
}
</style>
