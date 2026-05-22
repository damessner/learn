const { getDB } = require('../db/init');

const AI_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || '30000', 10);

function getOllamaSettings() {
  const db = getDB();
  const urlRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('ollama_base_url');
  const modelRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('ollama_model');
  
  return {
    baseUrl: (urlRow && urlRow.value) || process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: (modelRow && modelRow.value) || process.env.OLLAMA_MODEL || 'llama3.1'
  };
}

function getGeminiSettings() {
  const db = getDB();
  const keyRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('gemini_api_key');
  const modelRow = db.prepare('SELECT value FROM settings WHERE key = ?').get('gemini_model');

  return {
    apiKey: (keyRow && keyRow.value) || process.env.GEMINI_API_KEY || '',
    model: (modelRow && modelRow.value) || process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  };
}
const ALLOWED_BLOCK_TYPES = new Set([
  'text',
  'image',
  'audio',
  'gap_fill',
  'drag_drop',
  'multiple_choice',
  'single_choice',
  'matching',
  'vocabulary',
  'short_answer',
  'flashcards',
  'memory_match',
  'word_scramble',
  'semantic_sorter',
  'contextual_dialogue',
  'flow_challenge'
]);

const SYSTEM_PROMPT = `
You are an advanced, professional Teacher Assistant designed to create high-quality, pedagogically sound, and engaging educational worksheets for LearnFlow.
Your primary goal is to ensure that the content is structured, scaffolded, themed, and aligned with standard curriculum guidelines.

JSON FORMAT RULES:
Return ONLY valid, parsable JSON matching this exact structure:
{"title":"Worksheet Title","description":"Worksheet Description","subject":"Subject Name","grade_level":"Grade Level","content":{"blocks":[]}}
Do not include any extra text, conversational remarks, or markdown code fences (like \`\`\`json) outside of the JSON output. Output ONLY the raw JSON string.

CORE PEDAGOGICAL PRINCIPLES TO ENFORCE:
1. Cohesive Story/Theme: Weave a single scenario, theme, or narrative throughout all reading passages and questions in the worksheet to make it a unified, immersive learning journey. Every question and block should be related to this story.
2. Scaffolded Difficulty: Order the blocks from easiest to hardest to build confidence and guide the student.
   - Start with a thematic introduction/reading passage (DOK 0 text block).
   - Move to recognition/recall questions (DOK 1).
   - Move to production/application exercises (DOK 2).
   - Conclude with strategic thinking/analysis/short answer blocks (DOK 3).
3. Webb's Depth of Knowledge (DOK) Balance: Target a pyramid of cognitive demand across the worksheet:
   - DOK Level 1 (Recall & Reproduction - ~40%): Remember facts, definitions, or simple rules (e.g., identifying a verb form, vocabulary matching). Use: multiple_choice, single_choice, matching, word_scramble.
   - DOK Level 2 (Skills & Concepts - ~40%): Apply the rule in a specific context, which often involves more than one step (e.g., choosing correct tense in a sentence, sorting words). Use: gap_fill, drag_drop, semantic_sorter.
   - DOK Level 3 (Strategic Thinking - ~20%): Explain "why", analyze errors, or handle non-routine reasoning (e.g., finding multiple errors in a sentence and explaining the broken rule, or completing an interactive dialogue). Use: short_answer (especially error correction analysis), contextual_dialogue.
4. Smart Distractors: In multiple_choice and single_choice questions, do NOT use silly, obvious, or nonsensical wrong answers. Design incorrect options that represent common student misconceptions and errors (e.g., for "Present Simple", use "he go", "he gos", "he is go", or "he don't likes" instead of "he banana").
5. Educational Explanations: Every interactive question block MUST have an "explanation" string explaining why the answer is correct and providing a key learning tip.

BLOCK SCHEMA BLUEPRINTS (Every block needs "id" and "type"):
- text: {"id":"string","type":"text","content":"markdown content"}
- image: {"id":"string","type":"image","url":"string","caption":"string"}
- audio: {"id":"string","type":"audio","url":"string","label":"string"}
- gap_fill: {"id":"string","type":"gap_fill","points":number,"explanation":"string","instruction":"string","template":"She ((has)) eaten. We ((have)) slept."} (Double parentheses around correct answers in template)
- drag_drop: {"id":"string","type":"drag_drop","points":number,"explanation":"string","instruction":"string","items":["has","have"],"targets":["She ((has)) eaten.","We ((have)) slept."],"answers":{"0":"has","1":"have"}} (targets contain double parentheses where the word goes, answers maps target index to correct item)
- multiple_choice: {"id":"string","type":"multiple_choice","points":number,"explanation":"string","instruction":"string","options":["optionA","optionB","optionC"],"correct":[0,2]} (correct is array of option indexes)
- single_choice: {"id":"string","type":"single_choice","points":number,"explanation":"string","instruction":"string","options":["optionA","optionB","optionC"],"correct":1} (correct is the single correct option index)
- matching: {"id":"string","type":"matching","points":number,"explanation":"string","instruction":"string","pairs":[["left1","right1"],["left2","right2"]]}
- vocabulary: {"id":"string","type":"vocabulary","points":number,"explanation":"string","instruction":"string","direction":"l2r"|"r2l"|"mixed","rawText":"English = German\\nDog = Hund","pairs":[{"l":"Dog","r":"Hund"}]}
- short_answer: {"id":"string","type":"short_answer","points":number,"explanation":"string","instruction":"string","prompt":"Identify the grammar error in the sentence: \\"He don't likes apples.\\" and explain the rule.","sample_answer":"The error is \'don\'t likes\' which is double marking. For 3rd person singular negative we use \'doesn\'t\' + base verb \'like\'.","keywords":["doesn\'t","like"]}
- semantic_sorter: {"id":"string","type":"semantic_sorter","points":number,"explanation":"string","instruction":"string","categories":[{"name":"Nouns","words":["dog","cat"]},{"name":"Verbs","words":["run","sleep"]}]}
- contextual_dialogue: {"id":"string","type":"contextual_dialogue","points":number,"explanation":"string","instruction":"string","messages":[{"sender":"teacher","isGap":false,"text":"How are you?"},{"sender":"student","isGap":true,"textBefore":"I am ","textAfter":".","answer":"good"}]}
- word_scramble: {"id":"string","type":"word_scramble","points":number,"explanation":"string","instruction":"string","words":[{"word":"apple","clue":"A red fruit"}]}
- flow_challenge: {"id":"string","type":"flow_challenge","points":number,"explanation":"string","instruction":"string","pairs":[{"l":"Dog","r":"Hund"}]}

STEM SUBJECT RULES (Maths, Chemistry, Physics, etc.):
- Wrap mathematical expressions, formulas, and equations in LaTeX: $...$ for inline, $$...$$ for block presentation.
- Ensure scientific notation is clear (e.g. use $1.5 \\times 10^3$ in text, or using e-notation in correct answers like "1.5e3").
- Supply valid numeric units when applicable (e.g., "10 m/s^2", "5.4 kg", "3e8 m/s") so the grading engine can evaluate them.
`.trim();

async function fetchWithTimeout(url, options = {}, timeoutMs = AI_TIMEOUT_MS) {
  // Using native global fetch
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function extractJsonString(text = '') {
  const trimmed = String(text).trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }
  return trimmed;
}

function clampPoints(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(20, Math.round(n)));
}

function asText(value, fallback = '') {
  if (typeof value !== 'string') return fallback;
  return value.trim();
}

function sanitizeBlock(block, index) {
  if (!block || typeof block !== 'object') return null;
  if (!ALLOWED_BLOCK_TYPES.has(block.type)) return null;

  const safe = {
    id: asText(block.id, `ai_${index}_${Math.random().toString(36).slice(2, 8)}`),
    type: block.type
  };

  if (!['text', 'image', 'audio'].includes(block.type)) {
    safe.points = clampPoints(block.points);
    if (block.explanation) {
      safe.explanation = asText(block.explanation);
    }
  }

  if (block.type === 'text') safe.content = asText(block.content);
  if (block.type === 'image') {
    safe.url = asText(block.url);
    safe.caption = asText(block.caption);
  }
  if (block.type === 'audio') {
    safe.url = asText(block.url);
    safe.label = asText(block.label);
  }
  if (block.type === 'gap_fill') {
    safe.instruction = asText(block.instruction, 'Fill in the blanks.');
    safe.template = asText(block.template);
  }
  if (block.type === 'drag_drop') {
    safe.instruction = asText(block.instruction, 'Drag the words to the gaps.');
    safe.items = Array.isArray(block.items) ? block.items.map(v => asText(v)).filter(Boolean) : [];
    safe.targets = Array.isArray(block.targets) ? block.targets.map(v => asText(v)).filter(Boolean) : [];
    safe.answers = (block.answers && typeof block.answers === 'object' && !Array.isArray(block.answers)) ? block.answers : {};
  }
  if (block.type === 'multiple_choice') {
    safe.instruction = asText(block.instruction, 'Select all correct answers.');
    safe.options = Array.isArray(block.options) ? block.options.map(v => asText(v)).filter(Boolean) : [];
    safe.correct = Array.isArray(block.correct)
      ? block.correct.map(Number).filter(i => Number.isInteger(i) && i >= 0)
      : [];
  }
  if (block.type === 'single_choice') {
    safe.instruction = asText(block.instruction, 'Select the correct answer.');
    safe.options = Array.isArray(block.options) ? block.options.map(v => asText(v)).filter(Boolean) : [];
    safe.correct = Number.isInteger(Number(block.correct)) ? Number(block.correct) : 0;
  }
  if (block.type === 'matching') {
    safe.instruction = asText(block.instruction, 'Match the pairs.');
    safe.pairs = Array.isArray(block.pairs)
      ? block.pairs
        .filter(p => Array.isArray(p) && p.length >= 2)
        .map(p => [asText(p[0]), asText(p[1])])
        .filter(p => p[0] && p[1])
      : [];
  }
  if (block.type === 'vocabulary') {
    safe.instruction = asText(block.instruction, 'Translate the vocabulary words.');
    safe.direction = ['l2r', 'r2l', 'mixed'].includes(block.direction) ? block.direction : 'l2r';
    safe.rawText = asText(block.rawText, '');
    safe.pairs = Array.isArray(block.pairs)
      ? block.pairs
        .filter(p => p && typeof p === 'object')
        .map(p => ({ l: asText(p.l), r: asText(p.r) }))
        .filter(p => p.l && p.r)
      : [];
  }
  if (block.type === 'short_answer') {
    safe.prompt = asText(block.prompt, 'Write a short answer.');
    safe.sample_answer = asText(block.sample_answer, '');
    safe.keywords = Array.isArray(block.keywords) ? block.keywords.map(v => asText(v)).filter(Boolean).slice(0, 10) : [];
  }
  if (block.type === 'semantic_sorter') {
    safe.instruction = asText(block.instruction, 'Sort the words into their correct semantic categories.');
    safe.categories = Array.isArray(block.categories)
      ? block.categories
        .filter(c => c && typeof c === 'object')
        .map(c => ({
          name: asText(c.name),
          words: Array.isArray(c.words) ? c.words.map(w => asText(w)).filter(Boolean) : []
        }))
        .filter(c => c.name && c.words.length > 0)
      : [];
  }
  if (block.type === 'contextual_dialogue') {
    safe.instruction = asText(block.instruction, 'Complete the conversation by filling in the missing words.');
    safe.messages = Array.isArray(block.messages)
      ? block.messages
        .filter(m => m && typeof m === 'object')
        .map(m => ({
          sender: ['teacher', 'student'].includes(m.sender) ? m.sender : 'teacher',
          isGap: !!m.isGap,
          text: asText(m.text),
          textBefore: asText(m.textBefore),
          textAfter: asText(m.textAfter),
          answer: asText(m.answer)
        }))
      : [];
  }
  if (block.type === 'word_scramble') {
    safe.instruction = asText(block.instruction, 'Unscramble the letters to form the correct word.');
    safe.words = Array.isArray(block.words)
      ? block.words
        .filter(w => w && typeof w === 'object')
        .map(w => ({
          word: asText(w.word),
          clue: asText(w.clue)
        }))
        .filter(w => w.word)
      : [];
  }
  if (block.type === 'flow_challenge') {
    safe.instruction = asText(block.instruction, 'Match the terms in flow challenge.');
    safe.pairs = Array.isArray(block.pairs)
      ? block.pairs
        .filter(p => p && typeof p === 'object')
        .map(p => ({ l: asText(p.l), r: asText(p.r) }))
        .filter(p => p.l && p.r)
      : [];
  }
  if (block.type === 'flashcards') {
    safe.instruction = asText(block.instruction, 'Review the flashcards.');
    safe.cards = Array.isArray(block.cards)
      ? block.cards
        .filter(c => c && typeof c === 'object')
        .map(c => ({ front: asText(c.front), back: asText(c.back) }))
        .filter(c => c.front && c.back)
      : [];
  }
  if (block.type === 'memory_match') {
    safe.instruction = asText(block.instruction, 'Match the cards.');
    safe.pairs = Array.isArray(block.pairs)
      ? block.pairs
        .filter(p => p && typeof p === 'object')
        .map(p => ({ l: asText(p.l), r: asText(p.r) }))
        .filter(p => p.l && p.r)
      : [];
  }

  return safe;
}

function sanitizeWorksheet(raw) {
  const worksheet = (raw && typeof raw === 'object') ? raw : {};
  const blocks = Array.isArray(worksheet.content?.blocks) ? worksheet.content.blocks : [];
  const safeBlocks = blocks
    .map((block, idx) => sanitizeBlock(block, idx))
    .filter(Boolean)
    .slice(0, 40);

  return {
    title: asText(worksheet.title, 'AI Worksheet'),
    description: asText(worksheet.description),
    subject: asText(worksheet.subject),
    grade_level: asText(worksheet.grade_level),
    content: { blocks: safeBlocks }
  };
}

async function callGemini(prompt) {
  const { apiKey, model } = getGeminiSettings();
  if (!apiKey) {
    throw new Error('Gemini is not configured. Set GEMINI_API_KEY in Admin Console or .env.');
  }

  const resp = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1600,
          responseMimeType: 'application/json'
        }
      })
    }
  );

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data?.error?.message || 'Gemini request failed');
  }

  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('\n') || '';
  return text;
}

async function callOllama(prompt) {
  const { baseUrl, model } = getOllamaSettings();
  const fullPrompt = `${SYSTEM_PROMPT}\n\nUser request:\n${prompt}\n\nReturn only JSON.`;
  const resp = await fetchWithTimeout(`${baseUrl.replace(/\/$/, '')}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model,
      prompt: fullPrompt,
      stream: false,
      format: 'json',
      options: { temperature: 0.2, num_predict: 1600 }
    })
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(data?.error || 'Ollama request failed');
  }
  return data?.response || '';
}

async function generateWorksheetFromAI({ provider = 'gemini', prompt }) {
  const selected = String(provider || 'gemini').toLowerCase();
  if (!prompt || !String(prompt).trim()) {
    throw new Error('Prompt is required');
  }

  let rawText;
  if (selected === 'ollama') {
    rawText = await callOllama(prompt);
  } else if (selected === 'gemini') {
    rawText = await callGemini(prompt);
  } else if (selected === 'auto') {
    rawText = getGeminiSettings().apiKey ? await callGemini(prompt) : await callOllama(prompt);
  } else {
    throw new Error('Unsupported provider');
  }

  let parsed;
  try {
    parsed = JSON.parse(extractJsonString(rawText));
  } catch {
    throw new Error('AI returned invalid JSON');
  }

  return sanitizeWorksheet(parsed);
}


async function generateNeuroVocabCourse({ rawList, provider = 'gemini' }) {
  const prompt = `
I am providing a raw vocabulary list.
List:
${rawList}

I need you to generate a 4-step Neuro-Gamified learning course based on these exact words.
Return a valid JSON object matching the worksheet format: {"title":"","description":"","subject":"","grade_level":"","content":{"blocks":[]}}
The blocks MUST follow this exact sequence:

1. Block type "text": A short, highly engaging introductory text setting a cohesive theme or story around these words.
2. Block type "semantic_sorter": Group the provided words into 2-4 logical semantic categories (e.g., verbs, nouns, emotions, places).
3. Block type "contextual_dialogue": An engaging conversation between a 'teacher' and 'student' where the provided words are the correct gap-fill answers. Make the dialogue thematic. Include a detailed explanation.
4. Block type "flow_challenge": The provided vocabulary words in the pairs format [{"l":"English", "r":"Translation"}]. Include a detailed explanation.

Ensure you adhere strictly to the JSON blueprints in the system prompt. Every interactive question block MUST have an educational explanation string explaining the meaning, grammar, or use-case of the vocabulary words.`;

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

module.exports = { generateWorksheetFromAI, generateNeuroVocabCourse };
