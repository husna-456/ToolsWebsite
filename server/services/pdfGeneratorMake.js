'use strict';

/**
 * Production PDF generator for Text-to-PDF tool.
 * Target: Hostinger Business Plan Node.js shared hosting.
 *
 * Font strategy — TTF files from npm packages only (no VFS extraction):
 *  - Roboto: pdfmake ships TTF files in its own package under examples/fonts/.
 *            Fallback: @expo-google-fonts/roboto (added to package.json).
 *  - Amiri:  @expo-google-fonts/amiri ships TTF files (guaranteed by npm install).
 *            Fallback: downloaded files in server/fonts/.
 *
 * No woff2, no VFS extraction, no tmpdir writes, no WebAssembly (wawoff2).
 *
 * Resilience:
 *  - Each block is wrapped in an independent try/catch.
 *  - All block fields are coerced to strings before use.
 *  - No Unicode Enclosed Alphanumerics (❶❷❸). They crash Amiri (no glyphs).
 */

const PdfPrinter = require('pdfmake/src/printer');
const path = require('path');
const fs   = require('fs');

const FONTS_DIR    = path.join(__dirname, '../fonts');
const NODE_MODULES = path.join(__dirname, '../node_modules');

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
// Roboto font resolution — tries multiple TTF sources in order.
//
// Source 1: pdfmake/examples/fonts/ — pdfmake ships these TTF files in its
//           own npm package. No extraction, no writing, always present.
// Source 2: @expo-google-fonts/roboto — added to package.json. Ships
//           TTF files directly (same pattern as @expo-google-fonts/amiri).
// Source 3: VFS extraction fallback — try to extract from pdfmake/build/vfs_fonts
//           into server/fonts/_cache/ (last resort).
// ─────────────────────────────────────────────────────────────────

const ROBOTO_SOURCES = {
  normal: [
    path.join(NODE_MODULES, 'pdfmake/examples/fonts/Roboto-Regular.ttf'),
    path.join(NODE_MODULES, '@expo-google-fonts/roboto/Roboto_400Regular.ttf'),
    path.join(FONTS_DIR, '_cache/Roboto-Regular.ttf'),
  ],
  bold: [
    path.join(NODE_MODULES, 'pdfmake/examples/fonts/Roboto-Medium.ttf'),
    path.join(NODE_MODULES, '@expo-google-fonts/roboto/Roboto_700Bold.ttf'),
    path.join(FONTS_DIR, '_cache/Roboto-Medium.ttf'),
  ],
  italics: [
    path.join(NODE_MODULES, 'pdfmake/examples/fonts/Roboto-Italic.ttf'),
    path.join(NODE_MODULES, '@expo-google-fonts/roboto/Roboto_400Regular_Italic.ttf'),
    path.join(FONTS_DIR, '_cache/Roboto-Italic.ttf'),
  ],
  bolditalics: [
    path.join(NODE_MODULES, 'pdfmake/examples/fonts/Roboto-MediumItalic.ttf'),
    path.join(NODE_MODULES, '@expo-google-fonts/roboto/Roboto_700Bold_Italic.ttf'),
    path.join(FONTS_DIR, '_cache/Roboto-MediumItalic.ttf'),
  ],
};

function tryExtractRobotoVFS(filename, dest) {
  try {
    // In Node.js, vfs_fonts injects fonts into pdfmake/build/pdfmake as a side effect.
    // Require vfs_fonts first, then read pdfMake.vfs from the pdfmake browser build.
    require('pdfmake/build/vfs_fonts');
    const pdfmakeBuild = require('pdfmake/build/pdfmake');
    const b64 = pdfmakeBuild && pdfmakeBuild.vfs && pdfmakeBuild.vfs[filename];
    if (!b64) return null;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, Buffer.from(b64, 'base64'));
    return fileOk(dest) ? dest : null;
  } catch (_) { return null; }
}

function resolveRoboto() {
  const VFS_NAMES = {
    normal:      'Roboto-Regular.ttf',
    bold:        'Roboto-Medium.ttf',
    italics:     'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  };

  // Find normal font — required; all others can fall back to normal.
  const normalPath = ROBOTO_SOURCES.normal.find(fileOk)
    || tryExtractRobotoVFS(VFS_NAMES.normal, path.join(FONTS_DIR, '_cache/Roboto-Regular.ttf'));

  if (!normalPath) {
    console.error('[PDF][FONT] Roboto NOT FOUND. Checked:', ROBOTO_SOURCES.normal.join(', '));
    return null;
  }

  const resolve = (candidates, vfsName) =>
    candidates.find(fileOk)
    || tryExtractRobotoVFS(vfsName, path.join(FONTS_DIR, `_cache/${vfsName}`))
    || normalPath;

  return {
    normal:      normalPath,
    bold:        resolve(ROBOTO_SOURCES.bold,        VFS_NAMES.bold),
    italics:     resolve(ROBOTO_SOURCES.italics,     VFS_NAMES.italics),
    bolditalics: resolve(ROBOTO_SOURCES.bolditalics, VFS_NAMES.bolditalics),
  };
}

// ─────────────────────────────────────────────────────────────────
// Amiri (Arabic/Urdu) font resolution.
// npm package path FIRST — guaranteed after npm install.
// ─────────────────────────────────────────────────────────────────

const AMIRI_NORMAL_CANDIDATES = [
  path.join(NODE_MODULES, '@expo-google-fonts/amiri/Amiri_400Regular.ttf'),
  path.join(FONTS_DIR, 'Amiri-Regular.ttf'),
  path.join(FONTS_DIR, 'Amiri_400Regular.ttf'),
];

const AMIRI_BOLD_CANDIDATES = [
  path.join(NODE_MODULES, '@expo-google-fonts/amiri/Amiri_700Bold.ttf'),
  path.join(FONTS_DIR, 'Amiri-Bold.ttf'),
  path.join(FONTS_DIR, 'Amiri_700Bold.ttf'),
];

function resolveAmiri() {
  const normal = AMIRI_NORMAL_CANDIDATES.find(fileOk) || null;
  if (!normal) {
    console.error('[PDF][FONT] Amiri NOT FOUND. Checked:', AMIRI_NORMAL_CANDIDATES.join(', '));
    return null;
  }
  const bold = AMIRI_BOLD_CANDIDATES.find(fileOk) || normal;
  return { normal, bold };
}

// ─────────────────────────────────────────────────────────────────
// Build verified font descriptor map — called fresh on every request.
// ─────────────────────────────────────────────────────────────────

function buildFontDescriptors() {
  const desc = {};

  const roboto = resolveRoboto();
  if (roboto) {
    desc.Roboto = roboto;
    console.log('[PDF][FONT] Roboto:', roboto.normal);
  }

  const amiri = resolveAmiri();
  if (amiri) {
    desc.Amiri = { normal: amiri.normal, bold: amiri.bold };
    console.log('[PDF][FONT] Amiri:', amiri.normal);
  }

  return desc;
}

// ─────────────────────────────────────────────────────────────────
// Block renderers — every text field coerced via safeStr().
// No Unicode Enclosed Alphanumerics (❶❷❸ U+2776+) — Amiri has no
// glyphs for them. ASCII (1)(2)(3) is used instead.
// ─────────────────────────────────────────────────────────────────

function renderChapterHeading(block, AF) {
  const nodes = [];
  const arabicTitle  = safeStr(block.arabicTitle);
  const urduSubtitle = safeStr(block.urduSubtitle);
  if (arabicTitle)  nodes.push({ text: arabicTitle,  font: AF, fontSize: 22, bold: true, alignment: 'center', margin: [0, 20, 0, urduSubtitle ? 4 : 14] });
  if (urduSubtitle) nodes.push({ text: urduSubtitle, font: AF, fontSize: 17, bold: true, alignment: 'center', margin: [0, 0,  0, 14] });
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
    nodes.push({ text: `(${i + 1}) ` + safeStr(pt), font: AF, fontSize: 13, alignment: 'right', margin: [0, 2, 0, 2] });
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
// Build content — each block is independently try/catched.
// A failing block is logged and skipped; rest of the PDF continues.
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
        case 'chapter_heading': r = renderChapterHeading(block, AF);  break;
        case 'hadith':          r = renderHadith(block, AF);          break;
        case 'fiqh':            r = renderFiqh(block, AF);            break;
        case 'reference':       r = renderReference(block, AF);       break;
        case 'verse':           r = renderVerse(block, AF);           break;
        default:                r = renderFreeText(block, AF, LF);    break;
      }
      if (Array.isArray(r)) content.push(...r.filter(Boolean));
      else if (r)           content.push(r);
    } catch (err) {
      console.error(`[PDF] Block[${i}] type=${block.type} render error (skipped):`, err.message);
    }
  }

  return content;
}

// ─────────────────────────────────────────────────────────────────
// Header / footer
// ─────────────────────────────────────────────────────────────────

function makeHeader(doc, AF) {
  const name = stripHtml(doc.headerRight || doc.name || '');
  const pos  = doc.showPageNumber !== false
    ? (safeStr(doc.pageNumberPosition) || 'header-right')
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
    ? (safeStr(doc.pageNumberPosition) || 'header-right')
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
    throw new Error(
      '[PDF] Roboto font not found. ' +
      'Ensure @expo-google-fonts/roboto is in server/package.json and run npm install. ' +
      'Checked: ' + ROBOTO_SOURCES.normal.join(', ')
    );
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
