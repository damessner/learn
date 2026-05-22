const fs = require('fs')
const path = 'c:/Users/dames/OneDrive - Mittelschule Telfs/github/learn/frontend/src/views/WorksheetBuilder.vue'
let content = fs.readFileSync(path, 'utf8')
content = content.replace(/\\nconst parseVocab/g, '\nconst parseVocab')
content = content.replace(/\\n              <!-- Static Media\\/Audio Blocks -->/g, '\n              <!-- Static Media/Audio Blocks -->')
content = content.replace(/\\n    <!-- AI Generator Wizard/g, '\n    <!-- AI Generator Wizard')
fs.writeFileSync(path, content)
console.log('Fixed')
