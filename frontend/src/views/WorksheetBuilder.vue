<template>
  <div class="worksheet-builder">
    <header class="builder-header glass">
      <div class="header-left">
        <router-link to="/teacher" class="btn btn-secondary btn-back">← Back</router-link>
        <h1 class="clickable-title" @click="openSettings" title="Click to edit document settings">
          {{ isEditing ? 'Edit Worksheet' : 'New Worksheet' }}
          <span class="title-settings-icon">⚙️</span>
        </h1>
      </div>
      <div class="header-right">
        <button @click="openAiPanel" class="btn btn-secondary btn-ai-wand" title="AI Worksheet Draft">
          🪄 AI
        </button>
        <button @click="saveWorksheet(false)" :disabled="saving" class="btn btn-secondary">Save Draft</button>
        <button @click="openLivePreview" class="btn btn-secondary">
          👀 Live Preview
        </button>
        <button @click="saveWorksheet(true)" :disabled="saving" class="btn btn-primary">Publish Worksheet 🚀</button>
      </div>
    </header>

    <div class="builder-layout" :class="{ 'right-collapsed': !rightExpanded }">
      <!-- Left Column: Block Toolbox -->
      <div class="sidebar-panel card toolbox-panel">
        <div class="panel-header-toggle">
          <h3 class="panel-title">🛠️ Toolbox</h3>
        </div>

        <div class="toolbox-content">
          <!-- Mode Tabs Selector -->
          <div class="toolbox-mode-selector">
            <button 
              type="button"
              class="toolbox-mode-btn" 
              :class="{ active: worksheetType === 'manual' }" 
              @click="worksheetType = 'manual'"
            >
              📝 Standard
            </button>
            <button 
              type="button"
              class="toolbox-mode-btn" 
              :class="{ active: worksheetType === 'vocab' }" 
              @click="worksheetType = 'vocab'"
            >
              🗂️ Vocabulary
            </button>
          </div>

          <!-- Add Question / Content (Standard Mode) -->
          <div v-if="worksheetType === 'manual'" class="add-blocks-section">
            <h3 v-if="leftExpanded">Presentation</h3>
            <div class="block-buttons-grid">
              <button @click="addBlock('text')" class="btn-add-block" title="Display text, instructions, or reading material">
                <span class="btn-icon">📝</span>
                <span class="btn-text" v-if="leftExpanded">Instructions</span>
                <span class="info-icon" v-if="leftExpanded">ℹ️</span>
              </button>
              <button @click="addBlock('image')" class="btn-add-block" title="Show a picture or illustration">
                <span class="btn-icon">🖼️</span>
                <span class="btn-text" v-if="leftExpanded">Image</span>
                <span class="info-icon" v-if="leftExpanded">ℹ️</span>
              </button>
              <button @click="addBlock('audio')" class="btn-add-block" title="Play a sound or voice recording">
                <span class="btn-icon">🎵</span>
                <span class="btn-text" v-if="leftExpanded">Audio</span>
                <span class="info-icon" v-if="leftExpanded">ℹ️</span>
              </button>
              <button @click="addBlock('tts_text')" class="btn-add-block" title="Display text that is read aloud by a natural neural voice">
                <span class="btn-icon">🗣️</span>
                <span class="btn-text" v-if="leftExpanded">Read Aloud</span>
                <span class="info-icon" v-if="leftExpanded">ℹ️</span>
              </button>
              <button @click="addBlock('video')" class="btn-add-block" title="Embed a YouTube video with optional comprehension questions">
                <span class="btn-icon">🎬</span>
                <span class="btn-text" v-if="leftExpanded">YouTube Video</span>
                <span class="info-icon" v-if="leftExpanded">ℹ️</span>
              </button>
            </div>

            <h3 class="mt-4" v-if="leftExpanded">Basic Questions</h3>
            <div class="block-buttons-grid">
              <button @click="addBlock('single_choice')" class="btn-add-block" title="Multiple options, only one correct answer">
                <span class="btn-icon">🔘</span>
                <span class="btn-text" v-if="leftExpanded">Single Choice</span>
                <span class="info-icon" v-if="leftExpanded">ℹ️</span>
              </button>
              <button @click="addBlock('multiple_choice')" class="btn-add-block" title="Multiple options, multiple correct answers">
                <span class="btn-icon">☑️</span>
                <span class="btn-text" v-if="leftExpanded">Multi Choice</span>
                <span class="info-icon" v-if="leftExpanded">ℹ️</span>
              </button>
              <button @click="addBlock('short_answer')" class="btn-add-block" title="Text box for a brief, open-ended answer">
                <span class="btn-icon">📝</span>
                <span class="btn-text" v-if="leftExpanded">Short Answer</span>
                <span class="info-icon" v-if="leftExpanded">ℹ️</span>
              </button>
            </div>

            <h3 class="mt-4" v-if="leftExpanded">Interactive Questions</h3>
            <div class="block-buttons-grid">
              <button @click="addBlock('gap_fill')" class="btn-add-block" title="Students type missing words into blanks">
                <span class="btn-icon">✏️</span>
                <span class="btn-text" v-if="leftExpanded">Gap Fill</span>
                <span class="info-icon" v-if="leftExpanded">ℹ️</span>
              </button>
              <button @click="addBlock('drag_drop')" class="btn-add-block" title="Drag and drop words into designated drop zones">
                <span class="btn-icon">👉</span>
                <span class="btn-text" v-if="leftExpanded">Drag & Drop</span>
                <span class="info-icon" v-if="leftExpanded">ℹ️</span>
              </button>
              <button @click="addBlock('matching')" class="btn-add-block" title="Match items on the left to items on the right">
                <span class="btn-icon">🔗</span>
                <span class="btn-text" v-if="leftExpanded">Connect Texts</span>
                <span class="info-icon" v-if="leftExpanded">ℹ️</span>
              </button>
            </div>
          </div>

          <!-- Vocab / Gamify Sections (Vocabulary Mode) -->
          <div v-else-if="worksheetType === 'vocab'" class="gamify-sections">
            <h3 style="margin-top: 0; margin-bottom: 8px;" v-if="leftExpanded">Vocab Wizards</h3>
            <button @click="openVocabWizard('standard')" class="btn btn-secondary w-full mb-2" title="Generate standard exercises from a vocabulary list">
              <span>🪄</span><span v-if="leftExpanded"> Std Vocab Course</span>
            </button>
            <button @click="openVocabWizard('neuro')" class="btn btn-secondary w-full mb-2" style="background: linear-gradient(135deg, var(--primary) 0%, #6366f1 100%); color: white; border: none;" title="Generate a full gamified neuro-learning course from a vocab list">
              <span>🪄</span><span v-if="leftExpanded"> Neuro Vocab Course</span>
            </button>

            <h3 class="mt-4" style="margin-bottom: 8px;" v-if="leftExpanded">Gamified Learning</h3>
            <div class="block-buttons-grid">
              <button @click="addBlock('flashcards')" class="btn-add-block" style="border-color:var(--primary)" title="Learn terms step-by-step with flip cards">
                <span class="btn-icon">🗂️</span>
                <span class="btn-text" v-if="leftExpanded">Flashcards</span>
                <span class="info-icon" v-if="leftExpanded">ℹ️</span>
              </button>
              <button @click="addBlock('memory_match')" class="btn-add-block" style="border-color:var(--primary)" title="Flip cards to find matching pairs">
                <span class="btn-icon">🃏</span>
                <span class="btn-text" v-if="leftExpanded">Memory Match</span>
                <span class="info-icon" v-if="leftExpanded">ℹ️</span>
              </button>
              <button @click="addBlock('word_scramble')" class="btn-add-block" style="border-color:var(--primary)" title="Unscramble letters to form words">
                <span class="btn-icon">🔡</span>
                <span class="btn-text" v-if="leftExpanded">Word Scramble</span>
                <span class="info-icon" v-if="leftExpanded">ℹ️</span>
              </button>
              <button @click="addBlock('semantic_sorter')" class="btn-add-block" style="border-color:#6366f1" title="Categorize terms by their meaning">
                <span class="btn-icon">🧠</span>
                <span class="btn-text" v-if="leftExpanded">Semantic Sort</span>
                <span class="info-icon" v-if="leftExpanded">ℹ️</span>
              </button>
              <button @click="addBlock('contextual_dialogue')" class="btn-add-block" style="border-color:#6366f1" title="Roleplay a conversation with interactive blanks">
                <span class="btn-icon">💬</span>
                <span class="btn-text" v-if="leftExpanded">Dialogue</span>
                <span class="info-icon" v-if="leftExpanded">ℹ️</span>
              </button>
              <button @click="addBlock('flow_challenge')" class="btn-add-block" style="border-color:#6366f1" title="Fast-paced challenge against the clock">
                <span class="btn-icon">⏳</span>
                <span class="btn-text" v-if="leftExpanded">Flow Game</span>
                <span class="info-icon" v-if="leftExpanded">ℹ️</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Center Column: Worksheet Preview / List of active blocks -->
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
                <div v-if="block.content && (block.content.includes('$') || block.content.includes('$$'))" class="math-preview">
                  <span class="preview-label">✨ Math Formula Live Preview:</span>
                  <div class="preview-box" v-math="block.content"></div>
                </div>
              </div>

              <!-- Static Media/Audio Blocks -->
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

              <!-- YouTube Video Block -->
              <div v-if="block.type === 'video'" class="editor-row">
                <label>YouTube Video URL</label>
                <input type="text" v-model="block.url" placeholder="e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ" class="mb-2" />
                <span class="field-hint">Paste any YouTube link: youtube.com/watch?v=..., youtu.be/..., or youtube.com/embed/...</span>
                <input type="text" v-model="block.caption" placeholder="Optional caption..." class="mt-2 mb-3" />

                <div class="row-between mb-2">
                  <label>Timed Questions (optional)</label>
                  <div class="points-input">
                    Points: <input type="number" :value="block.points || 0" disabled />
                  </div>
                </div>
                <div v-for="(q, qIdx) in (block.questions || [])" :key="qIdx" class="pair-editor-row mb-2">
                  <div style="display:flex;flex-direction:column;gap:8px;flex:1">
                    <div style="display:grid;grid-template-columns:2fr 1fr 1fr 80px;gap:8px;align-items:center">
                      <input type="text" v-model="block.questions[qIdx].text" placeholder="Question text" @input="normalizeVideoQuestion(block, qIdx)" />
                      <select v-model="block.questions[qIdx].type" @change="normalizeVideoQuestion(block, qIdx)">
                        <option value="short_answer">Short Answer</option>
                        <option value="single_choice">Single Choice</option>
                        <option value="multiple_choice">Multiple Choice</option>
                        <option value="gap_fill">Gap Fill ((answer))</option>
                      </select>
                      <input type="number" min="0" step="1" v-model.number="block.questions[qIdx].timeSeconds" @input="normalizeVideoQuestion(block, qIdx)" placeholder="Pause at (s)" />
                      <input type="number" min="1" step="1" v-model.number="block.questions[qIdx].points" @input="recalculateVideoBlockPoints(block)" title="Question points" />
                    </div>
                    <div v-if="block.questions[qIdx].type === 'single_choice' || block.questions[qIdx].type === 'multiple_choice'">
                      <div v-for="(opt, oIdx) in (block.questions[qIdx].options || [])" :key="oIdx" class="option-editor-row mb-2">
                        <input
                          v-if="block.questions[qIdx].type === 'multiple_choice'"
                          type="checkbox"
                          :checked="Array.isArray(block.questions[qIdx].correct) && block.questions[qIdx].correct.includes(oIdx)"
                          @change="toggleVideoMcCorrect(block, qIdx, oIdx)"
                        />
                        <input
                          v-else
                          type="radio"
                          :name="`video-sc-${block.id}-${qIdx}`"
                          :checked="block.questions[qIdx].correct === oIdx"
                          @change="block.questions[qIdx].correct = oIdx"
                        />
                        <input type="text" v-model="block.questions[qIdx].options[oIdx]" placeholder="Option text" />
                        <button @click="removeVideoOption(block, qIdx, oIdx)" class="btn-sm btn-danger">×</button>
                      </div>
                      <button @click="addVideoOption(block, qIdx)" class="btn btn-secondary btn-sm">＋ Add Option</button>
                    </div>
                    <textarea
                      v-if="block.questions[qIdx].type === 'gap_fill'"
                      v-model="block.questions[qIdx].template"
                      @input="normalizeVideoQuestion(block, qIdx)"
                      placeholder="e.g. She ((has gone)) to school already."
                      rows="2"
                    ></textarea>
                    <input
                      v-if="block.questions[qIdx].type === 'short_answer'"
                      type="text"
                      v-model="block.questions[qIdx].sample_answer"
                      @input="normalizeVideoQuestion(block, qIdx)"
                      placeholder="Optional expected answer for grading"
                    />
                  </div>
                  <button @click="removeVideoQuestion(block, qIdx)" class="btn-sm btn-danger">×</button>
                </div>
                <button @click="addVideoQuestion(block)" class="btn btn-secondary btn-sm">
                  ＋ Add Question
                </button>
              </div>

              <!-- Read Aloud (TTS) Block -->
              <div v-if="block.type === 'tts_text'" class="editor-row">
                <label>Read Aloud Block Label / Title</label>
                <input type="text" v-model="block.label" placeholder="e.g. Listen and Read" class="mb-3" />
                
                <label>Text to read aloud</label>
                <textarea 
                  v-model="block.text" 
                  placeholder="Paste the text you want the voice to read aloud here..." 
                  rows="4"
                  class="mb-3"
                ></textarea>
                
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px;" class="mb-3">
                  <div>
                    <label>Language</label>
                    <select v-model="block.language" @change="onLanguageChange(block)">
                      <option value="de-AT">Austrian German (de-AT)</option>
                      <option value="de-DE">Standard German (de-DE)</option>
                      <option value="en-US">US English (en-US)</option>
                      <option value="en-GB">UK English (en-GB)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label>Engine</label>
                    <select v-model="block.engine" @change="onLanguageChange(block)">
                      <option value="cloud">Edge Neural (Cloud)</option>
                      <option value="local">SAPI5 (Local Fallback)</option>
                    </select>
                  </div>
                  
                  <div v-if="block.engine === 'cloud'">
                    <label>Voice / Tone</label>
                    <select v-model="block.voice">
                      <option v-for="v in getVoicesForLang(block.language)" :key="v.value" :value="v.value">
                        {{ v.name }}
                      </option>
                    </select>
                  </div>
                </div>

                <div class="audio-generation-hud" style="display: flex; gap: 12px; align-items: center;">
                  <button 
                    @click="generateTTSAudio(block)" 
                    class="btn btn-primary"
                    :disabled="isGeneratingTTS[block.id] || !block.text || !block.text.trim()"
                  >
                    <span v-if="isGeneratingTTS[block.id]">⏳ Generating...</span>
                    <span v-else>🗣️ Generate Audio File</span>
                  </button>
                  <span class="field-hint" v-if="block.url" style="color: var(--success); font-weight: 600; margin: 0;">
                    ✓ Audio generated successfully!
                  </span>
                  <span class="field-hint" v-else style="margin: 0;">
                    ⚠️ Click to generate the audio file.
                  </span>
                </div>
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
                <div v-if="block.instruction && block.instruction.includes('$')" class="math-preview mb-2">
                  <span class="preview-label">✨ Math Instruction Live Preview:</span>
                  <div class="preview-box" v-math="block.instruction"></div>
                </div>
                <label>Sentence Template (Put correct answers inside double parentheses)</label>
                <textarea 
                  v-model="block.template" 
                  placeholder="e.g. She ((has gone)) to school already. We ((have played)) basketball." 
                  rows="3"
                ></textarea>
                <span class="field-hint">Student sees: She ______ to school already. Correct answer is "has gone" (multi-word answers are allowed).</span>
                <div v-if="block.template && (block.template.includes('$') || block.template.includes('(('))" class="math-preview mt-2">
                  <span class="preview-label">✨ Template Live Preview:</span>
                  <div class="preview-box" v-math="getGapFillPreview(block.template)"></div>
                </div>
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

                <label>Add Target Sentences (Use ((word)) to indicate drop zones. Ensure count matches items)</label>
                <div v-for="(target, tIdx) in block.targets" :key="tIdx" class="target-editor-row mb-2">
                  <input type="text" v-model="block.targets[tIdx]" placeholder="e.g. She ((has)) left." />
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

              <!-- Short Answer -->
              <div v-if="block.type === 'short_answer'" class="editor-row">
                <div class="row-between">
                  <label>Prompt</label>
                  <div class="points-input">
                    Points: <input type="number" v-model.number="block.points" min="1" />
                  </div>
                </div>
                <textarea v-model="block.prompt" rows="3" placeholder="Ask students for a short free-text response"></textarea>
                <div v-if="block.prompt && block.prompt.includes('$')" class="math-preview mt-2">
                  <span class="preview-label">✨ Math Prompt Live Preview:</span>
                  <div class="preview-box" v-math="block.prompt"></div>
                </div>
                <input type="text" v-model="block.sample_answer" placeholder="Optional sample answer (not shown to students)" class="mt-2" />
                <input type="text" v-model="block.keywordText" placeholder="Keyword list, comma-separated (for AI-style feedback)" class="mt-2" />
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

              <div
                v-if="builderMode === 'advanced' && !['text','image','audio'].includes(block.type)"
                class="editor-row"
              >
                <label>Hints (Light → Guided → Full, one per line)</label>
                <textarea
                  :value="(block.hints || []).join('\n')"
                  @input="updateHints(block, $event.target.value)"
                  rows="3"
                  placeholder="Hint 1&#10;Hint 2&#10;Hint 3"
                ></textarea>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Right Column: Settings, STEM, AI Copilot -->
      <div class="sidebar-panel card settings-panel" :class="{ collapsed: !rightExpanded }" @click="!rightExpanded && (rightExpanded = true)">
        <div class="panel-header-toggle">
          <div v-if="rightExpanded" class="panel-tabs">
            <button 
              type="button" 
              class="panel-tab-btn" 
              :class="{ active: rightTab === 'settings' }" 
              @click.stop="rightTab = 'settings'"
            >
              ⚙️ Settings
            </button>
            <button 
              type="button" 
              class="panel-tab-btn" 
              :class="{ active: rightTab === 'ai' }" 
              @click.stop="rightTab = 'ai'"
            >
              🪄 AI Generator
            </button>
          </div>
          <h3 v-else class="panel-title">⚙️/🪄</h3>
          <button class="btn-collapse" @click.stop="rightExpanded = !rightExpanded" :title="rightExpanded ? 'Collapse Panel' : 'Expand Panel'">
            {{ rightExpanded ? '▶' : '◀' }}
          </button>
        </div>

        <div v-if="rightExpanded" class="settings-content">
          <!-- Tab 1: Settings Content -->
          <div v-if="rightTab === 'settings'">
            <!-- General Settings -->
            <h3>General Settings</h3>
            <div class="form-group">
              <label>Builder Mode</label>
              <select v-model="builderMode">
                <option value="basic">Basic</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
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
              <div class="form-group" v-if="builderMode === 'advanced'">
                <label>Grade Level</label>
                <input type="text" v-model="sheet.grade_level" placeholder="e.g. 3a" />
              </div>
              <div class="form-group" v-if="builderMode === 'advanced'">
                <label>Tags</label>
                <input type="text" v-model="sheet.tags" placeholder="e.g. grammar, vocabulary, beginner" />
              </div>
            </div>
            <div class="form-group" v-if="builderMode === 'advanced'">
              <label>Rubric (one criterion per line: name|weight|description)</label>
              <textarea v-model="sheet.rubricText" rows="3" placeholder="Accuracy|50|Correctness of answers&#10;Clarity|25|Clear explanations"></textarea>
            </div>

            <!-- STEM Quick Presets — collapsible accordion -->
            <div class="stem-helper-section card glass mt-4">
              <button class="stem-accordion-toggle" @click="stemOpen = !stemOpen">
                <span>📐 STEM Quick Presets</span>
                <span class="stem-chevron" :class="{ open: stemOpen }">▾</span>
              </button>
              <transition name="stem-expand">
                <div v-if="stemOpen" class="stem-accordion-body">
                  <p class="field-hint mb-2">Click to insert preformatted LaTeX math/science exercises:</p>
                  <div class="stem-presets">
                    <button @click="insertSTEMPreset('quadratic')" class="btn btn-secondary btn-sm">📐 Math: Quadratic Equation (Gap Fill)</button>
                    <button @click="insertSTEMPreset('physics_velocity')" class="btn btn-secondary btn-sm">⚡ Physics: Velocity & Units (Short Answer)</button>
                    <button @click="insertSTEMPreset('chemistry_reaction')" class="btn btn-secondary btn-sm">🧪 Chem: Reaction Balancing (Gap Fill)</button>
                    <button @click="insertSTEMPreset('pythagorean')" class="btn btn-secondary btn-sm">📐 Geometry: Pythagorean (Short Answer)</button>
                  </div>
                </div>
              </transition>
            </div>
          </div>

          <!-- Tab 2: AI Content -->
          <div v-else-if="rightTab === 'ai'" class="ai-section">
            <h3>AI Worksheet Draft</h3>
            <button @click="openWizardModal" class="btn btn-primary" style="width: 100%; margin-bottom: 12px; font-weight: bold; background: linear-gradient(135deg, var(--primary) 0%, #6366f1 100%); color: white; border: none;">
              🪄 Launch AI Wizard
            </button>
            
            <div class="ai-divider">
              <span>OR MANUAL PROMPT</span>
            </div>

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
        </div>

        <div v-else class="panel-collapsed-icons">
          <div class="collapsed-icon-group" title="General Settings" @click="rightTab = 'settings'">⚙️</div>
          <div class="collapsed-icon-group" title="AI Copilot" @click="rightTab = 'ai'">🪄</div>
        </div>
      </div>
    </div>

    <!-- Live Preview Modal Overlay -->
    <div v-if="showLivePreview" class="preview-modal-overlay">
      <div class="preview-modal-card">
        <header class="modal-header">
          <h2>👀 Live Worksheet Preview</h2>
          <button @click="showLivePreview = false" class="btn-close">&times;</button>
        </header>

        <div class="preview-scroll-container">
          <!-- Sticky Info Bar -->
          <div class="live-sticky-bar glass">
            <div class="live-info">
              <h3>{{ sheet.title || 'Untitled Worksheet' }} <span class="badge badge-warning" style="margin-left: 8px;">Draft Preview</span></h3>
              <span class="live-sub">Interact and grade this worksheet locally without saving first.</span>
            </div>
            <div class="live-actions">
              <span class="live-points">{{ calculatedTotalPoints }} Points Max</span>
              <button v-if="!previewIsSubmitted" @click="submitLocalPreview" class="btn btn-primary">
                Grade Preview 🚀
              </button>
              <button v-else @click="resetLocalPreview" class="btn btn-secondary">
                Reset Preview
              </button>
              <button @click="showLivePreview = false" class="btn btn-secondary" style="margin-left: 8px;">
                Exit Preview
              </button>
            </div>
          </div>

          <!-- Graded Result Card -->
          <div v-if="previewIsSubmitted && previewFeedbackSummary" class="live-result-summary-card card glass">
            <div class="summary-emoji">🏆</div>
            <h3>Preview Graded!</h3>
            <p class="score-summary">
              You scored <strong>{{ previewFeedbackSummary.score }}</strong> out of <strong>{{ previewFeedbackSummary.maxScore }}</strong> points 
              ({{ previewFeedbackSummary.percentage }}%).
            </p>
            <div class="live-progress-bar-large">
              <div class="live-progress-fill" :style="{ width: `${previewFeedbackSummary.percentage}%` }"></div>
            </div>
            <p class="review-note">Check the color-coded feedback below to review correct/incorrect answers.</p>
          </div>

          <!-- Worksheet Body -->
          <div class="live-preview-body">
            <div 
              v-for="(block, idx) in previewBlocks" 
              :key="block.id || idx"
              class="live-block-container"
            >
              <!-- Dynamic Component Mapping -->
              <component 
                v-if="getExerciseComponent(block.type)"
                :is="getExerciseComponent(block.type)"
                v-model="previewAnswers[block.id]"
                :id="block.id"
                v-bind="block"
                :disabled="previewIsSubmitted"
                :feedback="previewFeedbackSummary?.feedback?.[block.id]"
                :correctAnswers="getCorrectAnswerData(block)"
                :correctAnswer="getSingleCorrectAnswerData(block)"
                :worksheetTitle="sheet.title"
              />

              <!-- Static Text Block -->
              <div v-else-if="block.type === 'text'" class="live-text-card card" v-math="block.content || ''"></div>
              
              
              <!-- Flashcards / Memory Match / Flow Challenge -->
              <div v-if="['flashcards', 'memory_match', 'flow_challenge'].includes(block.type)" class="editor-row">
                <label>Instruction</label>
                <input type="text" v-model="block.instruction" placeholder="e.g. Find the matching pairs" class="mb-2" />
                <label>Add vocabulary pairs (Format: Word = Translation)</label>
                <textarea 
                  v-model="block.rawText" 
                  @input="updateGamifiedPairs(block)"
                  placeholder="apple = Apfel\nbanana = Banane" 
                  rows="4"
                ></textarea>
                <span class="field-hint">Each line should contain an equals sign. Spaces around it are ignored.</span>
              </div>

              <!-- Word Scramble -->
              <div v-if="block.type === 'word_scramble'" class="editor-row">
                <div class="row-between">
                  <label>Instruction</label>
                  <div class="points-input">
                    Points: <input type="number" v-model.number="block.points" min="1" />
                  </div>
                </div>
                <input type="text" v-model="block.instruction" placeholder="e.g. Unscramble the letters" class="mb-2" />
                <label>Words & Clues (Format: word = clue)</label>
                <textarea 
                  v-model="block.rawText" 
                  @input="updateScrambleWords(block)"
                  placeholder="apple = A red fruit\nbanana = A yellow fruit" 
                  rows="4"
                ></textarea>
              </div>

              <!-- Semantic Sorter -->
              <div v-if="block.type === 'semantic_sorter'" class="editor-row">
                <div class="row-between">
                  <label>Instruction</label>
                  <div class="points-input">
                    Points: <input type="number" v-model.number="block.points" min="1" />
                  </div>
                </div>
                <input type="text" v-model="block.instruction" placeholder="e.g. Sort into categories" class="mb-2" />
                
                <div v-for="(cat, cIdx) in block.categories" :key="cIdx" class="category-editor-card card glass mb-2">
                  <div class="row-between mb-2">
                    <input type="text" v-model="cat.name" placeholder="Category Name (e.g. Fruits)" style="font-weight: bold; width: 60%;" />
                    <button @click="block.categories.splice(cIdx, 1)" class="btn-sm btn-danger">Delete Category</button>
                  </div>
                  <label>Words in this category (comma separated)</label>
                  <input type="text" :value="cat.words.join(', ')" @input="updateCategoryWords($event, cat)" placeholder="apple, banana, cherry" />
                </div>
                <button @click="block.categories.push({ name: 'New Category', words: [] })" class="btn btn-secondary btn-sm">＋ Add Category</button>
              </div>

              <!-- Contextual Dialogue -->
              <div v-if="block.type === 'contextual_dialogue'" class="editor-row">
                <div class="row-between">
                  <label>Instruction</label>
                  <div class="points-input">
                    Points: <input type="number" v-model.number="block.points" min="1" />
                  </div>
                </div>
                <input type="text" v-model="block.instruction" placeholder="e.g. Fill the gaps in the chat" class="mb-2" />
                
                <label>Dialogue Messages</label>
                <div v-for="(msg, mIdx) in block.messages" :key="mIdx" class="message-editor-row card glass mb-2">
                  <div class="row-between mb-2">
                    <select v-model="msg.sender" style="width: 120px;">
                      <option value="teacher">Left (Bot)</option>
                      <option value="student">Right (You)</option>
                    </select>
                    <label class="gap-toggle">
                      <input type="checkbox" v-model="msg.isGap" /> Has Gap?
                    </label>
                    <button @click="block.messages.splice(mIdx, 1)" class="btn-sm btn-danger">×</button>
                  </div>
                  
                  <div v-if="!msg.isGap">
                    <input type="text" v-model="msg.text" placeholder="Message text" class="w-full" />
                  </div>
                  <div v-else style="display: flex; gap: 8px; align-items: center;">
                    <input type="text" v-model="msg.textBefore" placeholder="Text before" style="flex: 1;" />
                    <input type="text" v-model="msg.answer" placeholder="Correct Answer" style="flex: 1; border: 2px solid var(--success);" />
                    <input type="text" v-model="msg.textAfter" placeholder="Text after" style="flex: 1;" />
                  </div>
                </div>
                <button @click="block.messages.push({ sender: 'student', isGap: false, text: '' })" class="btn btn-secondary btn-sm">＋ Add Message</button>
              </div>
              <!-- Static Media/Audio Blocks -->
              <MediaBlock v-if="block.type === 'image'" v-bind="block" />
              <AudioBlock v-else-if="block.type === 'audio'" v-bind="block" />
              <ReadAloudBlock v-else-if="block.type === 'tts_text'" v-bind="block" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Unified Worksheet Creation Wizard Modal Overlay -->
    <div v-if="showStartWizard" class="wizard-modal-overlay">
      <div class="wizard-modal-card">
        <!-- Loading State Overlay -->
        <div v-if="aiLoading || vocabWizardLoading" class="wizard-loading-container">
          <div class="wizard-spinner-emoji">🪄</div>
          <h3>{{ vocabWizardLoading ? 'Generating Course...' : 'Weaving Your Worksheet...' }}</h3>
          <p>{{ vocabWizardLoading ? 'Weaving your vocabulary into a gamified sequence. Please hold on.' : 'Our AI is generating exercises based on your specifications. Please hold on.' }}</p>
          <div class="wizard-progress-bar">
            <div class="wizard-progress-indefinite"></div>
          </div>
        </div>

        <template v-else>
          <header class="modal-header">
            <h2>✨ Worksheet Creation Wizard</h2>
            <button @click="showStartWizard = false" class="btn-close" v-if="isEditing || sheet.blocks.length > 0">&times;</button>
          </header>

          <div class="wizard-scroll-container">
            <!-- Phase 1: Choice between Manual, Vocabulary, or AI -->
            <div v-if="wizardTab === 'choice'" class="wizard-choice-stage">
              <h3 class="stage-title">How would you like to build this worksheet?</h3>
              <p class="stage-subtitle">Choose a path to get started with your new worksheet.</p>
              
              <div class="choice-cards-grid">
                <div @click="selectStartPath('manual')" class="choice-card hover-glow">
                  <div class="choice-icon">📝</div>
                  <h4>Standard / Manual</h4>
                  <p>Start with a blank canvas and add standard exercises like gap-fill, choice, or matching.</p>
                  <button class="btn btn-secondary">Create Standard</button>
                </div>

                <div @click="selectStartPath('vocab')" class="choice-card hover-glow">
                  <div class="choice-icon">🗂️</div>
                  <h4>Vocabulary Course</h4>
                  <p>Build vocabulary exercises, or paste a word list to auto-generate a gamified learning sequence.</p>
                  <button class="btn btn-secondary">Create Vocabulary</button>
                </div>

                <div @click="selectStartPath('ai')" class="choice-card hover-glow active-card">
                  <div class="choice-icon">🪄</div>
                  <h4>AI Worksheet Wizard</h4>
                  <p>Generate a complete worksheet with custom exercises in seconds using AI prompting.</p>
                  <button class="btn btn-primary">Open AI Wizard</button>
                </div>
              </div>
            </div>

            <!-- Phase 2: AI Configuration Wizard -->
            <div v-else-if="wizardTab === 'wizard'" class="wizard-config-stage">
              <div class="wizard-form">
                <div class="form-section">
                  <h4>1. General Information</h4>
                  <div class="form-group">
                    <label>Worksheet Topic <span class="required">*</span></label>
                    <input 
                      type="text" 
                      v-model="wizardData.topic" 
                      placeholder="e.g. Present Progressive, Basic Fractions, Animals Vocabulary" 
                      required
                      class="wizard-input-text"
                    />
                  </div>

                  <div class="wizard-form-row">
                    <div class="form-group">
                      <label>Subject</label>
                      <input type="text" v-model="wizardData.subject" placeholder="e.g. English" class="wizard-input-text" />
                    </div>
                    <div class="form-group">
                      <label>Grade Level / Class</label>
                      <input type="text" v-model="wizardData.grade_level" placeholder="e.g. 3a" class="wizard-input-text" />
                    </div>
                    <div class="form-group">
                      <label>Difficulty</label>
                      <select v-model="wizardData.difficulty" class="wizard-select">
                        <option value="Beginner">Beginner (A1/Basic)</option>
                        <option value="Intermediate">Intermediate (A2/B1)</option>
                        <option value="Advanced">Advanced (B2+)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div class="form-section">
                  <div class="section-header-row">
                    <h4>2. Select Exercise Quantities</h4>
                    <button type="button" @click="resetWizardCounts" class="btn-clear-counts">Reset Counts</button>
                  </div>
                  <p class="section-subtitle">Select which task types to generate and how many of each (max 15 total):</p>
                  
                  <div class="exercise-quantity-grid">
                    <div class="exercise-quantity-card">
                      <div class="eq-left">
                        <span class="eq-emoji">✏️</span>
                        <div class="eq-details">
                          <span class="eq-name">Gap Fill</span>
                          <span class="eq-desc">Sentences with blanks</span>
                        </div>
                      </div>
                      <div class="eq-right">
                        <button type="button" @click="decrementWizardCount('gap_fill')" class="btn-counter" :disabled="wizardData.counts.gap_fill <= 0">-</button>
                        <span class="eq-count">{{ wizardData.counts.gap_fill }}</span>
                        <button type="button" @click="incrementWizardCount('gap_fill')" class="btn-counter" :disabled="wizardData.counts.gap_fill >= 15">+</button>
                      </div>
                    </div>

                    <div class="exercise-quantity-card">
                      <div class="eq-left">
                        <span class="eq-emoji">👉</span>
                        <div class="eq-details">
                          <span class="eq-name">Drag & Drop</span>
                          <span class="eq-desc">Drag words to correct spots</span>
                        </div>
                      </div>
                      <div class="eq-right">
                        <button type="button" @click="decrementWizardCount('drag_drop')" class="btn-counter" :disabled="wizardData.counts.drag_drop <= 0">-</button>
                        <span class="eq-count">{{ wizardData.counts.drag_drop }}</span>
                        <button type="button" @click="incrementWizardCount('drag_drop')" class="btn-counter" :disabled="wizardData.counts.drag_drop >= 15">+</button>
                      </div>
                    </div>

                    <div class="exercise-quantity-card">
                      <div class="eq-left">
                        <span class="eq-emoji">☑️</span>
                        <div class="eq-details">
                          <span class="eq-name">Multiple Choice</span>
                          <span class="eq-desc">Select all correct options</span>
                        </div>
                      </div>
                      <div class="eq-right">
                        <button type="button" @click="decrementWizardCount('multiple_choice')" class="btn-counter" :disabled="wizardData.counts.multiple_choice <= 0">-</button>
                        <span class="eq-count">{{ wizardData.counts.multiple_choice }}</span>
                        <button type="button" @click="incrementWizardCount('multiple_choice')" class="btn-counter" :disabled="wizardData.counts.multiple_choice >= 15">+</button>
                      </div>
                    </div>

                    <div class="exercise-quantity-card">
                      <div class="eq-left">
                        <span class="eq-emoji">🔘</span>
                        <div class="eq-details">
                          <span class="eq-name">Single Choice</span>
                          <span class="eq-desc">Choose one correct answer</span>
                        </div>
                      </div>
                      <div class="eq-right">
                        <button type="button" @click="decrementWizardCount('single_choice')" class="btn-counter" :disabled="wizardData.counts.single_choice <= 0">-</button>
                        <span class="eq-count">{{ wizardData.counts.single_choice }}</span>
                        <button type="button" @click="incrementWizardCount('single_choice')" class="btn-counter" :disabled="wizardData.counts.single_choice >= 15">+</button>
                      </div>
                    </div>

                    <div class="exercise-quantity-card">
                      <div class="eq-left">
                        <span class="eq-emoji">🔗</span>
                        <div class="eq-details">
                          <span class="eq-name">Connect Texts</span>
                          <span class="eq-desc">Match corresponding phrases</span>
                        </div>
                      </div>
                      <div class="eq-right">
                        <button type="button" @click="decrementWizardCount('matching')" class="btn-counter" :disabled="wizardData.counts.matching <= 0">-</button>
                        <span class="eq-count">{{ wizardData.counts.matching }}</span>
                        <button type="button" @click="incrementWizardCount('matching')" class="btn-counter" :disabled="wizardData.counts.matching >= 15">+</button>
                      </div>
                    </div>

                    <div class="exercise-quantity-card">
                      <div class="eq-left">
                        <span class="eq-emoji">📖</span>
                        <div class="eq-details">
                          <span class="eq-name">Vocabulary</span>
                          <span class="eq-desc">Key word translation lists</span>
                        </div>
                      </div>
                      <div class="eq-right">
                        <button type="button" @click="decrementWizardCount('vocabulary')" class="btn-counter" :disabled="wizardData.counts.vocabulary <= 0">-</button>
                        <span class="eq-count">{{ wizardData.counts.vocabulary }}</span>
                        <button type="button" @click="incrementWizardCount('vocabulary')" class="btn-counter" :disabled="wizardData.counts.vocabulary >= 15">+</button>
                      </div>
                    </div>

                    <div class="exercise-quantity-card">
                      <div class="eq-left">
                        <span class="eq-emoji">📝</span>
                        <div class="eq-details">
                          <span class="eq-name">Text Explanation</span>
                          <span class="eq-desc">Grammar rules or readings</span>
                        </div>
                      </div>
                      <div class="eq-right">
                        <button type="button" @click="decrementWizardCount('text')" class="btn-counter" :disabled="wizardData.counts.text <= 0">-</button>
                        <span class="eq-count">{{ wizardData.counts.text }}</span>
                        <button type="button" @click="incrementWizardCount('text')" class="btn-counter" :disabled="wizardData.counts.text >= 15">+</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="form-section">
                  <h4>3. Special Instructions / Rules (Optional)</h4>
                  <div class="form-group">
                    <textarea 
                      v-model="wizardData.customRules" 
                      rows="3" 
                      placeholder="e.g. use active verbs, focus on daily routines, include a short story about school life, keep sentences funny"
                      class="wizard-textarea"
                    ></textarea>
                  </div>
                </div>

                <div class="wizard-footer-settings">
                  <div class="wizard-provider-group">
                    <label>AI Model Provider:</label>
                    <select v-model="wizardData.provider" class="wizard-select wizard-provider-select">
                      <option value="gemini">Gemini API</option>
                      <option value="ollama">Ollama (local)</option>
                      <option value="auto">Auto (Gemini fallback to Ollama)</option>
                    </select>
                  </div>
                  <div class="wizard-form-actions">
                    <button 
                      type="button" 
                      @click="isEditing || sheet.blocks.length > 0 ? (showStartWizard = false) : (wizardTab = 'choice')" 
                      class="btn btn-secondary"
                    >
                      Back
                    </button>
                    <button 
                      type="button" 
                      @click="generateFromWizard" 
                      :disabled="aiLoading" 
                      class="btn btn-primary btn-generate-magic"
                    >
                      Generate Worksheet 🚀
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Phase 3: Vocabulary Course Setup Choice -->
            <div v-else-if="wizardTab === 'vocab_setup'" class="wizard-config-stage">
              <div class="wizard-form">
                <div class="form-section">
                  <h4>✨ Create Vocabulary Worksheet</h4>
                  <p class="section-subtitle">Choose how you'd like to construct your vocabulary course:</p>
                  
                  <div class="choice-cards-grid mb-4" style="grid-template-columns: 1fr 1fr; max-width: 600px; margin: 0 auto;">
                    <div @click="startBlankVocab" class="choice-card hover-glow" style="padding: 20px 16px;">
                      <div class="choice-icon" style="font-size: 32px; margin-bottom: 8px;">📝</div>
                      <h4 style="font-size: 15px; margin-bottom: 6px;">Start Blank Course</h4>
                      <p style="font-size: 12px; margin-bottom: 12px;">Create a blank canvas to manually add vocabulary and gamified modules.</p>
                      <button class="btn btn-secondary btn-sm" style="pointer-events: none;">Start Blank</button>
                    </div>

                    <div @click="vocabWizardType = 'standard'; vocabWizardRaw = ''; wizardTab = 'vocab_paste'" class="choice-card hover-glow active-card" style="padding: 20px 16px;">
                      <div class="choice-icon" style="font-size: 32px; margin-bottom: 8px;">🪄</div>
                      <h4 style="font-size: 15px; margin-bottom: 6px;">Paste Vocab List</h4>
                      <p style="font-size: 12px; margin-bottom: 12px;">Generate a full standard or neuro-gamified course from a list of words.</p>
                      <button class="btn btn-primary btn-sm" style="pointer-events: none;">Paste List</button>
                    </div>
                  </div>
                </div>
                
                <div class="wizard-footer-settings">
                  <div class="wizard-form-actions" style="margin-left: auto;">
                    <button type="button" @click="wizardTab = 'choice'" class="btn btn-secondary">Back</button>
                  </div>
                </div>
              </div>
            </div>

            <!-- Phase 4: Paste Vocabulary List -->
            <div v-else-if="wizardTab === 'vocab_paste'" class="wizard-config-stage">
              <div class="wizard-form">
                <div class="form-section">
                  <h4>Paste Vocabulary List</h4>
                  <p class="section-subtitle">We will automatically generate a progressive sequence of gamified exercises to teach these words.</p>
                  
                  <div class="form-group">
                    <label>Vocabulary List (Format: English = Deutsch)</label>
                    <textarea 
                      v-model="vocabWizardRaw" 
                      rows="8" 
                      class="wizard-textarea" 
                      placeholder="apple = Apfel&#10;banana = Banane&#10;to go = gehen"
                    ></textarea>
                  </div>
                  
                  <div class="form-group mt-3">
                    <label>Generator Mode</label>
                    <select v-model="vocabWizardType" class="wizard-select">
                      <option value="standard">Standard (Generated instantly in-browser)</option>
                      <option value="neuro">Neuro-Gamified (Powered by Gemini AI)</option>
                    </select>
                  </div>
                </div>
                
                <div class="wizard-footer-settings">
                  <div class="wizard-form-actions">
                    <button type="button" @click="vocabWizardType === 'standard' ? (wizardTab = 'vocab_setup') : (wizardTab = 'choice')" class="btn btn-secondary">Back</button>
                    <button 
                      type="button" 
                      @click="generateVocabCourse" 
                      :disabled="vocabWizardLoading" 
                      class="btn btn-primary btn-generate-magic"
                    >
                      🪄 Generate Magic Worksheet
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'

const getGapFillPreview = (template) => {
  if (!template) return ''
  return template.replace(/\(\(([^)]+)\)\)/g, ' ______ ')
}
import { useRouter, useRoute } from 'vue-router'
import GapFill from '../components/exercises/GapFill.vue'
import DragDrop from '../components/exercises/DragDrop.vue'
import MultipleChoice from '../components/exercises/MultipleChoice.vue'
import SingleChoice from '../components/exercises/SingleChoice.vue'
import Matching from '../components/exercises/Matching.vue'
import MediaBlock from '../components/exercises/MediaBlock.vue'
import AudioBlock from '../components/exercises/AudioBlock.vue'
import ReadAloudBlock from '../components/exercises/ReadAloudBlock.vue'
import Vocabulary from '../components/exercises/Vocabulary.vue'
import ShortAnswer from '../components/exercises/ShortAnswer.vue'

const router = useRouter()
const route = useRoute()
const isEditing = ref(false)
const isGeneratingTTS = ref({})
const saving = ref(false)
const aiLoading = ref(false)
const aiProvider = ref('gemini')
const aiPrompt = ref('')
const builderMode = ref('basic')
const stemOpen = ref(false)
const leftExpanded = ref(true)
const rightExpanded = ref(true)
const worksheetType = ref('manual')
const rightTab = ref('settings')

const openSettings = () => {
  if (rightExpanded.value && rightTab.value === 'settings') {
    rightExpanded.value = false
  } else {
    rightTab.value = 'settings'
    rightExpanded.value = true
  }
}

const openAiPanel = () => {
  if (rightExpanded.value && rightTab.value === 'ai') {
    rightExpanded.value = false
  } else {
    rightTab.value = 'ai'
    rightExpanded.value = true
  }
}

const selectStartPath = (path) => {
  if (path === 'manual') {
    worksheetType.value = 'manual'
    showStartWizard.value = false
  } else if (path === 'vocab') {
    worksheetType.value = 'vocab'
    wizardTab.value = 'vocab_setup'
  } else if (path === 'ai') {
    worksheetType.value = 'manual'
    wizardTab.value = 'wizard'
  }
}

const startBlankVocab = () => {
  worksheetType.value = 'vocab'
  sheet.value.blocks = []
  showStartWizard.value = false
}

// AI Wizard State Variables
const showStartWizard = ref(false)
const wizardTab = ref('choice') // 'choice' or 'wizard'
const wizardData = ref({
  topic: '',
  subject: 'English',
  grade_level: '',
  difficulty: 'Intermediate',
  provider: 'gemini',
  customRules: '',
  counts: {
    gap_fill: 0,
    drag_drop: 0,
    multiple_choice: 0,
    single_choice: 0,
    matching: 0,
    vocabulary: 0,
    text: 0
  }
})

const incrementWizardCount = (type) => {
  if (wizardData.value.counts[type] !== undefined && wizardData.value.counts[type] < 15) {
    wizardData.value.counts[type]++
  }
}

const decrementWizardCount = (type) => {
  if (wizardData.value.counts[type] !== undefined && wizardData.value.counts[type] > 0) {
    wizardData.value.counts[type]--
  }
}

const resetWizardCounts = () => {
  Object.keys(wizardData.value.counts).forEach(key => {
    wizardData.value.counts[key] = 0
  })
}

const openWizardModal = () => {
  wizardTab.value = 'choice'
  wizardData.value.subject = sheet.value.subject || 'English'
  wizardData.value.grade_level = sheet.value.grade_level || ''
  wizardData.value.provider = aiProvider.value
  showStartWizard.value = true
}

const sheet = ref({
  title: '',
  description: '',
  subject: '',
  grade_level: '',
  tags: '',
  rubricText: '',
  blocks: []
})

const API_BASE = '/api'

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
        tags: data.tags || '',
        rubricText: Array.isArray(data.rubric?.criteria)
          ? data.rubric.criteria.map(c => `${c.name || ''}|${c.weight || ''}|${c.description || ''}`).join('\n')
          : '',
        blocks: data.content?.blocks || []
      }
    } catch (err) {
      alert(err.message)
      router.push('/teacher')
    }
  } else {
    showStartWizard.value = true
    wizardTab.value = 'choice'
  }
  
  // Auto-detect worksheet mode based on existing blocks
  const gamifiedTypes = ['flashcards', 'memory_match', 'word_scramble', 'semantic_sorter', 'contextual_dialogue', 'flow_challenge', 'vocabulary']
  const hasVocabBlocks = sheet.value.blocks.some(b => gamifiedTypes.includes(b.type))
  worksheetType.value = hasVocabBlocks ? 'vocab' : 'manual'
})

// Block creation helper
const insertSTEMPreset = (presetType) => {
  const id = `q_${Math.random().toString(36).substr(2, 9)}`
  let presetBlock = {}

  if (presetType === 'quadratic') {
    presetBlock = {
      id,
      type: 'gap_fill',
      points: 3,
      instruction: 'Solve the quadratic equation using the quadratic formula: $$x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}$$',
      template: 'For the equation $x^2 - 5x + 6 = 0$, we have $a = ((1))$, $b = ((-5))$, and $c = ((6))$. The discriminant $D = b^2 - 4ac$ is ((1)). The solutions are $x_1 = ((3))$ and $x_2 = ((2))$.'
    }
  } else if (presetType === 'physics_velocity') {
    presetBlock = {
      id,
      type: 'short_answer',
      points: 2,
      prompt: 'A car travels a distance of $d = 100\\text{ km}$ in $t = 1.5\\text{ hours}$. Calculate its average velocity in meters per second ($\\text{m/s}$). (Note: round to 2 decimal places. $1\\text{ m/s} = 3.6\\text{ km/h}$).',
      sample_answer: '18.52 m/s',
      keywordText: '18.52 m/s, 18.5 m/s'
    }
  } else if (presetType === 'chemistry_reaction') {
    presetBlock = {
      id,
      type: 'gap_fill',
      points: 3,
      instruction: 'Balance the combustion reaction of propane.',
      template: '$$\\text{C}_3\\text{H}_8 + ((5))\\text{O}_2 \\rightarrow ((3))\\text{CO}_2 + ((4))\\text{H}_2\\text{O}$$'
    }
  } else if (presetType === 'pythagorean') {
    presetBlock = {
      id,
      type: 'short_answer',
      points: 2,
      prompt: 'In a right-angled triangle, the lengths of the two legs are $a = 6\\text{ cm}$ and $b = 8\\text{ cm}$. Find the length of the hypotenuse $c$ in centimeters.',
      sample_answer: '10 cm',
      keywordText: '10 cm, 10'
    }
  }

  sheet.value.blocks.push(presetBlock)
}

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
    case 'tts_text':
      baseBlock.points = 0
      baseBlock.label = 'Read Aloud'
      baseBlock.text = ''
      baseBlock.language = 'de-AT'
      baseBlock.engine = 'cloud'
      baseBlock.voice = 'de-AT-IngridNeural'
      baseBlock.url = ''
      break
    case 'gap_fill':
      baseBlock.instruction = 'Fill in the blanks.'
      baseBlock.template = 'She ((has gone)) to school already.'
      break
    case 'drag_drop':
      baseBlock.instruction = 'Drag the words to correct gaps.'
      baseBlock.items = ['has gone', 'have gone']
      baseBlock.targets = ['She ((has gone)) to school already.', 'They ((have gone)) to school already.']
      baseBlock.answers = { '0': 'has gone', '1': 'have gone' }
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
    case 'short_answer':
      baseBlock.prompt = 'Explain your answer in 3-5 sentences.'
      baseBlock.sample_answer = ''
      baseBlock.keywordText = ''
      break
    case 'flashcards':
    case 'memory_match':
    case 'flow_challenge':
      baseBlock.instruction = type === 'flashcards' ? 'Study the flashcards.' : (type === 'memory_match' ? 'Find the matching pairs.' : 'Test your fluency. Fast!')
      baseBlock.rawText = 'apple = Apfel\nbanana = Banane\ncherry = Kirsche'
      baseBlock.pairs = [
        { l: 'apple', r: 'Apfel' },
        { l: 'banana', r: 'Banane' },
        { l: 'cherry', r: 'Kirsche' }
      ]
      break
    case 'word_scramble':
      baseBlock.instruction = 'Unscramble the letters.'
      baseBlock.rawText = 'apple = A red fruit\nbanana = A yellow fruit'
      baseBlock.words = [{ word: 'apple', clue: 'A red fruit' }, { word: 'banana', clue: 'A yellow fruit' }]
      break
    case 'semantic_sorter':
      baseBlock.instruction = 'Sort into categories.'
      baseBlock.categories = [
        { name: 'Fruits', words: ['apple', 'banana'] },
        { name: 'Colors', words: ['red', 'blue'] }
      ]
      break
    case 'contextual_dialogue':
      baseBlock.instruction = 'Fill the gaps in the chat.'
      baseBlock.messages = [
        { sender: 'teacher', isGap: false, text: 'Hello, how are you?' },
        { sender: 'student', isGap: true, textBefore: 'I am doing ', textAfter: '.', answer: 'well' }
      ]
      break
    case 'video':
      baseBlock.points = 0
      baseBlock.url = ''
      baseBlock.caption = ''
      baseBlock.questions = []
      break
  }

  if (!['text', 'image', 'audio', 'tts_text'].includes(type)) {
    const subjectHint = sheet.value.subject ? `Relate your answer to ${sheet.value.subject}.` : 'Relate your answer to the lesson topic.'
    baseBlock.hints = ['Think about the core concept first.', subjectHint, 'Break the task into smaller steps.']
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

const normalizeBlockForEditing = (block) => {
  if (block.type === 'video') {
    block.questions = Array.isArray(block.questions) ? block.questions : []
    block.questions.forEach((_, idx) => normalizeVideoQuestion(block, idx))
    recalculateVideoBlockPoints(block)
  }
  return block
}

const normalizeBlocksForEditing = (blocks) => {
  return (Array.isArray(blocks) ? blocks : []).map(block => normalizeBlockForEditing(block))
}

// TTS Audio Generation Helpers
const getVoicesForLang = (lang) => {
  switch (lang) {
    case 'de-AT':
      return [
        { value: 'de-AT-IngridNeural', name: 'Ingrid (Female)' },
        { value: 'de-AT-JonasNeural', name: 'Jonas (Male)' }
      ]
    case 'de-DE':
      return [
        { value: 'de-DE-KatjaNeural', name: 'Katja (Female)' },
        { value: 'de-DE-ConradNeural', name: 'Conrad (Male)' },
        { value: 'de-DE-KillianNeural', name: 'Killian (Male)' }
      ]
    case 'en-US':
      return [
        { value: 'en-US-JennyNeural', name: 'Jenny (Female)' },
        { value: 'en-US-GuyNeural', name: 'Guy (Male)' },
        { value: 'en-US-AriaNeural', name: 'Aria (Female)' }
      ]
    case 'en-GB':
      return [
        { value: 'en-GB-SoniaNeural', name: 'Sonia (Female)' },
        { value: 'en-GB-RyanNeural', name: 'Ryan (Male)' },
        { value: 'en-GB-LibbyNeural', name: 'Libby (Female)' }
      ]
    default:
      return []
  }
}

const onLanguageChange = (block) => {
  const voices = getVoicesForLang(block.language)
  if (voices.length > 0) {
    block.voice = voices[0].value
  } else {
    block.voice = ''
  }
}

const generateTTSAudio = async (block) => {
  if (!block.text || !block.text.trim()) return
  
  isGeneratingTTS.value[block.id] = true
  const token = localStorage.getItem('token')
  
  try {
    const response = await fetch('/api/worksheets/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        text: block.text,
        language: block.language,
        engine: block.engine,
        voice: block.voice
      })
    })
    
    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to generate TTS audio')
    }
    
    const data = await response.json()
    block.url = data.url
    
    // Play preview of the generated audio
    const audioUrl = data.url.startsWith('http') ? data.url : `${data.url}`
    const previewAudio = new Audio(audioUrl)
    previewAudio.play().catch(err => console.log('Audio preview block autoplay prevented:', err))
  } catch (err) {
    alert(err.message || 'Error generating TTS audio')
  } finally {
    isGeneratingTTS.value[block.id] = false
  }
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

const recalculateVideoBlockPoints = (block) => {
  const questions = Array.isArray(block.questions) ? block.questions : []
  block.points = questions.reduce((sum, q) => sum + (Number(q?.points) || 1), 0)
}

const normalizeVideoQuestion = (block, qIdx) => {
  const q = block.questions?.[qIdx]
  if (!q) return
  q.type = q.type || 'short_answer'
  q.points = Math.max(1, Number(q.points) || 1)
  q.timeSeconds = Number.isFinite(Number(q.timeSeconds)) ? Math.max(0, Number(q.timeSeconds)) : null
  if (q.type === 'multiple_choice') {
    q.options = Array.isArray(q.options) && q.options.length ? q.options : ['', '']
    q.correct = Array.isArray(q.correct) ? q.correct : []
  } else if (q.type === 'single_choice') {
    q.options = Array.isArray(q.options) && q.options.length ? q.options : ['', '']
    q.correct = Number.isFinite(Number(q.correct)) ? Number(q.correct) : 0
  } else if (q.type === 'gap_fill') {
    q.template = q.template || q.text || ''
  } else {
    q.sample_answer = q.sample_answer || ''
  }
  recalculateVideoBlockPoints(block)
}

const addVideoQuestion = (block) => {
  if (!Array.isArray(block.questions)) block.questions = []
  block.questions.push({
    text: '',
    type: 'short_answer',
    timeSeconds: null,
    points: 1,
    sample_answer: ''
  })
  normalizeVideoQuestion(block, block.questions.length - 1)
}

const removeVideoQuestion = (block, qIdx) => {
  if (!Array.isArray(block.questions)) return
  block.questions.splice(qIdx, 1)
  recalculateVideoBlockPoints(block)
}

const addVideoOption = (block, qIdx) => {
  const q = block.questions?.[qIdx]
  if (!q) return
  q.options = Array.isArray(q.options) ? q.options : []
  q.options.push('')
}

const removeVideoOption = (block, qIdx, oIdx) => {
  const q = block.questions?.[qIdx]
  if (!q || !Array.isArray(q.options)) return
  q.options.splice(oIdx, 1)
  if (q.type === 'multiple_choice') {
    q.correct = (q.correct || []).filter(idx => idx !== oIdx).map(idx => idx > oIdx ? idx - 1 : idx)
  } else if (q.type === 'single_choice' && q.correct === oIdx) {
    q.correct = 0
  }
}

const toggleVideoMcCorrect = (block, qIdx, oIdx) => {
  const q = block.questions?.[qIdx]
  if (!q) return
  q.correct = Array.isArray(q.correct) ? q.correct : []
  const pos = q.correct.indexOf(oIdx)
  if (pos > -1) q.correct.splice(pos, 1)
  else q.correct.push(oIdx)
}

// Matching pairs utilities
const addPair = (block) => {
  block.pairs.push(['', ''])
}

const removePair = (block, idx) => {
  block.pairs.splice(idx, 1)
}

// Vocabulary utilities

// Gamification updater functions
const updateGamifiedPairs = (block) => {
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

const updateScrambleWords = (block) => {
  const text = block.rawText || ''
  const lines = text.split('\n')
  const words = []
  lines.forEach(line => {
    const cleaned = line.trim()
    if (!cleaned) return
    const parts = cleaned.split(/\s*=\s*|\s*-\s*|\s*:\s*|,\s*/)
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
const vocabWizardType = ref('standard')
const vocabWizardRaw = ref('')
const vocabWizardLoading = ref(false)

const openVocabWizard = (type) => {
  worksheetType.value = 'vocab'
  vocabWizardType.value = type
  vocabWizardRaw.value = ''
  wizardTab.value = 'vocab_paste'
  showStartWizard.value = true
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
      content: '## Vocabulary Course\nWelcome to your customized vocabulary training. Follow the steps below to master these words.'
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

    showStartWizard.value = false
    vocabWizardLoading.value = false
  } else {
    // Neuro-Gamified (Needs Backend / Gemini API)
    const token = localStorage.getItem('token')
    try {
      const resp = await fetch('/api/worksheets/ai/neuro-vocab', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          rawList: vocabWizardRaw.value
        })
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data?.error || 'AI generation failed')
      
      sheet.value.blocks = normalizeBlocksForEditing(data.blocks || [])
      showStartWizard.value = false
    } catch (err) {
      alert(err.message)
    } finally {
      vocabWizardLoading.value = false
    }
  }
}

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

const updateHints = (block, rawText) => {
  block.hints = String(rawText || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .slice(0, 3)
}

const generateFromWizard = async () => {
  if (!wizardData.value.topic.trim()) {
    alert('Please enter a topic!')
    return
  }

  aiLoading.value = true
  const token = localStorage.getItem('token')

  // Construct structured detailed instructions prompt for LLM based on counts
  const parts = []
  parts.push(`Create an educational worksheet about "${wizardData.value.topic.trim()}" for grade level/class "${wizardData.value.grade_level.trim() || 'any'}" (subject: "${wizardData.value.subject.trim() || 'English'}", difficulty level: "${wizardData.value.difficulty}").`)

  const tasksRequested = []
  if (wizardData.value.counts.text > 0) {
    tasksRequested.push(`${wizardData.value.counts.text} text instruction/reading passage block(s) (type: "text")`)
  }
  if (wizardData.value.counts.gap_fill > 0) {
    tasksRequested.push(`${wizardData.value.counts.gap_fill} gap fill exercise(s) (type: "gap_fill")`)
  }
  if (wizardData.value.counts.drag_drop > 0) {
    tasksRequested.push(`${wizardData.value.counts.drag_drop} drag and drop exercise(s) (type: "drag_drop")`)
  }
  if (wizardData.value.counts.multiple_choice > 0) {
    tasksRequested.push(`${wizardData.value.counts.multiple_choice} multiple choice question(s) (type: "multiple_choice")`)
  }
  if (wizardData.value.counts.single_choice > 0) {
    tasksRequested.push(`${wizardData.value.counts.single_choice} single choice question(s) (type: "single_choice")`)
  }
  if (wizardData.value.counts.matching > 0) {
    tasksRequested.push(`${wizardData.value.counts.matching} text matching / connect phrases exercise(s) (type: "matching")`)
  }
  if (wizardData.value.counts.vocabulary > 0) {
    tasksRequested.push(`${wizardData.value.counts.vocabulary} vocabulary translation exercise(s) (type: "vocabulary")`)
  }

  if (tasksRequested.length > 0) {
    parts.push(`The worksheet MUST contain exactly the following content blocks in this sequence:`)
    tasksRequested.forEach((task, idx) => {
      parts.push(`${idx + 1}. ${task}`)
    })
  } else {
    parts.push(`Please include a standard mix of text instructions, gap fill, and multiple choice questions.`)
  }

  if (wizardData.value.customRules.trim()) {
    parts.push(`Additional guidelines: ${wizardData.value.customRules.trim()}`)
  }

  const promptText = parts.join('\n')

  try {
    const resp = await fetch(`${API_BASE}/worksheets/ai/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        provider: wizardData.value.provider,
        prompt: promptText
      })
    })
    const data = await resp.json()
    if (!resp.ok) throw new Error(data?.error || 'AI generation failed')

    sheet.value.title = data.title || sheet.value.title
    sheet.value.description = data.description || sheet.value.description
    sheet.value.subject = data.subject || sheet.value.subject
    sheet.value.grade_level = data.grade_level || sheet.value.grade_level
    sheet.value.blocks = normalizeBlocksForEditing(Array.isArray(data.content?.blocks) ? data.content.blocks : [])

    showStartWizard.value = false
  } catch (err) {
    alert(err.message)
  } finally {
    aiLoading.value = false
  }
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
    sheet.value.blocks = normalizeBlocksForEditing(Array.isArray(data.content?.blocks) ? data.content.blocks : [])
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

  const rubricLines = (sheet.value.rubricText || '')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
  const invalidRubricLine = rubricLines.find(line => line.split('|').length < 3)
  if (invalidRubricLine) {
    alert('Rubric format error. Use "name|weight|description" for each rubric line.')
    return
  }
  const rubric = {
    criteria: rubricLines.map(line => {
      const [name, weight, description] = line.split('|').map(v => (v || '').trim())
      return {
        name: name || 'Criterion',
        weight: Number.isFinite(Number(weight)) ? Number(weight) : 0,
        description: description || ''
      }
    })
  }
  const normalizedBlocks = sheet.value.blocks.map(block => {
    if (block.type === 'short_answer') {
      const keywords = String(block.keywordText || '')
        .split(',')
        .map(v => v.trim())
        .filter(Boolean)
        .slice(0, 10)
      return { ...block, keywords }
    }
    if (block.type === 'video') {
      const questions = (Array.isArray(block.questions) ? block.questions : []).map(question => {
        const type = question.type || 'short_answer'
        const base = {
          text: question.text || '',
          type,
          timeSeconds: Number.isFinite(Number(question.timeSeconds)) ? Math.max(0, Number(question.timeSeconds)) : null,
          points: Math.max(1, Number(question.points) || 1)
        }
        if (type === 'single_choice') {
          return {
            ...base,
            options: Array.isArray(question.options) ? question.options : [],
            correct: Number.isFinite(Number(question.correct)) ? Number(question.correct) : 0
          }
        }
        if (type === 'multiple_choice') {
          return {
            ...base,
            options: Array.isArray(question.options) ? question.options : [],
            correct: Array.isArray(question.correct) ? question.correct : []
          }
        }
        if (type === 'gap_fill') {
          return {
            ...base,
            template: question.template || question.text || ''
          }
        }
        return {
          ...base,
          sample_answer: question.sample_answer || ''
        }
      })
      return {
        ...block,
        points: questions.reduce((sum, q) => sum + (Number(q.points) || 1), 0),
        questions
      }
    }
    return block
  })

  saving.value = true
  const token = localStorage.getItem('token')
  const payload = {
    title: sheet.value.title,
    description: sheet.value.description,
    subject: sheet.value.subject,
    grade_level: sheet.value.grade_level,
    tags: sheet.value.tags || '',
    rubric,
    content: { blocks: normalizedBlocks },
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

// --- Live Preview Functionality ---
const showLivePreview = ref(false)
const previewAnswers = ref({})
const previewIsSubmitted = ref(false)
const previewFeedbackSummary = ref(null)

const calculatedTotalPoints = computed(() => {
  return sheet.value.blocks.reduce((sum, b) => sum + (Number(b.points) || 0), 0)
})

const previewBlocks = computed(() => {
  return sheet.value.blocks.map(block => {
    const stripped = JSON.parse(JSON.stringify(block))
    if (block.type === 'gap_fill') {
      stripped.template_display = (block.template || '').replace(/\{[^}]+\}/g, '____')
    }
    if (block.type === 'matching') {
      const pairs = block.pairs || []
      stripped.left = pairs.map(p => p[0])
      // Shuffle the right side for realistic preview
      stripped.right = pairs.map(p => p[1]).sort(() => Math.random() - 0.5)
    }
    if (block.type === 'drag_drop') {
      stripped.items = [...(block.items || [])].sort(() => Math.random() - 0.5)
    }
    if (block.type === 'vocabulary') {
      const pairs = block.pairs || []
      stripped.words = pairs.map((pair, pIdx) => {
        const isL2R = block.direction === 'l2r' || (block.direction === 'mixed' && pIdx % 2 === 0)
        return {
          id: pIdx,
          clue: isL2R ? pair.l : pair.r,
          answer: isL2R ? pair.r : pair.l,
          promptLang: isL2R ? 'left' : 'right'
        }
      })
    }
    return stripped
  })
})

const openLivePreview = () => {
  const initialAnswers = {}
  sheet.value.blocks.forEach(block => {
    if (['gap_fill', 'multiple_choice', 'single_choice', 'drag_drop', 'matching', 'vocabulary'].includes(block.type)) {
      if (block.type === 'multiple_choice') {
        initialAnswers[block.id] = []
      } else if (['drag_drop', 'matching'].includes(block.type)) {
        initialAnswers[block.id] = {}
      } else if (block.type === 'vocabulary') {
        initialAnswers[block.id] = { completed: false, answersMap: {} }
      } else if (block.type === 'gap_fill') {
        initialAnswers[block.id] = []
      } else {
        initialAnswers[block.id] = null
      }
    }
    if (block.type === 'short_answer') initialAnswers[block.id] = ''
  })
  previewAnswers.value = initialAnswers
  previewIsSubmitted.value = false
  previewFeedbackSummary.value = null
  showLivePreview.value = true
}

const resetLocalPreview = () => {
  previewIsSubmitted.value = false
  previewFeedbackSummary.value = null
  const initialAnswers = {}
  sheet.value.blocks.forEach(block => {
    if (['gap_fill', 'multiple_choice', 'single_choice', 'drag_drop', 'matching', 'vocabulary'].includes(block.type)) {
      if (block.type === 'multiple_choice') {
        initialAnswers[block.id] = []
      } else if (['drag_drop', 'matching'].includes(block.type)) {
        initialAnswers[block.id] = {}
      } else if (block.type === 'vocabulary') {
        initialAnswers[block.id] = { completed: false, answersMap: {} }
      } else if (block.type === 'gap_fill') {
        initialAnswers[block.id] = []
      } else {
        initialAnswers[block.id] = null
      }
    }
    if (block.type === 'short_answer') initialAnswers[block.id] = ''
  })
  previewAnswers.value = initialAnswers
}

const getExerciseComponent = (type) => {
  switch (type) {
    case 'gap_fill': return GapFill
    case 'drag_drop': return DragDrop
    case 'multiple_choice': return MultipleChoice
    case 'single_choice': return SingleChoice
    case 'matching': return Matching
    case 'vocabulary': return Vocabulary
    case 'short_answer': return ShortAnswer
    default: return null
  }
}

const getCorrectAnswerData = (block) => {
  if (!previewFeedbackSummary.value || !previewFeedbackSummary.value.feedback) return null
  const blockFeedback = previewFeedbackSummary.value.feedback[block.id]
  return blockFeedback?.correctAnswers || null
}

const getSingleCorrectAnswerData = (block) => {
  if (!previewFeedbackSummary.value || !previewFeedbackSummary.value.feedback) return null
  const blockFeedback = previewFeedbackSummary.value.feedback[block.id]
  return blockFeedback?.correctAnswer !== undefined ? blockFeedback.correctAnswer : null
}

const submitLocalPreview = () => {
  let totalScore = 0
  let totalMaxScore = 0
  const feedback = {}

  sheet.value.blocks.forEach(block => {
    if (!['gap_fill', 'drag_drop', 'multiple_choice', 'single_choice', 'matching', 'vocabulary'].includes(block.type)) return

    const pts = block.points || 1
    totalMaxScore += pts
    let blockScore = 0
    let isCorrect = false
    const blockFeedback = { correct: false }

    const studentAns = previewAnswers.value[block.id]

    if (block.type === 'gap_fill') {
      const template = block.template || ''
      const blanks = [...template.matchAll(/\{([^}]+)\}/g)].map(m => m[1])
      const totalGaps = blanks.length
      if (totalGaps === 0) {
        blockScore = pts
        isCorrect = true
      } else {
        let correctCount = 0
        const ansArr = Array.isArray(studentAns) ? studentAns : []
        const correctAnswers = []
        blanks.forEach((correctText, i) => {
          const ans = (ansArr[i] || '').trim().toLowerCase()
          if (ans === correctText.trim().toLowerCase()) correctCount++
          correctAnswers.push(correctText.trim())
        })
        blockScore = Math.round((correctCount / totalGaps) * pts)
        isCorrect = correctCount === totalGaps
        blockFeedback.correctAnswers = correctAnswers
      }
    } else if (block.type === 'drag_drop') {
      const targets = block.targets || []
      const correctDict = block.answers || {}
      const totalTargets = targets.length
      if (totalTargets === 0) {
        blockScore = pts
        isCorrect = true
      } else {
        let correctCount = 0
        const studentDict = studentAns || {}
        for (let i = 0; i < totalTargets; i++) {
          if (studentDict[i] === correctDict[i]) correctCount++
        }
        blockScore = Math.round((correctCount / totalTargets) * pts)
        isCorrect = correctCount === totalTargets
      }
    } else if (block.type === 'multiple_choice') {
      const correctArr = Array.isArray(block.correct) ? block.correct : []
      const studentArr = Array.isArray(studentAns) ? studentAns : []
      const isExactlySame = correctArr.length === studentArr.length && correctArr.every(v => studentArr.includes(v))
      if (isExactlySame) {
        blockScore = pts
        isCorrect = true
      }
      blockFeedback.correctAnswers = correctArr
    } else if (block.type === 'single_choice') {
      if (Number(studentAns) === Number(block.correct)) {
        blockScore = pts
        isCorrect = true
      }
      blockFeedback.correctAnswer = Number(block.correct)
    } else if (block.type === 'matching') {
      const pairs = block.pairs || []
      const totalPairs = pairs.length
      if (totalPairs === 0) {
        blockScore = pts
        isCorrect = true
      } else {
        let correctCount = 0
        const studentDict = studentAns || {}
        
        const previewBlock = previewBlocks.value.find(b => b.id === block.id)
        const leftArr = previewBlock?.left || []
        const rightArr = previewBlock?.right || []

        pairs.forEach(pair => {
          const leftText = pair[0]
          const rightText = pair[1]
          
          const leftIdx = leftArr.indexOf(leftText)
          const studentRightIdx = studentDict[String(leftIdx)]
          const studentRightText = studentRightIdx !== undefined ? rightArr[studentRightIdx] : null

          if (studentRightText === rightText) {
            correctCount++
          }
        })
        blockScore = Math.round((correctCount / totalPairs) * pts)
        isCorrect = correctCount === totalPairs
      }
    } else if (block.type === 'vocabulary') {
      const pairs = block.pairs || []
      const totalPairs = pairs.length
      if (totalPairs === 0) {
        blockScore = pts
        isCorrect = true
      } else {
        let correctCount = 0
        const ansMap = studentAns?.answersMap || {}
        pairs.forEach((pair, idx) => {
          const targetWord = (pair.r || '').trim().toLowerCase()
          const stWord = (ansMap[idx] || '').trim().toLowerCase()
          if (stWord === targetWord) correctCount++
        })
        blockScore = Math.round((correctCount / totalPairs) * pts)
        isCorrect = correctCount === totalPairs
      }
    }

    blockFeedback.correct = isCorrect
    blockFeedback.pointsAwarded = blockScore
    feedback[block.id] = blockFeedback
    totalScore += blockScore
  })

  previewFeedbackSummary.value = {
    score: totalScore,
    maxScore: totalMaxScore,
    percentage: totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0,
    feedback
  }
  previewIsSubmitted.value = true
}
</script>

<style scoped>
.worksheet-builder {
  max-width: 1400px;
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
  grid-template-columns: 280px minmax(0, 1fr) 320px;
  gap: 20px;
  align-items: start;
  transition: grid-template-columns 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.builder-layout.left-collapsed {
  grid-template-columns: 70px minmax(0, 1fr) 320px;
}

.builder-layout.right-collapsed {
  grid-template-columns: 280px minmax(0, 1fr) 70px;
}

.builder-layout.left-collapsed.right-collapsed {
  grid-template-columns: 70px minmax(0, 1fr) 70px;
}

.sidebar-panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: fit-content;
  position: sticky;
  top: 170px;
  transition: width 0.3s ease, padding 0.3s ease;
}

.toolbox-panel {
  min-width: 0;
}

.settings-panel {
  min-width: 0;
}

.panel-header-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}

.panel-title {
  margin: 0;
  font-size: 15px;
  color: var(--text-muted);
}

.btn-collapse {
  width: 32px;
  height: 32px;
  min-height: 32px;
  padding: 0;
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  background: var(--bg-main);
  color: var(--text-main);
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: none;
}

.btn-collapse:hover {
  border-color: var(--primary);
  color: var(--primary);
}

.toolbox-panel.collapsed,
.settings-panel.collapsed {
  padding-left: 10px;
  padding-right: 10px;
  cursor: pointer;
}

.toolbox-content.is-collapsed {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.toolbox-content.is-collapsed .block-buttons-grid {
  grid-template-columns: 1fr;
  width: 100%;
}

.toolbox-content.is-collapsed .btn-add-block {
  justify-content: center;
  padding: 10px 6px;
}

.toolbox-content.is-collapsed .btn-icon {
  font-size: 18px;
}

.panel-collapsed-icons {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 6px 0;
}

.collapsed-icon-group {
  width: 42px;
  height: 42px;
  border: 1px solid var(--border-color);
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  background: var(--bg-main);
}

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
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
  grid-template-columns: 1fr;
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
  justify-content: space-between;
  gap: 6px;
  min-height: 40px;
  box-shadow: none;
  transition: all 0.2s ease;
}

.btn-add-block .btn-text {
  flex: 1;
}

.btn-add-block .info-icon {
  font-size: 11px;
  opacity: 0.5;
  cursor: help;
  transition: opacity 0.2s ease;
}

.btn-add-block:hover .info-icon {
  opacity: 1;
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

/* Live Preview Modal Overlay Styles */
.preview-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(8px);
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.preview-modal-card {
  width: 100%;
  max-width: 900px;
  height: 90vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-main);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  animation: modalScaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalScaleUp {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}

.preview-modal-card .modal-header {
  padding: 16px 24px;
  border-bottom: 1px solid var(--border-color);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--bg-card);
}

.preview-modal-card .modal-header h2 {
  font-size: 18px;
  font-weight: 700;
  margin: 0;
}

.btn-close {
  background: none;
  border: none;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  color: var(--text-muted);
  transition: color 0.2s;
}

.btn-close:hover {
  color: var(--text-color);
}

.preview-scroll-container {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}

.live-sticky-bar {
  position: sticky;
  top: 0;
  z-index: 90;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  border-radius: var(--radius-md);
  border: 1px solid var(--border-color);
  margin-bottom: 24px;
  box-shadow: var(--shadow-sm);
  background-color: var(--bg-card);
}

.live-info h3 {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 4px 0;
}

.live-sub {
  font-size: 12px;
  color: var(--text-muted);
}

.live-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

.live-points {
  font-size: 13px;
  font-weight: 700;
  background-color: var(--bg-main);
  border: 1px solid var(--border-color);
  padding: 6px 12px;
  border-radius: 20px;
}

.live-preview-body {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin-bottom: 40px;
}

.live-block-container {
  width: 100%;
}

.live-text-card {
  padding: 24px;
  font-size: 16px;
  white-space: pre-wrap;
}

.live-result-summary-card {
  text-align: center;
  padding: 24px;
  border-radius: var(--radius-md);
  border: 2px solid var(--success);
  margin-bottom: 24px;
  animation: slideDown 0.3s ease;
}

@keyframes slideDown {
  from { transform: translateY(-10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

.summary-emoji {
  font-size: 40px;
  margin-bottom: 8px;
}

.live-result-summary-card h3 {
  font-size: 20px;
  color: var(--success);
  margin: 0 0 8px 0;
}

.score-summary {
  font-size: 15px;
  margin-bottom: 16px;
}

.live-progress-bar-large {
  height: 10px;
  background-color: var(--border-color);
  border-radius: 5px;
  overflow: hidden;
  max-width: 400px;
  margin: 0 auto 12px auto;
}

.live-progress-fill {
  height: 100%;
  background-color: var(--success);
  border-radius: 5px;
}

.review-note {
  font-size: 13px;
  color: var(--text-muted);
}

/* AI Generator Wizard Overlay Styles */
.wizard-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(15, 23, 42, 0.75);
  backdrop-filter: blur(8px);
  z-index: 99999; /* Higher than live preview overlay */
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.wizard-modal-card {
  width: 100%;
  max-width: 800px;
  height: 85vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-main);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  overflow: hidden;
  box-shadow: var(--shadow-lg);
  position: relative;
  animation: modalScaleUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.wizard-scroll-container {
  flex: 1;
  overflow-y: auto;
  padding: 28px;
}

/* Loading State */
.wizard-loading-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding: 40px;
  text-align: center;
  background-color: var(--bg-main);
  z-index: 10;
}

.wizard-spinner-emoji {
  font-size: 64px;
  margin-bottom: 24px;
  animation: magicWand 1.5s ease-in-out infinite;
}

@keyframes magicWand {
  0% { transform: rotate(0deg) scale(1); }
  50% { transform: rotate(20deg) scale(1.15); filter: drop-shadow(0 0 15px var(--primary)); }
  100% { transform: rotate(0deg) scale(1); }
}

.wizard-loading-container h3 {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 8px 0;
}

.wizard-loading-container p {
  color: var(--text-muted);
  font-size: 14px;
  margin-bottom: 24px;
}

.wizard-progress-bar {
  width: 100%;
  max-width: 320px;
  height: 6px;
  background-color: var(--border-color);
  border-radius: 3px;
  overflow: hidden;
  position: relative;
}

.wizard-progress-indefinite {
  width: 40%;
  height: 100%;
  background: linear-gradient(90deg, var(--primary) 0%, #6366f1 100%);
  border-radius: 3px;
  position: absolute;
  left: -40%;
  animation: indefiniteProgress 1.6s infinite linear;
}

@keyframes indefiniteProgress {
  0% { left: -40%; }
  100% { left: 100%; }
}

/* Phase 1: Choice Stage */
.wizard-choice-stage {
  text-align: center;
  padding: 20px 0;
}

.stage-title {
  font-size: 22px;
  font-weight: 700;
  margin: 0 0 8px 0;
}

.stage-subtitle {
  color: var(--text-muted);
  margin-bottom: 32px;
}

.choice-cards-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  max-width: 860px;
  margin: 0 auto;
}

.choice-card {
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  padding: 32px 24px;
  cursor: pointer;
  background-color: var(--bg-card);
  transition: all 0.25s ease;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.choice-card:hover {
  transform: translateY(-4px);
  border-color: var(--primary);
  box-shadow: 0 8px 30px rgba(99, 102, 241, 0.15);
}

.choice-card.active-card {
  border-color: var(--primary);
  background: linear-gradient(180deg, var(--bg-card) 0%, rgba(99, 102, 241, 0.03) 100%);
}

.choice-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.choice-card h4 {
  font-size: 18px;
  font-weight: 700;
  margin: 0 0 12px 0;
}

.choice-card p {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
  margin-bottom: 24px;
  flex: 1;
}

.choice-card button {
  width: 100%;
  pointer-events: none;
}

/* Phase 2: Configuration Stage */
.wizard-form {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.form-section {
  border-bottom: 1px solid var(--border-color);
  padding-bottom: 24px;
}

.form-section h4 {
  font-size: 15px;
  font-weight: 700;
  margin: 0 0 16px 0;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-color);
}

.section-header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.btn-clear-counts {
  background: none;
  border: none;
  color: var(--primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.btn-clear-counts:hover {
  text-decoration: underline;
}

.section-subtitle {
  color: var(--text-muted);
  font-size: 13px;
  margin: 0 0 16px 0;
}

.wizard-input-text {
  width: 100%;
  padding: 10px 14px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background-color: var(--bg-card);
  font-size: 14px;
  color: var(--text-color);
}

.wizard-form-row {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 16px;
  margin-top: 16px;
}

.wizard-select {
  width: 100%;
  padding: 10px 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background-color: var(--bg-card);
  font-size: 14px;
  color: var(--text-color);
}

.wizard-textarea {
  width: 100%;
  padding: 12px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background-color: var(--bg-card);
  font-size: 14px;
  color: var(--text-color);
  resize: vertical;
}

/* Grid for task counts */
.exercise-quantity-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.exercise-quantity-card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
  background-color: var(--bg-card);
}

.eq-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.eq-emoji {
  font-size: 22px;
}

.eq-details {
  display: flex;
  flex-direction: column;
}

.eq-name {
  font-size: 14px;
  font-weight: 600;
}

.eq-desc {
  font-size: 11px;
  color: var(--text-muted);
}

.eq-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.btn-counter {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 1px solid var(--border-color);
  background-color: var(--bg-main);
  cursor: pointer;
  display: flex;
  justify-content: center;
  align-items: center;
  font-weight: 700;
  transition: all 0.2s;
  color: var(--text-color);
}

.btn-counter:hover:not(:disabled) {
  border-color: var(--primary);
  color: var(--primary);
}

.btn-counter:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.eq-count {
  font-size: 14px;
  font-weight: 700;
  min-width: 16px;
  text-align: center;
}

/* Footer layout */
.wizard-footer-settings {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  background-color: var(--bg-card);
  padding: 16px;
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-color);
}

.wizard-provider-group {
  display: flex;
  align-items: center;
  gap: 8px;
}

.wizard-provider-group label {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-muted);
  text-transform: uppercase;
}

.wizard-provider-select {
  width: auto;
  padding: 6px 12px;
  font-size: 13px;
}

.wizard-form-actions {
  display: flex;
  gap: 12px;
}

.btn-generate-magic {
  font-weight: bold;
  background: linear-gradient(135deg, var(--primary) 0%, #6366f1 100%);
  color: white !important;
  border: none;
}

.btn-generate-magic:hover {
  filter: brightness(1.1);
  box-shadow: 0 4px 15px rgba(99, 102, 241, 0.3);
}

/* Sidebar divider style */
.ai-divider {
  display: flex;
  align-items: center;
  text-align: center;
  margin: 16px 0;
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.ai-divider::before,
.ai-divider::after {
  content: '';
  flex: 1;
  border-bottom: 1px solid var(--border-color);
}

.ai-divider span {
  padding: 0 10px;
}

.math-preview {
  margin-top: 10px;
  padding: 12px;
  background: rgba(99, 102, 241, 0.05);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  backdrop-filter: blur(10px);
}
.preview-label {
  display: block;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: var(--primary);
  margin-bottom: 6px;
  letter-spacing: 0.5px;
}
.preview-box {
  font-size: 15px;
  line-height: 1.6;
  color: var(--text-main);
  word-break: break-word;
}

.stem-helper-section {
  margin-top: 20px;
  border: 1px dashed var(--primary);
  background: rgba(99, 102, 241, 0.02);
  border-radius: var(--radius-md);
  overflow: hidden;
}
.stem-accordion-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 12px 16px;
  background: none;
  border: none;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--text-main);
  text-align: left;
  transition: background 0.2s ease;
  min-height: auto;
  box-shadow: none;
  border-radius: 0;
}
.stem-accordion-toggle:hover {
  background: rgba(99, 102, 241, 0.07);
}
.stem-chevron {
  font-size: 1.1rem;
  transition: transform 0.25s ease;
  color: var(--primary);
  display: inline-block;
}
.stem-chevron.open {
  transform: rotate(180deg);
}
.stem-accordion-body {
  padding: 0 16px 14px;
}
/* Transition animations */
.stem-expand-enter-active,
.stem-expand-leave-active {
  transition: max-height 0.28s ease, opacity 0.22s ease;
  overflow: hidden;
  max-height: 300px;
}
.stem-expand-enter-from,
.stem-expand-leave-to {
  max-height: 0;
  opacity: 0;
}
.stem-presets {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
}
.stem-presets button {
  text-align: left;
  justify-content: flex-start;
  font-size: 13px;
  padding: 8px 12px;
  transition: all 0.2s ease;
  width: 100%;
}
.stem-presets button:hover {
  background: rgba(99, 102, 241, 0.1);
  border-color: var(--primary);
  transform: translateY(-1px);
}

@media (max-width: 1320px) {
  .builder-layout {
    grid-template-columns: 250px minmax(0, 1fr) 300px;
  }

  .builder-layout.left-collapsed {
    grid-template-columns: 64px minmax(0, 1fr) 300px;
  }

  .builder-layout.right-collapsed {
    grid-template-columns: 250px minmax(0, 1fr) 64px;
  }

  .builder-layout.left-collapsed.right-collapsed {
    grid-template-columns: 64px minmax(0, 1fr) 64px;
  }
}

@media (max-width: 1024px) {
  .builder-layout,
  .builder-layout.left-collapsed,
  .builder-layout.right-collapsed,
  .builder-layout.left-collapsed.right-collapsed {
    grid-template-columns: 1fr;
  }

  .sidebar-panel {
    position: static;
    top: auto;
  }

  .toolbox-panel {
    order: 1;
  }

  .main-preview-panel {
    order: 2;
  }

  .settings-panel {
    order: 3;
  }
}
.clickable-title {
  cursor: pointer;
  transition: color 0.2s ease;
  display: flex;
  align-items: center;
  gap: 8px;
}
.clickable-title:hover {
  color: var(--primary);
}
.title-settings-icon {
  font-size: 16px;
  opacity: 0.6;
  transition: transform 0.3s ease;
}
.clickable-title:hover .title-settings-icon {
  transform: rotate(45deg);
  opacity: 1;
}

.btn-ai-wand {
  background: linear-gradient(135deg, var(--primary) 0%, #6366f1 100%);
  color: white !important;
  border: none !important;
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
}
.btn-ai-wand:hover {
  opacity: 0.9;
  transform: translateY(-1px);
}

.toolbox-mode-selector {
  display: flex;
  background: var(--bg-hover);
  border-radius: var(--radius-md);
  padding: 4px;
  gap: 4px;
  margin-bottom: 16px;
  border: 1px solid var(--border-color);
}
.toolbox-mode-btn {
  flex: 1;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border-radius: var(--radius-sm);
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.toolbox-mode-btn.active {
  background: var(--bg-main);
  color: var(--primary);
  box-shadow: var(--shadow-sm);
}
.toolbox-mode-btn:hover:not(.active) {
  color: var(--text-main);
  background: rgba(255, 255, 255, 0.05);
}

.panel-tabs {
  display: flex;
  width: 100%;
  gap: 8px;
}
.panel-tab-btn {
  flex: 1;
  padding: 8px 12px;
  border: none;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: center;
}
.panel-tab-btn.active {
  color: var(--primary);
  border-bottom-color: var(--primary);
}
.panel-tab-btn:hover:not(.active) {
  color: var(--text-main);
}
</style>
