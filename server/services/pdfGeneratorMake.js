'use strict';

/**
 * Production PDF generator — pdfmake/src/printer (Node.js server API).
 *
 * Font strategy: TTF ONLY. woff2 requires WebAssembly (wawoff2) which
 * hangs on Hostinger shared hosting. TTF is parsed natively by fontkit.
 *
 * Roboto: extracted at startup from pdfmake's bundled VFS (always TTF).
 * Amiri:  downloaded as TTF by server/scripts/download-fonts.js.
 *         Falls back to Roboto if TTF file is absent — PDF still generates.
 *
 * A fresh PdfPrinter is created per request with only files that exist at
 * that moment, avoiding ENOENT surprises from stale module-level state.
 */

const PdfPrinter = require('pdfmake/src/printer');
const path = require('path');
const fs   = require('fs');
const os   = require('os');

const FONTS_DIR = path.join(__dirname, '../fonts');
const CACHE_DIR = path.join(__dirname, '../fonts/_cache');

// ─────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────
function fileOk(p) {
  try { return !!p && fs.existsSync(p) && fs.statSync(p).size > 1000; } catch (_) { return false; }
}

function tryWrite(dest, buf) {
  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    return fileOk(dest);
  } catch (_) { return false; }
}

// ─────────────────────────────────────────────────────────────────
// Roboto — extracted ONCE from pdfmake's VFS as TTF
// Tries os.tmpdir() first (most reliably writable on shared hosting),
// then server/fonts/_cache/ as fallback.
// ─────────────────────────────────────────────────────────────────
function extractRobotoTTF(filename) {
  const candidates = [
    path.join(os.tmpdir(), '_pdfm_' + filename),
    path.join(CACHE_DIR,  filename),
  ];
  const hit = candidates.find(fileOk);
  if (hit) return hit;

  let b64;
  try {
    const vfsMod = require('pdfmake/build/vfs_fonts');
    const vfs = vfsMod?.pdfMake?.vfs || vfsMod?.vfs || {};
    b64 = vfs[filename];
  } catch (e) {
    console.error('[PDF] vfs_fonts load error:', e.message);
    return null;
  }
  if (!b64) { console.error('[PDF] VFS missing key:', filename); return null; }

  const buf = Buffer.from(b64, 'base64');
  for (const dest of candidates) {
    if (tryWrite(dest, buf)) { return dest; }
  }
  console.error('[PDF] Cannot write', filename, 'to any path');
  return null;
}

const ROBOTO_NORMAL      = extractRobotoTTF('Roboto-Regular.ttf');
const ROBOTO_BOLD        = extractRobotoTTF('Roboto-Medium.ttf')       || ROBOTO_NORMAL;
const ROBOTO_ITALIC      = extractRobotoTTF('Roboto-Italic.ttf')        || ROBOTO_NORMAL;
const ROBOTO_BOLDITALIC  = extractRobotoTTF('Roboto-MediumItalic.ttf') || ROBOTO_NORMAL;

console.log('[PDF] Roboto:', ROBOTO_NORMAL || 'NOT FOUND');

// ─────────────────────────────────────────────────────────────────
// Amiri candidates — checked fresh on every request (not cached)
// ─────────────────────────────────────────────────────────────────
const AMIRI_NORMAL_CANDIDATES = [
  path.join(FONTS_DIR, 'Amiri-Regular.ttf'),
  path.join(FONTS_DIR, 'Amiri_400Regular.ttf'),
];
const AMIRI_BOLD_CANDIDATES = [
  path.join(FONTS_DIR, 'Amiri-Bold.ttf'),
  path.join(FONTS_DIR, 'Amiri_700Bold.ttf'),
];

function resolveAmiri() {
  const normal = AMIRI_NORMAL_CANDIDATES.find(fileOk) || null;
  if (!normal) return null;
  const bold = AMIRI_BOLD_CANDIDATES.find(fileOk) || normal;
  return { normal, bold };
}

// ─────────────────────────────────────────────────────────────────
// Build a verified font descriptor map for THIS request.
// Every file path is confirmed to exist right now — no stale state.
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
  }

  return desc;
}

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
// Block renderers — receive ARABIC_FONT / LATIN_FONT per-request
// ─────────────────────────────────────────────────────────────────
function renderChapterHeading(block, AF) {
  const nodes = [];
  if (block.arabicTitle)  nodes.push({ text: block.arabicTitle,  font: AF, fontSize: 22, bold: true, alignment: 'center', margin: [0, 20, 0, block.urduSubtitle ? 4 : 14] });
  if (block.urduSubtitle) nodes.push({ text: block.urduSubtitle, font: AF, fontSize: 17, bold: true, alignment: 'center', margin: [0, 0, 0, 14] });
  return nodes;
}

function renderHadith(block, AF) {
  const num    = block.number ? `﴿${block.number}﴾ ` : '';
  const arabic = (num + (block.arabicMatn || '')).trim();
  const urdu   = (block.urduTranslation  || '').trim();
  return {
    table: { widths: ['50%', '50%'], body: [[
      { text: urdu,   font: AF, fontSize: 13, alignment: 'right', margin: [4, 4, 8, 8] },
      { text: arabic, font: AF, fontSize: 13, alignment: 'right', margin: [8, 4, 4, 8] },
    ]] },
    layout: 'noBorders',
    margin: [0, 14, 0, 0],
  };
}

function renderFiqh(block, AF) {
  const nodes = [{ text: block.heading || 'فقہ الحدیث:', font: AF, fontSize: 15, bold: true, alignment: 'right', margin: [0, 8, 0, 4] }];
  (block.points || []).forEach((pt, i) => nodes.push({ text: `${CIRCLED[i] || `(${i + 1})`} ${pt}`, font: AF, fontSize: 13, alignment: 'right', margin: [0, 2, 0, 2] }));
  return nodes;
}

function renderReference(block, AF) {
  if (!block.content?.trim()) return [];
  return [
    { canvas: [{ type: 'line', x1: 330, y1: 0, x2: 481, y2: 0, lineWidth: 0.8, lineColor: '#555' }], margin: [0, 8, 0, 3] },
    { text: block.content, font: AF, fontSize: 10, alignment: 'right', color: '#333', margin: [0, 0, 0, 6] },
  ];
}

function renderVerse(block, AF) {
  const nodes = [];
  if (block.arabicText) nodes.push({ text: block.arabicText, font: AF, fontSize: 14, alignment: 'center', margin: [0, 10, 0, block.urduText ? 4 : 10] });
  if (block.urduText)   nodes.push({ text: block.urduText,   font: AF, fontSize: 14, alignment: 'center', margin: [0, 0, 0, 10] });
  return nodes;
}

function renderFreeText(block, AF, LF) {
  const dir = block.direction || 'rtl';
  return {
    text:      stripHtml(block.content || ''),
    font:      dir === 'ltr' ? LF : AF,
    fontSize:  Number(block.fontSize) || 13,
    alignment: pdfAlign(block.textAlign, dir),
    margin:    [0, 4, 0, 4],
  };
}

function buildContent(blocks, AF, LF) {
  const content = [];
  for (const block of (blocks || [])) {
    let r;
    switch (block.type) {
      case 'chapter_heading': r = renderChapterHeading(block, AF);     break;
      case 'hadith':          r = renderHadith(block, AF);             break;
      case 'fiqh':            r = renderFiqh(block, AF);               break;
      case 'reference':       r = renderReference(block, AF);          break;
      case 'verse':           r = renderVerse(block, AF);              break;
      default:                r = renderFreeText(block, AF, LF);       break;
    }
    if (Array.isArray(r)) content.push(...r);
    else if (r)           content.push(r);
  }
  return content;
}

function makeHeader(doc, AF) {
  const name = doc.headerRight || doc.name || '';
  const pos  = doc.showPageNumber !== false ? (doc.pageNumberPosition || 'header-right') : 'none';
  return (pg) => ({
    columns: [
      { text: pos === 'header-left'  ? String(pg) : '',   font: AF, fontSize: 9, color: '#555', alignment: 'left'  },
      { text: pos === 'header-right' ? String(pg) : name, font: AF, fontSize: 9, color: '#555', alignment: 'right' },
    ],
    margin: [57, 15, 57, 0],
  });
}

function makeFooter(doc, AF) {
  const pos      = doc.showPageNumber !== false ? (doc.pageNumberPosition || 'header-right') : 'none';
  const hairline = doc.footerHairline !== false;
  const center   = doc.footerCenter || '';
  return (pg) => {
    const ct = pos === 'footer-center' ? String(pg) : center;
    const stack = [];
    if (hairline) stack.push({ canvas: [{ type: 'line', x1: 57, y1: 0, x2: 481, y2: 0, lineWidth: 0.4, lineColor: '#000' }], margin: [0, 0, 0, 3] });
    stack.push({ text: ct, font: AF, fontSize: 9, color: '#555', alignment: 'center' });
    return { stack, margin: [0, 8, 0, 0] };
  };
}

// ─────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────
async function generatePDF(doc) {
  // Build and verify font descriptors fresh for every request.
  // This prevents ENOENT from fontkit when stale module-level paths are used.
  const desc = buildFontDescriptors();

  const AF = desc.Amiri  ? 'Amiri'  : (desc.Roboto ? 'Roboto' : null);
  const LF = desc.Roboto ? 'Roboto' : AF;

  if (!AF) {
    throw new Error('[PDF] No fonts available. Check server logs for font extraction errors.');
  }

  console.time('[PDF] generate');
  console.log('[PDF] fonts:', Object.keys(desc), '| ARABIC:', AF, '| LATIN:', LF, '| blocks:', doc.blocks?.length ?? 0);

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
