<template>
  <div class="exercise-card word-scramble-exercise">
    <div class="exercise-header">
      <span class="exercise-badge">Word Scramble (Spelling Phase)</span>
      <span class="points">{{ points }} pts</span>
    </div>

    <div class="instruction">{{ instruction }}</div>

    <div class="scramble-list">
      <div 
        v-for="(item, idx) in words" 
        :key="idx"
        class="scramble-item card glass"
        :class="{
          'correct': isGraded && isCorrect(idx),
          'incorrect': isGraded && !isCorrect(idx)
        }"
      >
        <div class="scramble-content">
          <div class="clue" v-if="item.clue">{{ item.clue }}</div>
          <div class="scrambled-letters">
            <span v-for="(letter, lIdx) in getScrambled(item.word, idx)" :key="lIdx" class="letter-tile">
              {{ letter }}
            </span>
          </div>
        </div>
        
        <div class="scramble-input-container">
          <input 
            type="text" 
            v-model="answers[idx]" 
            :disabled="disabled || isGraded"
            placeholder="Unscramble..."
            class="scramble-input"
          />
          <div v-if="isGraded && !isCorrect(idx)" class="correct-answer">
            {{ item.word }}
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
  words: {
    type: Array, // [{ word: 'apple', clue: 'A red fruit' }]
    default: () => []
  },
  points: Number,
  instruction: {
    type: String,
    default: 'Unscramble the letters to form the correct word.'
  },
  modelValue: {
    type: Object,
    default: () => ({}) // { "0": "apple" }
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

// Cache scrambled words so they don't jump around on re-render
const scrambledCache = ref({})

const getScrambled = (word, idx) => {
  if (scrambledCache.value[idx]) return scrambledCache.value[idx]

  let arr = word.split('')
  // Simple Fisher-Yates shuffle
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  
  // Make sure it's actually scrambled (if length > 3)
  if (arr.join('') === word && word.length > 3) {
    // Just swap first two
    [arr[0], arr[1]] = [arr[1], arr[0]]
  }

  scrambledCache.value[idx] = arr
  return arr
}

const isCorrect = (idx) => {
  if (!props.feedback || !props.feedback.correctAnswers) return false
  const correct = props.feedback.correctAnswers[idx]
  const student = answers.value[idx] || ''
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
.scramble-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.scramble-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  flex-wrap: wrap;
  gap: 16px;
}
.scramble-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.clue {
  font-size: 12px;
  color: var(--text-muted);
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.05em;
}
.scrambled-letters {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.letter-tile {
  background-color: var(--bg-main);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  width: 36px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 18px;
  text-transform: uppercase;
  box-shadow: var(--shadow-sm);
  color: var(--primary);
}
.scramble-input-container {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-end;
  flex: 1;
  min-width: 200px;
}
.scramble-input {
  width: 100%;
  max-width: 300px;
  font-size: 18px;
  padding: 10px 16px;
  border-radius: var(--radius-md);
  border: 2px dashed var(--border-color);
  text-align: center;
  font-weight: bold;
  letter-spacing: 0.1em;
  background-color: var(--bg-main);
  transition: all 0.2s ease;
}
.scramble-input:focus {
  border-color: var(--primary);
  border-style: solid;
  background-color: var(--bg-card);
}
.scramble-item.correct {
  background-color: var(--success-light);
  border-color: var(--success);
}
.scramble-item.correct .scramble-input {
  background-color: transparent;
  border-color: var(--success);
  color: var(--success);
}
.scramble-item.incorrect {
  background-color: var(--danger-light);
  border-color: var(--danger);
}
.scramble-item.incorrect .scramble-input {
  background-color: transparent;
  border-color: var(--danger);
  color: var(--danger);
  text-decoration: line-through;
}
.correct-answer {
  font-size: 14px;
  font-weight: bold;
  color: var(--success);
}
</style>
