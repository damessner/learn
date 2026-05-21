<template>
  <div class="exercise-card gap-fill-exercise">
    <div class="exercise-header">
      <span class="exercise-badge">Gap Fill</span>
      <span class="points">{{ points }} pts</span>
    </div>
    
    <div class="instruction" v-math="instruction"></div>

    <div class="gap-text-container">
      <template v-for="(segment, index) in parsedSegments" :key="index">
        <span v-if="segment.type === 'text'" class="text-segment" v-math="segment.content"></span>
        
        <span v-else class="input-segment" :class="segmentClass(segment.gapIndex)">
          <input 
            type="text" 
            v-model="answers[segment.gapIndex]" 
            :disabled="disabled || isGraded"
            :placeholder="isGraded ? '' : '...'"
            :style="{ width: inputWidth(segment.correctLength) }"
            class="gap-input"
          />
          <span v-if="isGraded && !isCorrect(segment.gapIndex)" class="correct-answer-reveal">
            ({{ segment.correctAnswer }})
          </span>
        </span>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed, watch, ref } from 'vue'

const props = defineProps({
  id: String,
  template: String,
  points: Number,
  instruction: {
    type: String,
    default: 'Fill in the blanks with the correct words.'
  },
  modelValue: {
    type: Array,
    default: () => []
  },
  disabled: Boolean,
  feedback: Object // feedback data from submission (if graded)
})

const emit = defineEmits(['update:modelValue'])

const answers = ref([...props.modelValue])

// Parse the template (e.g., "Hello {world}!")
const parsedSegments = computed(() => {
  const segments = []
  const regex = /\{([^}]+)\}/g
  let lastIndex = 0
  let match
  let gapIndex = 0

  while ((match = regex.exec(props.template)) !== null) {
    // Add text segment before the match
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: props.template.substring(lastIndex, match.index)
      })
    }

    // Add input segment
    segments.push({
      type: 'input',
      gapIndex,
      correctAnswer: match[1],
      correctLength: match[1].length
    })

    gapIndex++
    lastIndex = regex.lastIndex
  }

  // Add final text segment
  if (lastIndex < props.template.length) {
    segments.push({
      type: 'text',
      content: props.template.substring(lastIndex)
    })
  }

  return segments
})

// Initialize answers length
watch(parsedSegments, (newSegments) => {
  const gapCount = newSegments.filter(s => s.type === 'input').length
  while (answers.value.length < gapCount) {
    answers.value.push('')
  }
}, { immediate: true })

watch(answers, (newVal) => {
  emit('update:modelValue', newVal)
}, { deep: true })

const isGraded = computed(() => !!props.feedback)

const isCorrect = (gapIdx) => {
  if (!props.feedback || !props.feedback.correctAnswers) return false
  const correctVal = props.feedback.correctAnswers[gapIdx]
  const studentVal = (answers.value[gapIdx] || '').toLowerCase().trim()
  return studentVal === correctVal.toLowerCase().trim()
}

const segmentClass = (gapIdx) => {
  if (!isGraded.value) return ''
  return isCorrect(gapIdx) ? 'correct' : 'incorrect'
}

const inputWidth = (charLength) => {
  return `${Math.max(charLength * 11, 60)}px`
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

.gap-text-container {
  line-height: 2.2;
  font-size: 17px;
}

.text-segment {
  color: var(--text-main);
}

.input-segment {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  position: relative;
  margin: 0 4px;
  vertical-align: middle;
}

.gap-input {
  min-height: 36px;
  padding: 4px 8px;
  text-align: center;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  font-size: 16px;
  font-weight: 600;
  background-color: var(--bg-main);
  transition: all 0.2s ease;
}

.gap-input:focus {
  border-color: var(--primary);
  background-color: var(--bg-card);
}

.input-segment.correct .gap-input {
  background-color: var(--success-light);
  border-color: var(--success);
  color: var(--success);
}

.input-segment.incorrect .gap-input {
  background-color: var(--danger-light);
  border-color: var(--danger);
  color: var(--danger);
  text-decoration: line-through;
}

.correct-answer-reveal {
  font-size: 12px;
  color: var(--success);
  font-weight: 700;
  margin-top: 2px;
}
</style>
