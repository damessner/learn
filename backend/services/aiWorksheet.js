const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.1';
const AI_TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || '30000', 10);

const ALLOWED_BLOCK_TYPES = new Set([
  'text',
  'image',
  'audio',
  'gap_fill',
  'drag_drop',
  'multiple_choice',
  'single_choice',
  'matching',
  'vocabulary'
]);

const SYSTEM_PROMPT = [
  'You generate compact worksheet JSON for LearnFlow.',
  'Return ONLY valid JSON with shape: {"title":"","description":"","subject":"","grade_level":"","content":{"blocks":[...]}}.',
  'Keep token use low: concise text, avoid explanations.',
  'Use only block types: text,image,audio,gap_fill,drag_drop,multiple_choice,single_choice,matching,vocabulary.',
  'Every block must include id and type; question blocks include points integer.',
  'For gap_fill use "template" with {answer} format.',
  'For drag_drop use items[], targets[], answers object index->answer.',
  'For multiple_choice use options[] and correct[] indexes.',
  'For single_choice use options[] and correct index.',
  'For matching use pairs as [["left","right"]].',
  'For vocabulary use pairs as [{"l":"EnglishWord","r":"GermanWord"}], direction as "l2r", "r2l", or "mixed", and rawText as string of "English = German" lines.'
].join(' ');

async function fetchWithTimeout(url, options = {}, timeoutMs = AI_TIMEOUT_MS) {
  const { default: fetch } = await import('node-fetch');
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
  if (!GEMINI_API_KEY) {
    throw new Error('Gemini is not configured. Set GEMINI_API_KEY.');
  }

  const resp = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
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
  const fullPrompt = `${SYSTEM_PROMPT}\n\nUser request:\n${prompt}\n\nReturn only JSON.`;
  const resp = await fetchWithTimeout(`${OLLAMA_BASE_URL.replace(/\/$/, '')}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
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
    rawText = GEMINI_API_KEY ? await callGemini(prompt) : await callOllama(prompt);
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

module.exports = { generateWorksheetFromAI };
