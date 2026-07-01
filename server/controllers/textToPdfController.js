const rateLimit = require('express-rate-limit');
const crypto    = require('crypto');
const metrics   = require('../utils/textToPdfMetrics');
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
const MODEL                 = 'llama-3.1-8b-instant';
const MAX_COMPLETION_TOKENS = 8000;  // headroom above SAFE_CHUNK_TOKENS — JSON output runs larger than input
const SAFE_CHUNK_TOKENS     = 2500;  // per-chunk input budget (leaves room for prompt + output)
const HARD_MAX_TOKENS       = 20000; // reject upfront rather than queue 8+ sequential chunks
const PER_ATTEMPT_TIMEOUT   = 25000; // ms — per HTTP attempt to Groq
const MAX_RETRIES           = 3;
const RETRY_BASE_MS         = 600;
const RETRY_MAX_MS          = 6000;

const FORMAT_SYSTEM =
  'You are an Islamic book typesetter. Return ONLY valid JSON — no markdown, no backticks, no extra text, no explanation before or after. ' +
  'The response MUST be a single JSON object of the exact shape {"name":"title","blocks":[...]} and nothing else. Plain text only in all string fields.';

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

// Pulls the model's text out of whatever shape the SDK/provider handed back.
// Groq's SDK always returns response.choices[0].message.content, but this
// stays defensive against provider/SDK changes rather than assuming one shape.
function extractContent(response) {
  const candidates = [
    response?.choices?.[0]?.message?.content,
    response?.data?.choices?.[0]?.message?.content,
    response?.choices?.[0]?.text,
    response?.data?.choices?.[0]?.text,
    response?.output,
    response?.data?.output,
    response?.output_text,
    response?.data?.output_text,
  ];
  const found = candidates.find((c) => typeof c === 'string' && c.trim().length > 0);
  return (found || '').trim();
}

function looksLikeJSON(str) {
  const s = str.trim();
  return s.startsWith('{') || s.startsWith('[');
}

function tryParseStrict(str) {
  try { return { ok: true, data: JSON.parse(str) }; }
  catch (err) { return { ok: false, error: err }; }
}

// Salvages a truncated `{"name":...,"blocks":[{...},{...},<cut off>` payload
// (the common failure mode when generation hits the token limit mid-array)
// by keeping only block objects that are structurally complete and discarding
// the partial trailing one, rather than losing the whole response.
function extractCompleteBlocksJSON(raw) {
  const blocksKeyIdx = raw.indexOf('"blocks"');
  if (blocksKeyIdx === -1) return null;
  const arrStart = raw.indexOf('[', blocksKeyIdx);
  if (arrStart === -1) return null;

  let depth = 1; // already inside the blocks array
  let inStr = false;
  let esc = false;
  let lastCompleteEnd = -1;

  for (let i = arrStart + 1; i < raw.length; i++) {
    const ch = raw[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{' || ch === '[') depth++;
    else if (ch === '}' || ch === ']') {
      depth--;
      if (depth === 1 && ch === '}') lastCompleteEnd = i + 1; // closed a top-level block element
      if (depth === 0) break; // the blocks array itself closed cleanly
    }
  }

  if (lastCompleteEnd === -1) return null;

  const nameMatch = raw.match(/"name"\s*:\s*"((?:[^"\\]|\\.)*)"/);
  const blocksJson = raw.slice(arrStart, lastCompleteEnd);
  const rebuilt = `{"name":${JSON.stringify(nameMatch ? nameMatch[1] : '')},"blocks":${blocksJson}]}`;

  const result = tryParseStrict(rebuilt);
  return result.ok ? result.data : null;
}

// Never calls JSON.parse() blindly on model output. Tries strict parsing,
// then salvages complete blocks from truncated JSON, then — rather than
// failing the chunk — falls back to the chunk's own source text so no
// content is ever lost, only its AI-generated structure.
function parseAIResponse(raw, chunkText, ctx) {
  const candidate = extractJSON(raw);

  if (looksLikeJSON(candidate)) {
    const strict = tryParseStrict(candidate);
    if (strict.ok && Array.isArray(strict.data.blocks) && strict.data.blocks.length) {
      return { blocks: strict.data.blocks, name: strict.data.name, mode: 'json' };
    }

    logEvent('warn', 'json_parse_failed', {
      ...ctx,
      parserError: strict.ok ? 'blocks array missing or empty' : strict.error.message,
    });

    const salvaged = extractCompleteBlocksJSON(raw) || extractCompleteBlocksJSON(candidate);
    if (salvaged?.blocks?.length) {
      logEvent('warn', 'json_salvaged_truncated', {
        ...ctx,
        salvagedBlockCount: salvaged.blocks.length,
        rawLength:          raw.length,
      });
      return { blocks: salvaged.blocks, name: salvaged.name, mode: 'salvaged' };
    }
  } else {
    logEvent('warn', 'non_json_response', { ...ctx, rawLength: raw.length });
  }

  logEvent('warn', 'plain_text_fallback', { ...ctx });
  return {
    blocks: [{ type: 'free_text', content: stripMd(chunkText) }],
    name:   undefined,
    mode:   'plain_text_fallback',
  };
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

// ── Structured logging (no secrets, no raw user text) ──────────
function logEvent(level, event, meta = {}) {
  const line = { ts: new Date().toISOString(), event, ...meta };
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn('[textToPdfFormat]', JSON.stringify(line));
}

// ── Token estimation (heuristic — no tokenizer available for Llama) ──
// ASCII text tokenizes at roughly 4 chars/token; Arabic/Urdu script and other
// wide-codepoint text tokenizes much denser (~1.5 chars/token) under typical
// BPE vocabularies. Iterating by code point keeps surrogate pairs intact.
function estimateTokens(text) {
  if (!text) return 0;
  let asciiChars = 0;
  let wideChars  = 0;
  for (const ch of text) {
    if (ch.codePointAt(0) < 128) asciiChars++;
    else wideChars++;
  }
  return Math.ceil(asciiChars / 4 + wideChars / 1.5);
}

// Adjust a cut index so it never lands inside a UTF-16 surrogate pair.
function safeSliceEnd(text, index) {
  let i = Math.max(1, Math.min(index, text.length - 1));
  const code = text.charCodeAt(i);
  if (code >= 0xdc00 && code <= 0xdfff) i--; // low surrogate — back up onto its high surrogate
  return i;
}

function splitLongParagraph(paragraph, maxTokens) {
  // Prefer sentence boundaries (Latin + Urdu/Arabic terminators), then hard-slice as a last resort.
  const sentences = paragraph.split(/(?<=[.!?۔؟])\s+/);
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    const candidate = current ? `${current} ${sentence}` : sentence;
    if (current && estimateTokens(candidate) > maxTokens) {
      chunks.push(current);
      current = sentence;
    } else {
      current = candidate;
    }
    while (estimateTokens(current) > maxTokens) {
      const approxChars = maxTokens * 3; // conservative floor so we under-cut, never over
      const cut = safeSliceEnd(current, Math.min(approxChars, current.length - 1));
      chunks.push(current.slice(0, cut));
      current = current.slice(cut);
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

// Splits on paragraph boundaries first (preserves hadith/verse block integrity),
// falling back to sentence/hard splits only for a single oversized paragraph.
function splitTextIntoChunks(text, maxTokens) {
  const paragraphs = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  const chunks = [];
  let current = '';

  const flush = () => { if (current.trim()) chunks.push(current.trim()); current = ''; };

  for (const paragraph of paragraphs) {
    if (estimateTokens(paragraph) > maxTokens) {
      flush();
      for (const piece of splitLongParagraph(paragraph, maxTokens)) {
        if (piece.trim()) chunks.push(piece.trim());
      }
      continue;
    }
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (current && estimateTokens(candidate) > maxTokens) {
      flush();
      current = paragraph;
    } else {
      current = candidate;
    }
  }
  flush();
  return chunks.length ? chunks : [text];
}

// ── Error classification ────────────────────────────────────────
// Maps Groq SDK errors (typed classes with .status) to an HTTP status, a
// stable machine-readable code, and a safe, specific, user-facing message.
// Parsing failures never reach here — parseAIResponse() always degrades
// gracefully instead of throwing (see below).
function classifyError(err) {
  const Groq = require('groq-sdk');
  const status = err?.status;
  const isTimeout = err instanceof Groq.APIConnectionTimeoutError || err?.name === 'APIConnectionTimeoutError';
  const isConnError = !isTimeout && (
    err instanceof Groq.APIConnectionError ||
    ['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN'].includes(err?.code)
  );

  if (isTimeout) {
    return { code: 'TIMEOUT', httpStatus: 504, retryable: true, userMessage: 'The AI service took too long to respond. Please try again.' };
  }
  if (isConnError) {
    return { code: 'NETWORK_ERROR', httpStatus: 503, retryable: true, userMessage: 'Could not reach the AI service. Please check your connection and try again.' };
  }
  if (status === 401) {
    return { code: 'AUTH_ERROR', httpStatus: 502, retryable: false, userMessage: 'The AI service rejected our API key. Please contact support.' };
  }
  if (status === 403) {
    return { code: 'FORBIDDEN', httpStatus: 502, retryable: false, userMessage: 'Access to the AI service was denied. Please contact support.' };
  }
  if (status === 400) {
    const bodyMsg = err?.error?.message || err?.message || '';
    if (/too large|context length|maximum context|reduce.*(message|token)/i.test(bodyMsg)) {
      return { code: 'INPUT_TOO_LARGE', httpStatus: 413, retryable: false, userMessage: 'This section of text is too large for the AI to process. Please shorten it and try again.' };
    }
    return { code: 'INVALID_REQUEST', httpStatus: 400, retryable: false, userMessage: 'The AI service rejected the request as invalid. Please try again with different text.' };
  }
  if (status === 429) {
    return { code: 'RATE_LIMIT', httpStatus: 429, retryable: true, userMessage: 'The AI service is rate-limited right now. Please wait a few seconds and try again.' };
  }
  if (status >= 500) {
    return { code: 'SERVICE_UNAVAILABLE', httpStatus: 503, retryable: true, userMessage: 'The AI service is temporarily unavailable. Please try again shortly.' };
  }

  return { code: 'INTERNAL_ERROR', httpStatus: 500, retryable: false, userMessage: 'Formatting failed due to an unexpected error. Please try again.' };
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

// Retries only 429 / 5xx / timeout (per classifyError.retryable), up to
// MAX_RETRIES times, with exponential backoff + jitter. Every attempt is
// logged so retry counts are visible in monitoring.
async function callGroqWithRetry(groq, params, ctx) {
  let attempt = 0;
  let retryCount = 0;
  let timedOut = false;
  let lastErr;

  while (attempt <= MAX_RETRIES) {
    const attemptStart = Date.now();
    try {
      const response = await groq.chat.completions.create(params, {
        timeout:    PER_ATTEMPT_TIMEOUT,
        maxRetries: 0, // we own retry/backoff so every attempt is logged individually
      });
      return { response, retryCount, timedOut };
    } catch (err) {
      lastErr = err;
      const classified = classifyError(err);
      if (classified.code === 'TIMEOUT') timedOut = true;

      logEvent('warn', 'groq_attempt_failed', {
        ...ctx,
        attempt:         attempt + 1,
        maxAttempts:     MAX_RETRIES + 1,
        status:          err?.status ?? null,
        code:            classified.code,
        retryable:       classified.retryable,
        durationMs:      Date.now() - attemptStart,
        providerMessage: err?.error?.message || err?.message || null,
      });

      if (!classified.retryable || attempt === MAX_RETRIES) throw err;

      const backoff = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** attempt) + Math.floor(Math.random() * 250);
      retryCount += 1;
      await sleep(backoff);
      attempt += 1;
    }
  }
  throw lastErr;
}

async function formatChunk(groq, chunkText, ctx) {
  const params = {
    model:                 MODEL,
    temperature:           0.2,
    max_completion_tokens: MAX_COMPLETION_TOKENS,
    // Forces syntactically valid JSON out of the model. Doesn't guarantee our
    // exact {name, blocks} shape or protect against max-token truncation —
    // parseAIResponse() below still has to verify/salvage/fall back.
    response_format:       { type: 'json_object' },
    messages: [
      { role: 'system', content: FORMAT_SYSTEM },
      { role: 'user',   content: buildFormatPrompt(chunkText) },
    ],
  };

  const { response, retryCount, timedOut } = await callGroqWithRetry(groq, params, ctx);

  // Log the complete raw response BEFORE any parsing is attempted.
  console.log('RAW AI RESPONSE', { requestId: ctx.requestId, chunkIndex: ctx.chunkIndex, chunkCount: ctx.chunkCount });
  console.dir(response, { depth: null });

  const raw = extractContent(response);
  if (!raw) logEvent('warn', 'empty_ai_response', ctx);

  const { blocks, name, mode } = parseAIResponse(raw, chunkText, ctx);
  if (mode !== 'json') {
    logEvent('warn', 'chunk_used_fallback_parsing', { ...ctx, mode, blockCount: blocks.length });
  }

  return { name, blocks, retryCount, timedOut, usage: response.usage, parseMode: mode };
}

async function textToPdfFormat(req, res) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  let retryCount  = 0;
  let timedOutAny = false;
  let chunkCount  = 1;

  try {
    const { text } = req.body;
    if (!text?.trim())
      return res.status(400).json({ error: 'Text is required.', code: 'INVALID_REQUEST', requestId });

    const trimmed       = text.trim();
    const inputLength   = trimmed.length;
    const tokenEstimate = estimateTokens(trimmed);

    logEvent('info', 'request_received', { requestId, model: MODEL, inputLength, tokenEstimate });

    if (!process.env.GROQ_API_KEY) {
      logEvent('error', 'missing_api_key', { requestId });
      metrics.recordRequest({ success: false, durationMs: Date.now() - startedAt, code: 'MISSING_CONFIG' });
      return res.status(500).json({ error: 'AI service is not configured. Please contact support.', code: 'MISSING_CONFIG', requestId });
    }

    if (tokenEstimate > HARD_MAX_TOKENS) {
      logEvent('warn', 'input_too_large', { requestId, tokenEstimate });
      metrics.recordRequest({ success: false, durationMs: Date.now() - startedAt, code: 'INPUT_TOO_LARGE' });
      return res.status(413).json({
        error: 'This text is too large to format automatically. Please split it into smaller sections and try again.',
        code:  'INPUT_TOO_LARGE',
        requestId,
      });
    }

    const Groq = require('groq-sdk');
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY, timeout: PER_ATTEMPT_TIMEOUT, maxRetries: 0 });

    const chunks = tokenEstimate > SAFE_CHUNK_TOKENS
      ? splitTextIntoChunks(trimmed, SAFE_CHUNK_TOKENS)
      : [trimmed];
    chunkCount = chunks.length;

    if (chunkCount > 1)
      logEvent('info', 'chunking_input', { requestId, chunkCount, tokenEstimate });

    let docName = null;
    let parseFallbacks = 0;
    const allBlocks = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunkCtx = { requestId, chunkIndex: i + 1, chunkCount };
      try {
        const result = await formatChunk(groq, chunks[i], chunkCtx);
        retryCount  += result.retryCount;
        timedOutAny  = timedOutAny || result.timedOut;
        if (result.parseMode !== 'json') parseFallbacks += 1;
        if (!docName && result.name) docName = result.name;

        const blocks = (result.blocks || []).map((b, idx) => ({ ...b, id: `${i + 1}-${idx + 1}` }));
        allBlocks.push(...blocks);

        logEvent('info', 'chunk_formatted', {
          ...chunkCtx,
          blockCount:       blocks.length,
          retryCount:       result.retryCount,
          parseMode:        result.parseMode,
          promptTokens:      result.usage?.prompt_tokens ?? null,
          completionTokens:  result.usage?.completion_tokens ?? null,
        });
      } catch (chunkErr) {
        const classified = classifyError(chunkErr);
        const durationMs = Date.now() - startedAt;

        logEvent('error', 'chunk_failed', {
          ...chunkCtx,
          code:            classified.code,
          status:          chunkErr?.status ?? null,
          providerMessage: chunkErr?.error?.message || chunkErr?.message || null,
          stack:           chunkErr?.stack || null,
        });
        metrics.recordRequest({ success: false, durationMs, retries: retryCount, timedOut: timedOutAny, chunkCount, code: classified.code });

        const message = chunkCount > 1
          ? `Formatting failed while processing section ${i + 1} of ${chunkCount}: ${classified.userMessage}`
          : classified.userMessage;

        return res.status(classified.httpStatus).json({ error: message, code: classified.code, requestId });
      }
    }

    if (!allBlocks.length) {
      metrics.recordRequest({ success: false, durationMs: Date.now() - startedAt, retries: retryCount, timedOut: timedOutAny, chunkCount, code: 'PARSE_ERROR' });
      return res.status(502).json({ error: 'The AI did not return any formatted content. Please try again.', code: 'PARSE_ERROR', requestId });
    }

    const blocks = allBlocks.map((b) => {
      const block = { ...b };
      if (block.arabicTitle)      block.arabicTitle      = stripMd(block.arabicTitle);
      if (block.urduSubtitle)     block.urduSubtitle     = stripMd(block.urduSubtitle);
      if (block.arabicMatn)       block.arabicMatn       = stripMd(block.arabicMatn);
      if (block.urduTranslation)  block.urduTranslation  = stripMd(block.urduTranslation);
      if (block.content)          block.content          = stripMd(block.content);
      if (block.arabicText)       block.arabicText       = stripMd(block.arabicText);
      if (block.urduText)         block.urduText         = stripMd(block.urduText);
      if (Array.isArray(block.points)) block.points = block.points.map(stripMd);
      return block;
    });

    const durationMs = Date.now() - startedAt;
    logEvent('info', 'request_succeeded', { requestId, durationMs, retryCount, chunkCount, parseFallbacks, blockCount: blocks.length });
    metrics.recordRequest({ success: true, durationMs, retries: retryCount, timedOut: timedOutAny, chunkCount, parseFallbacks });

    return res.json({ success: true, name: docName || 'Untitled Document', blocks, requestId });
  } catch (err) {
    const classified = classifyError(err);
    const durationMs = Date.now() - startedAt;

    logEvent('error', 'request_failed', {
      requestId,
      code:            classified.code,
      status:          err?.status ?? null,
      providerMessage: err?.error?.message || err?.message || null,
      durationMs,
      stack:           err?.stack || null,
    });
    metrics.recordRequest({ success: false, durationMs, retries: retryCount, timedOut: timedOutAny, chunkCount, code: classified.code });

    return res.status(classified.httpStatus).json({ error: classified.userMessage, code: classified.code, requestId });
  }
}

module.exports = { textToPdfFormat, textToPdfGenerate, textToPdfLimiter };
