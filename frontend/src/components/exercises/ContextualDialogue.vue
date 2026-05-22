<template>
  <div class="exercise-card contextual-dialogue-exercise">
    <div class="exercise-header">
      <span class="exercise-badge">Contextual Dialogue (Episodic Phase)</span>
      <span class="points">{{ points }} pts</span>
    </div>

    <div class="instruction">{{ instruction }}</div>

    <div class="chat-container">
      <div 
        v-for="(msg, index) in messages" 
        :key="index"
        class="chat-bubble"
        :class="[msg.sender === 'student' ? 'bubble-right' : 'bubble-left']"
      >
        <!-- If it's a normal message -->
        <div v-if="!msg.isGap" class="bubble-text" v-math="msg.text"></div>

        <!-- If it has a gap to fill -->
        <div v-else class="bubble-text gap-bubble">
          <span>{{ msg.textBefore }}</span>
          <input 
            type="text" 
            v-model="answers[index]"
            :disabled="disabled || isGraded"
            class="chat-gap-input"
            :class="{
              'correct': isGraded && isCorrect(index),
              'incorrect': isGraded && !isCorrect(index)
            }"
          />
          <span>{{ msg.textAfter }}</span>
          <div v-if="isGraded && !isCorrect(index)" class="chat-correct-reveal">
            ({{ msg.answer }})
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'

const props = defineProps({
  id: String,
  messages: {
    type: Array, // [{ sender: 'teacher', text: 'Hello!' }, { sender: 'student', isGap: true, textBefore: 'Hi, I am ', textAfter: '.', answer: 'good' }]
    default: () => []
  },
  points: Number,
  instruction: {
    type: String,
    default: 'Complete the conversation by filling in the missing words.'
  },
  modelValue: {
    type: Object,
    default: () => ({}) // { "1": "good" }
  },
  disabled: Boolean,
  feedback: Object
})

const emit = defineEmits(['update:modelValue'])

const answers = ref({ ...props.modelValue })
const isGraded = computed(() => !!props.feedback)

watch(answers, (newVal) => {
  emit('update:modelValue', newVal)
}, { deep: true })

const isCorrect = (index) => {
  if (!props.feedback || !props.feedback.correctAnswers) return false
  const correct = props.feedback.correctAnswers[index]
  const student = answers.value[index] || ''
  return student.trim().toLowerCase() === correct.trim().toLowerCase()
}
</script>

<style scoped>
.exercise-card {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 24px;
  margin-bottom: 24px;
}
.exercise-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
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
.instruction {
  font-weight: 600;
  margin-bottom: 20px;
  font-size: 15px;
}
.chat-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  background-color: var(--bg-main);
  padding: 20px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  max-width: 600px;
  margin: 0 auto;
}
.chat-bubble {
  max-width: 80%;
  padding: 12px 16px;
  border-radius: 20px;
  font-size: 15px;
  line-height: 1.5;
  box-shadow: var(--shadow-sm);
  position: relative;
}
.bubble-left {
  align-self: flex-start;
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-bottom-left-radius: 4px;
  color: var(--text-main);
}
.bubble-right {
  align-self: flex-end;
  background-color: var(--primary);
  color: white;
  border-bottom-right-radius: 4px;
}
.gap-bubble {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}
.chat-gap-input {
  background-color: rgba(255, 255, 255, 0.9);
  border: none;
  border-radius: 12px;
  padding: 4px 10px;
  font-weight: bold;
  color: #333;
  width: 120px;
  text-align: center;
  font-size: 14px;
}
.chat-gap-input:focus {
  outline: 2px solid #fff;
  background-color: #fff;
}
.chat-gap-input.correct {
  background-color: var(--success);
  color: white;
}
.chat-gap-input.incorrect {
  background-color: var(--danger);
  color: white;
  text-decoration: line-through;
}
.chat-correct-reveal {
  font-size: 12px;
  font-weight: bold;
  color: #a7f3d0; /* light emerald */
  margin-left: 4px;
}
.bubble-left .chat-correct-reveal {
  color: var(--success);
}
</style>
