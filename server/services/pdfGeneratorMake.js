'use strict';

/**
 * Production-safe PDF generator using pdfmake (no Puppeteer / no Chrome).
 *
 * Uses pdfmake/src/printer — the documented Node.js / server-side API.
 * Font strategy (each step is a fallback for the previous):
 *   Roboto: pdfmake's own fonts/ dir → VFS extraction to OS temp dir
 *   Amiri:  server/fonts/ (download-fonts.js) → @fontsource/amiri/files/
 *           → falls back to Roboto if unavailable (PDF still generates)
 */

const PdfPrinter = require('pdfmake/src/printer');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

// ─────────────────────────────────────────────────────────────────
// Font resolution helpers
// ─────────────────────────────────────────────────────────────────
function pickFile(...candidates) {
  for (const f of candidates) {
    try { if (f && fs.existsSync(f)) return f; } catch (_) {}
  }
  return null;
}

// Find pdfmake's installed root so we can read its bundled Roboto TTFs.
let pdfmakeRoot = null;
try {
  pdfmakeRoot = path.dirname(require.resolve('pdfmake/package.json'));
} catch (_) {
  try {
    pdfmakeRoot = path.dirname(path.dirname(require.resolve('pdfmake/src/printer')));
  } catch (_2) {}
}
const PDFMAKE_FONTS = pdfmakeRoot ? path.join(pdfmakeRoot, 'fonts') : null;

// If pdfmake ships without a fonts/ dir, extract Roboto from vfs_fonts.js.
function extractFromVFS(fontFilename) {
  const dest = path.join(os.tmpdir(), `_pdfmake_${fontFilename}`);
  if (pickFile(dest)) return dest;
  try {
    const vfs = require('pdfmake/build/vfs_fonts');
    const b64 = vfs?.pdfMake?.vfs?.[fontFilename];
    if (!b64) return null;
    fs.writeFileSync(dest, Buffer.from(b64, 'base64'));
    console.log(`[PDF] extracted ${fontFilename} from VFS → ${dest}`);
    return dest;
  } catch (e) {
    console.warn('[PDF] VFS extraction failed:', e.message);
    return null;
  }
}

// ── Roboto (Latin / English) ──────────────────────────────────────
const robotoNormal = pickFile(
  PDFMAKE_FONTS && path.join(PDFMAKE_FONTS, 'Roboto-Regular.ttf'),
) || extractFromVFS('Roboto-Regular.ttf');

const robotoBold = pickFile(
  PDFMAKE_FONTS && path.join(PDFMAKE_FONTS, 'Roboto-Medium.ttf'),
) || extractFromVFS('Roboto-Medium.ttf') || robotoNormal;

const robotoItalic = pickFile(
  PDFMAKE_FONTS && path.join(PDFMAKE_FONTS, 'Roboto-Italic.ttf'),
) || extractFromVFS('Roboto-Italic.ttf') || robotoNormal;

const robotoBoldItalic = pickFile(
  PDFMAKE_FONTS && path.join(PDFMAKE_FONTS, 'Roboto-MediumItalic.ttf'),
) || extractFromVFS('Roboto-MediumItalic.ttf') || robotoNormal;

// ── Amiri (Arabic / Urdu) ─────────────────────────────────────────
const SERVER_FONTS     = path.join(__dirname, '../fonts');
const FONTSOURCE_AMIRI = path.join(__dirname, '../node_modules/@fontsource/amiri/files');

const amiriNormal = pickFile(
  path.join(SERVER_FONTS,     'Amiri-Regular.woff2'),
  path.join(FONTSOURCE_AMIRI, 'amiri-arabic-400-normal.woff2'),
  path.join(FONTSOURCE_AMIRI, 'amiri-arabic-400-normal.woff'),
);
const amiriBold = pickFile(
  path.join(SERVER_FONTS,     'Amiri-Bold.woff2'),
  path.join(FONTSOURCE_AMIRI, 'amiri-arabic-700-normal.woff2'),
  path.join(FONTSOURCE_AMIRI, 'amiri-arabic-700-normal.woff'),
) || amiriNormal;

// ── Font diagnostics ──────────────────────────────────────────────
console.log('[PDF] Roboto:', robotoNormal || 'NOT FOUND');
console.log('[PDF] Amiri: ', amiriNormal  || 'NOT FOUND — using Roboto fallback');

if (!robotoNormal) {
  console.error('[PDF] CRITICAL: Roboto font not found. pdfmake may not be installed correctly.');
}

// ─────────────────────────────────────────────────────────────────
// Build font descriptor — omit fonts that weren't found
// ─────────────────────────────────────────────────────────────────
const fontDescriptors = {};

if (robotoNormal) {
  fontDescriptors.Roboto = {
    normal:      robotoNormal,
    bold:        robotoBold,
    italics:     robotoItalic,
    bolditalics: robotoBoldItalic,
  };
}

if (amiriNormal) {
  fontDescriptors.Amiri = {
    normal: amiriNormal,
    bold:   amiriBold || amiriNormal,
  };
}

const ARABIC_FONT = fontDescriptors.Amiri  ? 'Amiri'  : 'Roboto';
const LATIN_FONT  = fontDescriptors.Roboto ? 'Roboto' : ARABIC_FONT;

// PdfPrinter is instantiated once at module load.
// If no fonts are found at all, we create a no-op that returns an error.
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
      text:      block.arabicTitle,
      font:      ARABIC_FONT,
      fontSize:  22,
      bold:      true,
      alignment: 'center',
      margin:    [0, 20, 0, block.urduSubtitle ? 4 : 14],
    });
  }
  if (block.urduSubtitle) {
    nodes.push({
      text:      block.urduSubtitle,
      font:      ARABIC_FONT,
      fontSize:  17,
      bold:      true,
      alignment: 'center',
      margin:    [0, 0, 0, 14],
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
    text:      heading,
    font:      ARABIC_FONT,
    fontSize:  15,
    bold:      true,
    alignment: 'right',
    margin:    [0, 8, 0, 4],
  }];
  points.forEach((pt, i) => nodes.push({
    text:      `${CIRCLED[i] || `(${i + 1})`} ${pt}`,
    font:      ARABIC_FONT,
    fontSize:  13,
    alignment: 'right',
    margin:    [0, 2, 0, 2],
  }));
  return nodes;
}

function renderReference(block) {
  if (!block.content?.trim()) return [];
  return [
    {
      canvas: [{ type: 'line', x1: 330, y1: 0, x2: 481, y2: 0, lineWidth: 0.8, lineColor: '#555' }],
      margin: [0, 8, 0, 3],
    },
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
  const dir       = block.direction || 'rtl';
  const font      = dir === 'ltr' ? LATIN_FONT : ARABIC_FONT;
  const alignment = pdfAlign(block.textAlign, dir);
  return {
    text:      stripHtml(block.content || ''),
    font,
    fontSize:  Number(block.fontSize) || 13,
    alignment,
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
  if (!printer) {
    throw new Error('[PDF] No fonts available — pdfmake cannot generate PDF. Check server logs.');
  }

  console.time('[PDF] generate');
  console.log('[PDF] blocks:', doc.blocks?.length ?? 0, '| arabic:', ARABIC_FONT);

  const docDefinition = {
    pageSize:     'A4',
    pageMargins:  [57, 71, 57, 71],
    defaultStyle: { font: ARABIC_FONT, fontSize: 13 },
    header:  makeHeader(doc),
    footer:  makeFooter(doc),
    content: buildContent(doc.blocks || []),
  };

  return new Promise((resolve, reject) => {
    // 30-second hard timeout — prevents 504 gateway errors
    const timer = setTimeout(() => reject(new Error('[PDF] generation timed out')), 30000);

    try {
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const chunks = [];
      pdfDoc.on('data',  (chunk) => chunks.push(chunk));
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
      console.error('[PDF] build error:', err.message);
      reject(err);
    }
  });
}

module.exports = { generatePDF };
