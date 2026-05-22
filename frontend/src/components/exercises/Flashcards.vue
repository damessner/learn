<template>
  <div class="exercise-card flashcards-exercise">
    <div class="exercise-header">
      <span class="exercise-badge">Flashcards (Study Phase)</span>
      <span class="points">Practice Only</span>
    </div>

    <div class="instruction">{{ instruction }}</div>

    <div v-if="!isCompleted" class="flashcard-container">
      <div class="progress-bar-container mb-3">
        <div class="progress-bar-fill" :style="{ width: `${progressPercentage}%` }"></div>
      </div>
      <div class="progress-text mb-3">
        {{ masteredCount }} / {{ totalCount }} mastered
      </div>

      <!-- Card -->
      <div 
        class="flashcard" 
        :class="{ 'is-flipped': isFlipped }"
        @click="flipCard"
      >
        <div class="flashcard-inner">
          <div class="flashcard-front card glass">
            <span class="side-label">Front</span>
            <h2>{{ activeCard.l }}</h2>
            <div class="flip-hint">Click to flip</div>
          </div>
          <div class="flashcard-back card glass">
            <span class="side-label">Back</span>
            <h2>{{ activeCard.r }}</h2>
            <div class="flip-hint">Click to flip back</div>
          </div>
        </div>
      </div>

      <!-- Controls -->
      <div class="controls mt-4" :class="{ 'visible': isFlipped }">
        <button @click.stop="markPractice" class="btn btn-danger btn-lg">Needs Practice 🔄</button>
        <button @click.stop="markGotIt" class="btn btn-success btn-lg">Got It! ✅</button>
      </div>
    </div>

    <div v-else class="completed-state card glass">
      <div class="celebration-emoji">🌟</div>
      <h2>Study Session Complete!</h2>
      <p>You have reviewed all flashcards.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  id: String,
  pairs: {
    type: Array,
    default: () => []
  },
  instruction: {
    type: String,
    default: 'Review these vocabulary words. Flip the card to see the translation.'
  },
  modelValue: Object,
  feedback: Object
})

const emit = defineEmits(['update:modelValue'])

const queue = ref([])
const masteredCount = ref(0)
const isFlipped = ref(false)
const isCompleted = ref(false)

const totalCount = computed(() => props.pairs.length)
const progressPercentage = computed(() => {
  if (totalCount.value === 0) return 0
  return Math.round((masteredCount.value / totalCount.value) * 100)
})

const activeCard = computed(() => queue.value[0] || {})

onMounted(() => {
  // Initialize queue
  if (props.pairs && props.pairs.length > 0) {
    queue.value = [...props.pairs]
  } else {
    isCompleted.value = true
  }
})

const flipCard = () => {
  isFlipped.value = !isFlipped.value
}

const markGotIt = () => {
  isFlipped.value = false
  setTimeout(() => {
    queue.value.shift()
    masteredCount.value++
    if (queue.value.length === 0) {
      isCompleted.value = true
      emit('update:modelValue', { completed: true })
    }
  }, 150)
}

const markPractice = () => {
  isFlipped.value = false
  setTimeout(() => {
    const card = queue.value.shift()
    queue.value.push(card) // Put back at the end
  }, 150)
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
.instruction {
  font-weight: 600;
  margin-bottom: 20px;
  font-size: 15px;
}
.flashcard-container {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.progress-bar-container {
  width: 100%;
  max-width: 400px;
  height: 8px;
  background-color: var(--border-color);
  border-radius: 4px;
  overflow: hidden;
}
.progress-bar-fill {
  height: 100%;
  background-color: var(--primary);
  transition: width 0.3s ease;
}
.progress-text {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted);
}
.flashcard {
  width: 100%;
  max-width: 400px;
  height: 250px;
  perspective: 1000px;
  cursor: pointer;
}
.flashcard-inner {
  position: relative;
  width: 100%;
  height: 100%;
  text-align: center;
  transition: transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1);
  transform-style: preserve-3d;
}
.flashcard.is-flipped .flashcard-inner {
  transform: rotateY(180deg);
}
.flashcard-front, .flashcard-back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  border: 2px solid var(--primary-light);
  box-shadow: var(--shadow-md);
}
.flashcard-back {
  transform: rotateY(180deg);
  background: linear-gradient(135deg, var(--bg-card) 0%, var(--primary-light) 100%);
  border-color: var(--primary);
}
.side-label {
  position: absolute;
  top: 10px;
  left: 10px;
  font-size: 10px;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--text-muted);
}
.flip-hint {
  position: absolute;
  bottom: 15px;
  font-size: 12px;
  color: var(--text-muted);
  opacity: 0.7;
}
.flashcard h2 {
  font-size: 32px;
  margin: 0;
  color: var(--text-main);
  word-break: break-word;
}
.controls {
  display: flex;
  gap: 16px;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease;
}
.controls.visible {
  opacity: 1;
  pointer-events: auto;
}
.btn-lg {
  padding: 12px 24px;
  font-size: 16px;
  font-weight: bold;
}
.completed-state {
  text-align: center;
  padding: 40px;
}
.celebration-emoji {
  font-size: 64px;
  margin-bottom: 16px;
}
</style>
