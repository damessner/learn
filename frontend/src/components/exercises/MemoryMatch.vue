<template>
  <div class="exercise-card memory-match-exercise">
    <div class="exercise-header">
      <span class="exercise-badge">Memory Match (Game Phase)</span>
      <span class="points">Play to win</span>
    </div>

    <div class="instruction">{{ instruction }}</div>

    <div v-if="!isCompleted" class="game-board">
      <div class="stats mb-3">
        <span class="attempts">Attempts: <strong>{{ attempts }}</strong></span>
        <span class="matches">Matches: <strong>{{ matchedPairs }} / {{ totalPairs }}</strong></span>
      </div>

      <div class="cards-grid">
        <div 
          v-for="(card, index) in deck" 
          :key="card.uniqueId"
          class="memory-card"
          :class="{ 
            'is-flipped': card.isFlipped || card.isMatched,
            'is-matched': card.isMatched,
            'is-mismatched': card.isMismatched
          }"
          @click="flipCard(index)"
        >
          <div class="memory-card-inner">
            <div class="memory-card-front card glass">
              <!-- Back of card (hidden face down) -->
              <span>❓</span>
            </div>
            <div class="memory-card-back card glass">
              <!-- Front of card (revealed text) -->
              <span class="card-text">{{ card.text }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="completed-state card glass">
      <div class="celebration-emoji">🏆</div>
      <h2>Game Complete!</h2>
      <p>You matched all {{ totalPairs }} pairs in {{ attempts }} attempts.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'

const props = defineProps({
  id: String,
  pairs: {
    type: Array, // [{l: 'apple', r: 'Apfel'}, ...]
    default: () => []
  },
  instruction: {
    type: String,
    default: 'Find all matching pairs. Tap two cards to reveal them.'
  },
  modelValue: Object,
  feedback: Object
})

const emit = defineEmits(['update:modelValue'])

const deck = ref([])
const attempts = ref(0)
const matchedPairs = ref(0)
const flippedIndices = ref([])
const isLocked = ref(false)

const totalPairs = computed(() => props.pairs.length)
const isCompleted = computed(() => matchedPairs.value > 0 && matchedPairs.value === totalPairs.value)

onMounted(() => {
  if (props.feedback && props.feedback.completed) {
    matchedPairs.value = totalPairs.value
    return
  }
  initGame()
})

const initGame = () => {
  const cards = []
  props.pairs.forEach((pair, index) => {
    cards.push({ text: pair.l, pairId: index, uniqueId: `l_${index}`, isFlipped: false, isMatched: false, isMismatched: false })
    cards.push({ text: pair.r, pairId: index, uniqueId: `r_${index}`, isFlipped: false, isMatched: false, isMismatched: false })
  })

  // Shuffle
  for (let i = cards.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [cards[i], cards[j]] = [cards[j], cards[i]];
  }

  deck.value = cards
}

const flipCard = (index) => {
  if (isLocked.value) return
  const card = deck.value[index]
  if (card.isFlipped || card.isMatched) return

  card.isFlipped = true
  flippedIndices.value.push(index)

  if (flippedIndices.value.length === 2) {
    checkMatch()
  }
}

const checkMatch = () => {
  isLocked.value = true
  attempts.value++
  
  const [idx1, idx2] = flippedIndices.value
  const card1 = deck.value[idx1]
  const card2 = deck.value[idx2]

  if (card1.pairId === card2.pairId) {
    // Match
    card1.isMatched = true
    card2.isMatched = true
    matchedPairs.value++
    flippedIndices.value = []
    isLocked.value = false

    if (matchedPairs.value === totalPairs.value) {
      emit('update:modelValue', { completed: true, attempts: attempts.value })
    }
  } else {
    // No match
    card1.isMismatched = true
    card2.isMismatched = true
    setTimeout(() => {
      card1.isFlipped = false
      card2.isFlipped = false
      card1.isMismatched = false
      card2.isMismatched = false
      flippedIndices.value = []
      isLocked.value = false
    }, 1000)
  }
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
.stats {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
  color: var(--text-muted);
}
.cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
  perspective: 1000px;
}
.memory-card {
  height: 120px;
  cursor: pointer;
}
.memory-card-inner {
  position: relative;
  width: 100%;
  height: 100%;
  text-align: center;
  transition: transform 0.5s cubic-bezier(0.4, 0.2, 0.2, 1);
  transform-style: preserve-3d;
}
.memory-card.is-flipped .memory-card-inner {
  transform: rotateY(180deg);
}
.memory-card-front, .memory-card-back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px solid var(--border-color);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-sm);
}
.memory-card-front {
  background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
  font-size: 32px;
}
.memory-card-back {
  transform: rotateY(180deg);
  background-color: var(--bg-main);
  padding: 8px;
}
.card-text {
  font-weight: bold;
  font-size: 14px;
  word-break: break-word;
}
.memory-card.is-matched .memory-card-back {
  background-color: var(--success-light);
  border-color: var(--success);
  color: var(--success);
  box-shadow: 0 0 10px rgba(16, 185, 129, 0.3);
}
.memory-card.is-mismatched .memory-card-back {
  background-color: var(--danger-light);
  border-color: var(--danger);
  animation: shake 0.4s;
}
@keyframes shake {
  0% { transform: rotateY(180deg) translateX(0); }
  25% { transform: rotateY(180deg) translateX(5px); }
  50% { transform: rotateY(180deg) translateX(-5px); }
  75% { transform: rotateY(180deg) translateX(5px); }
  100% { transform: rotateY(180deg) translateX(0); }
}
.completed-state {
  text-align: center;
  padding: 40px;
}
.celebration-emoji {
  font-size: 64px;
  margin-bottom: 16px;
  animation: bounce 1s infinite alternate;
}
@keyframes bounce {
  from { transform: translateY(0); }
  to { transform: translateY(-10px); }
}
</style>
