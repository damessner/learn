<template>
  <div class="exercise-card mc-exercise">
    <div class="exercise-header">
      <span class="exercise-badge">Multiple Choice</span>
      <span class="points">{{ points }} pts</span>
    </div>

    <div class="instruction" v-html="instruction"></div>

    <div class="options-container">
      <label 
        v-for="(option, idx) in options" 
        :key="idx"
        class="option-label"
        :class="optionClass(idx)"
      >
        <input 
          type="checkbox" 
          :value="idx" 
          v-model="selectedIndices"
          :disabled="disabled || isGraded"
          class="option-checkbox"
        />
        <span class="option-text">{{ option }}</span>
        
        <!-- Feedback symbols -->
        <span v-if="isGraded" class="feedback-indicator">
          <span v-if="isCorrectOption(idx)" class="symbol-correct">✓</span>
          <span v-else-if="isSelected(idx)" class="symbol-incorrect">✗</span>
        </span>
      </label>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'

const props = defineProps({
  id: String,
  question: String,
  options: Array, // ["I have went", "I have gone", "I went yesterday"]
  correctAnswers: Array, // [1, 2] (from feedback)
  points: Number,
  instruction: {
    type: String,
    default: 'Select all correct answers.'
  },
  modelValue: {
    type: Array,
    default: () => []
  },
  disabled: Boolean,
  feedback: Object
})

const emit = defineEmits(['update:modelValue'])

const selectedIndices = ref([...props.modelValue])

watch(selectedIndices, (newVal) => {
  emit('update:modelValue', newVal)
}, { deep: true })

const isGraded = computed(() => !!props.feedback)

const isSelected = (idx) => selectedIndices.value.includes(idx)

const isCorrectOption = (idx) => {
  return props.correctAnswers && props.correctAnswers.includes(idx)
}

const optionClass = (idx) => {
  if (!isGraded.value) {
    return isSelected(idx) ? 'selected' : ''
  }

  const selected = isSelected(idx)
  const correct = isCorrectOption(idx)

  if (correct) return 'correct'
  if (selected && !correct) return 'incorrect'
  return ''
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
  font-weight: 700;
  margin-bottom: 18px;
  font-size: 16px;
}

.options-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.option-label {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  background-color: var(--bg-main);
  transition: all 0.2s ease;
  min-height: 48px;
  user-select: none;
}

.option-label:hover:not(.disabled) {
  border-color: var(--primary);
  background-color: var(--bg-card);
}

.option-label.selected {
  border-color: var(--primary);
  background-color: var(--primary-light);
}

.option-checkbox {
  width: 20px;
  height: 20px;
  accent-color: var(--primary);
  cursor: pointer;
}

.option-text {
  font-size: 15px;
  font-weight: 500;
  flex-grow: 1;
}

/* Graded States */
.option-label.correct {
  border-color: var(--success);
  background-color: var(--success-light);
  color: var(--success);
}

.option-label.incorrect {
  border-color: var(--danger);
  background-color: var(--danger-light);
  color: var(--danger);
}

.feedback-indicator {
  font-weight: 800;
  font-size: 18px;
}

.symbol-correct {
  color: var(--success);
}

.symbol-incorrect {
  color: var(--danger);
}
</style>
