<template>
  <div class="exercise-card drag-drop-exercise">
    <div class="exercise-header">
      <span class="exercise-badge">Drag & Drop</span>
      <span class="points">{{ points }} pts</span>
    </div>

    <div class="instruction">{{ instruction }}</div>

    <!-- Draggable/Clickable items bank -->
    <div class="items-bank">
      <div 
        v-for="(item, idx) in availableItems" 
        :key="idx"
        class="drag-card"
        :class="{ 'selected': selectedItemIdx === idx, 'used': isItemUsed(item) }"
        @click="selectItem(idx)"
        draggable="true"
        @dragstart="onDragStart($event, item)"
      >
        {{ item }}
      </div>
    </div>

    <!-- Targets container -->
    <div class="targets-container">
      <div 
        v-for="(targetText, targetIdx) in targets" 
        :key="targetIdx" 
        class="target-row"
      >
        <span class="target-sentence-part">{{ splitTarget(targetText).before }}</span>
        
        <div 
          class="drop-zone"
          :class="{ 
            'active': selectedItemIdx !== null,
            'has-item': answers[targetIdx],
            'correct': isGraded && isTargetCorrect(targetIdx),
            'incorrect': isGraded && !isTargetCorrect(targetIdx)
          }"
          @click="placeSelectedItem(targetIdx)"
          @dragover.prevent
          @drop="onDrop($event, targetIdx)"
        >
          <span v-if="answers[targetIdx]" class="placed-item">
            {{ answers[targetIdx] }}
            <button 
              v-if="!disabled && !isGraded" 
              @click.stop="removePlacedItem(targetIdx)" 
              class="btn-remove"
            >
              ×
            </button>
          </span>
          <span v-else class="drop-placeholder">Drop here</span>
        </div>

        <span class="target-sentence-part">{{ splitTarget(targetText).after }}</span>
        
        <span v-if="isGraded && !isTargetCorrect(targetIdx)" class="correct-solution">
          (Correct: {{ getCorrectAnswerForTarget(targetIdx) }})
        </span>
      </div>
    </div>
    <div v-if="isGraded && explanation" class="explanation-box">
      <strong>Explanation:</strong> {{ explanation }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  id: String,
  items: Array,    // Shuffled items: ["have", "has", "had"]
  targets: Array,  // Targets like: ["___ you eaten?", "She ___ left."]
  correctAnswers: Object, // The correct keys: { "0": "have", "1": "has" } (from backend feedback if graded)
  points: Number,
  instruction: {
    type: String,
    default: 'Drag words into the correct gaps, or click a word then click a gap to place it.'
  },
  modelValue: {
    type: Object,
    default: () => ({}) // e.g. { "0": "have", "1": "has" }
  },
  disabled: Boolean,
  feedback: Object,
  explanation: String
})

const emit = defineEmits(['update:modelValue'])

const answers = ref({ ...props.modelValue })
const selectedItemIdx = ref(null)

const availableItems = computed(() => props.items || [])

const isItemUsed = (item) => {
  return Object.values(answers.value).includes(item)
}

watch(answers, (newVal) => {
  emit('update:modelValue', newVal)
}, { deep: true })

// Helper to parse sentences like "((drop zone)) you eaten?" into before/after the gap
const splitTarget = (targetText) => {
  const match = targetText.match(/^(.*?)\(\(([^)]+)\)\)(.*)$/s)
  if (match) {
    return { before: match[1] || '', after: match[3] || '' }
  }
  // Fallback: whole text as before
  return { before: targetText, after: '' }
}

// Tap-to-Place functionality (highly friendly for iPad touch)
const selectItem = (idx) => {
  if (props.disabled || isGraded.value) return
  if (isItemUsed(availableItems.value[idx])) return
  
  if (selectedItemIdx.value === idx) {
    selectedItemIdx.value = null // Toggle off
  } else {
    selectedItemIdx.value = idx
  }
}

const placeSelectedItem = (targetIdx) => {
  if (props.disabled || isGraded.value) return
  
  if (selectedItemIdx.value !== null) {
    const item = availableItems.value[selectedItemIdx.value]
    // If target already has an item, it'll get replaced/returned to bank
    answers.value[targetIdx] = item
    selectedItemIdx.value = null
  }
}

const removePlacedItem = (targetIdx) => {
  if (props.disabled || isGraded.value) return
  delete answers.value[targetIdx]
}

// HTML5 Drag and Drop fallback support
const onDragStart = (event, item) => {
  if (props.disabled || isGraded.value) return
  event.dataTransfer.setData('text/plain', item)
}

const onDrop = (event, targetIdx) => {
  if (props.disabled || isGraded.value) return
  const item = event.dataTransfer.getData('text/plain')
  if (item && availableItems.value.includes(item)) {
    answers.value[targetIdx] = item
  }
}

// Grading state
const isGraded = computed(() => !!props.feedback)

const isTargetCorrect = (targetIdx) => {
  if (!props.feedback || !props.correctAnswers) return false
  const correct = props.correctAnswers[targetIdx]
  const student = answers.value[targetIdx]
  return (student || '').toLowerCase() === (correct || '').toLowerCase()
}

const getCorrectAnswerForTarget = (targetIdx) => {
  return props.correctAnswers ? props.correctAnswers[targetIdx] : ''
}
</script>

<style scoped>
.exercise-card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 20px;
  margin-bottom: 24px;
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
  margin-bottom: 16px;
  font-size: 15px;
}

.items-bank {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 12px;
  background-color: var(--bg-main);
  border-radius: var(--radius-md);
  margin-bottom: 20px;
  border: 1px dashed var(--border-color);
}

.drag-card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  padding: 8px 16px;
  font-weight: 600;
  cursor: pointer;
  user-select: none;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
  min-height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.drag-card.selected {
  border-color: var(--primary);
  background-color: var(--primary-light);
  color: var(--primary);
  transform: scale(1.05);
}

.drag-card.used {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

.targets-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.target-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  font-size: 16px;
  line-height: 2;
}

.drop-zone {
  min-width: 100px;
  min-height: 38px;
  border: 2px dashed var(--border-color);
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px 10px;
  background-color: var(--bg-main);
  cursor: pointer;
  transition: all 0.2s ease;
}

.drop-zone.active {
  border-color: var(--primary);
  background-color: var(--primary-light);
}

.drop-zone.has-item {
  border-style: solid;
  background-color: var(--bg-card);
}

.placed-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
  color: var(--primary);
}

.btn-remove {
  background: none;
  border: none;
  font-size: 16px;
  color: var(--text-muted);
  cursor: pointer;
  font-weight: 700;
  padding: 0 4px;
  min-height: auto;
  box-shadow: none;
}

.btn-remove:hover {
  color: var(--danger);
}

.drop-placeholder {
  font-size: 12px;
  color: var(--text-muted);
}

.drop-zone.correct {
  border-color: var(--success);
  background-color: var(--success-light);
}

.drop-zone.correct .placed-item {
  color: var(--success);
}

.drop-zone.incorrect {
  border-color: var(--danger);
  background-color: var(--danger-light);
}

.drop-zone.incorrect .placed-item {
  color: var(--danger);
  text-decoration: line-through;
}

.correct-solution {
  font-size: 13px;
  color: var(--success);
  font-weight: 700;
}
</style>
