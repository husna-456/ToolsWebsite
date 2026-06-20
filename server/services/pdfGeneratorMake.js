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
const path = require('path');
const fs   = require('fs');
const vm   = require('vm');

const FONTS_DIR = path.join(__dirname, '../fonts');
const CACHE_DIR = path.join(__dirname, '../fonts/_cache');

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
    const amiriPath = AMIRI_NORMAL_CANDIDATES.find(fileOk);
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
// VFS extraction via vm sandbox
//
// pdfmake/build/vfs_fonts.js is a UMD module. In Node.js its factory calls
// require('pdfmake/build/pdfmake') and sets vfs on that object. We can't
// reliably load pdfmake/build/pdfmake (it's a browser webpack bundle), so
// instead we run vfs_fonts.js in a vm sandbox and intercept the require to
// return a plain mock object. The factory then sets mock.vfs = { ... }.
// This avoids browser globals entirely.
//
// Loaded once; result is cached in _vfsData for the process lifetime.
// ─────────────────────────────────────────────────────────────────

let _vfsData = null;

function loadVFS() {
  if (_vfsData !== null) return _vfsData;
  try {
    const vfsPath = require.resolve('pdfmake/build/vfs_fonts');
    const code    = fs.readFileSync(vfsPath, 'utf8');
    const mock    = {};
    vm.runInNewContext(code, {
      exports: {},
      module:  { exports: {} },
      require: (id) => {
        if (id === 'pdfmake/build/pdfmake') return mock;
        throw new Error('vfs sandbox blocked: ' + id);
      },
    }, { timeout: 15000, filename: 'vfs_fonts.js' });
    _vfsData = mock.vfs || {};
    console.log('[PDF][FONT] VFS loaded via vm, font count:', Object.keys(_vfsData).length);
  } catch (e) {
    console.error('[PDF][FONT] VFS vm load failed:', e.message);
    _vfsData = {};
  }
  return _vfsData;
}

function extractFromVFS(vfsKey, destPath) {
  if (fileOk(destPath)) return destPath;
  try {
    const b64 = loadVFS()[vfsKey];
    if (!b64) { console.error('[PDF][FONT] VFS key missing:', vfsKey); return null; }
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.writeFileSync(destPath, Buffer.from(b64, 'base64'));
    if (fileOk(destPath)) { console.log('[PDF][FONT] VFS extracted:', vfsKey); return destPath; }
  } catch (e) {
    console.error('[PDF][FONT] VFS extract error:', vfsKey, e.message);
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────
// Comprehensive font registry
//
// All TTF files are committed in server/fonts/ — no npm packages needed.
// Each entry: pdfmake key → { normal, bold, italics, bolditalics }
// The first path that satisfies fileOk() is used per style.
// Non-normal styles fall back to normal if not found.
// If normal is not found the font is omitted (not registered).
//
// script:   'arabic'|'urdu'|'latin'  — used to choose text cleaner
// fallback: pdfmake key to use when this font is not available
// ─────────────────────────────────────────────────────────────────

function fd(file) { return path.join(FONTS_DIR, file); }

const FONT_REGISTRY = {
  // ── Arabic-script fonts ──────────────────────────────────────────
  Amiri: {
    script: 'arabic', fallback: 'NotoNaskhArabic',
    normal:      [ fd('Amiri-Regular.ttf')      ],
    bold:        [ fd('Amiri-Bold.ttf')         ],
    italics:     [ fd('Amiri-Italic.ttf')       ],
    bolditalics: [ fd('Amiri-BoldItalic.ttf')   ],
  },
  NotoNaskhArabic: {
    script: 'arabic', fallback: 'Amiri',
    normal:      [ fd('NotoNaskhArabic-Regular.ttf') ],
    bold:        [ fd('NotoNaskhArabic-Bold.ttf')    ],
  },
  ScheherazadeNew: {
    script: 'arabic', fallback: 'Amiri',
    normal:      [ fd('ScheherazadeNew-Regular.ttf') ],
    bold:        [ fd('ScheherazadeNew-Bold.ttf')    ],
  },
  Cairo: {
    script: 'arabic', fallback: 'NotoNaskhArabic',
    normal:      [ fd('Cairo-Regular.ttf') ],
    bold:        [ fd('Cairo-Bold.ttf')    ],
  },
  Tajawal: {
    script: 'arabic', fallback: 'NotoNaskhArabic',
    normal:      [ fd('Tajawal-Regular.ttf') ],
    bold:        [ fd('Tajawal-Bold.ttf')    ],
  },
  ReemKufi: {
    script: 'arabic', fallback: 'NotoNaskhArabic',
    normal:      [ fd('ReemKufi-Regular.ttf') ],
  },
  Lateef: {
    script: 'arabic', fallback: 'Amiri',
    normal:      [ fd('Lateef-Regular.ttf') ],
  },

  // ── Urdu-script fonts ────────────────────────────────────────────
  NotoNastaliqUrdu: {
    script: 'urdu', fallback: 'Amiri',
    normal:      [ fd('NotoNastaliqUrdu-Regular.ttf') ],
    bold:        [ fd('NotoNastaliqUrdu-Bold.ttf')    ],
  },

  // ── Latin fonts ───────────────────────────────────────────────────
  Roboto: {
    script: 'latin', fallback: 'OpenSans',
    normal:      [ fd('Roboto-Regular.ttf')    ],
    bold:        [ fd('Roboto-Bold.ttf')       ],
    italics:     [ fd('Roboto-Italic.ttf')     ],
    bolditalics: [ fd('Roboto-BoldItalic.ttf') ],
  },
  OpenSans: {
    script: 'latin', fallback: 'Roboto',
    normal:      [ fd('OpenSans-Regular.ttf')    ],
    bold:        [ fd('OpenSans-Bold.ttf')       ],
    italics:     [ fd('OpenSans-Italic.ttf')     ],
    bolditalics: [ fd('OpenSans-BoldItalic.ttf') ],
  },
  Lato: {
    script: 'latin', fallback: 'Roboto',
    normal:      [ fd('Lato-Regular.ttf')    ],
    bold:        [ fd('Lato-Bold.ttf')       ],
    italics:     [ fd('Lato-Italic.ttf')     ],
    bolditalics: [ fd('Lato-BoldItalic.ttf') ],
  },
  Poppins: {
    script: 'latin', fallback: 'Roboto',
    normal:      [ fd('Poppins-Regular.ttf')    ],
    bold:        [ fd('Poppins-Bold.ttf')       ],
    italics:     [ fd('Poppins-Italic.ttf')     ],
    bolditalics: [ fd('Poppins-BoldItalic.ttf') ],
  },
  Inter: {
    script: 'latin', fallback: 'Roboto',
    normal:      [ fd('Inter-Regular.ttf') ],
    bold:        [ fd('Inter-Bold.ttf')    ],
  },
  Montserrat: {
    script: 'latin', fallback: 'Roboto',
    normal:      [ fd('Montserrat-Regular.ttf')    ],
    bold:        [ fd('Montserrat-Bold.ttf')       ],
    italics:     [ fd('Montserrat-Italic.ttf')     ],
    bolditalics: [ fd('Montserrat-BoldItalic.ttf') ],
  },
  Merriweather: {
    script: 'latin', fallback: 'Lora',
    normal:      [ fd('Merriweather-Regular.ttf')    ],
    bold:        [ fd('Merriweather-Bold.ttf')       ],
    italics:     [ fd('Merriweather-Italic.ttf')     ],
    bolditalics: [ fd('Merriweather-BoldItalic.ttf') ],
  },
  Lora: {
    script: 'latin', fallback: 'Merriweather',
    normal:      [ fd('Lora-Regular.ttf')    ],
    bold:        [ fd('Lora-Bold.ttf')       ],
    italics:     [ fd('Lora-Italic.ttf')     ],
    bolditalics: [ fd('Lora-BoldItalic.ttf') ],
  },
  PlayfairDisplay: {
    script: 'latin', fallback: 'Merriweather',
    normal:      [ fd('PlayfairDisplay-Regular.ttf')    ],
    bold:        [ fd('PlayfairDisplay-Bold.ttf')       ],
    italics:     [ fd('PlayfairDisplay-Italic.ttf')     ],
    bolditalics: [ fd('PlayfairDisplay-BoldItalic.ttf') ],
  },
  EBGaramond: {
    script: 'latin', fallback: 'Lora',
    normal:      [ fd('EBGaramond-Regular.ttf')    ],
    bold:        [ fd('EBGaramond-Bold.ttf')       ],
    italics:     [ fd('EBGaramond-Italic.ttf')     ],
    bolditalics: [ fd('EBGaramond-BoldItalic.ttf') ],
  },
};

// ── Editor font name (value from FONT_GROUPS) → pdfmake key ─────
// System fonts map to nearest available equivalent.
// "Jameel Noori Nastaleeq" → NotoNastaliqUrdu (no free TTF for JNN).
const EDITOR_FONT_TO_KEY = {
  // Arabic
  'Amiri':              'Amiri',
  'Noto Naskh Arabic':  'NotoNaskhArabic',
  'Scheherazade New':   'ScheherazadeNew',
  'Cairo':              'Cairo',
  'Tajawal':            'Tajawal',
  'Reem Kufi':          'ReemKufi',
  'Lateef':             'Lateef',
  // Urdu
  'Noto Nastaliq Urdu':     'NotoNastaliqUrdu',
  'Jameel Noori Nastaleeq': 'NotoNastaliqUrdu',
  // Latin (web fonts)
  'Roboto':            'Roboto',
  'Open Sans':         'OpenSans',
  'Lato':              'Lato',
  'Poppins':           'Poppins',
  'Inter':             'Inter',
  'Montserrat':        'Montserrat',
  'Merriweather':      'Merriweather',
  'Lora':              'Lora',
  'Playfair Display':  'PlayfairDisplay',
  'EB Garamond':       'EBGaramond',
  // Latin (system font fallbacks — mapped to nearest free equivalent)
  'Times New Roman':   'Lora',
  'Georgia':           'Merriweather',
  'Garamond':          'EBGaramond',
  'Arial':             'OpenSans',
  'Verdana':           'OpenSans',
  'Trebuchet MS':      'OpenSans',
};

// ── Resolve a single font style from candidate paths ─────────────
function resolveStyle(candidates) {
  if (!Array.isArray(candidates)) return null;
  return candidates.find(fileOk) || null;
}

// ── Amiri candidates — also used by patchFontkitGPOS ─────────────
const AMIRI_NORMAL_CANDIDATES = FONT_REGISTRY.Amiri.normal;

// ── Build PdfPrinter font descriptor map ─────────────────────────
// Resolves all registered fonts. Missing normal = font omitted.
// Missing bold/italic = falls back to normal (pdfmake accepts this).
// Returns { available: Set<key>, desc: { [key]: {normal,bold,...} } }
function buildFontDescriptors() {
  const desc      = {};
  const available = new Set();

  for (const [key, def] of Object.entries(FONT_REGISTRY)) {
    const normal = resolveStyle(def.normal);
    if (!normal) {
      console.warn(`[PDF][FONT] ${key}: normal TTF not found — font skipped`);
      continue;
    }
    const bold        = resolveStyle(def.bold)        || normal;
    const italics     = resolveStyle(def.italics)     || normal;
    const bolditalics = resolveStyle(def.bolditalics) || bold;
    desc[key]         = { normal, bold, italics, bolditalics };
    available.add(key);
    console.log(`[PDF][FONT] ${key}: ok (${path.basename(normal)})`);
  }

  // Roboto VFS fallback: extract from pdfmake's bundled VFS if no file found
  if (!available.has('Roboto')) {
    const vfsFallbacks = {
      normal:      extractFromVFS('Roboto-Regular.ttf',      path.join(CACHE_DIR,'Roboto-Regular.ttf')),
      bold:        extractFromVFS('Roboto-Medium.ttf',       path.join(CACHE_DIR,'Roboto-Medium.ttf')),
      italics:     extractFromVFS('Roboto-Italic.ttf',       path.join(CACHE_DIR,'Roboto-Italic.ttf')),
      bolditalics: extractFromVFS('Roboto-MediumItalic.ttf', path.join(CACHE_DIR,'Roboto-MediumItalic.ttf')),
    };
    if (vfsFallbacks.normal) {
      desc.Roboto = {
        normal:      vfsFallbacks.normal,
        bold:        vfsFallbacks.bold        || vfsFallbacks.normal,
        italics:     vfsFallbacks.italics     || vfsFallbacks.normal,
        bolditalics: vfsFallbacks.bolditalics || vfsFallbacks.bold || vfsFallbacks.normal,
      };
      available.add('Roboto');
      console.log('[PDF][FONT] Roboto: ok via VFS');
    }
  }

  return { desc, available };
}

// ── Resolve editor font name → registered pdfmake key ────────────
// Returns the key if available, or walks the fallback chain.
// If all fallbacks fail, returns the script-appropriate last-resort.
function resolveFont(editorName, available, script) {
  const mapped = EDITOR_FONT_TO_KEY[editorName] || editorName;

  // Walk fallback chain
  let key = mapped;
  const seen = new Set();
  while (key && !seen.has(key)) {
    if (available.has(key)) return key;
    seen.add(key);
    key = FONT_REGISTRY[key]?.fallback;
  }

  // Last resort by script
  if (script === 'latin') {
    for (const k of ['Roboto','OpenSans','Lato']) {
      if (available.has(k)) return k;
    }
  }
  if (script === 'urdu') {
    for (const k of ['NotoNastaliqUrdu','Amiri']) {
      if (available.has(k)) return k;
    }
  }
  // arabic or unknown
  for (const k of ['NotoNaskhArabic','Amiri','ScheherazadeNew']) {
    if (available.has(k)) return k;
  }
  // Absolute last resort — pick anything
  return [...available][0] || 'Roboto';
}

// ── Is this a RTL (Arabic/Urdu) font key? ────────────────────────
function isRtlFont(key) {
  return FONT_REGISTRY[key]?.script === 'arabic' || FONT_REGISTRY[key]?.script === 'urdu';
}

// ─────────────────────────────────────────────────────────────────
// Block renderers
//
// All renderers receive a font context (fctx):
//   fctx.NAF  — default Arabic pdfmake key (NotoNaskhArabic or fallback)
//   fctx.NUF  — default Urdu pdfmake key   (NotoNastaliqUrdu or fallback)
//   fctx.LF   — default Latin pdfmake key  (Roboto or fallback)
//   fctx.AF   — Amiri key (for Amiri-specific content if available)
//   fctx.res  — resolveFont(editorName, script) → pdfmake key
//
// Structured blocks (chapter_heading, fiqh, verse) match frontend defaults:
//   Arabic fields  → NAF (NotoNaskhArabic, same as editor)
//   Urdu fields    → NUF (NotoNastaliqUrdu ≈ Jameel Noori Nastaleeq shape)
// ─────────────────────────────────────────────────────────────────

function renderChapterHeading(block, fctx) {
  const nodes        = [];
  const arabicTitle  = cleanForAmiri(block.arabicTitle);
  const urduSubtitle = cleanForAmiri(block.urduSubtitle);
  if (arabicTitle)  nodes.push({ text: arabicTitle,  font: fctx.NAF, fontSize: 22, bold: true, alignment: 'center', margin: [0, 20, 0, urduSubtitle ? 4 : 14] });
  if (urduSubtitle) nodes.push({ text: urduSubtitle, font: fctx.NUF, fontSize: 17, bold: true, alignment: 'center', margin: [0, 0, 0, 14] });
  return nodes;
}

function renderHadith(block, fctx) {
  // Arabic column: honour block.arabicFont (user-selected in Hadith editor)
  const arabicKey = block.arabicFont ? fctx.res(block.arabicFont, 'arabic') : fctx.NAF;
  const num    = cleanForAmiri(block.number);
  const arabic = cleanForAmiri((num ? `﴿${num}﴾ ` : '') + safeStr(block.arabicMatn));
  const urdu   = cleanForAmiri(block.urduTranslation);
  return {
    table: {
      widths: ['50%', '50%'],
      body: [[
        { text: urdu.trim(),   font: fctx.NUF,  fontSize: 13, alignment: 'right', margin: [4, 4, 8, 8] },
        { text: arabic.trim(), font: arabicKey,  fontSize: 13, alignment: 'right', margin: [8, 4, 4, 8] },
      ]],
    },
    layout: 'noBorders',
    margin: [0, 14, 0, 0],
  };
}

function renderFiqh(block, fctx) {
  const heading = cleanForAmiri(block.heading) || 'فقہ الحدیث:';
  const nodes   = [{ text: heading, font: fctx.NAF, fontSize: 15, bold: true, alignment: 'right', margin: [0, 8, 0, 4] }];
  const points  = Array.isArray(block.points) ? block.points : [];
  points.forEach((pt, i) => {
    nodes.push({ text: `(${i + 1}) ` + cleanForAmiri(pt), font: fctx.NUF, fontSize: 13, alignment: 'right', margin: [0, 2, 0, 2] });
  });
  return nodes;
}

function renderReference(block, fctx) {
  const content = cleanForAmiri(stripHtml(block.content));
  if (!content) return [];
  return [
    { canvas: [{ type: 'line', x1: 330, y1: 0, x2: 481, y2: 0, lineWidth: 0.8, lineColor: '#555' }], margin: [0, 8, 0, 3] },
    { text: content, font: fctx.NAF, fontSize: 10, alignment: 'right', color: '#333', margin: [0, 0, 0, 6] },
  ];
}

function renderVerse(block, fctx) {
  const nodes      = [];
  const arabicText = cleanForAmiri(block.arabicText);
  const urduText   = cleanForAmiri(block.urduText);
  if (arabicText) nodes.push({ text: arabicText, font: fctx.NAF, fontSize: 14, alignment: 'center', margin: [0, 10, 0, urduText ? 4 : 10] });
  if (urduText)   nodes.push({ text: urduText,   font: fctx.NUF, fontSize: 14, alignment: 'center', margin: [0, 0, 0, 10] });
  return nodes;
}

function renderFreeText(block, fctx) {
  const dir       = safeStr(block.direction) || 'rtl';
  const isLtr     = dir === 'ltr';
  const raw       = stripHtml(block.content);
  // Resolve per-block font; fall back to NAF (RTL) or LF (LTR)
  const editorFont = safeStr(block.fontFamily);
  const script     = isLtr ? 'latin' : 'arabic';
  const fontKey    = editorFont ? fctx.res(editorFont, script)
                                : (isLtr ? fctx.LF : fctx.NAF);
  const content    = isRtlFont(fontKey) ? cleanForAmiri(raw) : cleanForRoboto(raw);
  const size       = Math.max(8, Math.min(48, Number(block.fontSize) || 13));
  return {
    text:      content,
    font:      fontKey,
    fontSize:  size,
    alignment: pdfAlign(safeStr(block.textAlign), dir),
    margin:    [0, 4, 0, 4],
  };
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
  const name  = cleanForAmiri(stripHtml(doc.headerRight || doc.name || ''));
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
  const center   = cleanForAmiri(stripHtml(doc.footerCenter || ''));
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
  };

  const blockCount = Array.isArray(doc.blocks) ? doc.blocks.length : 0;
  console.time('[PDF] generate');
  console.log(`[PDF] start: fonts=[${[...available].join(',')}] NAF=${fctx.NAF} NUF=${fctx.NUF} LF=${fctx.LF} blocks=${blockCount}`);

  const printer = new PdfPrinter(desc);
  const docDef  = {
    pageSize:     'A4',
    pageMargins:  [57, 71, 57, 71],
    defaultStyle: { font: fctx.NAF, fontSize: 13 },
    header:  makeHeader(doc, fctx),
    footer:  makeFooter(doc, fctx),
    content: buildContent(doc.blocks || [], fctx),
  };

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('[PDF] Timed out after 25s.'));
    }, 25000);

    try {
      const pdfDoc = printer.createPdfKitDocument(docDef);
      const chunks = [];
      pdfDoc.on('data',  (c) => chunks.push(c));
      pdfDoc.on('end',   () => {
        clearTimeout(timer);
        const buf = Buffer.concat(chunks);
        console.timeEnd('[PDF] generate');
        console.log('[PDF] done, bytes:', buf.length);
        resolve(buf);
      });
      pdfDoc.on('error', (err) => { clearTimeout(timer); reject(err); });
      pdfDoc.end();
    } catch (err) {
      clearTimeout(timer);
      console.error('[PDF] createPdfKitDocument error:', err.message);
      reject(err);
    }
  });
}

async function generatePDF(doc) {
  if (!doc || typeof doc !== 'object') throw new Error('[PDF] Invalid document data.');

  // Layer 1: patch GPOSProcessor.prototype.getAnchor before any font opens.
  patchFontkitGPOS();

  const fontData = buildFontDescriptors();
  const { available } = fontData;

  // Need at least one Arabic font and one Latin font to render the document.
  const hasArabic = ['NotoNaskhArabic','Amiri','ScheherazadeNew','Cairo','Tajawal','ReemKufi','Lateef','NotoNastaliqUrdu'].some(k => available.has(k));
  const hasLatin  = ['Roboto','OpenSans','Lato','Poppins','Inter','Montserrat','Merriweather','Lora','PlayfairDisplay','EBGaramond'].some(k => available.has(k));

  if (!hasArabic) throw new Error('[PDF] No Arabic/Urdu font available. Run npm run install:fonts');
  if (!hasLatin)  throw new Error('[PDF] No Latin font available. Run npm run install:fonts');

  console.log(`[PDF] fonts resolved: ${[...available].join(', ')}`);

  // Layer 2: build PDF; on GPOS null-anchor escape, strip harakat and retry.
  try {
    return await _buildPDFBuffer(fontData, doc);
  } catch (e) {
    if (e && typeof e.message === 'string' && e.message.includes('xCoordinate')) {
      console.warn('[PDF] GPOS null-anchor escaped patch — retrying with harakat stripped');
      return await _buildPDFBuffer(fontData, stripDocHarakat(doc));
    }
    throw e;
  }
}

module.exports = { generatePDF };
