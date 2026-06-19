'use strict';

/**
 * Production-safe PDF generator using pdfmake (no Puppeteer / no Chrome).
 *
 * Font strategy:
 *   1. Roboto — always available, bundled inside pdfmake/build/vfs_fonts.js
 *   2. Amiri  — Arabic/Urdu Naskh; loaded from (in priority order):
 *        a. server/fonts/  (downloaded by server/scripts/download-fonts.js)
 *        b. node_modules/@fontsource/amiri/files/  (if package installed)
 *      Falls back gracefully to Roboto if Amiri is not found — PDF still
 *      generates, Arabic text is rendered as fallback glyphs rather than crash.
 *
 * This module uses pdfmake's UMD browser build (pdfmake/build/pdfmake) which
 * runs fine in Node.js and exposes getBuffer(cb) for server-side rendering.
 * Fonts are injected into pdfmake's virtual file system (vfs) — no disk paths
 * needed at runtime beyond what's already in node_modules/pdfmake.
 */

const pdfMake  = require('pdfmake/build/pdfmake');
const pdfFonts = require('pdfmake/build/vfs_fonts');
const path     = require('path');
const fs       = require('fs');

// ─────────────────────────────────────────────────────────────────
// Boot pdfmake with its built-in Roboto VFS — always succeeds
// ─────────────────────────────────────────────────────────────────
pdfMake.vfs = { ...(pdfFonts.pdfMake?.vfs || {}) };

// ─────────────────────────────────────────────────────────────────
// Amiri font loading (Arabic/Urdu)
// ─────────────────────────────────────────────────────────────────
const FONTS_DIR   = path.join(__dirname, '../fonts');
const FONTSOURCE  = path.join(__dirname, '../node_modules/@fontsource/amiri/files');

function readBase64(...candidates) {
  for (const p of candidates) {
    try {
      if (p && fs.existsSync(p)) return fs.readFileSync(p).toString('base64');
    } catch (_) {}
  }
  return null;
}

const amiriNormalB64 = readBase64(
  path.join(FONTS_DIR,  'Amiri-Regular.woff2'),
  path.join(FONTSOURCE, 'amiri-arabic-400-normal.woff2'),
  path.join(FONTSOURCE, 'amiri-arabic-400-normal.woff'),
);
const amiriBoldB64 = readBase64(
  path.join(FONTS_DIR,  'Amiri-Bold.woff2'),
  path.join(FONTSOURCE, 'amiri-arabic-700-normal.woff2'),
  path.join(FONTSOURCE, 'amiri-arabic-700-normal.woff'),
) || amiriNormalB64;

const HAS_AMIRI = !!amiriNormalB64;

if (HAS_AMIRI) {
  pdfMake.vfs['Amiri-Regular.woff2'] = amiriNormalB64;
  pdfMake.vfs['Amiri-Bold.woff2']    = amiriBoldB64 || amiriNormalB64;
  console.log('[PDF] Amiri Arabic font loaded into VFS.');
} else {
  console.warn('[PDF] Amiri font not found — Arabic/Urdu text will use Roboto fallback.');
  console.warn('[PDF] Run: cd server && node scripts/download-fonts.js');
}

// ─────────────────────────────────────────────────────────────────
// Font definitions passed to every createPdf() call
// ─────────────────────────────────────────────────────────────────
const FONT_DEFS = {
  Roboto: {
    normal:      'Roboto-Regular.ttf',
    bold:        'Roboto-Medium.ttf',
    italics:     'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  },
};
if (HAS_AMIRI) {
  FONT_DEFS.Amiri = {
    normal: 'Amiri-Regular.woff2',
    bold:   'Amiri-Bold.woff2',
  };
}

const ARABIC_FONT = HAS_AMIRI ? 'Amiri'  : 'Roboto';
const LATIN_FONT  = 'Roboto';

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
// Block renderers → pdfmake content nodes
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
  console.time('[PDF] pdfmake total');
  console.log('[PDF] blocks:', doc.blocks?.length ?? 0, '| arabic font:', ARABIC_FONT);

  const docDefinition = {
    pageSize:    'A4',
    pageMargins: [57, 71, 57, 71],
    defaultStyle: { font: ARABIC_FONT, fontSize: 13 },
    fonts:  FONT_DEFS,
    header: makeHeader(doc),
    footer: makeFooter(doc),
    content: buildContent(doc.blocks || []),
  };

  return new Promise((resolve, reject) => {
    try {
      pdfMake.createPdf(docDefinition).getBuffer((buf) => {
        console.timeEnd('[PDF] pdfmake total');
        console.log('[PDF] done, bytes:', buf.length);
        resolve(buf);
      });
    } catch (err) {
      console.error('[PDF] pdfmake error:', err.message);
      reject(err);
    }
  });
}

module.exports = { generatePDF };
