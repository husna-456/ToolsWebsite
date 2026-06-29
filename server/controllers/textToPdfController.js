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

    const blocks = documentData.blocks;
    const first  = blocks[0] || {};
    console.log('[PDF_REQUEST_DEBUG]', JSON.stringify({
      blocksCount:     blocks.length,
      firstBlockType:  first.type,
      firstBlockFont:  first.fontFamily  || first.arabicFont || null,
      firstBlockDir:   first.direction   || null,
      firstBlockAlign: first.textAlign   || null,
      firstBlock:      first,
    }));

    const { generatePDF } = require('../services/pdfGeneratorMake');
    const pdfBuffer = await generatePDF(documentData);

    // Strip non-ASCII from filename (HTTP headers: ASCII only)
    const rawName = (documentData.name || documentData.title || 'document')
      .replace(/[^a-zA-Z0-9\s_-]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .substring(0, 60) || 'document';

    if (!pdfBuffer || pdfBuffer.length < 100) {
      return res.status(500).json({ success: false, error: 'PDF generation produced empty output.' });
    }

    res.set({
      'Content-Type':        'application/pdf',
      'Content-Disposition': `attachment; filename="${rawName}.pdf"`,
      'Content-Length':       pdfBuffer.length,
      'Cache-Control':        'no-store',
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
  'You are an Islamic book typesetter. Return ONLY valid JSON — no markdown, no backticks, no extra text. Plain text only in all fields.';

function buildFormatPrompt(text) {
  return `Analyze the text and return ONLY this JSON (no markdown, no explanation):
{"name":"title","blocks":[...]}

Block types and required fields:
- chapter_heading: {arabicTitle, urduSubtitle}  — for باب/chapter titles only
- hadith: {number, arabicMatn, urduTranslation, arabicFont:"Noto Naskh Arabic"}  — one block per hadith, never truncate
- fiqh: {heading, points:[...]}  — for فقہ الحدیث/rulings lists only
- reference: {content}  — source citations, place after hadith/fiqh
- verse: {arabicText, urduText}  — Quranic ayat
- free_text: {content}  — all other paragraphs

Rules: never truncate text. One logical unit per block. Unique string id per block starting "1". Plain text only, no markdown.

Text:
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

    // Lazy-loaded so a missing groq-sdk doesn't break the entire module at startup.
    const Groq = require('groq-sdk');
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const response = await groq.chat.completions.create({
      model:       'llama-3.1-8b-instant',
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
    console.error('[textToPdfFormat] error:', err.message, err.status, err.code);

    // Specific Groq / network error messages the user can act on
    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: 'AI service not configured. Please contact support.' });
    }
    if (err.status === 401 || err.message?.includes('401') || err.message?.includes('Unauthorized')) {
      return res.status(500).json({ error: 'AI service authentication failed. Please contact support.' });
    }
    if (err.status === 429 || err.message?.includes('429') || err.message?.includes('rate limit') || err.message?.includes('Request too large') || err.message?.includes('TPM')) {
      return res.status(429).json({ error: 'AI service is busy. Please wait a few seconds and try again, or paste a smaller section of text.' });
    }
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND' || err.message?.includes('network')) {
      return res.status(503).json({ error: 'Could not reach AI service. Please check your connection and try again.' });
    }

    return res.status(500).json({ error: 'Formatting failed. Please try again.' });
  }
}

module.exports = { textToPdfFormat, textToPdfGenerate, textToPdfLimiter };
