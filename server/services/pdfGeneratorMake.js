'use strict';

/**
 * Production-safe PDF generator using pdfmake (no Puppeteer / no Chrome).
 * Replaces pdfGenerator.js for the /api/tools/text-to-pdf/generate route.
 *
 * Fonts used:
 *   Amiri   (@fontsource/amiri)  — Arabic Naskh; covers Arabic + Urdu scripts
 *   Roboto  (@fontsource/roboto) — Latin; used for LTR / English free_text blocks
 *
 * Block types supported (identical to editor block structure):
 *   chapter_heading | hadith | fiqh | reference | verse | free_text
 */

const PdfPrinter = require('pdfmake/src/printer');
const path       = require('path');
const fs         = require('fs');

// ─────────────────────────────────────────────────────────────────
// Font resolution
// @fontsource packages install woff2 files into node_modules.
// pdfmake's PdfPrinter (server-side) reads font files from disk via
// fontkit, which natively supports woff2 format.
// ─────────────────────────────────────────────────────────────────
const nm = (...p) => path.join(__dirname, '../../node_modules', ...p);

function pick(...candidates) {
  for (const f of candidates) {
    if (f && fs.existsSync(f)) return f;
  }
  return null;
}

const amiriArabicRegular = pick(
  nm('@fontsource/amiri/files/amiri-arabic-400-normal.woff2'),
  nm('@fontsource/amiri/files/amiri-arabic-400-normal.woff')
);
const amiriArabicBold = pick(
  nm('@fontsource/amiri/files/amiri-arabic-700-normal.woff2'),
  nm('@fontsource/amiri/files/amiri-arabic-700-normal.woff'),
  amiriArabicRegular
);
const robotoRegular = pick(
  nm('@fontsource/roboto/files/roboto-latin-400-normal.woff2'),
  nm('@fontsource/roboto/files/roboto-latin-400-normal.woff')
);
const robotoBold = pick(
  nm('@fontsource/roboto/files/roboto-latin-700-normal.woff2'),
  nm('@fontsource/roboto/files/roboto-latin-700-normal.woff'),
  robotoRegular
);
const robotoItalic = pick(
  nm('@fontsource/roboto/files/roboto-latin-400-italic.woff2'),
  nm('@fontsource/roboto/files/roboto-latin-400-italic.woff'),
  robotoRegular
);

if (!amiriArabicRegular) {
  console.warn('[PDF] @fontsource/amiri not found — Arabic/Urdu text will be unstyled. Run: npm install @fontsource/amiri');
}
if (!robotoRegular) {
  console.warn('[PDF] @fontsource/roboto not found — English text will use Amiri fallback. Run: npm install @fontsource/roboto');
}

console.log('[PDF] Amiri font:', amiriArabicRegular || '(missing)');
console.log('[PDF] Roboto font:', robotoRegular    || '(missing)');

// Build font descriptor — use Amiri as universal fallback if Roboto missing
const fontDescriptors = {};

if (amiriArabicRegular) {
  fontDescriptors.Amiri = {
    normal: amiriArabicRegular,
    bold:   amiriArabicBold || amiriArabicRegular,
  };
}

if (robotoRegular) {
  fontDescriptors.Roboto = {
    normal:      robotoRegular,
    bold:        robotoBold   || robotoRegular,
    italics:     robotoItalic || robotoRegular,
    bolditalics: robotoBold   || robotoRegular,
  };
}

// Always need at least one font registered
if (Object.keys(fontDescriptors).length === 0) {
  throw new Error('[PDF] No fonts available. Install @fontsource/amiri and @fontsource/roboto.');
}

const ARABIC_FONT = fontDescriptors.Amiri  ? 'Amiri'  : 'Roboto';
const LATIN_FONT  = fontDescriptors.Roboto ? 'Roboto' : ARABIC_FONT;

const printer = new PdfPrinter(fontDescriptors);

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
const CIRCLED = ['❶','❷','❸','❹','❺','❻','❼','❽','❾','❿'];

// Strip HTML tags from rich-text content fields.
// free_text blocks store editor HTML; pdfmake works with plain text.
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

// Resolve pdfmake alignment from CSS text-align value
function pdfAlign(textAlign, direction) {
  if (textAlign === 'center')  return 'center';
  if (textAlign === 'left')    return 'left';
  if (textAlign === 'justify') return 'justify';
  if (textAlign === 'right')   return 'right';
  return direction === 'ltr' ? 'justify' : 'right';
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
      pageBreak: nodes.length === 0 ? undefined : 'before',
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
  const urdu   = (block.urduTranslation || '').trim();

  // Two-column layout: Urdu on left, Arabic on right (mirrors RTL HTML table)
  return {
    table: {
      widths: ['50%', '50%'],
      body: [[
        {
          text:      urdu,
          font:      ARABIC_FONT,
          fontSize:  13,
          alignment: 'right',
          margin:    [4, 4, 8, 8],
        },
        {
          text:      arabic,
          font:      ARABIC_FONT,
          fontSize:  13,
          alignment: 'right',
          margin:    [8, 4, 4, 8],
        },
      ]],
    },
    layout:  'noBorders',
    margin:  [0, 14, 0, 0],
  };
}

function renderFiqh(block) {
  const heading = block.heading || 'فقہ الحدیث:';
  const points  = block.points  || [];
  const nodes   = [
    {
      text:      heading,
      font:      ARABIC_FONT,
      fontSize:  15,
      bold:      true,
      alignment: 'right',
      margin:    [0, 8, 0, 4],
    },
  ];
  points.forEach((pt, i) => {
    nodes.push({
      text:      `${CIRCLED[i] || `(${i + 1})`} ${pt}`,
      font:      ARABIC_FONT,
      fontSize:  13,
      alignment: 'right',
      margin:    [0, 2, 0, 2],
    });
  });
  return nodes;
}

function renderReference(block) {
  if (!block.content?.trim()) return [];
  // A short hairline above the citation (drawn from right edge inward ~150pt)
  return [
    {
      canvas: [{
        type:      'line',
        x1: 330, y1: 0,
        x2: 481, y2: 0,
        lineWidth:  0.8,
        lineColor: '#555',
      }],
      margin: [0, 8, 0, 3],
    },
    {
      text:      block.content,
      font:      ARABIC_FONT,
      fontSize:  10,
      alignment: 'right',
      color:     '#333',
      margin:    [0, 0, 0, 6],
    },
  ];
}

function renderVerse(block) {
  const nodes = [];
  if (block.arabicText) {
    nodes.push({
      text:      block.arabicText,
      font:      ARABIC_FONT,
      fontSize:  14,
      alignment: 'center',
      margin:    [0, 10, 0, block.urduText ? 4 : 10],
    });
  }
  if (block.urduText) {
    nodes.push({
      text:      block.urduText,
      font:      ARABIC_FONT,
      fontSize:  14,
      alignment: 'center',
      margin:    [0, 0, 0, 10],
    });
  }
  return nodes;
}

function renderFreeText(block) {
  const dir       = block.direction || 'rtl';
  const font      = dir === 'ltr' ? LATIN_FONT : ARABIC_FONT;
  const alignment = pdfAlign(block.textAlign, dir);
  const fontSize  = Number(block.fontSize) || 13;
  const text      = stripHtml(block.content || '');

  return {
    text,
    font,
    fontSize,
    alignment,
    margin: [0, 4, 0, 4],
  };
}

// ─────────────────────────────────────────────────────────────────
// Document content assembler
// ─────────────────────────────────────────────────────────────────
function buildContent(blocks) {
  const content = [];
  for (const block of (blocks || [])) {
    let rendered;
    switch (block.type) {
      case 'chapter_heading': rendered = renderChapterHeading(block); break;
      case 'hadith':          rendered = renderHadith(block);         break;
      case 'fiqh':            rendered = renderFiqh(block);           break;
      case 'reference':       rendered = renderReference(block);      break;
      case 'verse':           rendered = renderVerse(block);          break;
      default:                rendered = renderFreeText(block);       break;
    }
    if (Array.isArray(rendered)) content.push(...rendered);
    else if (rendered)           content.push(rendered);
  }
  return content;
}

// ─────────────────────────────────────────────────────────────────
// Header / footer — mirrors buildHeaderTemplate / buildFooterTemplate
// in pdfGenerator.js, translated to pdfmake API
// ─────────────────────────────────────────────────────────────────
function makeHeader(doc) {
  const name   = doc.headerRight || doc.name || '';
  const showPN = doc.showPageNumber !== false;
  const pos    = showPN ? (doc.pageNumberPosition || 'header-right') : 'none';

  return function(currentPage) {
    const leftText  = pos === 'header-left'  ? String(currentPage) : '';
    const rightText = pos === 'header-right' ? String(currentPage) : name;
    return {
      columns: [
        { text: leftText,  font: ARABIC_FONT, fontSize: 9, color: '#555', alignment: 'left'  },
        { text: rightText, font: ARABIC_FONT, fontSize: 9, color: '#555', alignment: 'right' },
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
    const centerText = pos === 'footer-center' ? String(currentPage) : center;
    const stack = [];
    if (hairline) {
      stack.push({
        canvas: [{
          type: 'line', x1: 57, y1: 0, x2: 481, y2: 0,
          lineWidth: 0.4, lineColor: '#000',
        }],
        margin: [0, 0, 0, 3],
      });
    }
    stack.push({
      text:      centerText,
      font:      ARABIC_FONT,
      fontSize:  9,
      color:     '#555',
      alignment: 'center',
    });
    return { stack, margin: [0, 8, 0, 0] };
  };
}

// ─────────────────────────────────────────────────────────────────
// Main export — same signature as pdfGenerator.js generatePDF()
// Returns a Buffer containing the PDF binary.
// ─────────────────────────────────────────────────────────────────
async function generatePDF(doc) {
  console.time('[PDF] pdfmake total');
  console.log('[PDF] blocks:', doc.blocks?.length ?? 0);

  const content = buildContent(doc.blocks || []);

  const docDefinition = {
    pageSize:    'A4',
    // Margins in pt: left=57(2cm), top=71(2.5cm), right=57(2cm), bottom=71(2.5cm)
    pageMargins: [57, 71, 57, 71],

    defaultStyle: {
      font:     ARABIC_FONT,
      fontSize: 13,
    },

    header: makeHeader(doc),
    footer: makeFooter(doc),
    content,
  };

  return new Promise((resolve, reject) => {
    try {
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      const chunks = [];
      pdfDoc.on('data',  (chunk) => chunks.push(chunk));
      pdfDoc.on('end',   () => {
        const buf = Buffer.concat(chunks);
        console.timeEnd('[PDF] pdfmake total');
        console.log('[PDF] done, bytes:', buf.length);
        resolve(buf);
      });
      pdfDoc.on('error', (err) => {
        console.error('[PDF] pdfmake stream error:', err.message);
        reject(err);
      });
      pdfDoc.end();
    } catch (err) {
      console.error('[PDF] pdfmake build error:', err.message);
      reject(err);
    }
  });
}

module.exports = { generatePDF };
