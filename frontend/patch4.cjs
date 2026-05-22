const fs = require('fs')

const filePath = 'c:\\Users\\dames\\OneDrive - Mittelschule Telfs\\github\\learn\\frontend\\src\\views\\WorksheetPlayer.vue'
let content = fs.readFileSync(filePath, 'utf-8')

// Imports
const importInject = `
import Flashcards from '../components/exercises/Flashcards.vue'
import MemoryMatch from '../components/exercises/MemoryMatch.vue'
import WordScramble from '../components/exercises/WordScramble.vue'
import SemanticSorter from '../components/exercises/SemanticSorter.vue'
import ContextualDialogue from '../components/exercises/ContextualDialogue.vue'
import FlowChallenge from '../components/exercises/FlowChallenge.vue'
`

const targetImport = "import ShortAnswer from '../components/exercises/ShortAnswer.vue'"
if (content.includes(targetImport)) {
  content = content.replace(targetImport, targetImport + '\\n' + importInject)
}

// getExerciseComponent
const componentInject = `
    case 'flashcards': return Flashcards
    case 'memory_match': return MemoryMatch
    case 'word_scramble': return WordScramble
    case 'semantic_sorter': return SemanticSorter
    case 'contextual_dialogue': return ContextualDialogue
    case 'flow_challenge': return FlowChallenge
`
const targetCase = "case 'short_answer': return ShortAnswer"
if (content.includes(targetCase)) {
  content = content.replace(targetCase, targetCase + componentInject)
}

// onMounted / isExercise initialization
const initInject = `
      } else if (block.type === 'flashcards' || block.type === 'memory_match') {
        initialAnswers[block.id] = { completed: false }
      } else if (block.type === 'word_scramble' || block.type === 'contextual_dialogue' || block.type === 'semantic_sorter') {
        initialAnswers[block.id] = {}
      } else if (block.type === 'flow_challenge') {
        initialAnswers[block.id] = { score: 0 }
`
const targetInit = "} else if (block.type === 'vocabulary') {"
if (content.includes(targetInit)) {
  content = content.replace(targetInit, initInject + '\\n      ' + targetInit)
}

const targetArray = "['gap_fill', 'multiple_choice', 'single_choice', 'drag_drop', 'matching', 'vocabulary']"
const newArray = "['gap_fill', 'multiple_choice', 'single_choice', 'drag_drop', 'matching', 'vocabulary', 'flashcards', 'memory_match', 'word_scramble', 'semantic_sorter', 'contextual_dialogue', 'flow_challenge']"
content = content.replaceAll(targetArray, newArray)

fs.writeFileSync(filePath, content)
console.log('Success WorksheetPlayer')
