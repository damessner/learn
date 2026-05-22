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

const SYSTEM_PROMPT = [
  'You generate compact worksheet JSON for LearnFlow.',
  'Return ONLY valid JSON with shape: {"title":"","description":"","subject":"","grade_level":"","content":{"blocks":[...]}}.',
  'Use only block types: text,image,audio,gap_fill,drag_drop,multiple_choice,single_choice,matching,vocabulary,short_answer,semantic_sorter,contextual_dialogue,word_scramble,flow_challenge.',
  'Every block must include id and type; question blocks include points integer and a clear, helpful explanation string.',
  'Always follow these core pedagogical principles:',
  '1. Cohesive Story/Theme: Weave a single scenario, theme, or narrative throughout all text and questions in the worksheet to make it a unified learning journey.',
  '2. Scaffolded Difficulty: Order the blocks from easiest (DOK 1) to hardest (DOK 3). Begin with an introduction/static text, then move to recognition questions, then application exercises, and conclude with strategic/short answer blocks.',
  '3. Smart Distractors: For multiple_choice and single_choice, design incorrect options that reflect common student misconceptions or errors, rather than obvious nonsense.',
  '4. Webb\'s DOK Balance: Target a pyramid of cognitive demand: ~40% DOK 1 Recall (e.g., multiple_choice, single_choice, matching), ~40% DOK 2 Skills & Concepts (e.g., gap_fill, drag_drop, semantic_sorter), and ~20% DOK 3 Strategic Thinking (e.g., short_answer, contextual_dialogue).',
  '5. Educational Explanations: Every interactive question block MUST have an "explanation" string explaining why the answer is correct and providing a key learning tip.',
  'For gap_fill use "template" with ((answer)) format — double parentheses around each correct answer (e.g. "She ((has)) eaten. We ((have)) slept.").',
  'For drag_drop use items[], targets[], answers object index->answer. In targets, mark each drop zone with ((word)) (e.g. "She ((has)) eaten.").',
  'For multiple_choice use options[] and correct[] indexes.',
  'For single_choice use options[] and correct index.',
  'For matching use pairs as [["left","right"]].',
  'For vocabulary use pairs as [{"l":"EnglishWord","r":"GermanWord"}], direction as "l2r", "r2l", or "mixed", and rawText as string of "English = German" lines.',
  'For short_answer use prompt, optional sample_answer, optional keywords array, and points.',
  'For semantic_sorter use categories as [{"name":"CategoryName","words":["word1","word2"]}].',
  'For contextual_dialogue use messages as [{"sender":"teacher","isGap":false,"text":"Hello"},{"sender":"student","isGap":true,"textBefore":"I am ","textAfter":".","answer":"good"}].',
  'For flow_challenge use pairs exactly like vocabulary.',
  'For word_scramble use words as [{"word":"apple","clue":"A red fruit"}].',
  'For STEM subjects (Maths, Physics, Chemistry, etc.): always wrap mathematical expressions, equations, and formulas in standard LaTeX delimiters ($...$ for inline, $$...$$ for block presentation). Make sure scientific notation and units are clear (e.g. use $1.5 \\times 10^3$ in text, or using e-notation in correct answers like "1.5e3"). Supply valid numeric units when applicable (e.g. "10 m/s^2", "5.4 kg", "3e8 m/s") so the STEM-aware grading engine can evaluate them accurately.'
].join(' ');

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
Return a JSON array of blocks under the 'blocks' array in the content object.
The blocks MUST follow this exact sequence:

1. Block type "text": A short introductory text setting a theme or story around these words.
2. Block type "semantic_sorter": Group the provided words into 2-4 logical semantic categories (e.g., verbs, nouns, emotions, places).
3. Block type "contextual_dialogue": A chat conversation between a 'teacher' and 'student' where the provided words are the correct gap-fill answers. Make the dialogue engaging.
4. Block type "flow_challenge": The provided vocabulary words in the pairs format [{l:"English", r:"Translation"}].

Make sure the JSON structure exactly matches the required block types.`;

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
