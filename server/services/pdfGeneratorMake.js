'use strict';

/**
 * Production-safe PDF generator using pdfmake/src/printer (Node.js server API).
 *
 * Font strategy — TTF ONLY (no woff2):
 *   woff2 requires WebAssembly (wawoff2) for decompression.  On some shared
 *   hosting environments (Hostinger) the WASM module hangs, causing the
 *   pdfkit stream to silently never emit 'end' → 504 gateway timeout.
 *   TTF is parsed by fontkit natively with no external decompressor.
 *
 *   Roboto (Latin/English):
 *     1. Extracted from pdfmake/build/vfs_fonts (always bundled as TTF)
 *        → written to os.tmpdir() or server/fonts/_cache/ at process start
 *
 *   Amiri (Arabic/Urdu):
 *     1. server/fonts/Amiri-Regular.ttf   (download-fonts.js fetches this)
 *     2. server/fonts/Amiri_400Regular.ttf (alternative name)
 *     3. Falls back to Roboto if not found — PDF still generates
 */

const PdfPrinter = require('pdfmake/src/printer');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

const FONTS_DIR  = path.join(__dirname, '../fonts');
const CACHE_DIR  = path.join(__dirname, '../fonts/_cache');

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
function fileOk(p) {
  try { return !!p && fs.existsSync(p) && fs.statSync(p).size > 1000; } catch (_) { return false; }
}

function tryWriteFile(dest, buf) {
  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    return fileOk(dest);
  } catch (_) { return false; }
}

// ─────────────────────────────────────────────────────────────────
// Roboto — extract TTF from pdfmake's bundled VFS at startup
// Tries OS temp dir first (almost always writable), then _cache/.
// ─────────────────────────────────────────────────────────────────
function extractRobotoTTF(filename) {
  // Already extracted in a previous request?
  const cached = [
    path.join(os.tmpdir(), '_pdfm_' + filename),
    path.join(CACHE_DIR, filename),
  ].find(fileOk);
  if (cached) return cached;

  let b64;
  try {
    const vfsMod = require('pdfmake/build/vfs_fonts');
    const vfs = vfsMod?.pdfMake?.vfs || vfsMod?.vfs || {};
    b64 = vfs[filename];
  } catch (e) {
    console.error('[PDF] Cannot load vfs_fonts:', e.message);
    return null;
  }
  if (!b64) { console.error('[PDF] VFS missing key:', filename); return null; }

  const buf = Buffer.from(b64, 'base64');

  // Try OS temp dir
  const tmp = path.join(os.tmpdir(), '_pdfm_' + filename);
  if (tryWriteFile(tmp, buf)) return tmp;

  // Try server/fonts/_cache/
  const fallback = path.join(CACHE_DIR, filename);
  if (tryWriteFile(fallback, buf)) return fallback;

  console.error('[PDF] Cannot write Roboto TTF to any writable path:', filename);
  return null;
}

function loadRoboto() {
  const n  = extractRobotoTTF('Roboto-Regular.ttf');
  const b  = extractRobotoTTF('Roboto-Medium.ttf')       || n;
  const i  = extractRobotoTTF('Roboto-Italic.ttf')        || n;
  const bi = extractRobotoTTF('Roboto-MediumItalic.ttf') || n;

  if (!n) { console.error('[PDF] Roboto NOT loaded — PDF generation will fail.'); return null; }
  console.log('[PDF] Roboto loaded:', n);
  return { normal: n, bold: b, italics: i, bolditalics: bi };
}

// ─────────────────────────────────────────────────────────────────
// Amiri — TTF only (downloaded by server/scripts/download-fonts.js)
// ─────────────────────────────────────────────────────────────────
function loadAmiri() {
  const normal = [
    path.join(FONTS_DIR, 'Amiri-Regular.ttf'),
    path.join(FONTS_DIR, 'Amiri_400Regular.ttf'),
  ].find(fileOk) || null;

  if (!normal) {
    console.warn('[PDF] Amiri TTF not found in server/fonts/ — Arabic/Urdu will use Roboto.');
    return null;
  }

  const bold = [
    path.join(FONTS_DIR, 'Amiri-Bold.ttf'),
    path.join(FONTS_DIR, 'Amiri_700Bold.ttf'),
  ].find(fileOk) || normal;

  console.log('[PDF] Amiri loaded:', normal);
  return { normal, bold };
}

// ─────────────────────────────────────────────────────────────────
// Build font descriptors (runs once at process start)
// ─────────────────────────────────────────────────────────────────
const robotoFiles = loadRoboto();
const amiriFiles  = loadAmiri();

const fontDescriptors = {};
if (robotoFiles) fontDescriptors.Roboto = robotoFiles;
if (amiriFiles)  fontDescriptors.Amiri  = amiriFiles;

// CRITICAL: every font name used in a docDefinition MUST be in fontDescriptors.
// An unregistered font name causes pdfmake to silently hang.
const ARABIC_FONT = fontDescriptors.Amiri  ? 'Amiri'  : (fontDescriptors.Roboto ? 'Roboto' : null);
const LATIN_FONT  = fontDescriptors.Roboto ? 'Roboto' : ARABIC_FONT;

console.log('[PDF] fonts registered:', Object.keys(fontDescriptors));
console.log('[PDF] ARABIC_FONT:', ARABIC_FONT, '| LATIN_FONT:', LATIN_FONT);

const printer = Object.keys(fontDescriptors).length > 0
  ? new PdfPrinter(fontDescriptors)
  : null;

// ─────────────────────────────────────────────────────────────────
// Content helpers
// ─────────────────────────────────────────────────────────────────
const CIRCLED = ['❶','❷','❸','❹','❺','❻','❼','❽','❾','❿'];

function stripHtml(html) {
  if (!html) return '';
  return html
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
// Block renderers
// ─────────────────────────────────────────────────────────────────
function renderChapterHeading(block) {
  const nodes = [];
  if (block.arabicTitle) nodes.push({ text: block.arabicTitle, font: ARABIC_FONT, fontSize: 22, bold: true, alignment: 'center', margin: [0, 20, 0, block.urduSubtitle ? 4 : 14] });
  if (block.urduSubtitle) nodes.push({ text: block.urduSubtitle, font: ARABIC_FONT, fontSize: 17, bold: true, alignment: 'center', margin: [0, 0, 0, 14] });
  return nodes;
}

function renderHadith(block) {
  const num    = block.number ? `﴿${block.number}﴾ ` : '';
  const arabic = (num + (block.arabicMatn || '')).trim();
  const urdu   = (block.urduTranslation  || '').trim();
  return {
    table: { widths: ['50%', '50%'], body: [[
      { text: urdu,   font: ARABIC_FONT, fontSize: 13, alignment: 'right', margin: [4, 4, 8, 8] },
      { text: arabic, font: ARABIC_FONT, fontSize: 13, alignment: 'right', margin: [8, 4, 4, 8] },
    ]] },
    layout: 'noBorders',
    margin: [0, 14, 0, 0],
  };
}

function renderFiqh(block) {
  const nodes = [{ text: block.heading || 'فقہ الحدیث:', font: ARABIC_FONT, fontSize: 15, bold: true, alignment: 'right', margin: [0, 8, 0, 4] }];
  (block.points || []).forEach((pt, i) => nodes.push({ text: `${CIRCLED[i] || `(${i + 1})`} ${pt}`, font: ARABIC_FONT, fontSize: 13, alignment: 'right', margin: [0, 2, 0, 2] }));
  return nodes;
}

function renderReference(block) {
  if (!block.content?.trim()) return [];
  return [
    { canvas: [{ type: 'line', x1: 330, y1: 0, x2: 481, y2: 0, lineWidth: 0.8, lineColor: '#555' }], margin: [0, 8, 0, 3] },
    { text: block.content, font: ARABIC_FONT, fontSize: 10, alignment: 'right', color: '#333', margin: [0, 0, 0, 6] },
  ];
}

function renderVerse(block) {
  const nodes = [];
  if (block.arabicText) nodes.push({ text: block.arabicText, font: ARABIC_FONT, fontSize: 14, alignment: 'center', margin: [0, 10, 0, block.urduText ? 4 : 10] });
  if (block.urduText)   nodes.push({ text: block.urduText,   font: ARABIC_FONT, fontSize: 14, alignment: 'center', margin: [0, 0, 0, 10] });
  return nodes;
}

function renderFreeText(block) {
  const dir = block.direction || 'rtl';
  return {
    text:      stripHtml(block.content || ''),
    font:      dir === 'ltr' ? LATIN_FONT : ARABIC_FONT,
    fontSize:  Number(block.fontSize) || 13,
    alignment: pdfAlign(block.textAlign, dir),
    margin:    [0, 4, 0, 4],
  };
}

function buildContent(blocks) {
  const content = [];
  for (const block of (blocks || [])) {
    let r;
    switch (block.type) {
      case 'chapter_heading': r = renderChapterHeading(block); break;
      case 'hadith':          r = renderHadith(block);         break;
      case 'fiqh':            r = renderFiqh(block);           break;
      case 'reference':       r = renderReference(block);      break;
      case 'verse':           r = renderVerse(block);          break;
      default:                r = renderFreeText(block);       break;
    }
    if (Array.isArray(r)) content.push(...r);
    else if (r)           content.push(r);
  }
  return content;
}

// ─────────────────────────────────────────────────────────────────
// Header / footer
// ─────────────────────────────────────────────────────────────────
function makeHeader(doc) {
  const name = doc.headerRight || doc.name || '';
  const pos  = doc.showPageNumber !== false ? (doc.pageNumberPosition || 'header-right') : 'none';
  return (currentPage) => ({
    columns: [
      { text: pos === 'header-left'  ? String(currentPage) : '',   font: ARABIC_FONT, fontSize: 9, color: '#555', alignment: 'left'  },
      { text: pos === 'header-right' ? String(currentPage) : name, font: ARABIC_FONT, fontSize: 9, color: '#555', alignment: 'right' },
    ],
    margin: [57, 15, 57, 0],
  });
}

function makeFooter(doc) {
  const pos      = doc.showPageNumber !== false ? (doc.pageNumberPosition || 'header-right') : 'none';
  const hairline = doc.footerHairline !== false;
  const center   = doc.footerCenter || '';
  return (currentPage) => {
    const ct = pos === 'footer-center' ? String(currentPage) : center;
    const stack = [];
    if (hairline) stack.push({ canvas: [{ type: 'line', x1: 57, y1: 0, x2: 481, y2: 0, lineWidth: 0.4, lineColor: '#000' }], margin: [0, 0, 0, 3] });
    stack.push({ text: ct, font: ARABIC_FONT, fontSize: 9, color: '#555', alignment: 'center' });
    return { stack, margin: [0, 8, 0, 0] };
  };
}

// ─────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────
async function generatePDF(doc) {
  if (!printer || !ARABIC_FONT) {
    throw new Error('[PDF] No fonts available — check server startup logs.');
  }

  console.time('[PDF] generate');
  console.log('[PDF] blocks:', doc.blocks?.length ?? 0, '| ARABIC:', ARABIC_FONT, '| LATIN:', LATIN_FONT);

  const docDefinition = {
    pageSize:     'A4',
    pageMargins:  [57, 71, 57, 71],
    defaultStyle: { font: ARABIC_FONT, fontSize: 13 },
    header:  makeHeader(doc),
    footer:  makeFooter(doc),
    content: buildContent(doc.blocks || []),
  };

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('[PDF] timed out after 30s')), 30000);
    try {
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const chunks = [];
      pdfDoc.on('data',  (c) => chunks.push(c));
      pdfDoc.on('end',   () => {
        clearTimeout(timer);
        const buf = Buffer.concat(chunks);
        console.timeEnd('[PDF] generate');
        console.log('[PDF] done, bytes:', buf.length);
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
      console.error('[PDF] createPdfKitDocument threw:', err.message);
      reject(err);
    }
  });
}

module.exports = { generatePDF };
