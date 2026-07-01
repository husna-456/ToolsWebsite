'use strict';

/**
 * Production PDF generator for Text-to-PDF tool.
 * Target: Hostinger Business Plan Node.js shared hosting.
 *
 * All 24 editor fonts are supported:
 *   Arabic/Urdu : Amiri, NotoNaskhArabic, ScheherazadeNew, Cairo, Tajawal,
 *                 ReemKufi, Lateef, NotoNastaliqUrdu
 *                 ("Jameel Noori Nastaleeq" → NotoNastaliqUrdu — no free TTF)
 *   Latin       : Roboto, OpenSans, Lato, Poppins, Inter, Montserrat,
 *                 Merriweather, Lora, PlayfairDisplay, EBGaramond
 *   System      : Times New Roman → Lora, Arial → OpenSans,
 *                 Georgia → Merriweather, Verdana → OpenSans,
 *                 Trebuchet MS → OpenSans, Garamond → EBGaramond
 *
 * Font resolution: TTF files are committed in server/fonts/ (no downloads at runtime).
 *   1. server/fonts/{Name}-{Style}.ttf  (committed to git)
 *   2. server/fonts/_cache/             (Roboto extracted from pdfmake VFS — last resort)
 *   If still missing → nearest same-script fallback → PDF still generates.
 *
 * Resilience:
 *   - Per-block try/catch: one bad block is skipped, rest continue.
 *   - GPOSProcessor null-anchor patch prevents Arabic diacritic crashes.
 *   - Harakat-strip fallback: if GPOS crash escapes, retry without diacritics.
 */

const PdfPrinter = require('pdfmake/src/printer');
const cheerio    = require('cheerio');
const path = require('path');
const fs   = require('fs');

const FR = require('./FontRegistry');   // central font registry + resolution

// Single source of truth for the version marker — reused for the console
// log, PDF document metadata (visible in any viewer's Document Properties,
// no server access required), and the X-PDF-Version response header.
const PDF_VERSION = 'exact-editor-export-v3-amiri-forced-override';
console.log('[PDF_VERSION]', PDF_VERSION);

// Master switch for the production debug-visibility tooling below. Sourced
// live from process.env (not cached at module load) so it can be toggled
// via Hostinger's environment-variable panel without a redeploy.
function debugInlineEnabled() { return process.env.PDF_DEBUG_INLINE === '1'; }

// Arabic-script Unicode ranges (Arabic, Arabic Supplement, Arabic
// Extended-A, Arabic Presentation Forms A/B) — covers Urdu too, since Urdu
// is written in an extended Arabic script.
const ARABIC_SCRIPT_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
function containsArabicScript(text) { return !!text && ARABIC_SCRIPT_RE.test(text); }

// Normalizes a raw CSS font-family value (from a style attribute, a <font
// face> attribute, or any other source) into a clean comparable name.
// Handles: surrounding/embedded quotes, comma-separated fallback stacks,
// extra whitespace, case differences, and CSS custom properties (var(...),
// which cannot be resolved without the full stylesheet — safely ignored
// rather than crashing).
function normalizeFontFamily(raw) {
  if (!raw) return { raw: raw || '', normalized: '', isAmiriVariant: false };
  let s = String(raw).trim();
  if (/^var\(/i.test(s)) return { raw, normalized: '', isAmiriVariant: false };
  // First comma-separated entry in the font stack, quotes stripped anywhere.
  const first = s.split(',')[0].replace(/['"]/g, '').trim();
  const normalized = first.toLowerCase();
  // Any family whose name contains "amiri" (Amiri, "Amiri", Amiri Quran,
  // amiri, AMIRI, Amiri-Regular, etc.) is treated as an Amiri request.
  const isAmiriVariant = normalized.includes('amiri');
  return { raw, normalized, isAmiriVariant };
}

// ─────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────

function fileOk(p) {
  try { return !!p && fs.existsSync(p) && fs.statSync(p).size > 1000; }
  catch (_) { return false; }
}

function safeStr(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  return String(v).trim();
}

/**
 * Remove characters that cause fontkit to return null (→ xCoordinate crash).
 *
 * Amiri covers: Basic Latin (0000-007F), Latin Extended (0080-024F),
 *   Arabic (0600-06FF), Arabic Supplement (0750-077F),
 *   Arabic Extended-A (08A0-08FF), Arabic Presentation Forms-A (FB50-FDFF),
 *   Arabic Presentation Forms-B (FE70-FEFF), General Punctuation (2000-206F),
 *   combining diacritics (0300-036F).
 *
 * Characters in supplementary planes (U+10000+) such as emoji or math
 * symbols are NOT in Amiri and crash fontkit with a null glyph.
 *
 * Roboto covers Basic Latin (0020-007E) and Latin Extended. Same principle:
 * Arabic chars in Roboto → null glyph → crash.
 */
function cleanForAmiri(text) {
  const s = safeStr(text).replace(/﻿/g, ''); // strip BOM
  if (!s) return '';
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    // Allow newlines and carriage returns
    if (cp === 0x0A || cp === 0x0D) { out += ch; continue; }
    // Reject control characters
    if (cp < 0x20) continue;
    // Reject supplementary plane (U+10000+) — emoji, math, etc. not in Amiri
    if (cp > 0xFFFF) continue;
    // Allow known Amiri ranges
    if (
      cp <= 0x024F ||                        // Basic Latin + Latin Extended
      (cp >= 0x0300 && cp <= 0x036F) ||      // Combining Diacritical Marks
      (cp >= 0x0600 && cp <= 0x06FF) ||      // Arabic
      (cp >= 0x0750 && cp <= 0x077F) ||      // Arabic Supplement
      (cp >= 0x08A0 && cp <= 0x08FF) ||      // Arabic Extended-A
      (cp >= 0x2000 && cp <= 0x206F) ||      // General Punctuation (spaces, dashes)
      (cp >= 0x25A0 && cp <= 0x25FF) ||      // Geometric Shapes (bullets etc.)
      (cp >= 0xFB50 && cp <= 0xFDFF) ||      // Arabic Presentation Forms-A (incl. ﷺ ﴿ ﴾)
      (cp >= 0xFE70 && cp <= 0xFEFF)         // Arabic Presentation Forms-B
    ) {
      out += ch;
    }
    // Characters outside these ranges are silently dropped
  }
  return out;
}

function cleanForRoboto(text) {
  const s = safeStr(text).replace(/﻿/g, '');
  if (!s) return '';
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    if (cp === 0x0A || cp === 0x0D) { out += ch; continue; }
    if (cp < 0x20) continue;
    if (cp > 0xFFFF) continue;
    // Roboto: Latin only — reject Arabic/RTL characters
    if (cp >= 0x0600 && cp <= 0x06FF)   continue; // Arabic
    if (cp >= 0x0750 && cp <= 0x077F)   continue; // Arabic Supplement
    if (cp >= 0x08A0 && cp <= 0x08FF)   continue; // Arabic Extended-A
    if (cp >= 0xFB50 && cp <= 0xFEFF)   continue; // Arabic Presentation Forms
    out += ch;
  }
  return out;
}

function stripHtml(html) {
  const s = safeStr(html);
  if (!s) return '';
  return s
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi,      '\n')
    .replace(/<\/li>/gi,     '\n')
    .replace(/<\/div>/gi,    '\n')
    .replace(/<[^>]+>/g,     '')
    .replace(/&nbsp;/g,      ' ')
    .replace(/&amp;/g,       '&')
    .replace(/&lt;/g,        '<')
    .replace(/&gt;/g,        '>')
    .replace(/&quot;/g,      '"')
    .replace(/&#39;/g,       "'")
    .replace(/\n{3,}/g,      '\n\n')
    .trim();
}

function pdfAlign(ta, dir) {
  // Never justify RTL (Arabic/Urdu): pdfmake's justification algorithm
  // measures glyph widths in a way that crashes when Arabic shaping produces
  // null glyph positions for some character combinations.
  if (dir === 'rtl') {
    if (ta === 'center') return 'center';
    if (ta === 'left')   return 'left';
    return 'right';
  }
  if (ta === 'center')  return 'center';
  if (ta === 'left')    return 'left';
  if (ta === 'justify') return 'justify';
  if (ta === 'right')   return 'right';
  return 'justify'; // LTR default
}

// ─────────────────────────────────────────────────────────────────
// GPOS null-anchor patch
//
// @foliojs-fork/fontkit@1.9.1 GPOSProcessor.getAnchor() crashes with
// "Cannot read properties of null (reading 'xCoordinate')" when a
// mark-to-base or mark-to-mark GPOS lookup returns a null anchor for
// a specific (base glyph, mark class) pair that the font has not defined.
// This happens with some Arabic diacritic + base combinations in Amiri.
//
// Fix: patch GPOSProcessor.prototype.getAnchor to return {x:0, y:0}
// for a null anchor (= place the mark at the default position instead
// of the precisely-defined offset — safe, visible, doesn't crash).
//
// We get the prototype by opening the Amiri font once via fontkit.create(),
// then traversing font._layoutEngine.engine.GPOSProcessor to the prototype.
// Because JavaScript prototype lookup is dynamic, patching the prototype
// after the fact fixes ALL existing AND future GPOSProcessor instances.
// ─────────────────────────────────────────────────────────────────

let _gposPatched = false;

function patchFontkitGPOS() {
  if (_gposPatched) return;
  try {
    const fk        = require('@foliojs-fork/fontkit');
    const amiriPath = FR.getAmiriPath();
    if (!amiriPath) {
      console.warn('[PDF][GPOS] patch deferred — Amiri not found yet');
      return;
    }
    const font = fk.create(fs.readFileSync(amiriPath));
    const le   = font._layoutEngine;                      // triggers [cache] getter
    const gp   = le && le.engine && le.engine.GPOSProcessor;
    if (!gp) {
      console.warn('[PDF][GPOS] patch skipped — no GPOSProcessor in Amiri layout engine');
      return;
    }
    const proto = Object.getPrototypeOf(gp);
    if (!proto || typeof proto.getAnchor !== 'function') {
      console.warn('[PDF][GPOS] patch skipped — getAnchor not on prototype');
      return;
    }
    if (proto.__getAnchorPatched) { _gposPatched = true; return; }
    const _orig = proto.getAnchor;
    proto.getAnchor = function safeGetAnchor(anchor) {
      if (anchor == null) return { x: 0, y: 0 };
      return _orig.call(this, anchor);
    };
    proto.__getAnchorPatched = true;
    _gposPatched = true;
    console.log('[PDF][GPOS] GPOSProcessor.prototype.getAnchor patched — null anchors safe');
  } catch (e) {
    console.error('[PDF][GPOS] patch error (non-fatal):', e.message);
  }
}

// ─────────────────────────────────────────────────────────────────
// Harakat stripper — fallback for GPOS crash recovery
//
// Arabic combining marks (harakat / tashkeel) are the primary trigger
// for GPOS null-anchor crashes. If the prototype patch above fails for
// any reason, generatePDF catches xCoordinate errors and retries with
// harakat stripped. Text remains readable; only vowel mark positioning
// is lost.
// ─────────────────────────────────────────────────────────────────
// U+0610-061A  Arabic Sign / Extended marks
// U+064B-065F  Harakat (fatha, damma, kasra, shadda, sukun, etc.)
// U+0670       Arabic Letter Superscript Alef
// U+06D6-06DC  Quranic annotation signs
// U+06DF-06E4  More Quranic marks
// U+06E7-06E8  Arabic sign above/below
// U+06EA-06ED  Arabic musical signs / poetic marks
const RE_HARAKAT = /[ؐ-ًؚ-ٰٟۖ-ۜ۟-۪ۤۧۨ-ۭ]/g;

function stripHarakat(text) {
  if (!text) return text;
  return typeof text === 'string' ? text.replace(RE_HARAKAT, '') : text;
}

function stripDocHarakat(doc) {
  if (!doc) return doc;
  const d = Object.assign({}, doc);
  if (Array.isArray(d.blocks)) {
    d.blocks = d.blocks.map(b => {
      if (!b || typeof b !== 'object') return b;
      const n = Object.assign({}, b);
      ['arabicTitle', 'urduSubtitle', 'arabicMatn', 'urduTranslation',
       'arabicText', 'urduText', 'content', 'heading'].forEach(k => {
        if (typeof n[k] === 'string') n[k] = stripHarakat(n[k]);
      });
      if (Array.isArray(n.points)) n.points = n.points.map(stripHarakat);
      return n;
    });
  }
  return d;
}

// ─────────────────────────────────────────────────────────────────
// Font resolution — delegates to FontRegistry (central source of truth)
// ─────────────────────────────────────────────────────────────────

// Resolve editor font name → available pdfmake key.
// Uses FontRegistry.resolveEditorFont (EDITOR_FONT_TO_KEY + fallback chain).
// If nothing found, falls back to a script-appropriate last resort so the
// PDF always generates rather than crashing.
function resolveFont(editorName, available, script) {
  const k = FR.resolveEditorFont(editorName, available);
  if (k) return k;
  // Last resort — only reached when the selected font AND its entire
  // fallback chain are missing from server/fonts/. Never fail silently.
  if (editorName) {
    console.warn(`[PDF][FONT][MISSING] "${editorName}" requested (block-level) but no font file is registered for it or its fallback chain — using script-default last resort.`);
  }
  if (script === 'urdu')   { for (const x of ['NotoNastaliqUrdu','Amiri'])                    if (available.has(x)) return x; }
  if (script === 'arabic') { for (const x of ['NotoNaskhArabic','Amiri','ScheherazadeNew'])   if (available.has(x)) return x; }
  if (script === 'latin')  { for (const x of ['Roboto','OpenSans','Lato','Poppins','Inter']) if (available.has(x)) return x; }
  return [...available][0] || 'Roboto';
}

function isRtlFont(key) {
  const s = FR.scriptOf(key);
  return s === 'arabic' || s === 'urdu';
}

// ─────────────────────────────────────────────────────────────────
// CSS / HTML parsing utilities
// Converts rich contentEditable innerHTML → pdfmake inline arrays
// preserving bold, italic, underline, font-family, font-size, color.
// ─────────────────────────────────────────────────────────────────

function cssColorToHex(color) {
  if (!color) return null;
  const c = color.trim();
  if (c === 'transparent' || c === 'inherit' || c === 'initial') return null;
  if (c.startsWith('#')) {
    return c.length === 4
      ? '#' + c[1]+c[1]+c[2]+c[2]+c[3]+c[3]
      : c.slice(0, 7);
  }
  const m = c.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) return '#' + [m[1],m[2],m[3]].map(n => parseInt(n).toString(16).padStart(2,'0')).join('');
  return null;
}

function cssSizeToPt(sizeStr) {
  if (!sizeStr) return null;
  const m = sizeStr.trim().match(/^([\d.]+)\s*(px|pt|em|rem)?$/i);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (isNaN(n) || n <= 0) return null;
  const unit = (m[2] || 'px').toLowerCase();
  if (unit === 'pt')  return n;
  if (unit === 'px')  return n * 0.75;         // 96 dpi: 1pt = 4/3px
  if (unit === 'em' || unit === 'rem') return n * 12;
  return n;
}

// Like cssSizeToPt but allows negative values (letter-spacing is commonly
// tightened with e.g. "-0.05em"; cssSizeToPt rejects non-positive numbers).
function cssSignedSizeToPt(sizeStr) {
  if (!sizeStr) return 0;
  const m = String(sizeStr).trim().match(/^(-?[\d.]+)\s*(px|pt|em|rem)?$/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  if (isNaN(n) || n === 0) return 0;
  const unit = (m[2] || 'px').toLowerCase();
  if (unit === 'pt') return n;
  if (unit === 'px') return n * 0.75;
  if (unit === 'em' || unit === 'rem') return n * 12;
  return n;
}

function parseCssDecls(styleStr) {
  const obj = {};
  if (!styleStr) return obj;
  for (const decl of styleStr.split(';')) {
    const i = decl.indexOf(':');
    if (i < 0) continue;
    const k = decl.slice(0, i).trim().toLowerCase();
    const v = decl.slice(i + 1).trim();
    if (k && v) obj[k] = v;
  }
  return obj;
}

// Convert CSS px margin value → pdfmake points
function pxToPt(cssVal) {
  if (!cssVal) return 0;
  const m = String(cssVal).match(/^([\d.]+)\s*px$/i);
  return m ? Math.round(parseFloat(m[1]) * 0.75) : 0;
}

// ─────────────────────────────────────────────────────────────────
// unbreakable-block gating
//
// pdfmake's `unbreakable: true` is an all-or-nothing constraint: if the
// block doesn't fit in whatever space remains on the current page, the
// WHOLE block moves to the next page, leaving the remaining space on the
// current page blank. Marking anything non-trivial unbreakable (a full
// hadith table, a long fiqh list) is what produces large blank areas and
// content jumping pages. This estimates a block's rendered height so
// `unbreakable` is only ever applied to genuinely small groups.
// ─────────────────────────────────────────────────────────────────
const PAGE_HEIGHT_PT      = 841.89; // A4
const PAGE_MARGIN_TOP_PT  = 56;
// Extra headroom below body content: Nastaliq/Naskh glyphs commonly extend
// past their nominal font-metrics box (tall diagonal ascenders/descenders),
// and the footer's center text can wrap to 2 lines for a long document
// title — both eat into the reserved bottom margin. 85pt gives real slack.
const PAGE_MARGIN_BOT_PT  = 85;
const PAGE_USABLE_PT      = PAGE_HEIGHT_PT - PAGE_MARGIN_TOP_PT - PAGE_MARGIN_BOT_PT;
const SMALL_BLOCK_MAX_PT  = PAGE_USABLE_PT * 0.25; // per-task: never unbreakable past 25% of page height

function inlineCharCount(inlines) {
  if (!Array.isArray(inlines)) return 0;
  return inlines.reduce((sum, i) => sum + (typeof i.text === 'string' ? i.text.length : 0), 0);
}

// Rough estimate only — good enough to gate "is this small?", not for
// precise layout. Arabic/Urdu glyphs average wider than Latin at the same
// point size, so a slightly larger per-char width is used for RTL.
function estimateTextHeightPt(charCount, fontSize, lineHeight, colWidthPt, rtl) {
  if (!charCount) return fontSize * lineHeight;
  const avgCharWidth = fontSize * (rtl ? 0.62 : 0.5);
  const charsPerLine = Math.max(1, Math.floor(colWidthPt / avgCharWidth));
  const lines = Math.max(1, Math.ceil(charCount / charsPerLine));
  return lines * fontSize * lineHeight;
}

// Wraps `nodes` as an unbreakable stack only if their estimated combined
// height stays under SMALL_BLOCK_MAX_PT; otherwise returns them as a plain
// array so they flow/split normally across a page break.
function unbreakableIfSmall(nodes, estimatedHeightPt, ctx) {
  const small = estimatedHeightPt <= SMALL_BLOCK_MAX_PT;
  if (ctx) {
    console.log('[PDF][DEBUG][unbreakable-gate]', JSON.stringify({
      ...ctx, estimatedHeightPt: Math.round(estimatedHeightPt), thresholdPt: Math.round(SMALL_BLOCK_MAX_PT), unbreakable: small,
    }));
  }
  return small ? { stack: nodes, unbreakable: true } : nodes;
}

// Resolve CSS font-family string → registered pdfmake key. Returns a
// structured result (not just the key) so callers can apply the forced
// Amiri override and build a full audit trail.
function resolveInlineFont(cssFontFamily, available) {
  const { raw, normalized, isAmiriVariant } = normalizeFontFamily(cssFontFamily);
  if (!normalized) return { resolved: null, raw, normalized, isAmiriVariant: false };

  // Hard override: any font-family naming Amiri in any form resolves
  // straight to the 'Amiri' registry key, bypassing EDITOR_FONT_TO_KEY /
  // FONT_FALLBACK entirely. This can't be defeated by an unexpected name
  // variant (quotes, casing, "Amiri Quran", a trailing fallback stack…).
  if (isAmiriVariant) {
    if (available.has('Amiri')) return { resolved: 'Amiri', raw, normalized, isAmiriVariant: true };
    console.warn(`[PDF][FONT][MISSING] Amiri requested (raw="${raw}") but the Amiri font file itself is not registered.`);
    return { resolved: null, raw, normalized, isAmiriVariant: true };
  }

  // First dequoted, trimmed entry of the font stack, ORIGINAL case
  // preserved — FontRegistry.resolveEditorFont handles case-insensitive
  // matching internally, but exact-case is tried first there.
  const firstName  = raw.split(',')[0].replace(/['"]/g, '').trim();
  const resolved    = FR.resolveEditorFont(firstName, available);
  const expectedKey = FR.EDITOR_FONT_TO_KEY[firstName] || firstName;
  if (!resolved) {
    console.warn(`[PDF][FONT][MISSING] "${firstName}" requested (inline run) but no font file is registered for it or its fallback chain.`);
  } else if (resolved !== expectedKey) {
    console.warn(`[PDF][FONT] fallback (inline run): requested="${firstName}" (expected ${expectedKey}) -> using ${resolved}`);
  }
  return { resolved, raw: firstName, normalized, isAmiriVariant: false };
}

// Verbose per-text-run font logging — opt-in via env var since it's one
// log line per inline text run and would be excessive on by default.
const DEBUG_INLINE_RUNS = debugInlineEnabled();

// Parse rich contentEditable HTML → pdfmake inline text array.
// Preserves: bold, italic, underline, strikethrough, font-family,
// font-size, color, background from element tags and inline styles.
//
// base = { font, fontSize, available, bold?, italics?, direction? ... }
function htmlToInlines(html, base) {
  if (!html || !html.trim()) return [];

  const $ = cheerio.load(`<body>${html}</body>`, { decodeEntities: false });
  const result = [];

  const BLOCK_TAGS = new Set(['div','p','h1','h2','h3','h4','h5','h6',
                               'blockquote','pre','li','td','th','tr','table']);

  function pushText(raw, styles) {
    if (!raw) return;
    let text = raw
      // Strip ONLY U+200B (zero-width space) and U+FEFF (BOM).
      // CRITICAL — DO NOT add U+200C (ZWNJ) or U+200D (ZWJ) to this regex.
      // ZWNJ/ZWJ control which glyph form the shaping engine selects in Arabic/Urdu.
      // Stripping them splits characters and destroys Nastaleeq ligatures.
      .replace(/​|﻿/g, '')
      .replace(/[\uD800-\uDFFF]/g, '');   // lone surrogates — encoding error, safe to drop
    // Drop supplementary-plane chars (emoji etc.) that most Arabic/Urdu fonts lack
    try { text = text.replace(/[\u{10000}-\u{10FFFF}]/gu, ''); } catch (_) {}
    if (!text) return;
    const inline = { text };
    if (styles.font)       inline.font       = styles.font;
    if (styles.fontSize)   inline.fontSize   = styles.fontSize;
    if (styles.bold)       inline.bold       = true;
    if (styles.italics)    inline.italics    = true;
    if (styles.color)      inline.color      = styles.color;
    if (styles.background) inline.background = styles.background;
    if (styles.decoration) inline.decoration = styles.decoration;

    // Forced Arabic-script override: if this run was ever styled with any
    // Amiri variant AND the actual text contains Arabic-script codepoints,
    // guarantee font:"Amiri" on the final node regardless of what the
    // registry-resolution chain produced. This is checked here (not at
    // style-parsing time) because only here do we know the real text.
    const hasArabic = containsArabicScript(text);
    if (styles.isAmiriVariant && hasArabic && styles.available?.has('Amiri')) {
      inline.font = 'Amiri';
    }

    const requestedAmiri = !!styles.isAmiriVariant;
    const violatesAmiri  = requestedAmiri && inline.font !== 'Amiri';

    if (DEBUG_INLINE_RUNS || styles.debugCollector) {
      const record = {
        textPreview:       text.length > 60 ? text.slice(0, 60) + '…' : text,
        containsArabic:    hasArabic,
        rawFontFamily:      styles.requestedFontName || null,
        rawStyleAttr:       styles.rawStyleAttr || null,
        normalizedFontFamily: styles.normalizedFontName || null,
        isAmiriVariant:    requestedAmiri,
        resolvedPdfmakeFont: styles.font || null,
        finalNodeFont:      inline.font || '(inherited/base, none set)',
        fontSource:         styles.fontSource || 'block-default',
        direction:          styles.direction || null,
        violatesAmiri,
      };
      if (DEBUG_INLINE_RUNS) console.log('[PDF][DEBUG][inline-run]', JSON.stringify(record));
      if (styles.debugCollector) styles.debugCollector.push(record);
    }

    result.push(inline);
  }

  function walk(node, inh) {
    if (node.type === 'text') { pushText(node.data, inh); return; }
    if (node.type !== 'tag') return;

    const tag = node.name.toLowerCase();
    if (tag === 'style' || tag === 'script') return;
    if (tag === 'br') { result.push({ text: '\n' }); return; }

    const next = { ...inh };

    // Semantic formatting tags
    if (tag === 'b' || tag === 'strong')                  next.bold       = true;
    if (tag === 'i' || tag === 'em')                      next.italics    = true;
    if (tag === 'u')                                       next.decoration = 'underline';
    if (tag === 's' || tag === 'del' || tag === 'strike') next.decoration = 'lineThrough';

    // <font face="..."> produced by document.execCommand('fontName', …)
    if (tag === 'font') {
      const face = $(node).attr('face');
      if (face) {
        const r = resolveInlineFont(face, inh.available);
        next.requestedFontName   = face;
        next.normalizedFontName  = r.normalized;
        next.isAmiriVariant      = r.isAmiriVariant;
        if (r.resolved) { next.font = r.resolved; next.fontSource = 'font-tag'; }
      }
      const fc = $(node).attr('color');
      if (fc) { const hex = cssColorToHex(fc); if (hex) next.color = hex; }
    }

    // Inline style attribute
    const styleAttr = $(node).attr('style');
    if (styleAttr) {
      const css = parseCssDecls(styleAttr);
      if (css['font-family']) {
        const r = resolveInlineFont(css['font-family'], inh.available);
        next.requestedFontName   = css['font-family'];
        next.rawStyleAttr        = styleAttr;
        next.normalizedFontName  = r.normalized;
        next.isAmiriVariant      = r.isAmiriVariant;
        if (r.resolved) { next.font = r.resolved; next.fontSource = 'style-attr'; }
      }
      if (css['font-size']) {
        const pt = cssSizeToPt(css['font-size']);
        if (pt && pt >= 4) next.fontSize = Math.max(4, Math.min(96, pt));
      }
      if (css['font-weight']) {
        const fw = css['font-weight'];
        if (fw === 'bold' || fw === 'bolder' || Number(fw) >= 600) next.bold = true;
        else if (fw === 'normal' || fw === 'lighter' || Number(fw) <= 400) delete next.bold;
      }
      if (css['font-style'] === 'italic' || css['font-style'] === 'oblique') next.italics = true;
      const td = css['text-decoration'];
      if (td) {
        if (td.includes('underline'))    next.decoration = 'underline';
        if (td.includes('line-through')) next.decoration = 'lineThrough';
        if (td === 'none')               delete next.decoration;
      }
      if (css['color']) {
        const hex = cssColorToHex(css['color']);
        if (hex && hex.toLowerCase() !== '#000000') next.color = hex;
      }
      if (css['background-color']) {
        const hex = cssColorToHex(css['background-color']);
        if (hex && hex.toLowerCase() !== '#ffffff') next.background = hex;
      }
    }

    const isBlock = BLOCK_TAGS.has(tag);
    const startIdx = result.length;

    // Paragraph break before block-level element
    if (isBlock && result.length > 0) {
      const prev = result[result.length - 1];
      if (prev && typeof prev.text === 'string' && !prev.text.endsWith('\n')) {
        result.push({ text: '\n' });
      }
    }

    // Bullet marker for list items — browser renders <li> with a bullet; pdfmake doesn't
    if (tag === 'li') {
      const bullet = { text: '• ' };
      if (next.font)     bullet.font     = next.font;
      if (next.fontSize) bullet.fontSize = next.fontSize;
      result.push(bullet);
    }

    for (const child of (node.children || [])) walk(child, next);

    // Paragraph break after block-level element
    if (isBlock && result.length > startIdx) {
      const last = result[result.length - 1];
      if (last && typeof last.text === 'string' && !last.text.endsWith('\n')) {
        result.push({ text: '\n' });
      }
    }
  }

  $('body').contents().each((_, node) => walk(node, base));

  // Trim trailing newline tokens
  while (result.length > 0 && result[result.length - 1].text === '\n') result.pop();

  return result;
}

// ─────────────────────────────────────────────────────────────────
// Block renderers
// Each reads the block's rich HTML fields, converts them to pdfmake
// inline arrays, and matches the preview sizes shown in the editor.
// ─────────────────────────────────────────────────────────────────

function renderChapterHeading(block, fctx) {
  const nodes = [];

  // Editor preview: arabicTitle at 27px (≈20pt), Urdu at 22px (≈17pt)
  const arabicInlines = htmlToInlines(safeStr(block.arabicTitle), {
    font: fctx.NAF, fontSize: 20, bold: true, available: fctx.available, direction: 'rtl', debugCollector: fctx.debugRuns,
  });
  if (arabicInlines.length) {
    nodes.push({
      text: arabicInlines, alignment: 'center', lineHeight: 1.6,
      margin: [0, 20, 0, 4],
    });
  }

  const urduInlines = htmlToInlines(safeStr(block.urduSubtitle), {
    font: fctx.NUF, fontSize: 17, bold: true, available: fctx.available, direction: 'rtl', debugCollector: fctx.debugRuns,
  });
  if (urduInlines.length) {
    nodes.push({
      text: urduInlines, alignment: 'center', lineHeight: 1.8,
      margin: [0, 0, 0, 14],
    });
  }

  if (!nodes.length) return null;
  if (nodes.length === 1) nodes[0].margin[3] = 14;
  // Keep title+subtitle together, but ONLY if the combined text is actually
  // small — an unusually long pasted title must still be free to flow.
  const estPt = estimateTextHeightPt(inlineCharCount(arabicInlines), 20, 1.6, 481, true)
              + estimateTextHeightPt(inlineCharCount(urduInlines),   17, 1.8, 481, true);
  return unbreakableIfSmall(nodes, estPt, { block: 'chapter_heading' });
}

function renderHadith(block, fctx) {
  const arabicKey = block.arabicFont ? fctx.res(block.arabicFont, 'arabic') : fctx.NAF;
  if (block.arabicFont) {
    const expectedKey = FR.EDITOR_FONT_TO_KEY[block.arabicFont] || block.arabicFont;
    if (arabicKey !== expectedKey) {
      console.warn(`[PDF][FONT] fallback: selected="${block.arabicFont}" (expected ${expectedKey}) -> using ${arabicKey}`);
    }
  }

  // Editor preview: Arabic/Urdu at 18px (≈14pt), lineHeight 1.8/2.0
  const numStr = safeStr(block.number).trim();
  const matnInlines = htmlToInlines(safeStr(block.arabicMatn), {
    font: arabicKey, fontSize: 14, available: fctx.available, direction: 'rtl', debugCollector: fctx.debugRuns,
  });
  const arabicInlines = numStr
    ? [{ text: `﴿${numStr}﴾ `, font: arabicKey, fontSize: 14 }, ...matnInlines]
    : matnInlines;

  const urduInlines = htmlToInlines(safeStr(block.urduTranslation), {
    font: fctx.NUF, fontSize: 14, available: fctx.available, direction: 'rtl', debugCollector: fctx.debugRuns,
  });

  const EMPTY = [{ text: ' ' }];
  return {
    table: {
      widths: ['50%', '50%'],
      body: [[
        { text: urduInlines.length   ? urduInlines   : EMPTY, font: fctx.NUF,  fontSize: 14, alignment: 'right', lineHeight: 2.0, margin: [4, 4, 8, 8] },
        { text: arabicInlines.length ? arabicInlines : EMPTY, font: arabicKey, fontSize: 14, alignment: 'right', lineHeight: 1.9, margin: [8, 4, 4, 8] },
      ]],
    },
    layout: 'noBorders',
    margin: [0, 14, 0, 0],
    // NOT unbreakable: a hadith can be long, and forcing the whole table
    // to stay together pushes it entirely to the next page whenever it
    // doesn't fit the remaining space — that's exactly what produces large
    // blank areas. pdfmake tables split rows across pages by default, so
    // long Arabic/Urdu matn and translation flow naturally instead.
  };
}

function renderFiqh(block, fctx) {
  // Editor preview: heading at 20px (≈15pt), points at 17px (≈13pt)
  const headingInlines = htmlToInlines(safeStr(block.heading || 'فقہ الحدیث:'), {
    font: fctx.NAF, fontSize: 15, bold: true, available: fctx.available, direction: 'rtl', debugCollector: fctx.debugRuns,
  });
  const headingNode = {
    text: headingInlines.length
      ? headingInlines
      : [{ text: 'فقہ الحدیث:', font: fctx.NAF, fontSize: 15, bold: true }],
    alignment: 'right', lineHeight: 1.6, margin: [0, 8, 0, 4],
  };

  const points = Array.isArray(block.points) ? block.points : [];
  const pointNodes = points.map((pt, i) => {
    const ptInlines = htmlToInlines(safeStr(pt), {
      font: fctx.NUF, fontSize: 13, available: fctx.available, direction: 'rtl', debugCollector: fctx.debugRuns,
    });
    return {
      text: [
        { text: `(${i + 1}) `, font: fctx.NUF, fontSize: 13 },
        ...(ptInlines.length ? ptInlines : [{ text: ' ', font: fctx.NUF }]),
      ],
      alignment: 'right', lineHeight: 2.0, margin: [0, 2, 0, 2],
    };
  });

  if (!pointNodes.length) {
    const estPt = estimateTextHeightPt(inlineCharCount(headingNode.text), 15, 1.6, 481, true);
    return unbreakableIfSmall([headingNode], estPt, { block: 'fiqh_heading_only' });
  }

  // Try to keep the heading glued to its first point (avoids an orphaned
  // heading alone at page bottom) — but ONLY if that pair is actually
  // small; a long first point must stay free to flow/split like the rest.
  // The remaining points always flow individually regardless.
  const headingPt = estimateTextHeightPt(inlineCharCount(headingNode.text), 15, 1.6, 481, true);
  const point1Pt   = estimateTextHeightPt(inlineCharCount(pointNodes[0].text), 13, 2.0, 481, true);
  const firstGroup = unbreakableIfSmall(
    [headingNode, pointNodes[0]], headingPt + point1Pt, { block: 'fiqh_heading_plus_point1' }
  );
  const rest = pointNodes.slice(1);
  return Array.isArray(firstGroup) ? [...firstGroup, ...rest] : [firstGroup, ...rest];
}

function renderReference(block, fctx) {
  // Editor preview: 13px (≈10pt)
  const inlines = htmlToInlines(safeStr(block.content), {
    font: fctx.NAF, fontSize: 10, available: fctx.available, direction: 'rtl', debugCollector: fctx.debugRuns,
  });
  if (!inlines.length) return [];
  const nodes = [
    { canvas: [{ type: 'line', x1: 330, y1: 0, x2: 481, y2: 0, lineWidth: 0.8, lineColor: '#555' }], margin: [0, 8, 0, 3] },
    { text: inlines, alignment: 'right', lineHeight: 1.5, color: '#333', margin: [0, 0, 0, 6] },
  ];
  const estPt = estimateTextHeightPt(inlineCharCount(inlines), 10, 1.5, 481, true) + 15; // + decorative line
  return unbreakableIfSmall(nodes, estPt, { block: 'reference' });
}

function renderVerse(block, fctx) {
  // Editor preview: 18px (≈14pt)
  const nodes = [];

  // Respect a per-block Arabic font override the same way hadith does
  // (e.g. selecting "Amiri" for an ayah) instead of always using the
  // document's default Arabic font.
  const arabicKey = block.arabicFont ? fctx.res(block.arabicFont, 'arabic') : fctx.NAF;
  if (block.arabicFont) {
    const expectedKey = FR.EDITOR_FONT_TO_KEY[block.arabicFont] || block.arabicFont;
    if (arabicKey !== expectedKey) {
      console.warn(`[PDF][FONT] fallback: selected="${block.arabicFont}" (expected ${expectedKey}) -> using ${arabicKey}`);
    }
  }

  const arabicInlines = htmlToInlines(safeStr(block.arabicText), {
    font: arabicKey, fontSize: 14, available: fctx.available, direction: 'rtl', debugCollector: fctx.debugRuns,
  });
  if (arabicInlines.length) {
    nodes.push({ text: arabicInlines, alignment: 'center', lineHeight: 1.8, margin: [0, 10, 0, 4] });
  }

  const urduInlines = htmlToInlines(safeStr(block.urduText), {
    font: fctx.NUF, fontSize: 14, available: fctx.available, direction: 'rtl', debugCollector: fctx.debugRuns,
  });
  if (urduInlines.length) {
    nodes.push({ text: urduInlines, alignment: 'center', lineHeight: 2.0, margin: [0, 0, 0, 10] });
  }

  if (!nodes.length) return null;
  if (nodes.length === 1) nodes[0].margin = [0, 10, 0, 10];
  // Keep the ayah and its translation together, but only if genuinely small.
  const estPt = estimateTextHeightPt(inlineCharCount(arabicInlines), 14, 1.8, 481, true)
              + estimateTextHeightPt(inlineCharCount(urduInlines),   14, 2.0, 481, true);
  return unbreakableIfSmall(nodes, estPt, { block: 'verse' });
}

function renderFreeText(block, fctx) {
  const dir    = safeStr(block.direction) || 'rtl';
  const isLtr  = dir === 'ltr';

  const editorFont = safeStr(block.fontFamily);

  // Detect script from the user-selected font so last-resort picks the
  // right script group if the font is somehow missing.
  let script;
  if (isLtr) {
    script = 'latin';
  } else if (editorFont) {
    const key = FR.EDITOR_FONT_TO_KEY[editorFont] || editorFont;
    script = FR.scriptOf(key) || 'urdu';
  } else {
    script = 'urdu'; // matches preview default: 'Jameel Noori Nastaleeq'
  }

  // Resolve block font. Preview default for RTL is 'Jameel Noori Nastaleeq'
  // = NotoNastaliqUrdu (fctx.NUF). NOT Noto Naskh Arabic (fctx.NAF).
  const fontKey = editorFont
    ? fctx.res(editorFont, script)
    : (isLtr ? fctx.LF : fctx.NUF);

  // Flag it when the requested font isn't the one actually embedded (e.g.
  // "Jameel Noori Nastaleeq" has no redistributable free TTF and always
  // falls back to NotoNastaliqUrdu) — this is the concrete, debuggable
  // signal for "selected font not applied in PDF".
  if (editorFont) {
    const expectedKey = FR.EDITOR_FONT_TO_KEY[editorFont] || editorFont;
    if (fontKey !== expectedKey) {
      console.warn(`[PDF][FONT] fallback: selected="${editorFont}" (expected ${expectedKey}) -> using ${fontKey}`);
    }
  }

  // Preview hardcodes font-size: 16px (= 12pt). Per-character size changes
  // are stored as inline <span style="font-size:..."> inside block.content.
  const inlines = htmlToInlines(safeStr(block.content), {
    font: fontKey, fontSize: 12, available: fctx.available, direction: dir, debugCollector: fctx.debugRuns,
  });

  if (!inlines.length) return null;

  const lineHeight = Math.max(0.8, Math.min(5.0,
    parseFloat(block.lineHeight) || (isLtr ? 1.6 : 2.0)
  ));
  const mt = pxToPt(block.marginTop)    || 4;
  const mb = pxToPt(block.marginBottom) || 4;

  const node = {
    text:       inlines,
    alignment:  pdfAlign(safeStr(block.textAlign), dir),
    lineHeight: lineHeight,
    margin:     [0, mt, 0, mb],
  };

  // Letter-spacing is only safe for LTR/Latin text. Applying extra spacing
  // between Arabic/Urdu codepoints breaks the contextual joining that forms
  // Nastaleeq/Naskh ligatures, so it's intentionally never applied for RTL.
  if (isLtr) {
    const cs = cssSignedSizeToPt(block.letterSpacing);
    if (cs) node.characterSpacing = cs;
  }

  return node;
}

// ── Per-block debug logging helpers ────────────────────────────────
function blockTextLength(block, type) {
  switch (type) {
    case 'chapter_heading': return safeStr(block.arabicTitle).length + safeStr(block.urduSubtitle).length;
    case 'hadith':          return safeStr(block.arabicMatn).length + safeStr(block.urduTranslation).length;
    case 'fiqh':            return safeStr(block.heading).length + (Array.isArray(block.points) ? block.points.join('').length : 0);
    case 'reference':       return safeStr(block.content).length;
    case 'verse':           return safeStr(block.arabicText).length + safeStr(block.urduText).length;
    default:                return safeStr(block.content).length;
  }
}

function blockSelectedFont(block, type) {
  if (type === 'hadith' || type === 'verse') return block.arabicFont || null;
  if (type === 'free_text') return block.fontFamily || null;
  return null;
}

function resultIsUnbreakable(r) {
  if (!r) return false;
  if (Array.isArray(r)) return r.some((n) => n && n.unbreakable);
  return !!r.unbreakable;
}

function buildContent(blocks, fctx) {
  const content    = [];
  const safeBlocks = Array.isArray(blocks) ? blocks : [];

  for (let i = 0; i < safeBlocks.length; i++) {
    const block = safeBlocks[i];
    if (!block || typeof block !== 'object') continue;
    try {
      const type = safeStr(block.type) || 'free_text';
      let r;
      switch (type) {
        case 'chapter_heading': r = renderChapterHeading(block, fctx); break;
        case 'hadith':          r = renderHadith(block, fctx);         break;
        case 'fiqh':            r = renderFiqh(block, fctx);           break;
        case 'reference':       r = renderReference(block, fctx);      break;
        case 'verse':           r = renderVerse(block, fctx);          break;
        default:                r = renderFreeText(block, fctx);       break;
      }

      console.log('[PDF][DEBUG][block]', JSON.stringify({
        index:        i,
        type,
        textLength:   blockTextLength(block, type),
        selectedFont: blockSelectedFont(block, type),
        direction:    type === 'free_text' ? (safeStr(block.direction) || 'rtl') : 'rtl',
        unbreakable:  resultIsUnbreakable(r),
        marginTop:    type === 'free_text' ? pxToPt(block.marginTop)    : null,
        marginBottom: type === 'free_text' ? pxToPt(block.marginBottom) : null,
      }));

      if (Array.isArray(r)) content.push(...r.filter(Boolean));
      else if (r)           content.push(r);
    } catch (err) {
      console.error(`[PDF] Block[${i}] type=${block.type} skipped:`, err.message);
    }
  }
  return content;
}

// ─────────────────────────────────────────────────────────────────
// Header / footer
// ─────────────────────────────────────────────────────────────────

function makeHeader(doc, fctx) {
  const hFont = fctx.res(safeStr(doc.headerFontFamily) || 'Noto Naskh Arabic', 'arabic');
  const hSize = Math.max(7, Math.min(18, Number(doc.headerFontSize) || 9));
  const name  = stripHtml(doc.headerRight || doc.name || '');
  const pos   = doc.showPageNumber !== false
    ? (safeStr(doc.pageNumberPosition) || 'header-right')
    : 'none';
  return (pg) => {
    try {
      return {
        columns: [
          { text: pos === 'header-left'  ? String(pg) : '',   font: hFont, fontSize: hSize, color: '#555', alignment: 'left'  },
          { text: pos === 'header-right' ? String(pg) : name, font: hFont, fontSize: hSize, color: '#555', alignment: 'right' },
        ],
        margin: [57, 15, 57, 0],
      };
    } catch (_) { return { text: '' }; }
  };
}

function makeFooter(doc, fctx) {
  const fFont    = fctx.res(safeStr(doc.footerFontFamily) || 'Noto Naskh Arabic', 'arabic');
  const fSize    = Math.max(7, Math.min(14, Number(doc.footerFontSize) || 9));
  const pos      = doc.showPageNumber !== false
    ? (safeStr(doc.pageNumberPosition) || 'header-right')
    : 'none';
  const hairline = doc.footerHairline !== false;
  // Truncated defensively: an unexpectedly long footer title wrapping to a
  // 2nd line grows the footer taller than the reserved bottom margin
  // accounts for, which can visually clip against body content above it.
  const rawCenter = stripHtml(doc.footerCenter || '');
  const center    = rawCenter.length > 70 ? rawCenter.slice(0, 69) + '…' : rawCenter;
  return (pg) => {
    try {
      const ct    = pos === 'footer-center' ? String(pg) : center;
      const stack = [];
      if (hairline) stack.push({ canvas: [{ type: 'line', x1: 57, y1: 0, x2: 481, y2: 0, lineWidth: 0.4, lineColor: '#000' }], margin: [0, 0, 0, 3] });
      stack.push({ text: ct, font: fFont, fontSize: fSize, color: '#555', alignment: 'center' });
      return { stack, margin: [0, 8, 0, 0] };
    } catch (_) { return { text: '' }; }
  };
}

// ─────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────

async function _buildPDFBuffer(fontResult, doc) {
  const { desc, available } = fontResult;

  // Build font context used by all renderers
  const res  = (name, script) => resolveFont(name, available, script);
  const fctx = {
    available,
    res,
    NAF: res('Noto Naskh Arabic',  'arabic'), // default Arabic  (matches editor default)
    NUF: res('Noto Nastaliq Urdu', 'urdu'),   // default Urdu    (≈ Jameel Noori Nastaleeq)
    LF:  res('Roboto',             'latin'),   // default Latin
    AF:  res('Amiri',              'arabic'),  // Amiri (for GPOS-tested Amiri usage)
    // Shared per-request collector — every htmlToInlines() call that's
    // given `debugCollector: fctx.debugRuns` in its base object appends
    // one audit record per inline text run here. Always collected (cheap
    // for a single request); the controller decides whether to expose it.
    debugRuns: [],
  };

  const blocks      = Array.isArray(doc.blocks) ? doc.blocks : [];
  const blockCount  = blocks.length;
  const byType      = {};
  blocks.forEach((b) => { const t = safeStr(b?.type) || 'free_text'; byType[t] = (byType[t] || 0) + 1; });

  console.time('[PDF] generate');
  console.log('[PDF][DEBUG]', JSON.stringify({
    engine:     'pdfmake',
    pageSize:   'A4',
    pageMargins: [57, PAGE_MARGIN_TOP_PT, 57, PAGE_MARGIN_BOT_PT],
    blockCount,
    blocksByType: byType,
    fontsAvailable: [...available],
    defaultArabicFont: fctx.NAF,
    defaultUrduFont:   fctx.NUF,
    defaultLatinFont:  fctx.LF,
  }));

  const printer = new PdfPrinter(desc);
  const docDef  = {
    pageSize:     'A4',
    pageMargins:  [57, PAGE_MARGIN_TOP_PT, 57, PAGE_MARGIN_BOT_PT],
    defaultStyle: { font: fctx.NAF, fontSize: 13 },
    header:  makeHeader(doc, fctx),
    footer:  makeFooter(doc, fctx),
    content: buildContent(blocks, fctx),
    // PDF_VERSION visible in any viewer's Document Properties (Keywords/
    // Subject) — verifiable without any server access at all.
    info: {
      title:    doc.name || 'Document',
      subject:  `PDF_VERSION:${PDF_VERSION}`,
      keywords: `PDF_VERSION:${PDF_VERSION}`,
      creator:  'pdfmake',
    },
  };

  return new Promise((resolve, reject) => {
    let settled = false;
    // 60s — generous headroom for large, multi-page Arabic/Urdu documents on
    // shared-hosting CPU (complex-script shaping is slower than Latin text).
    // The previous 25s cutoff could fire on legitimately slow-but-successful
    // large documents, which then look like a failure with no real cause.
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try { pdfDocRef && pdfDocRef.destroy && pdfDocRef.destroy(); } catch (_) {}
      reject(new Error('[PDF] Timed out after 60s.'));
    }, 60000);

    let pdfDocRef = null;
    try {
      const pdfDoc = printer.createPdfKitDocument(docDef);
      pdfDocRef = pdfDoc;
      const chunks = [];
      pdfDoc.on('data',  (c) => chunks.push(c));
      pdfDoc.on('end',   () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        const buf = Buffer.concat(chunks);
        console.timeEnd('[PDF] generate');
        console.log('[PDF] done, bytes:', buf.length);
        resolve({ buffer: buf, debugRuns: fctx.debugRuns });
      });
      pdfDoc.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(err);
      });
      pdfDoc.end();
    } catch (err) {
      if (!settled) {
        settled = true;
        clearTimeout(timer);
        console.error('[PDF] createPdfKitDocument error:', err.message);
        reject(err);
      }
    }
  });
}

async function generatePDF(doc) {
  if (!doc || typeof doc !== 'object') throw new Error('[PDF] Invalid document data.');

  // Layer 1: patch GPOSProcessor.prototype.getAnchor before any font opens.
  patchFontkitGPOS();

  const fontData = FR.getFontData();          // cached — loaded once at startup
  const { available } = fontData;

  // Need at least one Arabic font and one Latin font to render the document.
  const hasArabic = ['NotoNaskhArabic','Amiri','ScheherazadeNew','Cairo','Tajawal','ReemKufi','Lateef','NotoNastaliqUrdu'].some(k => available.has(k));
  const hasLatin  = ['Roboto','OpenSans','Lato','Poppins','Inter','Montserrat','Merriweather','Lora','PlayfairDisplay','EBGaramond'].some(k => available.has(k));

  if (!hasArabic) throw new Error('[PDF] No Arabic/Urdu font available. Run npm run install:fonts');
  if (!hasLatin)  throw new Error('[PDF] No Latin font available. Run npm run install:fonts');

  console.log(`[PDF] fonts resolved: ${[...available].join(', ')}`);

  // Layer 2: build PDF; on GPOS null-anchor escape, strip harakat and retry.
  // Always returns { buffer, debugRuns, version, violations } — debugRuns is
  // collected regardless of debug mode (cheap for one request); callers
  // decide whether to expose/persist it.
  let result;
  try {
    result = await _buildPDFBuffer(fontData, doc);
  } catch (e) {
    if (e && typeof e.message === 'string' && e.message.includes('xCoordinate')) {
      console.warn('[PDF] GPOS null-anchor escaped patch — retrying with harakat stripped');
      result = await _buildPDFBuffer(fontData, stripDocHarakat(doc));
    } else {
      throw e;
    }
  }

  const violations = (result.debugRuns || []).filter((r) => r.violatesAmiri);
  if (violations.length && debugInlineEnabled()) {
    console.error('[PDF][FONT][VIOLATION] Amiri requested but final node font is not Amiri:',
      JSON.stringify(violations));
  }

  return { buffer: result.buffer, debugRuns: result.debugRuns, version: PDF_VERSION, violations };
}

module.exports = { generatePDF, PDF_VERSION };
