'use strict';

/**
 * Production PDF generator for Text-to-PDF tool.
 * Target: Hostinger Business Plan Node.js shared hosting.
 *
 * Design constraints:
 *  - TTF ONLY. woff2 requires WebAssembly (wawoff2) which hangs on shared hosting.
 *  - pdfmake/src/printer (PdfPrinter). The browser build (pdfmake/build/pdfmake)
 *    does not work in Node.js.
 *  - Roboto has NO Arabic glyphs. Never use Roboto for Arabic/Urdu text or fontkit
 *    returns null → "Cannot read properties of null (reading 'xCoordinate')".
 *  - Avoid Enclosed Alphanumeric Unicode chars (❶❷❸ U+2776+). Amiri does not
 *    carry these code points. Same xCoordinate crash results.
 *
 * Resilience guarantees:
 *  - Each block is rendered inside an isolated try/catch. One bad block is
 *    logged and skipped; the rest of the PDF continues.
 *  - All block field values are coerced to strings before use.
 *  - Amiri npm package path is checked FIRST (guaranteed by npm install).
 *  - Roboto is extracted once at startup from pdfmake's bundled VFS.
 *  - If Amiri is genuinely absent, the error is thrown with a clear message
 *    (better than crashing inside pdfkit with a null dereference).
 */

const PdfPrinter = require('pdfmake/src/printer');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

const FONTS_DIR  = path.join(__dirname, '../fonts');
const CACHE_DIR  = path.join(__dirname, '../fonts/_cache');
const EXPO_AMIRI = path.join(__dirname, '../node_modules/@expo-google-fonts/amiri');

// ─────────────────────────────────────────────────────────────────
// Low-level utilities
// ─────────────────────────────────────────────────────────────────

/** Returns true only when p is a file that exists and has at least 1 KB of content. */
function fileOk(p) {
  try { return !!p && fs.existsSync(p) && fs.statSync(p).size > 1000; }
  catch (_) { return false; }
}

/** Coerce any value to a trimmed string; returns '' for null/undefined/non-string. */
function safeStr(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  return String(v).trim();
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
  if (ta === 'center')  return 'center';
  if (ta === 'left')    return 'left';
  if (ta === 'justify') return 'justify';
  if (ta === 'right')   return 'right';
  return dir === 'ltr' ? 'justify' : 'right';
}

// ─────────────────────────────────────────────────────────────────
// Roboto — extracted ONCE at module load from pdfmake's bundled VFS.
// Tries os.tmpdir() first (most reliably writable on shared hosting),
// then falls back to server/fonts/_cache/.
// ─────────────────────────────────────────────────────────────────

function extractRobotoTTF(filename) {
  const candidates = [
    path.join(os.tmpdir(), '_pdfm_' + filename),
    path.join(CACHE_DIR,   filename),
  ];

  const cached = candidates.find(fileOk);
  if (cached) return cached;

  let b64;
  try {
    const vfsMod = require('pdfmake/build/vfs_fonts');
    const vfs = (vfsMod && (vfsMod.pdfMake || vfsMod).vfs) || {};
    b64 = vfs[filename];
  } catch (e) {
    console.error('[PDF][FONT] Cannot load vfs_fonts:', e.message);
    return null;
  }
  if (!b64) {
    console.error('[PDF][FONT] Key not in VFS:', filename);
    return null;
  }

  const buf = Buffer.from(b64, 'base64');
  for (const dest of candidates) {
    try {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf);
      if (fileOk(dest)) {
        console.log('[PDF][FONT] Extracted', filename, '->', dest);
        return dest;
      }
    } catch (_) {}
  }

  console.error('[PDF][FONT] Cannot write', filename, 'to tmpdir or _cache.');
  return null;
}

const ROBOTO_NORMAL     = extractRobotoTTF('Roboto-Regular.ttf');
const ROBOTO_BOLD       = extractRobotoTTF('Roboto-Medium.ttf')       || ROBOTO_NORMAL;
const ROBOTO_ITALIC     = extractRobotoTTF('Roboto-Italic.ttf')        || ROBOTO_NORMAL;
const ROBOTO_BOLDITALIC = extractRobotoTTF('Roboto-MediumItalic.ttf') || ROBOTO_NORMAL;

console.log('[PDF][FONT] Roboto normal:', ROBOTO_NORMAL || 'NOT FOUND');

// ─────────────────────────────────────────────────────────────────
// Amiri (Arabic/Urdu) — candidate list checked fresh on every request.
// npm package path is FIRST: it is guaranteed present after `npm install`
// regardless of CDN availability on Hostinger.
// ─────────────────────────────────────────────────────────────────

const AMIRI_NORMAL_CANDIDATES = [
  path.join(EXPO_AMIRI, 'Amiri_400Regular.ttf'),  // npm package — most reliable
  path.join(FONTS_DIR,  'Amiri-Regular.ttf'),      // from download-fonts.js
  path.join(FONTS_DIR,  'Amiri_400Regular.ttf'),   // alternate download name
];

const AMIRI_BOLD_CANDIDATES = [
  path.join(EXPO_AMIRI, 'Amiri_700Bold.ttf'),      // npm package — most reliable
  path.join(FONTS_DIR,  'Amiri-Bold.ttf'),          // from download-fonts.js
  path.join(FONTS_DIR,  'Amiri_700Bold.ttf'),       // alternate download name
];

function resolveAmiri() {
  const normal = AMIRI_NORMAL_CANDIDATES.find(fileOk) || null;
  if (!normal) return null;
  const bold = AMIRI_BOLD_CANDIDATES.find(fileOk) || normal;
  return { normal, bold };
}

// ─────────────────────────────────────────────────────────────────
// Build a fresh, verified font descriptor map for each request.
// Every path is re-confirmed to exist right now.
// ─────────────────────────────────────────────────────────────────

function buildFontDescriptors() {
  const desc = {};

  if (fileOk(ROBOTO_NORMAL)) {
    desc.Roboto = {
      normal:      ROBOTO_NORMAL,
      bold:        fileOk(ROBOTO_BOLD)       ? ROBOTO_BOLD       : ROBOTO_NORMAL,
      italics:     fileOk(ROBOTO_ITALIC)     ? ROBOTO_ITALIC     : ROBOTO_NORMAL,
      bolditalics: fileOk(ROBOTO_BOLDITALIC) ? ROBOTO_BOLDITALIC : ROBOTO_NORMAL,
    };
  }

  const amiri = resolveAmiri();
  if (amiri) {
    desc.Amiri = { normal: amiri.normal, bold: amiri.bold };
    console.log('[PDF][FONT] Amiri normal:', amiri.normal);
  } else {
    console.error('[PDF][FONT] Amiri NOT FOUND. Checked:', AMIRI_NORMAL_CANDIDATES.join(', '));
  }

  return desc;
}

// ─────────────────────────────────────────────────────────────────
// Block renderers
//
// Rules:
//  - Every text field is coerced with safeStr() before use.
//  - Never use CIRCLED Unicode chars (❶❷❸ U+2776+). Amiri does not carry
//    these glyphs. Use ASCII like (1)(2)(3) instead.
//  - All Arabic/Urdu text uses font: AF (Amiri). Never render Arabic with Roboto.
//  - LTR free_text uses font: LF (Roboto) with alignment: justify.
// ─────────────────────────────────────────────────────────────────

function renderChapterHeading(block, AF) {
  const nodes = [];
  const arabicTitle  = safeStr(block.arabicTitle);
  const urduSubtitle = safeStr(block.urduSubtitle);
  if (arabicTitle)  nodes.push({ text: arabicTitle,  font: AF, fontSize: 22, bold: true,  alignment: 'center', margin: [0, 20, 0, urduSubtitle ? 4 : 14] });
  if (urduSubtitle) nodes.push({ text: urduSubtitle, font: AF, fontSize: 17, bold: true,  alignment: 'center', margin: [0, 0,  0, 14] });
  return nodes;
}

function renderHadith(block, AF) {
  const num    = safeStr(block.number);
  const arabic = (num ? `﴿${num}﴾ ` : '') + safeStr(block.arabicMatn);
  const urdu   = safeStr(block.urduTranslation);
  return {
    table: {
      widths: ['50%', '50%'],
      body: [[
        { text: urdu.trim(),   font: AF, fontSize: 13, alignment: 'right', margin: [4, 4, 8, 8] },
        { text: arabic.trim(), font: AF, fontSize: 13, alignment: 'right', margin: [8, 4, 4, 8] },
      ]],
    },
    layout: 'noBorders',
    margin: [0, 14, 0, 0],
  };
}

function renderFiqh(block, AF) {
  const heading = safeStr(block.heading) || 'فقہ الحدیث:';
  const nodes = [
    { text: heading, font: AF, fontSize: 15, bold: true, alignment: 'right', margin: [0, 8, 0, 4] },
  ];
  const points = Array.isArray(block.points) ? block.points : [];
  points.forEach((pt, i) => {
    const label = `(${i + 1}) `;  // ASCII only — avoids ❶❷❸ which crash Amiri (no glyphs)
    nodes.push({ text: label + safeStr(pt), font: AF, fontSize: 13, alignment: 'right', margin: [0, 2, 0, 2] });
  });
  return nodes;
}

function renderReference(block, AF) {
  const content = stripHtml(block.content);
  if (!content) return [];
  return [
    { canvas: [{ type: 'line', x1: 330, y1: 0, x2: 481, y2: 0, lineWidth: 0.8, lineColor: '#555' }], margin: [0, 8, 0, 3] },
    { text: content, font: AF, fontSize: 10, alignment: 'right', color: '#333', margin: [0, 0, 0, 6] },
  ];
}

function renderVerse(block, AF) {
  const nodes = [];
  const arabicText = safeStr(block.arabicText);
  const urduText   = safeStr(block.urduText);
  if (arabicText) nodes.push({ text: arabicText, font: AF, fontSize: 14, alignment: 'center', margin: [0, 10, 0, urduText ? 4 : 10] });
  if (urduText)   nodes.push({ text: urduText,   font: AF, fontSize: 14, alignment: 'center', margin: [0, 0,  0, 10] });
  return nodes;
}

function renderFreeText(block, AF, LF) {
  const dir     = safeStr(block.direction) || 'rtl';
  const content = stripHtml(block.content);
  const font    = dir === 'ltr' ? LF : AF;
  const size    = Math.max(8, Math.min(48, Number(block.fontSize) || 13));
  return {
    text:      content,
    font:      font,
    fontSize:  size,
    alignment: pdfAlign(safeStr(block.textAlign), dir),
    margin:    [0, 4, 0, 4],
  };
}

// ─────────────────────────────────────────────────────────────────
// Build content array — each block is independently try/catched.
// A bad block is logged and skipped; remaining blocks continue.
// ─────────────────────────────────────────────────────────────────

function buildContent(blocks, AF, LF) {
  const content = [];
  const safeBlocks = Array.isArray(blocks) ? blocks : [];

  for (let i = 0; i < safeBlocks.length; i++) {
    const block = safeBlocks[i];
    if (!block || typeof block !== 'object') continue;

    try {
      const type = safeStr(block.type) || 'free_text';
      let r;
      switch (type) {
        case 'chapter_heading': r = renderChapterHeading(block, AF);     break;
        case 'hadith':          r = renderHadith(block, AF);             break;
        case 'fiqh':            r = renderFiqh(block, AF);               break;
        case 'reference':       r = renderReference(block, AF);          break;
        case 'verse':           r = renderVerse(block, AF);              break;
        default:                r = renderFreeText(block, AF, LF);       break;
      }
      if (Array.isArray(r)) content.push(...r.filter(Boolean));
      else if (r)           content.push(r);
    } catch (err) {
      console.error(`[PDF] Block ${i} (${block.type}) render error — skipped:`, err.message);
    }
  }

  return content;
}

// ─────────────────────────────────────────────────────────────────
// Header and footer factories
// ─────────────────────────────────────────────────────────────────

function makeHeader(doc, AF) {
  // Strip HTML + non-safe chars from name so no glyph-missing crash in header
  const name = stripHtml(doc.headerRight || doc.name || '');
  const pos  = doc.showPageNumber !== false
    ? safeStr(doc.pageNumberPosition) || 'header-right'
    : 'none';

  return (pg) => {
    try {
      return {
        columns: [
          { text: pos === 'header-left'  ? String(pg) : '',   font: AF, fontSize: 9, color: '#555', alignment: 'left'  },
          { text: pos === 'header-right' ? String(pg) : name, font: AF, fontSize: 9, color: '#555', alignment: 'right' },
        ],
        margin: [57, 15, 57, 0],
      };
    } catch (_) { return { text: '' }; }
  };
}

function makeFooter(doc, AF) {
  const pos      = doc.showPageNumber !== false
    ? safeStr(doc.pageNumberPosition) || 'header-right'
    : 'none';
  const hairline = doc.footerHairline !== false;
  const center   = stripHtml(doc.footerCenter || '');

  return (pg) => {
    try {
      const ct = pos === 'footer-center' ? String(pg) : center;
      const stack = [];
      if (hairline) stack.push({ canvas: [{ type: 'line', x1: 57, y1: 0, x2: 481, y2: 0, lineWidth: 0.4, lineColor: '#000' }], margin: [0, 0, 0, 3] });
      stack.push({ text: ct, font: AF, fontSize: 9, color: '#555', alignment: 'center' });
      return { stack, margin: [0, 8, 0, 0] };
    } catch (_) { return { text: '' }; }
  };
}

// ─────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────

async function generatePDF(doc) {
  if (!doc || typeof doc !== 'object') throw new Error('[PDF] Invalid document data.');

  const desc = buildFontDescriptors();

  if (!desc.Amiri) {
    throw new Error(
      '[PDF] Amiri Arabic font not found. ' +
      'Ensure @expo-google-fonts/amiri is in server/package.json and run npm install. ' +
      'Checked: ' + AMIRI_NORMAL_CANDIDATES.join(', ')
    );
  }
  if (!desc.Roboto) {
    throw new Error('[PDF] Roboto font not available. Check server logs for VFS extraction errors.');
  }

  const AF = 'Amiri';
  const LF = 'Roboto';
  const blockCount = Array.isArray(doc.blocks) ? doc.blocks.length : 0;

  console.time('[PDF] generate');
  console.log(`[PDF] start: fonts=[${Object.keys(desc).join(',')}] blocks=${blockCount}`);

  const printer = new PdfPrinter(desc);

  const docDefinition = {
    pageSize:     'A4',
    pageMargins:  [57, 71, 57, 71],
    defaultStyle: { font: AF, fontSize: 13 },
    header:  makeHeader(doc, AF),
    footer:  makeFooter(doc, AF),
    content: buildContent(doc.blocks || [], AF, LF),
  };

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('[PDF] Generation timed out after 25s. Document may be too large.'));
    }, 25000);

    try {
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const chunks = [];

      pdfDoc.on('data',  (chunk) => chunks.push(chunk));
      pdfDoc.on('end',   () => {
        clearTimeout(timer);
        const buf = Buffer.concat(chunks);
        console.timeEnd('[PDF] generate');
        if (buf.length < 100) {
          console.error('[PDF] Generated buffer suspiciously small:', buf.length, 'bytes');
        } else {
          console.log('[PDF] done, size:', buf.length, 'bytes');
        }
        resolve(buf);
      });
      pdfDoc.on('error', (err) => {
        clearTimeout(timer);
        console.error('[PDF] stream error:', err.message);
        reject(err);
      });

      pdfDoc.end();
    } catch (err) {
      clearTimeout(timer);
      console.error('[PDF] createPdfKitDocument error:', err.message);
      reject(err);
    }
  });
}

module.exports = { generatePDF };
