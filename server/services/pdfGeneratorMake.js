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

console.log('[PDF_VERSION] exact-editor-export-v1');

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
  // fallback chain are missing from server/fonts/
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

// Resolve CSS font-family string → registered pdfmake key.
// Parses the first name from a CSS font-family list, then delegates to
// FontRegistry for EDITOR_FONT_TO_KEY lookup + fallback chain.
function resolveInlineFont(cssFontFamily, available) {
  if (!cssFontFamily) return null;
  const name = cssFontFamily.replace(/^['"]|['"].*$/g, '').split(',')[0].trim();
  if (!name) return null;
  return FR.resolveEditorFont(name, available);
}

// Parse rich contentEditable HTML → pdfmake inline text array.
// Preserves: bold, italic, underline, strikethrough, font-family,
// font-size, color, background from element tags and inline styles.
//
// base = { font, fontSize, available, bold?, italics?, ... }
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
        const k = resolveInlineFont(face, inh.available);
        if (k) next.font = k;
      }
      const fc = $(node).attr('color');
      if (fc) { const hex = cssColorToHex(fc); if (hex) next.color = hex; }
    }

    // Inline style attribute
    const styleAttr = $(node).attr('style');
    if (styleAttr) {
      const css = parseCssDecls(styleAttr);
      if (css['font-family']) {
        const k = resolveInlineFont(css['font-family'], inh.available);
        if (k) next.font = k;
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
    font: fctx.NAF, fontSize: 20, bold: true, available: fctx.available,
  });
  if (arabicInlines.length) {
    nodes.push({
      text: arabicInlines, alignment: 'center', lineHeight: 1.6,
      margin: [0, 20, 0, 4],
    });
  }

  const urduInlines = htmlToInlines(safeStr(block.urduSubtitle), {
    font: fctx.NUF, fontSize: 17, bold: true, available: fctx.available,
  });
  if (urduInlines.length) {
    nodes.push({
      text: urduInlines, alignment: 'center', lineHeight: 1.8,
      margin: [0, 0, 0, 14],
    });
  }

  if (!nodes.length) return null;
  if (nodes.length === 1) nodes[0].margin[3] = 14;
  return nodes;
}

function renderHadith(block, fctx) {
  const arabicKey = block.arabicFont ? fctx.res(block.arabicFont, 'arabic') : fctx.NAF;

  // Editor preview: Arabic/Urdu at 18px (≈14pt), lineHeight 1.8/2.0
  const numStr = safeStr(block.number).trim();
  const matnInlines = htmlToInlines(safeStr(block.arabicMatn), {
    font: arabicKey, fontSize: 14, available: fctx.available,
  });
  const arabicInlines = numStr
    ? [{ text: `﴿${numStr}﴾ `, font: arabicKey, fontSize: 14 }, ...matnInlines]
    : matnInlines;

  const urduInlines = htmlToInlines(safeStr(block.urduTranslation), {
    font: fctx.NUF, fontSize: 14, available: fctx.available,
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
  };
}

function renderFiqh(block, fctx) {
  // Editor preview: heading at 20px (≈15pt), points at 17px (≈13pt)
  const headingInlines = htmlToInlines(safeStr(block.heading || 'فقہ الحدیث:'), {
    font: fctx.NAF, fontSize: 15, bold: true, available: fctx.available,
  });
  const nodes = [{
    text: headingInlines.length
      ? headingInlines
      : [{ text: 'فقہ الحدیث:', font: fctx.NAF, fontSize: 15, bold: true }],
    alignment: 'right', lineHeight: 1.6, margin: [0, 8, 0, 4],
  }];

  const points = Array.isArray(block.points) ? block.points : [];
  points.forEach((pt, i) => {
    const ptInlines = htmlToInlines(safeStr(pt), {
      font: fctx.NUF, fontSize: 13, available: fctx.available,
    });
    nodes.push({
      text: [
        { text: `(${i + 1}) `, font: fctx.NUF, fontSize: 13 },
        ...(ptInlines.length ? ptInlines : [{ text: ' ', font: fctx.NUF }]),
      ],
      alignment: 'right', lineHeight: 2.0, margin: [0, 2, 0, 2],
    });
  });
  return nodes;
}

function renderReference(block, fctx) {
  // Editor preview: 13px (≈10pt)
  const inlines = htmlToInlines(safeStr(block.content), {
    font: fctx.NAF, fontSize: 10, available: fctx.available,
  });
  if (!inlines.length) return [];
  return [
    { canvas: [{ type: 'line', x1: 330, y1: 0, x2: 481, y2: 0, lineWidth: 0.8, lineColor: '#555' }], margin: [0, 8, 0, 3] },
    { text: inlines, alignment: 'right', lineHeight: 1.5, color: '#333', margin: [0, 0, 0, 6] },
  ];
}

function renderVerse(block, fctx) {
  // Editor preview: 18px (≈14pt)
  const nodes = [];

  const arabicInlines = htmlToInlines(safeStr(block.arabicText), {
    font: fctx.NAF, fontSize: 14, available: fctx.available,
  });
  if (arabicInlines.length) {
    nodes.push({ text: arabicInlines, alignment: 'center', lineHeight: 1.8, margin: [0, 10, 0, 4] });
  }

  const urduInlines = htmlToInlines(safeStr(block.urduText), {
    font: fctx.NUF, fontSize: 14, available: fctx.available,
  });
  if (urduInlines.length) {
    nodes.push({ text: urduInlines, alignment: 'center', lineHeight: 2.0, margin: [0, 0, 0, 10] });
  }

  if (!nodes.length) return null;
  if (nodes.length === 1) nodes[0].margin = [0, 10, 0, 10];
  return nodes;
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

  // Preview hardcodes font-size: 16px (= 12pt). Per-character size changes
  // are stored as inline <span style="font-size:..."> inside block.content.
  const inlines = htmlToInlines(safeStr(block.content), {
    font: fontKey, fontSize: 12, available: fctx.available,
  });

  if (!inlines.length) return null;

  const lineHeight = Math.max(0.8, Math.min(5.0,
    parseFloat(block.lineHeight) || (isLtr ? 1.6 : 2.0)
  ));
  const mt = pxToPt(block.marginTop)    || 4;
  const mb = pxToPt(block.marginBottom) || 4;

  return {
    text:       inlines,
    alignment:  pdfAlign(safeStr(block.textAlign), dir),
    lineHeight: lineHeight,
    margin:     [0, mt, 0, mb],
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
  const center   = stripHtml(doc.footerCenter || '');
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

  const fontData = FR.getFontData();          // cached — loaded once at startup
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
