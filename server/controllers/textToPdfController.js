const rateLimit = require('express-rate-limit');
// groq-sdk is required lazily inside textToPdfFormat so a missing/broken
// groq-sdk installation does NOT prevent the module from loading.
// textToPdfGenerate (the PDF download handler) never uses groq-sdk.

// ── Rate limiter: 10 requests / minute per IP ──────────────────
const textToPdfLimiter = rateLimit({
  windowMs: 60 * 1000,
  max:      10,
  keyGenerator: (req) =>
    (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.ip,
  message:      { error: 'Too many requests. Please wait a moment and try again.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

// ── POST /api/tools/text-to-pdf/generate ──────────────────────
// Accepts the new block-based documentData format.
async function textToPdfGenerate(req, res) {
  try {
    const { documentData } = req.body;
    if (!documentData)
      return res.status(400).json({ success: false, error: 'Document data is required.' });
    if (!documentData.blocks?.length)
      return res.status(400).json({ success: false, error: 'Document has no blocks to render.' });

    const { generatePDF } = require('../services/pdfGeneratorMake');
    const pdfBuffer = await generatePDF(documentData);

    // Strip non-ASCII from filename (HTTP headers: ASCII only)
    const rawName = (documentData.name || documentData.title || 'document')
      .replace(/[^a-zA-Z0-9\s_-]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .substring(0, 60) || 'document';

    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${rawName}.pdf"`,
      'Content-Length':       pdfBuffer.length,
    });
    res.end(pdfBuffer);
  } catch (err) {
    console.error('Text-to-PDF generation failed:', err);
    return res.status(500).json({
      success: false,
      error:   'PDF generation failed',
      details: err.message,
    });
  }
}

// ── POST /api/tools/text-to-pdf/format (AI quick-import) ──────
// Returns blocks in the new block-based format.
const FORMAT_SYSTEM =
  'You are an expert Islamic hadith book typesetter. ' +
  'You produce polished, professionally structured JSON for a book compositor. ' +
  'Return ONLY valid JSON — no markdown, no backticks, no text before or after the JSON object. ' +
  'All content fields must contain plain text only — never any markdown syntax.';

function buildFormatPrompt(text) {
  return `You are an expert Islamic text formatter. Analyze the text below and return ONLY a valid JSON object — no markdown fences, no explanations, nothing before or after the JSON.

Your goal: produce output that looks like a polished, professionally typeset Islamic book — clear hierarchy, proper grouping, nothing truncated.

OUTPUT STRUCTURE:
{
  "name": "concise document/book title",
  "blocks": [
    { "id": "1", "type": "chapter_heading", "arabicTitle": "full chapter title preserving any number, e.g. ٤- باب الطہارۃ", "urduSubtitle": "Urdu chapter subtitle or empty string" },
    { "id": "2", "type": "hadith", "number": "٤٢", "arabicMatn": "complete Arabic isnad + matn, nothing truncated", "urduTranslation": "complete Urdu translation, nothing truncated", "arabicFont": "Noto Naskh Arabic" },
    { "id": "3", "type": "fiqh", "points": ["complete first ruling", "complete second ruling"] },
    { "id": "4", "type": "reference", "content": "full source citation, e.g. صحیح البخاری: ١٥٠، صحیح مسلم: ٢٤١" },
    { "id": "5", "type": "verse", "arabicText": "Quranic verse Arabic text", "urduText": "Urdu translation of verse or empty string" },
    { "id": "6", "type": "free_text", "content": "introductory or explanatory paragraph" }
  ]
}

BLOCK ASSIGNMENT RULES — read every rule before assigning:

chapter_heading:
  - Use for chapter/section/باب titles ONLY.
  - ALWAYS include the full number+title in arabicTitle. If the source has "٤- باب الماء وَالْقَدر" write exactly "٤- باب الماء وَالْقَدر".
  - urduSubtitle: Urdu chapter title if present, otherwise "".
  - Never put hadith text or fiqh notes inside a chapter_heading.

hadith:
  - Use for hadith narrations containing an isnad (chain of narrators) and matn (body of hadith).
  - "number": the hadith sequence number extracted from the text (e.g. "٤٢", "١٢٣"). Do NOT put this number inside arabicMatn.
  - arabicMatn: the COMPLETE Arabic text (isnad + matn). Never truncate.
  - urduTranslation: the COMPLETE Urdu translation. Never truncate.
  - One block per hadith. Never split one hadith across multiple blocks.
  - arabicFont: always "Noto Naskh Arabic".

fiqh:
  - Use ONLY for فقہ الحدیث / فقہی نکات / فوائد sections that list lessons or rulings.
  - Each individual lesson/ruling is one entry in "points" array. Do not combine multiple points into one string.
  - Do NOT use for general explanatory paragraphs that happen to list items.

reference:
  - Use for takhrij and source citations that appear after a hadith (صحیح البخاری، صحیح مسلم، etc.).
  - Always place immediately after the hadith/fiqh block it references.

verse:
  - Use for Quranic ayat or introductory prophetic verse lines.
  - If no Urdu translation is present, set urduText to "".

free_text:
  - Use for introductory paragraphs, explanations, prefaces, and body text not covered above.
  - KEEP related sentences together in ONE block. Never split a continuous paragraph into tiny sentence-by-sentence blocks.
  - If content spans multiple clearly separate paragraphs, each paragraph gets its own free_text block.

ABSOLUTE RULES:
1. Never truncate any Arabic or Urdu text — always complete.
2. Never merge two different block types into one block.
3. Never split one logical unit (one hadith, one paragraph) across multiple blocks.
4. Preserve every number exactly as written — chapter numbers in arabicTitle, hadith numbers in "number" field.
5. Plain text ONLY in every field — no **bold**, no *italic*, no markdown whatsoever.
6. Every block must have a unique string "id" starting from "1".

TYPOGRAPHY QUALITY RULES (produce output comparable to a professionally typeset academic book):
- Group related content together — never scatter a single logical section across many tiny blocks.
- Maintain proper heading hierarchy: chapter_heading → hadith → fiqh → reference, in that order.
- Do not create more blocks than necessary; merge short related paragraphs into one free_text block.
- Avoid orphaned single-line blocks — a reference should always follow its hadith/fiqh, never stand alone.
- Preserve all content; never summarise or omit anything from the input text.

Text to analyze:
${text}`;
}

function extractJSON(raw) {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const start = raw.indexOf('{');
  const end   = raw.lastIndexOf('}');
  if (start !== -1 && end > start) return raw.slice(start, end + 1).trim();
  return raw.trim();
}

function stripMd(str) {
  if (!str) return '';
  return str
    .replace(/\*\*(.*?)\*\*/gs, '$1')
    .replace(/__(.*?)__/gs, '$1')
    .replace(/\*(.*?)\*/gs,  '$1')
    .replace(/_(.*?)_/gs,    '$1')
    .replace(/`(.*?)`/gs,    '$1');
}

async function textToPdfFormat(req, res) {
  try {
    const { text } = req.body;
    if (!text?.trim())
      return res.status(400).json({ error: 'Text is required.' });
    if (text.length > 10000)
      return res.status(400).json({ error: 'Text too long (max 10,000 characters).' });

    // Lazy-loaded so a missing groq-sdk doesn't break the entire module at startup.
    const Groq = require('groq-sdk');
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const response = await groq.chat.completions.create({
      model:       'llama-3.3-70b-versatile',
      temperature: 0.2,
      max_tokens:  4096,
      messages: [
        { role: 'system', content: FORMAT_SYSTEM },
        { role: 'user',   content: buildFormatPrompt(text.trim()) },
      ],
    });

    const raw = response.choices[0]?.message?.content?.trim();
    if (!raw)
      return res.status(500).json({ error: 'AI returned an empty response. Please try again.' });

    let parsed;
    try { parsed = JSON.parse(extractJSON(raw)); }
    catch { return res.status(500).json({ error: 'AI response could not be parsed. Please try again.' }); }

    if (!Array.isArray(parsed.blocks))
      return res.status(500).json({ error: 'Invalid AI response structure. Please try again.' });

    const ts = Date.now();
    const blocks = parsed.blocks.map((b, i) => {
      const block = { ...b, id: String(b.id ?? `${ts}-${i}`) };
      // Strip markdown from text fields
      if (block.arabicTitle)      block.arabicTitle      = stripMd(block.arabicTitle);
      if (block.urduSubtitle)     block.urduSubtitle     = stripMd(block.urduSubtitle);
      if (block.arabicMatn)       block.arabicMatn       = stripMd(block.arabicMatn);
      if (block.urduTranslation)  block.urduTranslation  = stripMd(block.urduTranslation);
      if (block.content)          block.content          = stripMd(block.content);
      if (block.arabicText)       block.arabicText       = stripMd(block.arabicText);
      if (block.urduText)         block.urduText         = stripMd(block.urduText);
      if (Array.isArray(block.points)) block.points = block.points.map(p => stripMd(p));
      return block;
    });

    return res.json({
      success: true,
      name:    parsed.name || 'Untitled Document',
      blocks,
    });
  } catch (err) {
    console.error('[textToPdfFormat]', err.message);
    return res.status(500).json({ error: 'Formatting failed. Please try again.' });
  }
}

module.exports = { textToPdfFormat, textToPdfGenerate, textToPdfLimiter };
