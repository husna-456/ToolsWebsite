'use strict';

/**
 * Production-safe PDF generator — pdfmake/src/printer (Node.js server API).
 *
 * Font strategy at startup (synchronous, deterministic):
 *   Roboto: pdfmake fonts/ dir → VFS extraction into server/fonts/_cache/
 *   Amiri:  server/fonts/Amiri-*.woff2 (download-fonts.js) → @fontsource/amiri
 *
 * LATIN_FONT always falls back to whatever Arabic font IS available so that
 * no font name is ever referenced in a docDefinition without being registered
 * — an unregistered font causes pdfmake to hang silently until timeout.
 */

const PdfPrinter = require('pdfmake/src/printer');
const path = require('path');
const fs   = require('fs');

// ─────────────────────────────────────────────────────────────────
// Paths
// ─────────────────────────────────────────────────────────────────
const FONTS_DIR   = path.join(__dirname, '../fonts');           // server/fonts/
const CACHE_DIR   = path.join(__dirname, '../fonts/_cache');    // Roboto extraction cache
const AMIRI_SRC   = path.join(__dirname, '../node_modules/@fontsource/amiri/files');

function ensureDir(d) {
  try { fs.mkdirSync(d, { recursive: true }); } catch (_) {}
}

function fileOk(p) {
  try { return p && fs.existsSync(p) && fs.statSync(p).size > 500; } catch (_) { return false; }
}

// ─────────────────────────────────────────────────────────────────
// Roboto — extract from pdfmake's VFS into server/fonts/_cache/
// This runs ONCE at process startup, synchronously.
// ─────────────────────────────────────────────────────────────────
function loadRoboto() {
  // 1. Try pdfmake's bundled fonts/ directory (present in some versions)
  let pdfmakeRoot = null;
  try { pdfmakeRoot = path.dirname(require.resolve('pdfmake/package.json')); } catch (_) {}

  const pdfmakeFontsDir = pdfmakeRoot ? path.join(pdfmakeRoot, 'fonts') : null;
  const ttfInPkg = pdfmakeFontsDir && fileOk(path.join(pdfmakeFontsDir, 'Roboto-Regular.ttf'));
  if (ttfInPkg) {
    console.log('[PDF] Roboto: using pdfmake bundled fonts dir');
    return {
      normal:      path.join(pdfmakeFontsDir, 'Roboto-Regular.ttf'),
      bold:        path.join(pdfmakeFontsDir, 'Roboto-Medium.ttf'),
      italics:     path.join(pdfmakeFontsDir, 'Roboto-Italic.ttf'),
      bolditalics: path.join(pdfmakeFontsDir, 'Roboto-MediumItalic.ttf'),
    };
  }

  // 2. Extract from pdfmake/build/vfs_fonts.js → server/fonts/_cache/
  try {
    ensureDir(CACHE_DIR);
    const vfsMod  = require('pdfmake/build/vfs_fonts');
    // Covers multiple possible export shapes across pdfmake versions
    const fontVFS = vfsMod?.pdfMake?.vfs || vfsMod?.vfs || {};

    const MAP = {
      normal:      'Roboto-Regular.ttf',
      bold:        'Roboto-Medium.ttf',
      italics:     'Roboto-Italic.ttf',
      bolditalics: 'Roboto-MediumItalic.ttf',
    };
    const result = {};
    let ok = 0;

    for (const [key, filename] of Object.entries(MAP)) {
      const b64  = fontVFS[filename];
      const dest = path.join(CACHE_DIR, filename);
      if (!b64) { console.warn('[PDF] VFS missing key:', filename); continue; }
      if (!fileOk(dest)) {
        fs.writeFileSync(dest, Buffer.from(b64, 'base64'));
      }
      result[key] = dest;
      ok++;
    }

    if (ok > 0) {
      console.log(`[PDF] Roboto: extracted ${ok}/4 files to ${CACHE_DIR}`);
      // Fill missing variants with the normal weight
      for (const key of ['bold', 'italics', 'bolditalics']) {
        if (!result[key] && result.normal) result[key] = result.normal;
      }
      return result;
    }
  } catch (e) {
    console.error('[PDF] VFS extraction error:', e.message);
  }

  console.error('[PDF] Roboto: NOT FOUND. PDF will fail.');
  return null;
}

// ─────────────────────────────────────────────────────────────────
// Amiri — loaded from disk (downloaded at deploy time)
// ─────────────────────────────────────────────────────────────────
function loadAmiri() {
  const normal = [
    path.join(FONTS_DIR, 'Amiri-Regular.woff2'),
    path.join(AMIRI_SRC, 'amiri-arabic-400-normal.woff2'),
    path.join(AMIRI_SRC, 'amiri-arabic-400-normal.woff'),
  ].find(fileOk) || null;

  const bold = [
    path.join(FONTS_DIR, 'Amiri-Bold.woff2'),
    path.join(AMIRI_SRC, 'amiri-arabic-700-normal.woff2'),
    path.join(AMIRI_SRC, 'amiri-arabic-700-normal.woff'),
  ].find(fileOk) || normal;

  if (normal) {
    console.log('[PDF] Amiri:', normal);
    return { normal, bold: bold || normal };
  }
  console.warn('[PDF] Amiri: NOT FOUND — Arabic/Urdu will use Roboto fallback');
  return null;
}

// ─────────────────────────────────────────────────────────────────
// Build font descriptors — only register fonts whose files exist
// ─────────────────────────────────────────────────────────────────
const robotoFiles = loadRoboto();
const amiriFiles  = loadAmiri();

const fontDescriptors = {};
if (robotoFiles) fontDescriptors.Roboto = robotoFiles;
if (amiriFiles)  fontDescriptors.Amiri  = amiriFiles;

// CRITICAL: LATIN_FONT and ARABIC_FONT MUST reference names that are
// actually in fontDescriptors, otherwise pdfmake hangs silently.
const ARABIC_FONT = fontDescriptors.Amiri  ? 'Amiri'  : (fontDescriptors.Roboto ? 'Roboto' : null);
const LATIN_FONT  = fontDescriptors.Roboto ? 'Roboto' : ARABIC_FONT;

console.log('[PDF] fonts registered:', Object.keys(fontDescriptors));
console.log('[PDF] ARABIC_FONT:', ARABIC_FONT, '| LATIN_FONT:', LATIN_FONT);

const printer = Object.keys(fontDescriptors).length > 0
  ? new PdfPrinter(fontDescriptors)
  : null;

// ─────────────────────────────────────────────────────────────────
// Helpers
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
  if (block.arabicTitle) {
    nodes.push({
      text: block.arabicTitle, font: ARABIC_FONT, fontSize: 22, bold: true,
      alignment: 'center', margin: [0, 20, 0, block.urduSubtitle ? 4 : 14],
    });
  }
  if (block.urduSubtitle) {
    nodes.push({
      text: block.urduSubtitle, font: ARABIC_FONT, fontSize: 17, bold: true,
      alignment: 'center', margin: [0, 0, 0, 14],
    });
  }
  return nodes;
}

function renderHadith(block) {
  const num    = block.number ? `﴿${block.number}﴾ ` : '';
  const arabic = (num + (block.arabicMatn || '')).trim();
  const urdu   = (block.urduTranslation  || '').trim();
  return {
    table: {
      widths: ['50%', '50%'],
      body: [[
        { text: urdu,   font: ARABIC_FONT, fontSize: 13, alignment: 'right', margin: [4, 4, 8, 8] },
        { text: arabic, font: ARABIC_FONT, fontSize: 13, alignment: 'right', margin: [8, 4, 4, 8] },
      ]],
    },
    layout: 'noBorders',
    margin: [0, 14, 0, 0],
  };
}

function renderFiqh(block) {
  const heading = block.heading || 'فقہ الحدیث:';
  const points  = block.points  || [];
  const nodes   = [{
    text: heading, font: ARABIC_FONT, fontSize: 15, bold: true,
    alignment: 'right', margin: [0, 8, 0, 4],
  }];
  points.forEach((pt, i) => nodes.push({
    text: `${CIRCLED[i] || `(${i + 1})`} ${pt}`,
    font: ARABIC_FONT, fontSize: 13, alignment: 'right', margin: [0, 2, 0, 2],
  }));
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
  const dir  = block.direction || 'rtl';
  const font = dir === 'ltr' ? LATIN_FONT : ARABIC_FONT;
  return {
    text:      stripHtml(block.content || ''),
    font,
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
  const name   = doc.headerRight || doc.name || '';
  const showPN = doc.showPageNumber !== false;
  const pos    = showPN ? (doc.pageNumberPosition || 'header-right') : 'none';
  return function(currentPage) {
    const l = pos === 'header-left'  ? String(currentPage) : '';
    const r = pos === 'header-right' ? String(currentPage) : name;
    return {
      columns: [
        { text: l, font: ARABIC_FONT, fontSize: 9, color: '#555', alignment: 'left'  },
        { text: r, font: ARABIC_FONT, fontSize: 9, color: '#555', alignment: 'right' },
      ],
      margin: [57, 15, 57, 0],
    };
  };
}

function makeFooter(doc) {
  const showPN   = doc.showPageNumber !== false;
  const pos      = showPN ? (doc.pageNumberPosition || 'header-right') : 'none';
  const hairline = doc.footerHairline !== false;
  const center   = doc.footerCenter || '';
  return function(currentPage) {
    const ct = pos === 'footer-center' ? String(currentPage) : center;
    const stack = [];
    if (hairline) {
      stack.push({ canvas: [{ type: 'line', x1: 57, y1: 0, x2: 481, y2: 0, lineWidth: 0.4, lineColor: '#000' }], margin: [0, 0, 0, 3] });
    }
    stack.push({ text: ct, font: ARABIC_FONT, fontSize: 9, color: '#555', alignment: 'center' });
    return { stack, margin: [0, 8, 0, 0] };
  };
}

// ─────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────
async function generatePDF(doc) {
  if (!printer || !ARABIC_FONT) {
    throw new Error('[PDF] No fonts loaded — check server logs for font extraction errors.');
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
      console.error('[PDF] createPdfKitDocument error:', err.message);
      reject(err);
    }
  });
}

module.exports = { generatePDF };
