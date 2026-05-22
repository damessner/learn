<template>
  <div class="exercise-card semantic-sorter-exercise">
    <div class="exercise-header">
      <span class="exercise-badge">Semantic Sorter (Categorization Phase)</span>
      <span class="points">{{ points }} pts</span>
    </div>

    <div class="instruction">{{ instruction }}</div>

    <!-- Word Bank -->
    <div class="word-bank" @dragover.prevent @drop="onDropBank">
      <div class="bank-label">Word Bank</div>
      <div class="bank-items">
        <div 
          v-for="word in availableWords" 
          :key="word.id"
          class="word-pill"
          draggable="true"
          @dragstart="onDragStart($event, word)"
          @click="selectWord(word)"
          :class="{ 'selected': selectedWord?.id === word.id }"
        >
          {{ word.text }}
        </div>
        <div v-if="availableWords.length === 0" class="empty-msg">All words sorted!</div>
      </div>
    </div>

    <!-- Categories -->
    <div class="categories-grid">
      <div 
        v-for="(cat, cIdx) in categories" 
        :key="cIdx"
        class="category-bucket card glass"
        @dragover.prevent
        @drop="onDropCategory($event, cat.name)"
        @click="placeWordInCategory(cat.name)"
        :class="{
          'correct-bucket': isGraded && isCategoryCorrect(cat.name),
          'incorrect-bucket': isGraded && !isCategoryCorrect(cat.name)
        }"
      >
        <h4 class="bucket-title">{{ cat.name }}</h4>
        <div class="bucket-items">
          <div 
            v-for="word in getWordsInCategory(cat.name)" 
            :key="word.id"
            class="word-pill placed"
            draggable="true"
            @dragstart="onDragStart($event, word)"
            @click.stop="returnToBank(word)"
            :class="{
              'correct-word': isGraded && isWordCorrect(word, cat.name),
              'incorrect-word': isGraded && !isWordCorrect(word, cat.name)
            }"
          >
            {{ word.text }}
            <button v-if="!disabled && !isGraded" class="btn-remove" @click.stop="returnToBank(word)">×</button>
          </div>
        </div>
      </div>
    </div>
    <div v-if="isGraded && explanation" class="explanation-box">
      <strong>Explanation:</strong> {{ explanation }}
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'

const props = defineProps({
  id: String,
  categories: {
    type: Array, // [{ name: 'Fruits', words: ['apple', 'banana'] }, ...]
    default: () => []
  },
  points: Number,
  instruction: {
    type: String,
    default: 'Sort the words into their correct semantic categories.'
  },
  modelValue: {
    type: Object,
    default: () => ({}) // { wordId: categoryName }
  },
  disabled: Boolean,
  feedback: Object,
  explanation: String
})

const emit = defineEmits(['update:modelValue'])

const answers = ref({ ...props.modelValue })
const allWords = ref([])
const selectedWord = ref(null)

const isGraded = computed(() => !!props.feedback)

onMounted(() => {
  let wordId = 0
  const wordsList = []
  props.categories.forEach(cat => {
    if (cat.words) {
      cat.words.forEach(w => {
        wordsList.push({ id: `w_${wordId++}`, text: w, originalCategory: cat.name })
      })
    }
  })
  
  // Shuffle words for bank
  for (let i = wordsList.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [wordsList[i], wordsList[j]] = [wordsList[j], wordsList[i]];
  }
  
  allWords.value = wordsList
})

watch(answers, (newVal) => {
  emit('update:modelValue', newVal)
}, { deep: true })

const availableWords = computed(() => {
  return allWords.value.filter(w => !answers.value[w.id])
})

const getWordsInCategory = (catName) => {
  return allWords.value.filter(w => answers.value[w.id] === catName)
}

// Drag & Drop
const onDragStart = (e, word) => {
  if (props.disabled || isGraded.value) return
  e.dataTransfer.setData('text/plain', word.id)
  selectedWord.value = null
}

const onDropCategory = (e, catName) => {
  if (props.disabled || isGraded.value) return
  const wordId = e.dataTransfer.getData('text/plain')
  if (wordId) {
    answers.value[wordId] = catName
  }
}

const onDropBank = (e) => {
  if (props.disabled || isGraded.value) return
  const wordId = e.dataTransfer.getData('text/plain')
  if (wordId) {
    delete answers.value[wordId]
  }
}

// Tap to place (Mobile friendly)
const selectWord = (word) => {
  if (props.disabled || isGraded.value) return
  selectedWord.value = selectedWord.value?.id === word.id ? null : word
}

const placeWordInCategory = (catName) => {
  if (props.disabled || isGraded.value) return
  if (selectedWord.value) {
    answers.value[selectedWord.value.id] = catName
    selectedWord.value = null
  }
}

const returnToBank = (word) => {
  if (props.disabled || isGraded.value) return
  delete answers.value[word.id]
}

// Grading checks
const isWordCorrect = (word, catName) => {
  if (!props.feedback) return false
  return word.originalCategory === catName
}

const isCategoryCorrect = (catName) => {
  if (!props.feedback) return false
  // Category is fully correct if all its expected words are inside, and no wrong words are inside.
  // This is a bit complex, let's just check if there are any wrong words in it.
  const wordsInCat = getWordsInCategory(catName)
  if (wordsInCat.length === 0) return false
  return wordsInCat.every(w => isWordCorrect(w, catName))
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
.word-bank {
  background-color: var(--bg-main);
  border: 2px dashed var(--border-color);
  border-radius: var(--radius-md);
  padding: 16px;
  margin-bottom: 24px;
  min-height: 100px;
}
.bank-label {
  font-size: 12px;
  text-transform: uppercase;
  font-weight: 700;
  color: var(--text-muted);
  margin-bottom: 12px;
}
.bank-items {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
.empty-msg {
  color: var(--text-muted);
  font-style: italic;
  font-size: 14px;
}
.categories-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
}
.category-bucket {
  min-height: 150px;
  padding: 16px;
  display: flex;
  flex-direction: column;
  transition: all 0.2s ease;
  cursor: pointer;
}
.category-bucket:hover {
  border-color: var(--primary);
}
.bucket-title {
  font-size: 16px;
  margin-top: 0;
  margin-bottom: 12px;
  color: var(--primary);
  text-align: center;
  border-bottom: 2px solid var(--border-color);
  padding-bottom: 8px;
}
.bucket-items {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.word-pill {
  background-color: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: 20px;
  padding: 6px 14px;
  font-size: 14px;
  font-weight: 600;
  cursor: grab;
  user-select: none;
  box-shadow: var(--shadow-sm);
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.word-pill:active {
  cursor: grabbing;
}
.word-pill.selected {
  background-color: var(--primary-light);
  border-color: var(--primary);
  color: var(--primary);
  transform: scale(1.05);
}
.word-pill.placed {
  background-color: var(--bg-main);
  cursor: pointer;
}
.btn-remove {
  background: none;
  border: none;
  font-size: 16px;
  font-weight: bold;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0 0 0 8px;
}
.btn-remove:hover {
  color: var(--danger);
}
.word-pill.correct-word {
  background-color: var(--success-light);
  border-color: var(--success);
  color: var(--success);
}
.word-pill.incorrect-word {
  background-color: var(--danger-light);
  border-color: var(--danger);
  color: var(--danger);
  text-decoration: line-through;
}
</style>
