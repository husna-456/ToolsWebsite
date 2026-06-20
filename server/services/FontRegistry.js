'use strict';

/**
 * FontRegistry — single source of truth for all PDF fonts.
 *
 * Auto-scans server/fonts/ for *.ttf files named {FontKey}-{Style}.ttf
 * where Style ∈ { Regular, Bold, Italic, BoldItalic }.
 *
 * Registered font keys (from committed TTF files):
 *   Arabic  : Amiri, NotoNaskhArabic, ScheherazadeNew, Cairo, Tajawal, ReemKufi, Lateef
 *   Urdu    : NotoNastaliqUrdu  (used for "Jameel Noori Nastaleeq" — no free JNN TTF)
 *   Latin   : Roboto, OpenSans, Lato, Poppins, Inter, Montserrat,
 *             Merriweather, Lora, PlayfairDisplay, EBGaramond
 *
 * Editor font name → registry key:
 *   Exact Google Font names map 1-to-1 (e.g. "Noto Naskh Arabic" → NotoNaskhArabic).
 *   System fonts (Times New Roman, Arial, Georgia…) map to nearest free equivalent.
 *   "Jameel Noori Nastaleeq" maps to NotoNastaliqUrdu (nearest free Nastaleeq TTF).
 *
 * Singleton: getFontData() loads fonts once at first call and caches forever.
 */

const path = require('path');
const fs   = require('fs');
const vm   = require('vm');

const FONTS_DIR = path.join(__dirname, '../fonts');
const CACHE_DIR = path.join(__dirname, '../fonts/_cache');

// ── Style suffix → pdfmake property name ─────────────────────────
const STYLE_TO_PDF = {
  Regular:    'normal',
  Bold:       'bold',
  Italic:     'italics',
  BoldItalic: 'bolditalics',
};

// ── Script tag for each registry key ─────────────────────────────
const FONT_SCRIPT = {
  Amiri:            'arabic',
  NotoNaskhArabic:  'arabic',
  ScheherazadeNew:  'arabic',
  Cairo:            'arabic',
  Tajawal:          'arabic',
  ReemKufi:         'arabic',
  Lateef:           'arabic',
  NotoNastaliqUrdu: 'urdu',
  // all others default to 'latin'
};

// ── Fallback chain per key ────────────────────────────────────────
// Used when a font is unavailable; walks the chain to find an alternative.
const FONT_FALLBACK = {
  Amiri:            'NotoNaskhArabic',
  NotoNaskhArabic:  'Amiri',
  ScheherazadeNew:  'Amiri',
  Cairo:            'NotoNaskhArabic',
  Tajawal:          'NotoNaskhArabic',
  ReemKufi:         'NotoNaskhArabic',
  Lateef:           'Amiri',
  NotoNastaliqUrdu: 'Amiri',
  Roboto:           'OpenSans',
  OpenSans:         'Roboto',
  Lato:             'Roboto',
  Poppins:          'Roboto',
  Inter:            'Roboto',
  Montserrat:       'Roboto',
  Merriweather:     'Lora',
  Lora:             'Merriweather',
  PlayfairDisplay:  'Merriweather',
  EBGaramond:       'Lora',
};

// ── Editor font name → registry key ──────────────────────────────
// This is the ONLY place where font name translation happens.
// Google Fonts: exact 1-to-1 match (space-to-CamelCase).
// System fonts: mapped to nearest free equivalent.
// "Jameel Noori Nastaleeq": no free TTF exists; NotoNastaliqUrdu is
//   the closest available Nastaleeq-script font.
const EDITOR_FONT_TO_KEY = {
  // Arabic (Google Fonts — all available as TTF)
  'Amiri':              'Amiri',
  'Noto Naskh Arabic':  'NotoNaskhArabic',
  'Scheherazade New':   'ScheherazadeNew',
  'Cairo':              'Cairo',
  'Tajawal':            'Tajawal',
  'Reem Kufi':          'ReemKufi',
  'Lateef':             'Lateef',
  // Urdu (Google Fonts — available as TTF)
  'Noto Nastaliq Urdu':     'NotoNastaliqUrdu',
  // Jameel Noori Nastaleeq is a proprietary font; no free TTF exists.
  // NotoNastaliqUrdu is the nearest free Nastaleeq-script substitute.
  'Jameel Noori Nastaleeq': 'NotoNastaliqUrdu',
  // Latin (Google Fonts — all available as TTF)
  'Roboto':             'Roboto',
  'Open Sans':          'OpenSans',
  'Lato':               'Lato',
  'Poppins':            'Poppins',
  'Inter':              'Inter',
  'Montserrat':         'Montserrat',
  'Merriweather':       'Merriweather',
  'Lora':               'Lora',
  'Playfair Display':   'PlayfairDisplay',
  'EB Garamond':        'EBGaramond',
  // System fonts (no free TTF) → nearest free equivalent
  'Times New Roman':    'Lora',
  'Georgia':            'Merriweather',
  'Garamond':           'EBGaramond',
  'Arial':              'OpenSans',
  'Verdana':            'OpenSans',
  'Trebuchet MS':       'OpenSans',
};

// ── Utilities ─────────────────────────────────────────────────────
function fileOk(p) {
  try { return !!p && fs.existsSync(p) && fs.statSync(p).size > 1000; }
  catch (_) { return false; }
}

function scriptOf(registryKey) {
  return FONT_SCRIPT[registryKey] || 'latin';
}

// ── Scan server/fonts/ for all *.ttf files ────────────────────────
// Groups them by font key and style variant.
function scanFonts() {
  const raw = {}; // key → { normal?, bold?, italics?, bolditalics? }
  let files;
  try { files = fs.readdirSync(FONTS_DIR); }
  catch (_) { return raw; }

  for (const file of files) {
    if (!/\.(ttf|otf)$/i.test(file)) continue;
    const base = file.replace(/\.(ttf|otf)$/i, '');
    const dash = base.lastIndexOf('-');
    if (dash < 0) continue;
    const fontKey   = base.slice(0, dash);
    const styleName = base.slice(dash + 1);
    const pdfProp   = STYLE_TO_PDF[styleName];
    if (!pdfProp) continue; // skip -Light, -Medium, -ExtraLight, etc.
    if (!raw[fontKey]) raw[fontKey] = {};
    raw[fontKey][pdfProp] = path.join(FONTS_DIR, file);
  }
  return raw;
}

// ── VFS extraction — Roboto fallback from pdfmake bundle ─────────
// Only triggered if Roboto-Regular.ttf is missing from server/fonts/.
// (All fonts are committed, so this is defensive-only code.)
let _vfsData = null;
function loadVFS() {
  if (_vfsData !== null) return _vfsData;
  try {
    const code = fs.readFileSync(require.resolve('pdfmake/build/vfs_fonts'), 'utf8');
    const mock  = {};
    vm.runInNewContext(code, {
      exports: {}, module: { exports: {} },
      require: (id) => { if (id === 'pdfmake/build/pdfmake') return mock; throw new Error('blocked'); },
    }, { timeout: 15000, filename: 'vfs_fonts.js' });
    _vfsData = mock.vfs || {};
  } catch (_) { _vfsData = {}; }
  return _vfsData;
}
function extractFromVFS(key, dest) {
  if (fileOk(dest)) return dest;
  try {
    const b64 = loadVFS()[key];
    if (!b64) return null;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, Buffer.from(b64, 'base64'));
    return fileOk(dest) ? dest : null;
  } catch (_) { return null; }
}

// ── Build pdfmake font descriptor map ────────────────────────────
function buildDescriptors(raw) {
  const desc      = {};
  const available = new Set();

  for (const [key, styles] of Object.entries(raw)) {
    if (!fileOk(styles.normal)) {
      console.warn(`[FontRegistry] ${key}: missing Regular TTF — skipped`);
      continue;
    }
    const bold        = fileOk(styles.bold)        ? styles.bold        : styles.normal;
    const italics     = fileOk(styles.italics)     ? styles.italics     : styles.normal;
    const bolditalics = fileOk(styles.bolditalics) ? styles.bolditalics : bold;
    desc[key]         = { normal: styles.normal, bold, italics, bolditalics };
    available.add(key);
    console.log(`[FontRegistry] ✓ ${key} (${path.basename(styles.normal)})`);
  }

  // Roboto VFS fallback (defensive — all Roboto TTFs are committed)
  if (!available.has('Roboto')) {
    const n = extractFromVFS('Roboto-Regular.ttf',      path.join(CACHE_DIR,'Roboto-Regular.ttf'));
    const b = extractFromVFS('Roboto-Medium.ttf',       path.join(CACHE_DIR,'Roboto-Medium.ttf'));
    const i = extractFromVFS('Roboto-Italic.ttf',       path.join(CACHE_DIR,'Roboto-Italic.ttf'));
    const bi= extractFromVFS('Roboto-MediumItalic.ttf', path.join(CACHE_DIR,'Roboto-MediumItalic.ttf'));
    if (n) {
      desc.Roboto = { normal: n, bold: b||n, italics: i||n, bolditalics: bi||b||n };
      available.add('Roboto');
      console.log('[FontRegistry] ✓ Roboto (via VFS)');
    }
  }

  return { desc, available };
}

// ── Singleton ─────────────────────────────────────────────────────
let _fontData = null;

function getFontData() {
  if (_fontData) return _fontData;
  const raw = scanFonts();
  _fontData = buildDescriptors(raw);
  console.log(`[FontRegistry] Ready: ${_fontData.available.size} fonts — ${[..._fontData.available].sort().join(', ')}`);
  return _fontData;
}

// Amiri normal path — used by GPOS null-anchor patch in pdfGeneratorMake.js
function getAmiriPath() {
  return scanFonts()['Amiri']?.normal || null;
}

// ── Font resolution ───────────────────────────────────────────────
// Converts an editor font name to a registered pdfmake key.
// Walks EDITOR_FONT_TO_KEY then FONT_FALLBACK chain.
// Returns null if nothing is available (caller must handle last-resort).
function resolveEditorFont(editorFontName, available) {
  if (!editorFontName || !available) return null;
  const startKey = EDITOR_FONT_TO_KEY[editorFontName] || editorFontName;
  let key = startKey;
  const seen = new Set();
  while (key && !seen.has(key)) {
    if (available.has(key)) return key;
    seen.add(key);
    key = FONT_FALLBACK[key];
  }
  return null;
}

module.exports = {
  getFontData,
  getAmiriPath,
  resolveEditorFont,
  scriptOf,
  EDITOR_FONT_TO_KEY,
  FONT_FALLBACK,
};
