const fs                            = require('fs');
const { runGeminiTool }             = require('../services/gemini');
const { incrementUsage }            = require('../middleware/usageCheck');
const { TOOLS, FREE_LIMIT }         = require('../constants/tools');
const EmailCapture                  = require('../models/EmailCapture');
const Tool                          = require('../models/Tool');
const axios                         = require('axios');
const cheerio                       = require('cheerio');
const { processImage, processMedia } = require('../services/fileProcessor');
const { IMAGE_SLUGS, CONVERTER_SLUGS } = require('../middleware/upload');
const { analyzeSeo, generateSeoOutput, URL_ANALYZE_SLUGS, SEO_GENERATOR_SLUGS } = require('../services/seoProcessor');

// ── Audio-converter SSE progress streams ─────────────────────
// Maps jobId → active SSE response object. Entries are removed when the
// SSE connection closes or the conversion finishes.
const audioProgressStreams = new Map();

// ── GET /api/tools ─────────────────────────────────────────────
// Returns all active tools from DB, flat + grouped by category.
const getTools = async (req, res, next) => {
  try {
    const { category } = req.query;
    const filter = { isActive: true };
    if (category && /^[a-z0-9-]+$/.test(category)) filter.category = category;

    const tools = await Tool.find(filter)
      .sort({ category: 1, order: 1 })
      .select('-__v')
      .lean();

    const grouped = {};
    for (const tool of tools) {
      if (!grouped[tool.category]) grouped[tool.category] = [];
      grouped[tool.category].push(tool);
    }

    res.json({ success: true, tools, grouped, total: tools.length });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/tools/categories ─────────────────────────────────
const getCategories = (_req, res) => {
  res.json({
    success: true,
    categories: {
      'ai-writing':   { label: 'AI Writing',    icon: 'Bot' },
      'text-tools':   { label: 'Text Tools',    icon: 'FileText' },
      'image-tools':  { label: 'Image Tools',   icon: 'Image' },
      'media-tools':  { label: 'Media Tools',   icon: 'Music' },
      'productivity': { label: 'Productivity',  icon: 'Timer' },
      'seo-tools':    { label: 'SEO Tools',     icon: 'TrendingUp' },
    },
  });
};

// ── GET /api/tools/:slug ──────────────────────────────────────
// Returns a single active tool from DB. 404 if not found or inactive.
const getTool = async (req, res, next) => {
  try {
    const { slug } = req.params;
    if (!/^[a-z0-9-]+$/.test(slug))
      return res.status(400).json({ success: false, error: 'Invalid tool slug.' });

    const tool = await Tool.findOne({ slug, isActive: true }).select('-__v').lean();
    if (!tool)
      return res.status(404).json({ success: false, error: 'Tool not found.' });

    // Tool metadata changes infrequently — allow browsers and CDN to cache for 5 min
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.json({ success: true, tool });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/tools/:slug/usage ────────────────────────────────
// Unchanged — existing 10 tools still use this.
const getUsage = (req, res) => {
  const used = req.currentUsage || 0;
  res.json({
    success:   true,
    used,
    limit:     null,
    remaining: null,
  });
};

// ── POST /api/tools/:slug/run ─────────────────────────────────
// Handles AI tools (via Gemini) + SEO generator tools + QR/base64 specials.
const runTool = async (req, res, next) => {
  try {
    const { slug } = req.params;

    // ── SEO generator tools (no Gemini, no file upload) ──────────
    if (SEO_GENERATOR_SLUGS.has(slug)) {
      const { fields = {} } = req.body;
      const result = generateSeoOutput(slug, fields);
      Tool.findOneAndUpdate({ slug }, { $inc: { usageCount: 1 } }).catch(() => {});
      return res.json({ success: true, result });
    }

    const { text, tone, language, mode } = req.body;
    const tool = TOOLS[slug];

    if (!tool || !tool.isActive)
      return res.status(404).json({ success: false, error: 'Tool not found' });

    if (!text || typeof text !== 'string' || text.trim().length < 10)
      return res.status(400).json({ success: false, error: 'Text must be at least 10 characters.' });

    if (tool.maxChars > 0 && text.length > tool.maxChars)
      return res.status(400).json({ success: false, error: `Text too long. Max ${tool.maxChars} characters.` });

    if (tool.clientSide)
      return res.status(400).json({ success: false, error: 'This tool runs client-side.' });

    const { result, fromCache } = await runGeminiTool(slug, text.trim(), { tone, language, mode });

    if (req.ipHash) {
      await incrementUsage(req.ipHash, slug, req.usageDate, text.length);
    }

    Tool.findOneAndUpdate({ slug }, { $inc: { usageCount: 1 } }).catch(() => {});

    const used = (req.currentUsage || 0) + 1;
    res.json({
      success: true, result, fromCache,
      usage: { used, limit: null, remaining: null },
    });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/tools/:slug/analyze ────────────────────────────
// SEO tools that fetch external URLs.
const analyzeSeoTool = async (req, res, next) => {
  try {
    const { slug }                = req.params;
    const { url, text, ...opts }  = req.body;

    if (!URL_ANALYZE_SLUGS.has(slug))
      return res.status(404).json({ success: false, error: 'Tool not found.' });

    const result = await analyzeSeo(url, slug, { text, ...opts });
    Tool.findOneAndUpdate({ slug }, { $inc: { usageCount: 1 } }).catch(() => {});
    res.json({ success: true, result });
  } catch (err) {
    const status = err.code === 400 ? 400 : 500;
    res.status(status).json({ success: false, error: err.message || 'Analysis failed.' });
  }
};

// ── POST /api/tools/citation-generator/fetch-source ──────────
const EMPTY_SOURCE = {
  title: '', author: '', year: '', publisher: '', url: '',
  journal: '', volume: '', issue: '', pages: '',
  doi: '', isbn: '', newspaperName: '', magazineName: '',
};

async function scrapeUrl(url) {
  const { data } = await axios.get(url, {
    timeout: 10000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
    },
    maxRedirects: 5,
  });
  const $ = cheerio.load(data);

  function getMeta(...names) {
    for (const name of names) {
      const val = $(`meta[property="${name}"]`).attr('content') ||
                  $(`meta[name="${name}"]`).attr('content');
      if (val && val.trim()) return val.trim();
    }
    return '';
  }

  // Title: og:title → twitter:title → <title> tag → URL slug
  const title =
    getMeta('og:title', 'twitter:title') ||
    $('title').text().trim() ||
    url.split('/').filter(Boolean).pop()?.replace(/-/g, ' ') ||
    '';

  // Year: article:published_time → publish-date → date → og:updated_time → current year
  const rawDate = getMeta(
    'article:published_time',
    'publish-date',
    'date',
    'og:updated_time',
    'DC.date',
  );
  let year = '';
  if (rawDate) {
    const parsed = new Date(rawDate);
    if (!isNaN(parsed.getFullYear())) year = String(parsed.getFullYear());
  }
  // Leave year empty if not found — user fills manually

  // Publisher: og:site_name → publisher → application-name → domain from URL
  let publisher = getMeta('og:site_name', 'publisher', 'application-name');
  if (!publisher) {
    try { publisher = new URL(url).hostname.replace(/^www\./, ''); } catch {}
  }

  // Author: article:author → author → twitter:creator → DC.creator
  const author = getMeta('article:author', 'author', 'twitter:creator', 'DC.creator');

  return { title, author, year, publisher, url };
}

async function fetchBook(isbn) {
  const { data } = await axios.get(
    `https://openlibrary.org/search.json?isbn=${isbn}&fields=title,author_name,publisher,publish_year,publish_place`,
    { timeout: 8000 }
  );
  const doc = data.docs?.[0];
  if (!doc) throw new Error('Book not found for this ISBN.');
  return {
    title:     doc.title || '',
    author:    doc.author_name?.[0] || '',
    year:      String(doc.publish_year?.[0] || ''),
    publisher: doc.publisher?.[0] || '',
    isbn,
  };
}

async function fetchJournal(doi) {
  const { data } = await axios.get(
    `https://api.crossref.org/works/${encodeURIComponent(doi)}`,
    { timeout: 8000, headers: { 'User-Agent': 'InnovateTools/1.0 (thefiveriversllc@gmail.com)' } }
  );
  const w = data.message;
  if (!w) throw new Error('Journal not found for this DOI.');

  const authorParts = w.author?.[0]
    ? [w.author[0].family, w.author[0].given].filter(Boolean).join(', ')
    : '';
  const allAuthors = w.author?.length > 1
    ? w.author.map(a => [a.family, a.given].filter(Boolean).join(', ')).join('; ')
    : authorParts;

  return {
    title:   Array.isArray(w.title) ? w.title[0] : w.title || '',
    author:  allAuthors,
    year:    String(w.published?.['date-parts']?.[0]?.[0] || ''),
    journal: Array.isArray(w['container-title']) ? w['container-title'][0] : w['container-title'] || '',
    volume:  w.volume || '',
    issue:   w.issue || '',
    pages:   w.page || '',
    doi,
    url:     w.URL || '',
  };
}

const fetchSource = async (req, res) => {
  const { sourceType, url, isbn, doi } = req.body;
  const result = { ...EMPTY_SOURCE };

  try {
    if (sourceType === 'Thesis') {
      return res.json({ success: true, thesis: true, source: result });
    }

    if (sourceType === 'Book') {
      if (!isbn) return res.status(400).json({ success: false, error: 'ISBN is required for books.' });
      const cleaned = isbn.replace(/[-\s]/g, '');
      if (!/^[0-9]{10}$|^[0-9]{13}$|^[0-9]{9}X$/.test(cleaned))
        return res.status(400).json({ success: false, error: 'Invalid ISBN. Must be 10 or 13 digits.' });
      const data = await fetchBook(cleaned);
      return res.json({ success: true, source: { ...result, ...data } });
    }

    if (sourceType === 'Journal Article') {
      if (!doi) return res.status(400).json({ success: false, error: 'DOI is required for journal articles.' });
      if (!/^10\.\d{4,9}\/.+/i.test(doi.trim()))
        return res.status(400).json({ success: false, error: 'Invalid DOI format. Example: 10.1000/xyz123' });
      const data = await fetchJournal(doi.trim());
      return res.json({ success: true, source: { ...result, ...data } });
    }

    // Website / Newspaper / Magazine / Report
    if (!url) return res.status(400).json({ success: false, error: 'URL is required.' });
    try { new URL(url); } catch {
      return res.status(400).json({ success: false, error: 'Invalid URL.' });
    }
    const scraped = await scrapeUrl(url);
    if (sourceType === 'Newspaper') scraped.newspaperName = scraped.publisher;
    if (sourceType === 'Magazine')  scraped.magazineName  = scraped.publisher;
    return res.json({ success: true, source: { ...result, ...scraped } });

  } catch (err) {
    return res.json({
      success: false,
      error: err.message?.includes('not found')
        ? err.message
        : 'Could not fetch details. Please enter manually.',
    });
  }
};

// ── POST /api/tools/capture-email ────────────────────────────
// Unchanged.
const captureEmail = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@'))
      return res.status(400).json({ success: false, error: 'Valid email required.' });

    await EmailCapture.findOneAndUpdate(
      { email },
      { email, source: req.body.source || 'usage-limit' },
      { upsert: true }
    );
    res.json({ success: true, message: 'Email saved! You get 5 more uses today.' });
  } catch (err) {
    next(err);
  }
};

// ── GET /api/tools/audio-converter/progress/:jobId ───────────
// SSE endpoint — client opens this before uploading. FFmpeg progress
// events are forwarded here in real time so the client can show a
// progress bar and ETA without polling.
const getAudioProgress = (req, res) => {
  const { jobId } = req.params;
  if (!jobId || !/^[a-z0-9-]+$/i.test(jobId)) return res.status(400).end();

  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering if present
  res.flushHeaders();

  audioProgressStreams.set(jobId, res);

  // Keep-alive ping every 10 s so proxies don't drop the connection
  const ping = setInterval(() => { if (!res.writableEnded) res.write(':ping\n\n'); }, 10000);

  req.on('close', () => {
    clearInterval(ping);
    audioProgressStreams.delete(jobId);
  });
};

// ── POST /api/tools/:slug/process ────────────────────────────
const processFile = async (req, res, next) => {
  const { slug } = req.params;

  const MULTI_SLUGS    = new Set(['image-merger', 'audio-merger', 'video-merger']);
  const SUBTITLE_SLUGS = new Set(['hardcode-subtitles']);

  const isMulti    = MULTI_SLUGS.has(slug);
  const isSubtitle = SUBTITLE_SLUGS.has(slug);

  let inputPath;
  let cleanupPaths = [];
  const options = { ...req.body };

  if (isMulti) {
    if (!req.files || req.files.length < 2) {
      const noun = slug === 'audio-merger' ? 'audio' : slug === 'video-merger' ? 'video' : 'image';
      return res.status(400).json({ success: false, error: `At least 2 ${noun} files are required.` });
    }
    inputPath    = req.files.map(f => f.path);
    cleanupPaths = [...inputPath];
  } else if (isSubtitle) {
    const videoFile    = req.files?.file?.[0];
    const subtitleFile = req.files?.subtitle?.[0];
    if (!videoFile)    return res.status(400).json({ success: false, error: 'Video file is required.' });
    if (!subtitleFile) return res.status(400).json({ success: false, error: 'Subtitle file (.srt or .vtt) is required.' });
    inputPath             = videoFile.path;
    options.subtitlePath  = subtitleFile.path;
    cleanupPaths          = [inputPath, subtitleFile.path];
  } else {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded.' });
    }
    if (req.file.buffer) {
      // Memory storage (audio-converter piped mode) — no disk path exists
      inputPath = null;
      options.inputBuffer  = req.file.buffer;
      options.originalname = req.file.originalname;
      cleanupPaths = [];
    } else {
      inputPath    = req.file.path;
      cleanupPaths = [inputPath];
    }
  }

  const cleanup = () => {
    cleanupPaths.forEach(p => { if (p) fs.unlink(p, () => {}); });
  };

  try {
    // For audio-converter, look up the SSE stream opened by the client and pass it down
    // so FFmpeg progress events can be streamed in real time.
    if (slug === 'audio-converter' && options.jobId) {
      options.progressStream = audioProgressStreams.get(options.jobId) || null;
    }

    const result = (IMAGE_SLUGS.includes(slug) || CONVERTER_SLUGS.includes(slug))
      ? await processImage(inputPath, slug, options)
      : await processMedia(inputPath, slug, options);

    // Close the SSE stream once processing is complete
    if (slug === 'audio-converter' && options.jobId) {
      audioProgressStreams.delete(options.jobId);
    }

    cleanup();

    // JSON-only results (no file download)
    if (result.base64) {
      return res.json({ success: true, base64: result.base64 });
    }
    if (result.text !== undefined) {
      return res.json({ success: true, text: result.text });
    }

    // background-remover with no API key
    if (result.comingSoon) {
      return res.status(503).json({
        success: false,
        comingSoon: true,
        error: 'Background removal is coming soon. Add a REMOVEBG_API_KEY to enable it.',
      });
    }

    // In-memory output (audio-converter piped mode) — send buffer directly
    if (result.outputBuffer) {
      res.setHeader('Content-Type', result.mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.end(result.outputBuffer);
      Tool.findOneAndUpdate({ slug }, { $inc: { usageCount: 1 } }).catch(() => {});
      return;
    }

    // Stream output file then delete
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    const stream = fs.createReadStream(result.outputPath);
    stream.on('end',   () => fs.unlink(result.outputPath, () => {}));
    stream.on('error', (e) => { fs.unlink(result.outputPath, () => {}); next(e); });
    stream.pipe(res);

    Tool.findOneAndUpdate({ slug }, { $inc: { usageCount: 1 } }).catch(() => {});
  } catch (err) {
    cleanup();
    next(err);
  }
};

// ── POST /api/tools/qr-code-generator/run ────────────────────
// Text → QR PNG returned as base64 data URL (no file upload).
const runQRCode = async (req, res, next) => {
  try {
    const { text, size, errorLevel } = req.body;

    if (!text || !String(text).trim()) {
      return res.status(400).json({ success: false, error: 'Text is required.' });
    }

    const result = await processImage(null, 'qr-code-generator', {
      text: String(text).trim(),
      size,
      errorLevel,
    });

    const buffer  = fs.readFileSync(result.outputPath);
    const dataUrl = `data:image/png;base64,${buffer.toString('base64')}`;
    fs.unlink(result.outputPath, () => {});

    Tool.findOneAndUpdate({ slug: 'qr-code-generator' }, { $inc: { usageCount: 1 } }).catch(() => {});

    res.json({ success: true, dataUrl, filename: result.filename });
  } catch (err) {
    next(err);
  }
};

// ── POST /api/tools/base64-to-png/run & /base64-to-jpg/run ───
// Accepts a base64 image string (raw or data-URL) and streams back a converted file.
const runBase64Convert = async (req, res, next) => {
  // Routes are static (/base64-to-png/run), not /:slug/run, so params.slug is undefined.
  // Derive the slug from the URL path within the router instead.
  const slug = req.path.split('/').filter(Boolean)[0]; // 'base64-to-png' | 'base64-to-jpg'
  const { base64 } = req.body;

  if (!base64 || typeof base64 !== 'string' || base64.trim().length < 20) {
    return res.status(400).json({ success: false, error: 'A valid base64 image string is required.' });
  }

  try {
    const result = await processImage(null, slug, { base64: base64.trim() });

    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    const stream = fs.createReadStream(result.outputPath);
    stream.on('end',   () => fs.unlink(result.outputPath, () => {}));
    stream.on('error', (err) => { fs.unlink(result.outputPath, () => {}); next(err); });
    stream.pipe(res);

    Tool.findOneAndUpdate({ slug }, { $inc: { usageCount: 1 } }).catch(() => {});
  } catch (err) {
    next(err);
  }
};

const runMemeCaption = async (req, res, next) => {
  try {
    const { topic, mode } = req.body;
    if (!topic || typeof topic !== 'string') return res.status(400).json({ success: false, error: 'topic required' });
    const { result } = await runGeminiTool('meme-caption', topic.slice(0, 300), { mode: mode || 'text meme' });
    res.json({ success: true, caption: result });
  } catch (err) {
    next(err);
  }
};

module.exports = { getTools, getCategories, getTool, getUsage, runTool, captureEmail, fetchSource, processFile, runQRCode, runBase64Convert, analyzeSeoTool, getAudioProgress, runMemeCaption };
