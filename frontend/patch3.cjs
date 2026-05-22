const fs = require('fs')

// 1. Update aiWorksheet.js
const aiPath = 'c:\\Users\\dames\\OneDrive - Mittelschule Telfs\\github\\learn\\backend\\services\\aiWorksheet.js'
let aiContent = fs.readFileSync(aiPath, 'utf-8')

// Update ALLOWED_BLOCK_TYPES
aiContent = aiContent.replace(
  "'short_answer'", 
  "'short_answer',\n  'flashcards',\n  'memory_match',\n  'word_scramble',\n  'semantic_sorter',\n  'contextual_dialogue',\n  'flow_challenge'"
)

// Update SYSTEM_PROMPT
const promptInject = `
  'For semantic_sorter use categories as [{"name":"CategoryName","words":["word1","word2"]}].',
  'For contextual_dialogue use messages as [{"sender":"teacher","isGap":false,"text":"Hello"},{"sender":"student","isGap":true,"textBefore":"I am ","textAfter":".","answer":"good"}].',
  'For flow_challenge use pairs exactly like vocabulary.'
].join(' ');`

aiContent = aiContent.replace("].join(' ');", promptInject)

// Update sanitizeBlock for categories and messages
const sanitizeInject = `
  }
  if (block.type === 'semantic_sorter') {
    safe.categories = Array.isArray(block.categories) ? block.categories : [];
  }
  if (block.type === 'contextual_dialogue') {
    safe.messages = Array.isArray(block.messages) ? block.messages : [];
  }
  if (block.type === 'word_scramble') {
    safe.words = Array.isArray(block.words) ? block.words : [];
  }
  if (['flashcards', 'memory_match', 'flow_challenge'].includes(block.type)) {
    safe.pairs = Array.isArray(block.pairs) ? block.pairs : [];
  }

  return safe;
`
aiContent = aiContent.replace("return safe;\n}", sanitizeInject + '}')

// Add generateNeuroVocabCourse function
const neuroVocabFunc = `
async function generateNeuroVocabCourse({ rawList, provider = 'gemini' }) {
  const prompt = \`
I am providing a raw vocabulary list.
List:
\${rawList}

I need you to generate a 4-step Neuro-Gamified learning course based on these exact words.
Return a JSON array of blocks under the 'blocks' array in the content object.
The blocks MUST follow this exact sequence:

1. Block type "text": A short introductory text setting a theme or story around these words.
2. Block type "semantic_sorter": Group the provided words into 2-4 logical semantic categories (e.g., verbs, nouns, emotions, places).
3. Block type "contextual_dialogue": A chat conversation between a 'teacher' and 'student' where the provided words are the correct gap-fill answers. Make the dialogue engaging.
4. Block type "flow_challenge": The provided vocabulary words in the pairs format [{l:"English", r:"Translation"}].

Make sure the JSON structure exactly matches the required block types.\`;

  const selected = String(provider || 'gemini').toLowerCase();
  let rawText;
  if (selected === 'ollama') {
    rawText = await callOllama(prompt);
  } else {
    rawText = await callGemini(prompt);
  }

  let parsed;
  try {
    parsed = JSON.parse(extractJsonString(rawText));
  } catch {
    throw new Error('AI returned invalid JSON');
  }
  
  if (Array.isArray(parsed)) {
    parsed = { content: { blocks: parsed } };
  } else if (parsed.blocks) {
    parsed = { content: { blocks: parsed.blocks } };
  }

  return sanitizeWorksheet(parsed);
}
`

aiContent = aiContent.replace('module.exports = { generateWorksheetFromAI };', neuroVocabFunc + '\nmodule.exports = { generateWorksheetFromAI, generateNeuroVocabCourse };')

fs.writeFileSync(aiPath, aiContent)


// 2. Update worksheets.js routes
const routesPath = 'c:\\Users\\dames\\OneDrive - Mittelschule Telfs\\github\\learn\\backend\\routes\\worksheets.js'
let routesContent = fs.readFileSync(routesPath, 'utf-8')

routesContent = routesContent.replace(
  "const { generateWorksheetFromAI } = require('../services/aiWorksheet');",
  "const { generateWorksheetFromAI, generateNeuroVocabCourse } = require('../services/aiWorksheet');"
)

const newRoute = `
// ─── AI Neuro Vocab Generation ──────────────────────────────────────────────────
router.post('/ai/neuro-vocab', requireAuth, requireRole('teacher', 'admin'), async (req, res) => {
  try {
    const { rawList, provider } = req.body || {};
    if (!rawList) {
      return res.status(400).json({ error: 'Vocabulary list is required' });
    }

    const worksheet = await generateNeuroVocabCourse({
      provider: provider || 'gemini',
      rawList: String(rawList).trim()
    });

    res.json(worksheet.content);
  } catch (err) {
    const msg = err?.message || 'AI generation failed';
    res.status(500).json({ error: msg });
  }
});
`

routesContent = routesContent.replace(
  "// ─── List worksheets ───────────────────────────────────────────────────────────",
  newRoute + '\n// ─── List worksheets ───────────────────────────────────────────────────────────'
)

fs.writeFileSync(routesPath, routesContent)
console.log('Success')
