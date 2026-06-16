const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── Prompts ───────────────────────────────────────────────────
const PROMPTS = {

  // SYSTEM prompt alag hai — tokens bachte hain
  // USER prompt mein sirf text jaata hai
  'ai-humanizer': (text) => `Rewrite this text. Return ONLY rewritten text, nothing else.

${text}`,

  'ai-detector': (text) => `Analyze if AI or human wrote this.
Return ONLY this JSON, nothing else:
{"score":<0-100>,"verdict":"Human|AI|Mixed","confidence":"Low|Medium|High","reasons":["r1","r2","r3"]}

${text}`,

  'tone-changer': (text, tone) => `Rewrite in ${tone} tone. Same meaning. Return ONLY rewritten text.

${text}`,

  'plagiarism-checker': (text) => `Check originality. Return ONLY this JSON, nothing else:
{"score":<0-100>,"verdict":"Original|Possibly Copied|Likely Copied","flagged":["p1","p2"],"summary":"one sentence"}

${text}`,

  'summarizer': (text) => `Summarize this text concisely. Capture every key point. Return ONLY the summary, no intro or preamble.

${text}`,

  'citation-generator': (text) => `Generate a properly formatted citation based on the following details. Return ONLY the formatted citation string, nothing else.

${text}`,

  'image-translator': (text, targetLang) => `Translate the following text to ${targetLang || 'English'}. Preserve meaning and formatting. Return ONLY the translated text, nothing else.

${text}`,
};

// ── System prompts — quality ke liye, tokens bachane ke liye alag rakhe ──
const SYSTEM_PROMPTS = {
  'ai-humanizer': `You are a human editor who rewrites AI text to sound authentically human.

YOUR WRITING STYLE:
- Write like a real person — a student, professional, or blogger
- Short sentences mostly (under 20 words). Mix in a longer one sometimes
- Use contractions: it's, don't, you'll, can't, we're, that's
- Active voice always: "The team finished" not "It was finished by"
- Start sentences differently — not always "The" or "It" or "This"
- Starting with "And", "But", "So" is fine — humans do this

BANNED WORDS — never use these:
delve, encompass, underscore, robust, pivotal, multifaceted, paramount,
Furthermore, Moreover, Additionally, Consequently, Subsequently,
utilize→use, leverage→use, facilitate→help, endeavor→try,
"In today's world", "In conclusion", "It is important to note",
"It is worth noting", "It goes without saying", "In the realm of"

RULES:
- Keep 100% of original meaning — no new ideas, no cutting key points
- Don't make it longer than original
- Keep professional terms as-is: ROI, KPIs, stakeholders, scalability etc
- Return ONLY the rewritten text. No intro. No explanation. No labels.`,

  'ai-detector': 'You are an AI content detector. Analyze text and return only valid JSON.',

  'tone-changer': 'You are a writing assistant. Rewrite text in the requested tone. Return only the rewritten text.',

  'plagiarism-checker': 'You are a plagiarism analyzer. Return only valid JSON with originality analysis.',

  'summarizer': `You are an expert summarizer. Create concise, accurate summaries that capture all key points. Write in clear, professional prose. Return ONLY the summary — no preamble, no "Here is a summary of:".`,

  'citation-generator': `You are a citation formatting expert. Generate properly formatted academic citations in the requested format (APA, MLA, Chicago, Harvard). Return ONLY the formatted citation string — no explanation, no alternatives.`,

  'image-translator': `You are a professional translator. Translate text accurately while preserving meaning, context, and formatting. Return ONLY the translated text — no explanation, no original text.`,
};

const MAX_TOKENS = {
  'ai-humanizer':       1024,
  'ai-detector':         150,
  'tone-changer':       1024,
  'plagiarism-checker':  200,
  'summarizer':          512,
  'citation-generator':  200,
  'image-translator':   1500,
};

// ── Input cleaner — extra spaces/lines hatao ─────────────────
function cleanInput(text) {
  return text
    .trim()
    .replace(/\n{3,}/g, '\n\n')   // 3+ newlines → 2
    .replace(/ {2,}/g, ' ')        // double spaces → single
    .replace(/<[^>]*>/g, '');      // HTML tags hatao
}

// ── Cache ─────────────────────────────────────────────────────
const cache = new Map();
const CACHE_MAX = 300;

function getCacheKey(slug, input, opts = {}) {
  const normalized = input.toLowerCase().trim().substring(0, 200);
  return `${slug}::${opts.tone || ''}::${opts.language || ''}::${opts.mode || ''}::${normalized}`;
}

// ── Main Runner ───────────────────────────────────────────────
async function runGeminiTool(toolSlug, input, options = {}) {
  const buildPrompt  = PROMPTS[toolSlug];
  const systemPrompt = SYSTEM_PROMPTS[toolSlug];
  if (!buildPrompt) throw new Error(`No prompt for: ${toolSlug}`);

  // Input clean karo pehle
  const cleanedInput = cleanInput(input);
  const prompt       = buildPrompt(cleanedInput, options.tone || options.language || options.mode);

  // Cache check
  const cacheKey = getCacheKey(toolSlug, cleanedInput, options);
  if (cache.has(cacheKey)) {
    return { result: cache.get(cacheKey), fromCache: true };
  }

  // Messages banao
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user',   content: prompt },
  ];

  const response = await groq.chat.completions.create({
    model:       'llama-3.3-70b-versatile',
    messages,
    temperature: toolSlug === 'ai-humanizer' ? 0.85 : 0.3,
    max_tokens:  MAX_TOKENS[toolSlug] || 1024,
  });

  const text = response.choices[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty response from Groq');

  // Cache store
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(cacheKey, text);

  return { result: text, fromCache: false };
}

module.exports = { runGeminiTool };
