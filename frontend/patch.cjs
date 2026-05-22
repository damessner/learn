const fs = require('fs')

const filePath = 'c:\\Users\\dames\\OneDrive - Mittelschule Telfs\\github\\learn\\frontend\\src\\views\\WorksheetBuilder.vue'
let content = fs.readFileSync(filePath, 'utf-8')

const injection = `
              <!-- Flashcards / Memory Match / Flow Challenge -->
              <div v-if="['flashcards', 'memory_match', 'flow_challenge'].includes(block.type)" class="editor-row">
                <label>Instruction</label>
                <input type="text" v-model="block.instruction" placeholder="e.g. Find the matching pairs" class="mb-2" />
                <label>Add vocabulary pairs (Format: Word = Translation)</label>
                <textarea 
                  v-model="block.rawText" 
                  @input="updateGamifiedPairs(block)"
                  placeholder="apple = Apfel\\nbanana = Banane" 
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
                  placeholder="apple = A red fruit\\nbanana = A yellow fruit" 
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
`

const target = '<!-- Static Media/Audio Blocks -->'

if (content.includes(target)) {
  content = content.replace(target, injection + '\\n              ' + target)
  fs.writeFileSync(filePath, content)
  console.log('Success')
} else {
  console.error('Marker not found')
  process.exit(1)
}
