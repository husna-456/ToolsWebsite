'use strict';

/**
 * Production PDF generator for Text-to-PDF tool.
 * Target: Hostinger Business Plan Node.js shared hosting.
 *
 * Font strategy (TTF only — no woff2, no WebAssembly):
 *
 * Roboto (Latin):
 *   1. @expo-google-fonts/roboto TTF files (installed via npm)
 *   2. server/fonts/Roboto-*.ttf (downloaded by download-fonts.js during deploy)
 *   3. VFS extraction: runs pdfmake/build/vfs_fonts.js inside a Node.js vm
 *      sandbox, intercepting its require('pdfmake/build/pdfmake') to avoid
 *      loading browser globals. Writes extracted TTF to server/fonts/_cache/.
 *
 * Amiri (Arabic/Urdu):
 *   1. @expo-google-fonts/amiri TTF files (installed via npm — FIRST, most reliable)
 *   2. server/fonts/Amiri-*.ttf (downloaded by download-fonts.js during deploy)
 *
 * Resilience:
 *   - Each block rendered inside independent try/catch. Bad block = skip + log.
 *   - All block fields coerced to strings. Null/undefined never reaches pdfmake.
 *   - No Enclosed Alphanumeric Unicode (❶❷❸ U+2776+). Amiri has no glyphs
 *     for them. (1)(2)(3) ASCII used instead.
 */

const PdfPrinter = require('pdfmake/src/printer');
const path = require('path');
const fs   = require('fs');
const vm   = require('vm');

const FONTS_DIR    = path.join(__dirname, '../fonts');
const CACHE_DIR    = path.join(__dirname, '../fonts/_cache');
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
// Roboto resolution
// ─────────────────────────────────────────────────────────────────

const ROBOTO_SPECS = [
  {
    key: 'normal',
    vfsKey: 'Roboto-Regular.ttf',
    paths: [
      path.join(NODE_MODULES, '@expo-google-fonts/roboto/Roboto_400Regular.ttf'),
      path.join(FONTS_DIR,    'Roboto-Regular.ttf'),
      path.join(CACHE_DIR,    'Roboto-Regular.ttf'),
    ],
  },
  {
    key: 'bold',
    vfsKey: 'Roboto-Medium.ttf',
    paths: [
      path.join(NODE_MODULES, '@expo-google-fonts/roboto/Roboto_700Bold.ttf'),
      path.join(FONTS_DIR,    'Roboto-Medium.ttf'),
      path.join(CACHE_DIR,    'Roboto-Medium.ttf'),
    ],
  },
  {
    key: 'italics',
    vfsKey: 'Roboto-Italic.ttf',
    paths: [
      path.join(NODE_MODULES, '@expo-google-fonts/roboto/Roboto_400Regular_Italic.ttf'),
      path.join(FONTS_DIR,    'Roboto-Italic.ttf'),
      path.join(CACHE_DIR,    'Roboto-Italic.ttf'),
    ],
  },
  {
    key: 'bolditalics',
    vfsKey: 'Roboto-MediumItalic.ttf',
    paths: [
      path.join(NODE_MODULES, '@expo-google-fonts/roboto/Roboto_700Bold_Italic.ttf'),
      path.join(FONTS_DIR,    'Roboto-MediumItalic.ttf'),
      path.join(CACHE_DIR,    'Roboto-MediumItalic.ttf'),
    ],
  },
];

function resolveRoboto() {
  const result   = {};
  let normalPath = null;

  for (const spec of ROBOTO_SPECS) {
    const found = spec.paths.find(fileOk)
      || extractFromVFS(spec.vfsKey, path.join(CACHE_DIR, spec.vfsKey));

    if (spec.key === 'normal') {
      if (!found) {
        console.error('[PDF][FONT] Roboto normal NOT FOUND. Paths checked:', spec.paths.join(', '));
        return null;
      }
      normalPath = found;
    }
    result[spec.key] = found || normalPath;
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────
// Amiri resolution — npm package path FIRST
// ─────────────────────────────────────────────────────────────────

const AMIRI_NORMAL_CANDIDATES = [
  path.join(NODE_MODULES, '@expo-google-fonts/amiri/Amiri_400Regular.ttf'),
  path.join(FONTS_DIR,    'Amiri-Regular.ttf'),
  path.join(FONTS_DIR,    'Amiri_400Regular.ttf'),
];
const AMIRI_BOLD_CANDIDATES = [
  path.join(NODE_MODULES, '@expo-google-fonts/amiri/Amiri_700Bold.ttf'),
  path.join(FONTS_DIR,    'Amiri-Bold.ttf'),
  path.join(FONTS_DIR,    'Amiri_700Bold.ttf'),
];

function resolveAmiri() {
  const normal = AMIRI_NORMAL_CANDIDATES.find(fileOk) || null;
  if (!normal) {
    console.error('[PDF][FONT] Amiri NOT FOUND. Paths checked:', AMIRI_NORMAL_CANDIDATES.join(', '));
    return null;
  }
  return { normal, bold: AMIRI_BOLD_CANDIDATES.find(fileOk) || normal };
}

// ─────────────────────────────────────────────────────────────────
// Build font descriptor map — called fresh on every request
// ─────────────────────────────────────────────────────────────────

function buildFontDescriptors() {
  const desc   = {};
  const roboto = resolveRoboto();
  const amiri  = resolveAmiri();
  if (roboto) { desc.Roboto = roboto; console.log('[PDF][FONT] Roboto ok:', roboto.normal); }
  if (amiri)  { desc.Amiri  = { normal: amiri.normal, bold: amiri.bold }; console.log('[PDF][FONT] Amiri ok:', amiri.normal); }
  return desc;
}

// ─────────────────────────────────────────────────────────────────
// Block renderers
// ─────────────────────────────────────────────────────────────────

function renderChapterHeading(block, AF) {
  const nodes       = [];
  const arabicTitle  = safeStr(block.arabicTitle);
  const urduSubtitle = safeStr(block.urduSubtitle);
  if (arabicTitle)  nodes.push({ text: arabicTitle,  font: AF, fontSize: 22, bold: true, alignment: 'center', margin: [0, 20, 0, urduSubtitle ? 4 : 14] });
  if (urduSubtitle) nodes.push({ text: urduSubtitle, font: AF, fontSize: 17, bold: true, alignment: 'center', margin: [0, 0, 0, 14] });
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
  const nodes   = [{ text: heading, font: AF, fontSize: 15, bold: true, alignment: 'right', margin: [0, 8, 0, 4] }];
  const points  = Array.isArray(block.points) ? block.points : [];
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
  const nodes      = [];
  const arabicText  = safeStr(block.arabicText);
  const urduText    = safeStr(block.urduText);
  if (arabicText) nodes.push({ text: arabicText, font: AF, fontSize: 14, alignment: 'center', margin: [0, 10, 0, urduText ? 4 : 10] });
  if (urduText)   nodes.push({ text: urduText,   font: AF, fontSize: 14, alignment: 'center', margin: [0, 0, 0, 10] });
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

function buildContent(blocks, AF, LF) {
  const content    = [];
  const safeBlocks = Array.isArray(blocks) ? blocks : [];

  for (let i = 0; i < safeBlocks.length; i++) {
    const block = safeBlocks[i];
    if (!block || typeof block !== 'object') continue;
    try {
      const type = safeStr(block.type) || 'free_text';
      let r;
      switch (type) {
        case 'chapter_heading': r = renderChapterHeading(block, AF); break;
        case 'hadith':          r = renderHadith(block, AF);         break;
        case 'fiqh':            r = renderFiqh(block, AF);           break;
        case 'reference':       r = renderReference(block, AF);      break;
        case 'verse':           r = renderVerse(block, AF);          break;
        default:                r = renderFreeText(block, AF, LF);   break;
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
      const ct    = pos === 'footer-center' ? String(pg) : center;
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
      '[PDF] Amiri font not found. Checked: ' + AMIRI_NORMAL_CANDIDATES.join(', ')
    );
  }
  if (!desc.Roboto) {
    throw new Error(
      '[PDF] Roboto font not found (VFS extraction also failed). ' +
      'Checked: ' + ROBOTO_SPECS[0].paths.join(', ')
    );
  }

  const AF         = 'Amiri';
  const LF         = 'Roboto';
  const blockCount = Array.isArray(doc.blocks) ? doc.blocks.length : 0;

  console.time('[PDF] generate');
  console.log(`[PDF] start: fonts=[${Object.keys(desc).join(',')}] blocks=${blockCount}`);

  const printer = new PdfPrinter(desc);
  const docDef  = {
    pageSize:     'A4',
    pageMargins:  [57, 71, 57, 71],
    defaultStyle: { font: AF, fontSize: 13 },
    header:  makeHeader(doc, AF),
    footer:  makeFooter(doc, AF),
    content: buildContent(doc.blocks || [], AF, LF),
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

module.exports = { generatePDF };
