<template>
  <div class="worksheet-builder">
    <header class="builder-header glass">
      <div class="header-left">
        <router-link to="/teacher" class="btn btn-secondary btn-back">← Back</router-link>
        <h1>{{ isEditing ? 'Edit Worksheet' : 'New Worksheet' }}</h1>
      </div>
      <div class="header-right">
        <button @click="saveWorksheet(false)" :disabled="saving" class="btn btn-secondary">Save Draft</button>
        <button @click="saveWorksheet(true)" :disabled="saving" class="btn btn-primary">Publish Worksheet 🚀</button>
      </div>
    </header>

    <div class="builder-layout">
      <!-- Left Panel: Worksheet Info & Block Manager -->
      <div class="sidebar-panel card">
        <h3>General Settings</h3>
        <div class="form-group">
          <label>Worksheet Title</label>
          <input type="text" v-model="sheet.title" placeholder="e.g. Present Perfect Practice" />
        </div>
        <div class="form-group">
          <label>Description / Instructions</label>
          <textarea v-model="sheet.description" placeholder="Instructions for students..." rows="3"></textarea>
        </div>
        <div class="form-group-row">
          <div class="form-group">
            <label>Subject</label>
            <input type="text" v-model="sheet.subject" placeholder="e.g. English" />
          </div>
          <div class="form-group">
            <label>Grade Level</label>
            <input type="text" v-model="sheet.grade_level" placeholder="e.g. 3a" />
          </div>
        </div>

        <div class="ai-section">
          <h3>AI Worksheet Draft</h3>
          <div class="form-group">
            <label>Provider</label>
            <select v-model="aiProvider">
              <option value="gemini">Gemini API</option>
              <option value="ollama">Ollama (local)</option>
              <option value="auto">Auto (Gemini fallback to Ollama)</option>
            </select>
          </div>
          <div class="form-group">
            <label>Prompt</label>
            <textarea
              v-model="aiPrompt"
              rows="4"
              placeholder="Example: Create a short A2 English worksheet about present perfect with one text block, 2 gap fills, 1 multiple-choice, and 1 matching."
            ></textarea>
          </div>
          <button @click="generateWorksheetWithAI" :disabled="aiLoading" class="btn btn-secondary">
            {{ aiLoading ? 'Generating…' : 'Generate Worksheet with AI' }}
          </button>
          <span class="field-hint">Imports title/description/subject/grade and blocks from AI JSON.</span>
        </div>

        <div class="add-blocks-section">
          <h3>Add Question / Content</h3>
          <div class="block-buttons-grid">
            <button @click="addBlock('text')" class="btn-add-block">📝 Instructions</button>
            <button @click="addBlock('image')" class="btn-add-block">🖼️ Image</button>
            <button @click="addBlock('audio')" class="btn-add-block">🎵 Audio</button>
            <button @click="addBlock('gap_fill')" class="btn-add-block">✏️ Gap Fill</button>
            <button @click="addBlock('drag_drop')" class="btn-add-block">👉 Drag & Drop</button>
            <button @click="addBlock('multiple_choice')" class="btn-add-block">☑️ Multi Choice</button>
            <button @click="addBlock('single_choice')" class="btn-add-block">🔘 Single Choice</button>
            <button @click="addBlock('matching')" class="btn-add-block">🔗 Connect Texts</button>
            <button @click="addBlock('vocabulary')" class="btn-add-block">📖 Vocabulary</button>
          </div>
        </div>
      </div>

      <!-- Right Panel: Worksheet Preview / List of active blocks -->
      <div class="main-preview-panel">
        <div v-if="sheet.blocks.length === 0" class="empty-builder card glass">
          <span>✨</span>
          <h3>Your Worksheet is Empty</h3>
          <p>Choose an item from the sidebar to add your first exercise block.</p>
        </div>

        <div v-else class="blocks-list">
          <div 
            v-for="(block, idx) in sheet.blocks" 
            :key="block.id"
            class="block-editor card"
          >
            <!-- Header of block: type, reorder, delete -->
            <div class="block-editor-header">
              <span class="block-badge">{{ block.type.replace('_', ' ') }}</span>
              <div class="block-actions">
                <button @click="moveBlock(idx, -1)" :disabled="idx === 0" class="btn-order">▲</button>
                <button @click="moveBlock(idx, 1)" :disabled="idx === sheet.blocks.length - 1" class="btn-order">▼</button>
                <button @click="removeBlock(idx)" class="btn-delete">🗑️</button>
              </div>
            </div>

            <!-- Block configuration forms -->
            <div class="block-editor-body">
              <!-- Text Block -->
              <div v-if="block.type === 'text'" class="editor-row">
                <label>Text Content (Markdown supported)</label>
                <textarea v-model="block.content" placeholder="Type instructions or reading text here..." rows="4"></textarea>
              </div>

              <!-- Image Block -->
              <div v-if="block.type === 'image'" class="editor-row">
                <label>Image Resource</label>
                <div class="media-uploader-hud">
                  <input type="file" @change="uploadMedia($event, block)" accept="image/*" />
                  <input type="text" v-model="block.url" placeholder="Or paste image URL" />
                </div>
                <input type="text" v-model="block.caption" placeholder="Add image caption..." class="mt-2" />
              </div>

              <!-- Audio Block -->
              <div v-if="block.type === 'audio'" class="editor-row">
                <label>Audio Resource</label>
                <div class="media-uploader-hud">
                  <input type="file" @change="uploadMedia($event, block)" accept="audio/*" />
                  <input type="text" v-model="block.url" placeholder="Or paste audio URL" />
                </div>
                <input type="text" v-model="block.label" placeholder="Audio Title / Label..." class="mt-2" />
              </div>

              <!-- Gap Fill Question -->
              <div v-if="block.type === 'gap_fill'" class="editor-row">
                <div class="row-between">
                  <label>Instruction</label>
                  <div class="points-input">
                    Points: <input type="number" v-model.number="block.points" min="1" />
                  </div>
                </div>
                <input type="text" v-model="block.instruction" placeholder="e.g. Complete the sentences." class="mb-2" />
                <label>Sentence Template (Put correct answers inside curly braces)</label>
                <textarea 
                  v-model="block.template" 
                  placeholder="e.g. She {has gone} to school already. We {have played} basketball." 
                  rows="3"
                ></textarea>
                <span class="field-hint">Student sees: She ______ to school already. Correct answer is "has gone".</span>
              </div>

              <!-- Drag & Drop Question -->
              <div v-if="block.type === 'drag_drop'" class="editor-row">
                <div class="row-between">
                  <label>Instruction</label>
                  <div class="points-input">
                    Points: <input type="number" v-model.number="block.points" min="1" />
                  </div>
                </div>
                <input type="text" v-model="block.instruction" placeholder="e.g. Drag the correct helping verbs." class="mb-2" />
                
                <label>Add items (comma separated words that students will drag)</label>
                <input type="text" :value="block.items.join(', ')" @input="updateDragItems($event, block)" placeholder="e.g. have, has, had" class="mb-2" />

                <label>Add Target Sentences (Use '___' to indicate drop zones. Ensure count matches items)</label>
                <div v-for="(target, tIdx) in block.targets" :key="tIdx" class="target-editor-row mb-2">
                  <input type="text" v-model="block.targets[tIdx]" placeholder="e.g. She ___ left." />
                  <input type="text" v-model="block.answers[tIdx]" placeholder="Correct word" class="w-xs" />
                  <button @click="removeTarget(block, tIdx)" class="btn-sm btn-danger">×</button>
                </div>
                <button @click="addTarget(block)" class="btn btn-secondary btn-sm">＋ Add Sentence Target</button>
              </div>

              <!-- Multiple Choice -->
              <div v-if="block.type === 'multiple_choice'" class="editor-row">
                <div class="row-between">
                  <label>Instruction / Question</label>
                  <div class="points-input">
                    Points: <input type="number" v-model.number="block.points" min="1" />
                  </div>
                </div>
                <input type="text" v-model="block.instruction" placeholder="e.g. Which statements are true?" class="mb-2" />
                
                <label>Answer Options (Check all that are correct)</label>
                <div v-for="(option, oIdx) in block.options" :key="oIdx" class="option-editor-row mb-2">
                  <input type="checkbox" :checked="block.correct.includes(oIdx)" @change="toggleMcCorrect(block, oIdx)" />
                  <input type="text" v-model="block.options[oIdx]" placeholder="Option text" />
                  <button @click="removeOption(block, oIdx)" class="btn-sm btn-danger">×</button>
                </div>
                <button @click="addOption(block)" class="btn btn-secondary btn-sm">＋ Add Option</button>
              </div>

              <!-- Single Choice -->
              <div v-if="block.type === 'single_choice'" class="editor-row">
                <div class="row-between">
                  <label>Instruction / Question</label>
                  <div class="points-input">
                    Points: <input type="number" v-model.number="block.points" min="1" />
                  </div>
                </div>
                <input type="text" v-model="block.instruction" placeholder="e.g. Select the correct conjugation." class="mb-2" />
                
                <label>Answer Options (Select the single correct option)</label>
                <div v-for="(option, oIdx) in block.options" :key="oIdx" class="option-editor-row mb-2">
                  <input type="radio" :name="'sc-correct-' + block.id" :checked="block.correct === oIdx" @change="block.correct = oIdx" />
                  <input type="text" v-model="block.options[oIdx]" placeholder="Option text" />
                  <button @click="removeOption(block, oIdx)" class="btn-sm btn-danger">×</button>
                </div>
                <button @click="addOption(block)" class="btn btn-secondary btn-sm">＋ Add Option</button>
              </div>

              <!-- Connecting / Matching Texts -->
              <div v-if="block.type === 'matching'" class="editor-row">
                <div class="row-between">
                  <label>Instruction</label>
                  <div class="points-input">
                    Points: <input type="number" v-model.number="block.points" min="1" />
                  </div>
                </div>
                <input type="text" v-model="block.instruction" placeholder="e.g. Match the opposites." class="mb-2" />
                
                <label>Matching Pairs (Left connects directly to Right row-wise)</label>
                <div v-for="(pair, pIdx) in block.pairs" :key="pIdx" class="pair-editor-row mb-2">
                  <input type="text" v-model="block.pairs[pIdx][0]" placeholder="Left Item" />
                  <span class="connector">⇄</span>
                  <input type="text" v-model="block.pairs[pIdx][1]" placeholder="Right Item" />
                  <button @click="removePair(block, pIdx)" class="btn-sm btn-danger">×</button>
                </div>
                <button @click="addPair(block)" class="btn btn-secondary btn-sm">＋ Add Pair</button>
              </div>

              <!-- Vocabulary Block Editor -->
              <div v-if="block.type === 'vocabulary'" class="editor-row">
                <div class="row-between">
                  <label>Instruction</label>
                  <div class="points-input">
                    Points: <input type="number" v-model.number="block.points" min="1" />
                  </div>
                </div>
                <input type="text" v-model="block.instruction" placeholder="e.g. Translate the vocabulary words." class="mb-2" />
                
                <div class="row-between mb-2">
                  <label>Translation Direction</label>
                  <select v-model="block.direction" class="w-xs">
                    <option value="l2r">Show Left, Write Right</option>
                    <option value="r2l">Show Right, Write Left</option>
                    <option value="mixed">Mixed Directions</option>
                  </select>
                </div>

                <label>Vocabulary List (Format: English = Deutsch, one per line)</label>
                <textarea
                  v-model="block.rawText"
                  @input="parseVocabLines(block)"
                  placeholder="apple = Apfel&#10;banana = Banane&#10;cherry = Kirsche"
                  rows="6"
                  class="mb-2"
                ></textarea>

                <div class="vocab-file-import mb-2">
                  <label class="btn btn-secondary btn-sm" style="margin: 0; min-height: auto; padding: 6px 12px;">
                    📥 Import Text/CSV File
                    <input type="file" @change="importVocabFile($event, block)" accept=".txt,.csv" style="display: none;" />
                  </label>
                  <span class="field-hint">Upload a text or CSV file. Lines should be "left = right" or comma-separated.</span>
                </div>

                <!-- Parsed Words Preview -->
                <div v-if="block.pairs && block.pairs.length > 0" class="vocab-preview-table-container">
                  <label>Parsed Vocabulary ({{ block.pairs.length }} words)</label>
                  <table class="vocab-preview-table">
                    <thead>
                      <tr>
                        <th>Left Side (Show or Write)</th>
                        <th>Right Side (Show or Write)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr v-for="(pair, pIdx) in block.pairs.slice(0, 5)" :key="pIdx">
                        <td>{{ pair.l }}</td>
                        <td>{{ pair.r }}</td>
                      </tr>
                      <tr v-if="block.pairs.length > 5">
                        <td colspan="2" style="text-align: center; color: var(--text-muted); font-style: italic;">
                          ... and {{ block.pairs.length - 5 }} more words ...
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()
const isEditing = ref(false)
const saving = ref(false)
const aiLoading = ref(false)
const aiProvider = ref('gemini')
const aiPrompt = ref('')

const sheet = ref({
  title: '',
  description: '',
  subject: '',
  grade_level: '',
  blocks: []
})

const API_BASE = window.location.origin.includes('localhost') ? 'http://localhost:3001/api' : '/api'

onMounted(async () => {
  if (route.params.id) {
    isEditing.value = true
    const token = localStorage.getItem('token')
    try {
      const resp = await fetch(`${API_BASE}/worksheets/${route.params.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (!resp.ok) throw new Error('Worksheet not found')
      const data = await resp.json()
      sheet.value = {
        title: data.title,
        description: data.description,
        subject: data.subject,
        grade_level: data.grade_level,
        blocks: data.content?.blocks || []
      }
    } catch (err) {
      alert(err.message)
      router.push('/teacher')
    }
  }
})

// Block creation helper
const addBlock = (type) => {
  const id = `q_${Math.random().toString(36).substr(2, 9)}`
  const baseBlock = { id, type, points: 1 }

  switch (type) {
    case 'text':
      baseBlock.content = ''
      break
    case 'image':
      baseBlock.url = ''
      baseBlock.caption = ''
      break
    case 'audio':
      baseBlock.url = ''
      baseBlock.label = ''
      break
    case 'gap_fill':
      baseBlock.instruction = 'Fill in the blanks.'
      baseBlock.template = 'She {has} a cat. We {have} a dog.'
      break
    case 'drag_drop':
      baseBlock.instruction = 'Drag the words to correct gaps.'
      baseBlock.items = ['have', 'has']
      baseBlock.targets = ['We ___ a dog.', 'She ___ a cat.']
      baseBlock.answers = { '0': 'have', '1': 'has' }
      break
    case 'multiple_choice':
      baseBlock.instruction = 'Select all correct answers.'
      baseBlock.options = ['Option 1', 'Option 2']
      baseBlock.correct = []
      break
    case 'single_choice':
      baseBlock.instruction = 'Select the correct answer.'
      baseBlock.options = ['Option 1', 'Option 2']
      baseBlock.correct = 0
      break
    case 'matching':
      baseBlock.instruction = 'Connect matching text pairs.'
      baseBlock.pairs = [['large', 'big'], ['small', 'little']]
      break
    case 'vocabulary':
      baseBlock.instruction = 'Translate the vocabulary words.'
      baseBlock.direction = 'l2r'
      baseBlock.rawText = 'apple = Apfel\nbanana = Banane\ncherry = Kirsche'
      baseBlock.pairs = [
        { l: 'apple', r: 'Apfel' },
        { l: 'banana', r: 'Banane' },
        { l: 'cherry', r: 'Kirsche' }
      ]
      break
  }

  sheet.value.blocks.push(baseBlock)
}

const removeBlock = (idx) => {
  sheet.value.blocks.splice(idx, 1)
}

const moveBlock = (idx, direction) => {
  const targetIdx = idx + direction
  if (targetIdx < 0 || targetIdx >= sheet.value.blocks.length) return
  const temp = sheet.value.blocks[idx]
  sheet.value.blocks[idx] = sheet.value.blocks[targetIdx]
  sheet.value.blocks[targetIdx] = temp
}

// Media upload API handler
const uploadMedia = async (event, block) => {
  const file = event.target.files[0]
  if (!file) return

  const formData = new FormData()
  formData.append('file', file)

  const token = localStorage.getItem('token')
  try {
    const resp = await fetch(`${API_BASE}/media/upload`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    })
    if (!resp.ok) throw new Error('Upload failed')
    const data = await resp.json()
    block.url = data.url
    if (block.type === 'audio' && !block.label) {
      block.label = data.originalName
    }
  } catch (err) {
    alert(err.message)
  }
}

// Drag & Drop utilities
const updateDragItems = (event, block) => {
  block.items = event.target.value.split(',').map(s => s.trim()).filter(Boolean)
}

const addTarget = (block) => {
  block.targets.push('')
  const nextIdx = Object.keys(block.answers).length
  block.answers[String(nextIdx)] = ''
}

const removeTarget = (block, idx) => {
  block.targets.splice(idx, 1)
  delete block.answers[String(idx)]
}

// Multiple choice utilities
const toggleMcCorrect = (block, idx) => {
  const list = block.correct
  const pos = list.indexOf(idx)
  if (pos > -1) {
    list.splice(pos, 1)
  } else {
    list.push(idx)
  }
}

const addOption = (block) => {
  block.options.push('')
}

const removeOption = (block, idx) => {
  block.options.splice(idx, 1)
  if (block.type === 'multiple_choice') {
    block.correct = block.correct.filter(item => item !== idx).map(item => item > idx ? item - 1 : item)
  } else if (block.type === 'single_choice' && block.correct === idx) {
    block.correct = 0
  }
}

// Matching pairs utilities
const addPair = (block) => {
  block.pairs.push(['', ''])
}

const removePair = (block, idx) => {
  block.pairs.splice(idx, 1)
}

// Vocabulary utilities
const parseVocabLines = (block) => {
  const text = block.rawText || ''
  const lines = text.split('\n')
  const pairs = []
  lines.forEach(line => {
    const cleaned = line.trim()
    if (!cleaned) return
    const parts = cleaned.split(/\s*=\s*|\s*-\s*|\s*:\s*|,\s*/)
    if (parts.length >= 2) {
      pairs.push({
        l: parts[0].trim(),
        r: parts[1].trim()
      })
    }
  })
  block.pairs = pairs
}

const importVocabFile = (event, block) => {
  const file = event.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = (e) => {
    block.rawText = e.target.result
    parseVocabLines(block)
  }
  reader.readAsText(file)
}

const generateWorksheetWithAI = async () => {
  if (!aiPrompt.value.trim()) {
    alert('Please enter a prompt first.')
    return
  }

  aiLoading.value = true
  const token = localStorage.getItem('token')
  try {
    const resp = await fetch(`${API_BASE}/worksheets/ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        provider: aiProvider.value,
        prompt: aiPrompt.value
      })
    })
    const data = await resp.json()
    if (!resp.ok) throw new Error(data?.error || 'AI generation failed')

    sheet.value.title = data.title || sheet.value.title
    sheet.value.description = data.description || sheet.value.description
    sheet.value.subject = data.subject || sheet.value.subject
    sheet.value.grade_level = data.grade_level || sheet.value.grade_level
    sheet.value.blocks = Array.isArray(data.content?.blocks) ? data.content.blocks : []
  } catch (err) {
    alert(err.message)
  } finally {
    aiLoading.value = false
  }
}

// Save worksheet to SQLite backend
const saveWorksheet = async (publish = false) => {
  if (!sheet.value.title.trim()) {
    alert('Please enter a worksheet title!')
    return
  }

  saving.value = true
  const token = localStorage.getItem('token')
  const payload = {
    title: sheet.value.title,
    description: sheet.value.description,
    subject: sheet.value.subject,
    grade_level: sheet.value.grade_level,
    content: { blocks: sheet.value.blocks },
    is_published: publish
  }

  try {
    const url = isEditing.value 
      ? `${API_BASE}/worksheets/${route.params.id}` 
      : `${API_BASE}/worksheets`
    
    const method = isEditing.value ? 'PUT' : 'POST'

    const resp = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    })

    if (!resp.ok) throw new Error('Failed to save worksheet')
    router.push('/teacher')
  } catch (err) {
    alert(err.message)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.worksheet-builder {
  max-width: 1200px;
  margin: 0 auto 100px auto;
}

.builder-header {
  position: sticky;
  top: 70px;
  z-index: 90;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  margin-bottom: 24px;
  box-shadow: var(--shadow-sm);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-left h1 {
  font-size: 22px;
}

.header-right {
  display: flex;
  gap: 12px;
}

.btn-back {
  padding: 6px 12px;
  min-height: auto;
}

.builder-layout {
  display: grid;
  grid-template-columns: 350px 1fr;
  gap: 24px;
}

.sidebar-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: fit-content;
  position: sticky;
  top: 170px;
}

.form-group-row {
  display: flex;
  gap: 12px;
}

.form-group-row .form-group {
  flex: 1;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted);
}

.add-blocks-section h3 {
  font-size: 15px;
  margin-bottom: 12px;
  color: var(--text-muted);
}

.ai-section {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ai-section h3 {
  font-size: 15px;
  color: var(--text-muted);
  margin: 0;
}

.block-buttons-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.btn-add-block {
  background-color: var(--bg-main);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 10px;
  font-weight: 600;
  font-size: 13px;
  color: var(--text-main);
  cursor: pointer;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  box-shadow: none;
  transition: all 0.2s ease;
}

.btn-add-block:hover {
  background-color: var(--primary-light);
  border-color: var(--primary);
  color: var(--primary);
}

.main-preview-panel {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.empty-builder {
  text-align: center;
  padding: 60px 40px;
  margin-top: 40px;
}

.empty-builder span {
  font-size: 48px;
  display: block;
  margin-bottom: 16px;
}

.blocks-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.block-editor {
  border-left: 4px solid var(--primary);
}

.block-editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 12px;
  margin-bottom: 16px;
}

.block-badge {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  background-color: var(--primary-light);
  color: var(--primary);
  padding: 4px 8px;
  border-radius: 20px;
}

.block-actions {
  display: flex;
  gap: 6px;
}

.btn-order, .btn-delete {
  background: none;
  border: 1px solid var(--border-color);
  width: 28px;
  height: 28px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  min-height: auto;
  box-shadow: none;
}

.btn-order:hover:not(:disabled) {
  background-color: var(--bg-main);
  border-color: var(--primary);
}

.btn-delete:hover {
  background-color: var(--danger-light);
  border-color: var(--danger);
  color: var(--danger);
}

.block-editor-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.editor-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.editor-row label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted);
}

.row-between {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.points-input {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: 6px;
}

.points-input input {
  width: 60px;
  min-height: 30px;
  padding: 2px 6px;
  text-align: center;
}

.media-uploader-hud {
  display: flex;
  gap: 12px;
  align-items: center;
}

.media-uploader-hud input[type="file"] {
  border: none;
  padding: 0;
  min-height: auto;
}

.target-editor-row, .option-editor-row, .pair-editor-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.w-xs {
  width: 140px !important;
}

.connector {
  font-size: 20px;
  color: var(--text-muted);
}

.field-hint {
  font-size: 11px;
  color: var(--text-muted);
  font-style: italic;
}

.mt-2 {
  margin-top: 8px;
}

.mb-2 {
  margin-bottom: 8px;
}

.vocab-file-import {
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.vocab-preview-table-container {
  margin-top: 12px;
}

.vocab-preview-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 6px;
  font-size: 13px;
}

.vocab-preview-table th, .vocab-preview-table td {
  border: 1px solid var(--border-color);
  padding: 6px 12px;
  text-align: left;
}

.vocab-preview-table th {
  background-color: var(--bg-main);
  font-weight: 700;
}
</style>
