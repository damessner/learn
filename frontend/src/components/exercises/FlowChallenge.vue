<template>
  <div class="exercise-card flow-challenge-exercise">
    <div class="exercise-header">
      <span class="exercise-badge">Flow Challenge (Fluency Phase)</span>
      <span class="points">Survival Game</span>
    </div>

    <div class="instruction">{{ instruction }}</div>

    <div v-if="gameState === 'start'" class="game-start card glass">
      <h3>Ready for the Flow Challenge?</h3>
      <p>Words will appear on screen. You must select the correct translation before time runs out. The faster you are, the higher your score!</p>
      <button @click="startGame" class="btn btn-primary btn-lg mt-3">Start Challenge 🚀</button>
    </div>

    <div v-else-if="gameState === 'playing'" class="game-playing">
      <!-- Timer Bar -->
      <div class="timer-bar-container">
        <div class="timer-bar-fill" :style="{ width: `${(timeLeft / maxTime) * 100}%`, backgroundColor: timerColor }"></div>
      </div>
      <div class="score-display">
        Score: <strong>{{ score }}</strong> | Streak: <strong>{{ streak }}🔥</strong>
      </div>

      <div class="challenge-card card glass">
        <div class="target-word">{{ currentWord.l }}</div>
        
        <div class="options-grid">
          <button 
            v-for="(opt, idx) in currentOptions" 
            :key="idx"
            class="btn-option"
            :class="{
              'correct': selectedOption === opt && isCorrectOption(opt),
              'incorrect': selectedOption === opt && !isCorrectOption(opt)
            }"
            @click="selectOption(opt)"
            :disabled="selectedOption !== null"
          >
            {{ opt }}
          </button>
        </div>
      </div>
    </div>

    <div v-else-if="gameState === 'gameover'" class="game-over card glass">
      <div class="celebration-emoji">{{ score > 10 ? '🔥' : '💥' }}</div>
      <h2>{{ timeLeft <= 0 ? 'Time\'s Up!' : 'Challenge Completed!' }}</h2>
      <p>Final Score: <strong>{{ score }}</strong></p>
      <p>Max Streak: <strong>{{ maxStreak }}</strong></p>
      <button @click="startGame" class="btn btn-secondary mt-3">Play Again 🔄</button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'

const props = defineProps({
  id: String,
  pairs: {
    type: Array, // [{l: 'apple', r: 'Apfel'}, ...]
    default: () => []
  },
  instruction: {
    type: String,
    default: 'Test your fluency. Choose the correct translation before the timer runs out.'
  },
  modelValue: Object,
  feedback: Object
})

const emit = defineEmits(['update:modelValue'])

const gameState = ref('start') // start, playing, gameover
const score = ref(0)
const streak = ref(0)
const maxStreak = ref(0)
const maxTime = 10000 // 10 seconds max
const timeLeft = ref(maxTime)
let timerInterval = null

const currentWordIndex = ref(0)
const currentOptions = ref([])
const selectedOption = ref(null)

const shuffledPairs = ref([])

const startGame = () => {
  score.value = 0
  streak.value = 0
  maxStreak.value = 0
  timeLeft.value = 5000 // start with 5 seconds
  gameState.value = 'playing'
  
  // Shuffle words for this run
  shuffledPairs.value = [...props.pairs].sort(() => 0.5 - Math.random())
  currentWordIndex.value = 0
  
  setupNextWord()
  
  clearInterval(timerInterval)
  timerInterval = setInterval(() => {
    timeLeft.value -= 100 // tick every 100ms
    if (timeLeft.value <= 0) {
      endGame()
    }
  }, 100)
}

const currentWord = computed(() => {
  if (shuffledPairs.value.length === 0) return {}
  return shuffledPairs.value[currentWordIndex.value] || {}
})

const setupNextWord = () => {
  if (currentWordIndex.value >= shuffledPairs.value.length) {
    // If we run out of words, shuffle and keep going (endless survival mode)
    shuffledPairs.value = [...props.pairs].sort(() => 0.5 - Math.random())
    currentWordIndex.value = 0
  }

  const correct = currentWord.value.r
  
  // Pick 3 random distractors
  const distractors = props.pairs
    .map(p => p.r)
    .filter(r => r !== correct)
    .sort(() => 0.5 - Math.random())
    .slice(0, 3)
    
  let options = [correct, ...distractors]
  // If not enough distractors (small list), pad with dummy
  while (options.length < 4) {
    options.push('---')
  }
  
  currentOptions.value = options.sort(() => 0.5 - Math.random())
  selectedOption.value = null
}

const isCorrectOption = (opt) => opt === currentWord.value.r

const selectOption = (opt) => {
  selectedOption.value = opt
  
  if (isCorrectOption(opt)) {
    // Correct
    score.value += 10 + streak.value
    streak.value++
    if (streak.value > maxStreak.value) maxStreak.value = streak.value
    // Add time (adaptive: less time added if streak is high)
    const timeToAdd = Math.max(1000, 3000 - (streak.value * 200))
    timeLeft.value = Math.min(maxTime, timeLeft.value + timeToAdd)
    
    setTimeout(() => {
      currentWordIndex.value++
      setupNextWord()
    }, 400)
  } else {
    // Incorrect
    streak.value = 0
    timeLeft.value = Math.max(0, timeLeft.value - 2000) // Penalty
    setTimeout(() => {
      currentWordIndex.value++
      setupNextWord()
    }, 800)
  }
}

const endGame = () => {
  clearInterval(timerInterval)
  gameState.value = 'gameover'
  emit('update:modelValue', { score: score.value, maxStreak: maxStreak.value })
}

const timerColor = computed(() => {
  const pct = timeLeft.value / maxTime
  if (pct > 0.5) return 'var(--success)'
  if (pct > 0.25) return 'var(--warning, #f59e0b)'
  return 'var(--danger)'
})

onUnmounted(() => {
  clearInterval(timerInterval)
})
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
.game-start, .game-over {
  text-align: center;
  padding: 40px 20px;
}
.celebration-emoji {
  font-size: 64px;
  margin-bottom: 16px;
}
.timer-bar-container {
  height: 12px;
  background-color: var(--border-color);
  border-radius: 6px;
  overflow: hidden;
  margin-bottom: 16px;
}
.timer-bar-fill {
  height: 100%;
  transition: width 0.1s linear, background-color 0.3s ease;
}
.score-display {
  display: flex;
  justify-content: space-between;
  font-size: 16px;
  margin-bottom: 20px;
}
.challenge-card {
  padding: 30px;
  text-align: center;
  border: 2px solid var(--primary-light);
}
.target-word {
  font-size: 42px;
  font-weight: 800;
  color: var(--text-main);
  margin-bottom: 30px;
}
.options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.btn-option {
  padding: 16px;
  font-size: 18px;
  font-weight: bold;
  background-color: var(--bg-main);
  border: 2px solid var(--border-color);
  border-radius: var(--radius-md);
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-option:hover:not(:disabled) {
  border-color: var(--primary);
  background-color: var(--primary-light);
}
.btn-option:disabled {
  cursor: default;
}
.btn-option.correct {
  background-color: var(--success);
  border-color: var(--success);
  color: white;
}
.btn-option.incorrect {
  background-color: var(--danger);
  border-color: var(--danger);
  color: white;
}
</style>
