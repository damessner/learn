const fs = require('fs')

const filePath = 'c:\\Users\\dames\\OneDrive - Mittelschule Telfs\\github\\learn\\frontend\\src\\views\\WorksheetBuilder.vue'
let content = fs.readFileSync(filePath, 'utf-8')

const scriptInjection = `
// Gamification updater functions
const updateGamifiedPairs = (block) => {
  const text = block.rawText || ''
  const lines = text.split('\\n')
  const pairs = []
  lines.forEach(line => {
    const cleaned = line.trim()
    if (!cleaned) return
    const parts = cleaned.split(/\\s*=\\s*|\\s*-\\s*|\\s*:\\s*|,\\s*/)
    if (parts.length >= 2) {
      pairs.push({
        l: parts[0].trim(),
        r: parts[1].trim()
      })
    }
  })
  block.pairs = pairs
}

const updateScrambleWords = (block) => {
  const text = block.rawText || ''
  const lines = text.split('\\n')
  const words = []
  lines.forEach(line => {
    const cleaned = line.trim()
    if (!cleaned) return
    const parts = cleaned.split(/\\s*=\\s*|\\s*-\\s*|\\s*:\\s*|,\\s*/)
    if (parts.length >= 2) {
      words.push({
        word: parts[0].trim(),
        clue: parts[1].trim()
      })
    } else {
      words.push({ word: parts[0].trim(), clue: '' })
    }
  })
  block.words = words
}

const updateCategoryWords = (e, cat) => {
  const text = e.target.value || ''
  cat.words = text.split(',').map(w => w.trim()).filter(Boolean)
}

// Vocabulary Course Wizard Logic
const showVocabWizard = ref(false)
const vocabWizardType = ref('standard')
const vocabWizardRaw = ref('')
const vocabWizardLoading = ref(false)

const openVocabWizard = (type) => {
  vocabWizardType.value = type
  vocabWizardRaw.value = ''
  showVocabWizard.value = true
}

const generateVocabCourse = async () => {
  if (!vocabWizardRaw.value.trim()) {
    alert('Please paste a vocabulary list.')
    return
  }

  vocabWizardLoading.value = true
  
  if (vocabWizardType.value === 'standard') {
    // Generate purely on frontend
    const tempBlock = { rawText: vocabWizardRaw.value }
    updateGamifiedPairs(tempBlock)
    const pairs = tempBlock.pairs
    
    if (pairs.length === 0) {
      alert('Could not parse any word pairs. Please use the format "word = translation".')
      vocabWizardLoading.value = false
      return
    }

    sheet.value.blocks = [] // Clear existing

    // 1. Instructions
    sheet.value.blocks.push({
      id: Date.now().toString() + '_1',
      type: 'text',
      content: '## Vocabulary Course\\nWelcome to your customized vocabulary training. Follow the steps below to master these words.'
    })

    // 2. Flashcards
    sheet.value.blocks.push({
      id: Date.now().toString() + '_2',
      type: 'flashcards',
      instruction: 'Study Phase: Review the words using flashcards.',
      pairs: JSON.parse(JSON.stringify(pairs))
    })

    // 3. Memory Match
    sheet.value.blocks.push({
      id: Date.now().toString() + '_3',
      type: 'memory_match',
      instruction: 'Game Phase: Find the matching pairs.',
      pairs: JSON.parse(JSON.stringify(pairs))
    })

    // 4. Word Scramble
    sheet.value.blocks.push({
      id: Date.now().toString() + '_4',
      type: 'word_scramble',
      instruction: 'Spelling Phase: Unscramble the letters.',
      points: pairs.length,
      words: pairs.map(p => ({ word: p.l, clue: p.r }))
    })

    // 5. Vocabulary strictly-typed
    sheet.value.blocks.push({
      id: Date.now().toString() + '_5',
      type: 'vocabulary',
      instruction: 'Final Boss: Type the correct translations.',
      points: pairs.length * 2,
      direction: 'mixed',
      pairs: JSON.parse(JSON.stringify(pairs))
    })

    showVocabWizard.value = false
    vocabWizardLoading.value = false
  } else {
    // Neuro-Gamified (Needs Backend / Gemini API)
    const token = localStorage.getItem('token')
    try {
      const resp = await fetch('http://localhost:3000/api/worksheets/ai/neuro-vocab', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': \`Bearer \${token}\`
        },
        body: JSON.stringify({
          rawList: vocabWizardRaw.value
        })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'AI generation failed')
      
      sheet.value.blocks = data.blocks || []
      showVocabWizard.value = false
    } catch (err) {
      alert(err.message)
    } finally {
      vocabWizardLoading.value = false
    }
  }
}
`

const htmlInjection = `
    <!-- Vocabulary Course Wizard Modal -->
    <div v-if="showVocabWizard" class="wizard-modal-overlay">
      <div class="wizard-modal-card" style="height: auto; max-height: 80vh;">
        <div v-if="vocabWizardLoading" class="wizard-loading-container">
          <div class="wizard-spinner-emoji">🪄</div>
          <h3>Generating Course...</h3>
          <p>Weaving your vocabulary into a gamified sequence.</p>
          <div class="wizard-progress-bar"><div class="wizard-progress-indefinite"></div></div>
        </div>
        <template v-else>
          <header class="modal-header">
            <h2>✨ Generate {{ vocabWizardType === 'standard' ? 'Standard' : 'Neuro-Gamified' }} Course</h2>
            <button @click="showVocabWizard = false" class="btn-close">&times;</button>
          </header>
          <div class="wizard-scroll-container">
            <p style="margin-bottom: 16px;">Paste your vocabulary list below. We will automatically generate a progressive sequence of 4-5 gamified exercises to teach these words.</p>
            <div class="form-group">
              <label>Vocabulary List (Format: english = Deutsch)</label>
              <textarea 
                v-model="vocabWizardRaw" 
                rows="8" 
                class="wizard-textarea" 
                placeholder="apple = Apfel\\nbanana = Banane\\nto go = gehen"
              ></textarea>
            </div>
            <div class="mt-4" style="text-align: right;">
              <button @click="generateVocabCourse" class="btn btn-primary btn-lg btn-generate-magic">🪄 Generate Magic Worksheet</button>
            </div>
          </div>
        </template>
      </div>
    </div>
`

// Inject Script Setup
const targetScript = "const parseVocabLines = (block) => {"
if (content.includes(targetScript)) {
  content = content.replace(targetScript, scriptInjection + '\\n' + targetScript)
}

// Inject HTML Modal
const targetHTML = "<!-- AI Generator Wizard Modal Overlay -->"
if (content.includes(targetHTML)) {
  content = content.replace(targetHTML, htmlInjection + '\\n    ' + targetHTML)
}

fs.writeFileSync(filePath, content)
console.log('Success')
