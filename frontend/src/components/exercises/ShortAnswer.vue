<template>
  <div class="exercise-block card" :class="stateClass">
    <div class="exercise-header">
      <h3>📝 Short Answer</h3>
      <span v-if="points" class="points">{{ points }} pts</span>
    </div>
    <p class="prompt">{{ prompt || instruction || 'Write your answer.' }}</p>
    <textarea
      :value="modelValue || ''"
      :disabled="disabled"
      rows="4"
      @input="$emit('update:modelValue', $event.target.value)"
      placeholder="Write your response..."
      aria-label="Short answer response"
    />
    <div v-if="feedback?.aiFeedback" class="feedback-box">
      <p><strong>Punctuation signal:</strong> {{ feedback.aiFeedback.automatedPunctuationSignal }}</p>
      <p><strong>Length signal:</strong> {{ feedback.aiFeedback.automatedLengthSignal }}</p>
      <p><strong>Key points:</strong> {{ feedback.aiFeedback.keyPointsCoverage }}</p>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  prompt: { type: String, default: '' },
  instruction: { type: String, default: '' },
  points: { type: Number, default: 0 },
  disabled: { type: Boolean, default: false },
  feedback: { type: Object, default: null }
})

defineEmits(['update:modelValue'])

const stateClass = computed(() => {
  if (!props.feedback) return ''
  return props.feedback.correct ? 'correct' : 'incorrect'
})
</script>

<style scoped>
.exercise-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
.prompt { color: var(--text-main); margin-bottom: 10px; }
textarea { width: 100%; min-height: 120px; }
.points { font-size: 12px; color: var(--text-muted); }
.feedback-box { margin-top: 10px; background: var(--primary-light); border-radius: var(--radius-sm); padding: 10px; font-size: 13px; }
</style>
