import { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileDown, Plus, Trash2, Edit3, Download, Upload, ArrowLeft,
  ChevronUp, ChevronDown, Eye, FileText, X, BookOpen,
  AlignRight, AlignCenter, AlignLeft, AlignJustify,
  Bold, Italic, Underline, Strikethrough, Superscript, Subscript,
  List, ListOrdered, Highlighter, Eraser,
  Save, Sparkles, Loader2, AlertCircle,
  Settings, Type, Palette, GripVertical, Copy,
} from 'lucide-react';
import ToolPageLayout from '@/components/tools/ToolPageLayout';
import api from '@/services/api';

// ── Constants ───────────────────────────────────────────────────
const LS_KEY = 'htbk_docs_v3';

// Expanded Google Fonts URL — English, Urdu, and Arabic professional fonts
const FONTS_URL =
  'https://fonts.googleapis.com/css2?family=Noto+Naskh+Arabic:wght@400;700' +
  '&family=Amiri:ital,wght@0,400;0,700;1,400;1,700' +
  '&family=Lora:ital,wght@0,400;0,600;1,400' +
  '&family=Open+Sans:wght@400;600;700' +
  '&family=Roboto:wght@400;700' +
  '&family=Lato:wght@400;700' +
  '&family=Poppins:wght@400;600;700' +
  '&family=Inter:wght@400;600;700' +
  '&family=Montserrat:wght@400;600;700' +
  '&family=Merriweather:ital,wght@0,400;0,700;1,400' +
  '&family=Playfair+Display:ital,wght@0,400;0,700;1,400' +
  '&family=EB+Garamond:ital,wght@0,400;0,700;1,400' +
  '&family=Noto+Nastaliq+Urdu:wght@400;700' +
  '&family=Scheherazade+New:wght@400;700' +
  '&family=Cairo:wght@400;700' +
  '&family=Tajawal:wght@400;700' +
  '&family=Reem+Kufi:wght@400;700' +
  '&family=Lateef:wght@400;700' +
  '&display=swap';

const CIRCLED = ['❶','❷','❸','❹','❺','❻','❼','❽','❾','❿'];

// Font groups organised by script / language
const FONT_GROUPS = [
  {
    group: 'English',
    fonts: [
      { label: 'Times New Roman',  value: 'Times New Roman' },
      { label: 'Arial',            value: 'Arial' },
      { label: 'Georgia',          value: 'Georgia' },
      { label: 'Garamond',         value: 'EB Garamond' },
      { label: 'Verdana',          value: 'Verdana' },
      { label: 'Trebuchet MS',     value: 'Trebuchet MS' },
      { label: 'Open Sans',        value: 'Open Sans' },
      { label: 'Roboto',           value: 'Roboto' },
      { label: 'Lato',             value: 'Lato' },
      { label: 'Poppins',          value: 'Poppins' },
      { label: 'Inter',            value: 'Inter' },
      { label: 'Montserrat',       value: 'Montserrat' },
      { label: 'Merriweather',     value: 'Merriweather' },
      { label: 'Playfair Display', value: 'Playfair Display' },
      { label: 'Lora',             value: 'Lora' },
    ],
  },
  {
    group: 'Urdu',
    fonts: [
      { label: 'Jameel Noori Nastaleeq', value: 'Jameel Noori Nastaleeq' },
      { label: 'Noto Nastaliq Urdu',     value: 'Noto Nastaliq Urdu' },
    ],
  },
  {
    group: 'Arabic',
    fonts: [
      { label: 'Noto Naskh Arabic', value: 'Noto Naskh Arabic' },
      { label: 'Amiri',             value: 'Amiri' },
      { label: 'Scheherazade New',  value: 'Scheherazade New' },
      { label: 'Cairo',             value: 'Cairo' },
      { label: 'Tajawal',           value: 'Tajawal' },
      { label: 'Reem Kufi',         value: 'Reem Kufi' },
      { label: 'Lateef',            value: 'Lateef' },
    ],
  },
];

// Flat list used for header/footer selects
const FONT_OPTIONS = FONT_GROUPS.flatMap(g => g.fonts);

// Microsoft Word-style point sizes
const PT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 32, 36, 40, 48, 60, 72];

// 1pt = 4/3 px  (96 dpi / 72 pt-per-inch)
function ptToPx(pt) { return Math.round(pt * 4 / 3) + 'px'; }

const LINE_HEIGHTS = ['1.0','1.15','1.5','2.0','2.5','3.0'];

const LETTER_SPACINGS = [
  { label: 'Tight',  value: '-0.05em' },
  { label: 'Normal', value: '0'       },
  { label: 'Wide',   value: '0.05em'  },
  { label: 'Wider',  value: '0.1em'   },
];

const STYLE_PRESETS = [
  // ── Islamic / Arabic / Urdu presets (unchanged) ──────────────────
  { key:'chapter_title',    label:'عنوانِ باب',   styles:{ fontFamily:'Noto Naskh Arabic', fontSize:'24px', fontWeight:'bold',   textAlign:'center', direction:'rtl' } },
  { key:'urdu_chapter_sub', label:'ترجمہ باب',   styles:{ fontFamily:'Jameel Noori Nastaleeq', fontSize:'20px', fontWeight:'bold', textAlign:'center', direction:'rtl' } },
  { key:'arabic_matn',      label:'متنِ حدیث',   styles:{ fontFamily:'Noto Naskh Arabic', fontSize:'17px', fontWeight:'normal', textAlign:'justify', direction:'rtl', lineHeight:'2.0' } },
  { key:'urdu_translation', label:'اردو ترجمہ',  styles:{ fontFamily:'Jameel Noori Nastaleeq', fontSize:'18px', fontWeight:'normal', textAlign:'right', direction:'rtl', lineHeight:'2.8' } },
  { key:'fiqh_heading',     label:'فقہ الحدیث',  styles:{ fontFamily:'Jameel Noori Nastaleeq', fontSize:'18px', fontWeight:'bold',   textAlign:'right', direction:'rtl' } },
  { key:'fiqh_point',       label:'فقہی نکتہ',   styles:{ fontFamily:'Jameel Noori Nastaleeq', fontSize:'16px', fontWeight:'normal', textAlign:'right', direction:'rtl', lineHeight:'2.6' } },
  { key:'reference',        label:'حوالہ',        styles:{ fontSize:'13px', fontWeight:'normal', textAlign:'right', direction:'rtl' } },
  { key:'verse',            label:'آیت / Verse',  styles:{ fontFamily:'Noto Naskh Arabic', fontSize:'18px', fontWeight:'normal', textAlign:'center', direction:'rtl' } },
  // ── English document presets ─────────────────────────────────────
  { key:'doc_title',    label:'Doc Title',  styles:{ fontFamily:'Playfair Display', fontSize:'32px', fontWeight:'bold',   textAlign:'center', direction:'ltr' } },
  { key:'doc_h1',       label:'Heading 1',  styles:{ fontFamily:'Merriweather',     fontSize:'24px', fontWeight:'bold',   textAlign:'left',   direction:'ltr' } },
  { key:'doc_h2',       label:'Heading 2',  styles:{ fontFamily:'Merriweather',     fontSize:'18px', fontWeight:'bold',   textAlign:'left',   direction:'ltr' } },
  { key:'doc_body',     label:'Body Text',  styles:{ fontFamily:'Georgia',          fontSize:'16px', fontWeight:'normal', textAlign:'justify',direction:'ltr', lineHeight:'1.6' } },
  { key:'doc_caption',  label:'Caption',    styles:{ fontFamily:'Inter',            fontSize:'12px', fontWeight:'normal', textAlign:'center', direction:'ltr' } },
];

const ADD_BLOCK_TYPES = [
  { type:'chapter_heading', label:'+ Chapter Heading' },
  { type:'hadith',          label:'+ Hadith Block'    },
  { type:'fiqh',            label:'+ Fiqh Points'     },
  { type:'reference',       label:'+ Reference'       },
  { type:'verse',           label:'+ Verse / Intro'   },
  { type:'free_text',       label:'+ Free Text'       },
];

// ── Shared block rendering (MUST match pdfGenerator.js output exactly) ──
function stripMd(s) {
  return (s || '')
    .replace(/<hr\b[^>]*\/?>/gi, '')
    .replace(/\*\*(.*?)\*\*/gs, '$1')
    .replace(/__(.*?)__/gs,     '$1')
    .replace(/\*(.*?)\*/gs,     '$1')
    .replace(/_(.*?)_/gs,       '$1')
    .replace(/`(.*?)`/gs,       '$1');
}
function clean(html) { return stripMd(html || ''); }

// Tailwind preflight and Puppeteer's headless HTML both strip list markers.
// This adds inline styles to <ul>/<ol>/<li> so lists render in preview divs and PDF.
// Called only in render functions — never on content being saved — so nothing accumulates.
function styleListsInContent(html) {
  if (!html || (html.indexOf('<ul') === -1 && html.indexOf('<ol') === -1)) return html;
  return html
    .replace(/<ul(\b[^>]*)>/gi, (_, attrs) =>
      /list-style/.test(attrs)
        ? `<ul${attrs}>`
        : `<ul${attrs} style="list-style:disc;padding-inline-start:1.6em;margin-top:0.4em;margin-bottom:0.4em;">`)
    .replace(/<ol(\b[^>]*)>/gi, (_, attrs) =>
      /list-style/.test(attrs)
        ? `<ol${attrs}>`
        : `<ol${attrs} style="list-style:decimal;padding-inline-start:1.6em;margin-top:0.4em;margin-bottom:0.4em;">`)
    .replace(/<li(\b[^>]*)>/gi, (_, attrs) =>
      /display/.test(attrs) ? `<li${attrs}>` : `<li${attrs} style="display:list-item;">`);
}

function renderChapterHeadingHTML(block) {
  const arabic = clean(block.arabicTitle  || '');
  const urdu   = clean(block.urduSubtitle || '');
  return (
    `<div style="padding:10px 0 6px;text-align:center;margin-top:20px;margin-bottom:8px;">` +
    `<div style="font-family:'Noto Naskh Arabic',serif;font-size:27px;font-weight:bold;direction:rtl;text-align:center;line-height:1.6;color:#000;">${arabic}</div>` +
    (urdu ? `<div style="font-family:'Jameel Noori Nastaleeq',serif;font-size:22px;font-weight:bold;direction:rtl;text-align:center;line-height:2.0;color:#000;margin-top:6px;">${urdu}</div>` : '') +
    `</div>`
  );
}

function renderHadithTableHTML(block) {
  const arabicFont = block.arabicFont || 'Noto Naskh Arabic';
  const num = block.number ? `<span style="font-family:'${arabicFont}',serif;">﴿${block.number}﴾ </span>` : '';
  return (
    `<table style="width:100%;border-collapse:collapse;direction:rtl;table-layout:fixed;margin-bottom:0;">` +
    `<tbody><tr>` +
    `<td style="width:50%;vertical-align:top;padding:8px 0 12px 16px;">` +
    `<div style="font-family:'${arabicFont}',serif;font-size:18px;font-weight:400;direction:rtl;text-align:justify;line-height:1.8;color:#000;">${num}${clean(block.arabicMatn)}</div>` +
    `</td>` +
    `<td style="width:50%;vertical-align:top;padding:0 14px 12px 0;">` +
    `<div style="font-family:'Jameel Noori Nastaleeq',serif;font-size:18px;font-weight:400;direction:rtl;text-align:right;line-height:2.0;color:#000;">${clean(block.urduTranslation)}</div>` +
    `</td>` +
    `</tr></tbody></table>`
  );
}

function renderFiqhHTML(block) {
  const heading = clean(block.heading || 'فقہ الحدیث:');
  const pts = block.points || [];
  let html = `<div style="font-family:'Noto Naskh Arabic',serif;font-size:20px;font-weight:bold;direction:rtl;text-align:right;color:#000;margin-top:8px;margin-bottom:6px;">${heading}</div>`;
  pts.forEach((pt, i) => {
    html += `<div style="font-family:'Jameel Noori Nastaleeq',serif;font-size:17px;font-weight:400;direction:rtl;text-align:right;line-height:2.0;color:#000;margin-bottom:1px;"><span style="font-size:22px;margin-left:16px;vertical-align:middle;">${CIRCLED[i] || `(${i+1})`}</span>${clean(pt)}</div>`;
  });
  return html;
}

function renderReferenceHTML(block) {
  const content = clean(block.content || '');
  if (!content.trim()) return '';
  return (
    `<div style="direction:rtl;text-align:right;margin-top:8px;">` +
    `<div style="width:5cm;height:0;border-top:1.3px solid #555;margin:0 0 6px auto;display:block;"></div>` +
    `<div style="font-size:13px;color:#000;">${content}</div>` +
    `</div>`
  );
}

function renderVerseHTML(block) {
  return (
    `<div style="text-align:center;margin-top:12px;margin-bottom:10px;">` +
    `<div style="font-family:'Noto Naskh Arabic',serif;font-size:18px;font-weight:400;direction:rtl;text-align:center;line-height:1.8;color:#000;">${clean(block.arabicText || '')}</div>` +
    (block.urduText ? `<div style="font-family:'Jameel Noori Nastaleeq',serif;font-size:18px;font-weight:400;direction:rtl;text-align:center;line-height:2.0;color:#000;margin-top:4px;">${clean(block.urduText)}</div>` : '') +
    `</div>`
  );
}

// Tighten highlighted spans: background-color fills the full line-height (32px at lh:2)
// which looks too tall. Add line-height:1.5 so the highlight box is ~24px instead.
function normalizeHighlights(html) {
  if (!html || html.indexOf('background-color') === -1) return html;
  return html.replace(/<span\b([^>]*)>/gi, (match, attrs) => {
    if (attrs.indexOf('background-color') === -1) return match;
    if (attrs.indexOf('line-height') !== -1) return match;
    return match.replace(/style="/, 'style="line-height:1.5;padding:1px 2px;');
  });
}

// Supports block-level: fontFamily, direction, textAlign, lineHeight, letterSpacing, wordSpacing, margins
function renderFreeTextHTML(block) {
  const ff  = block.fontFamily  || 'Jameel Noori Nastaleeq';
  const dir = block.direction   || 'rtl';
  const ta  = block.textAlign   || (dir === 'ltr' ? 'justify' : 'right');
  const lh  = block.lineHeight  || (dir === 'ltr' ? '1.6' : '2.0');
  const ls  = block.letterSpacing ? `letter-spacing:${block.letterSpacing};` : '';
  const ws  = block.wordSpacing   ? `word-spacing:${block.wordSpacing};`     : '';
  const mt  = block.marginTop     || '8px';
  const mb  = block.marginBottom  || '8px';
  const content = normalizeHighlights(styleListsInContent(clean(block.content || '')));
  return `<div style="font-family:'${ff}',serif;font-size:16px;direction:${dir};text-align:${ta};line-height:${lh};${ls}${ws}margin-top:${mt};margin-bottom:${mb};color:#000;">${content}</div>`;
}

function renderBlockHTML(block) {
  switch (block.type) {
    case 'chapter_heading': return renderChapterHeadingHTML(block);
    case 'hadith':          return renderHadithTableHTML(block);
    case 'fiqh':            return renderFiqhHTML(block);
    case 'reference':       return renderReferenceHTML(block);
    case 'verse':           return renderVerseHTML(block);
    default:                return renderFreeTextHTML(block);
  }
}

function buildDocumentBodyHTML(blocks) {
  const parts = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];

    if (b.type === 'chapter_heading') { parts.push(renderChapterHeadingHTML(b)); i++; continue; }

    if (b.type === 'hadith') {
      i++;
      let fiqhHTML = '';
      while (i < blocks.length && blocks[i].type === 'fiqh') { fiqhHTML += renderFiqhHTML(blocks[i]); i++; }
      let refHTML = '';
      if (i < blocks.length && blocks[i].type === 'reference') { refHTML = renderReferenceHTML(blocks[i]); i++; }
      parts.push(
        `<div style="margin-top:22px;margin-bottom:0;">` +
        `<div style="page-break-inside:avoid;break-inside:avoid;">${renderHadithTableHTML(b)}</div>` +
        (fiqhHTML ? `<div style="page-break-before:avoid;break-before:avoid;">${fiqhHTML}</div>` : '') +
        (refHTML  ? `<div style="page-break-before:avoid;break-before:avoid;">${refHTML}</div>`  : '') +
        `</div>`
      );
      continue;
    }

    if (b.type === 'fiqh')      { parts.push(renderFiqhHTML(b));      i++; continue; }
    if (b.type === 'reference') { parts.push(renderReferenceHTML(b)); i++; continue; }
    if (b.type === 'verse')     { parts.push(renderVerseHTML(b));     i++; continue; }
    parts.push(renderFreeTextHTML(b)); i++;
  }
  return parts.join('\n');
}

// ══════════════════════════════════════════════════════════════════════
// PDF EXPORT ENGINE v2.0 — Production Grade
// Font-first DOM pagination + per-page html2canvas capture.
// Block render functions (renderFreeTextHTML etc.) are shared with the
// editor preview, guaranteeing visual parity between screen and PDF.
// ══════════════════════════════════════════════════════════════════════

// A4 page geometry — CSS pixels at 96 dpi ↔ PDF points
// PDF_DENSITY='professional-compact': tighter margins → more content per page
const PDF_DENSITY = 'professional-compact';
const CHUNK_GAP   = 6; // px vertical gap between adjacent chunks (replaces CSS margins)

const PL = {
  cssW: 794,  cssH: 1123,
  ptW:  595.28, ptH: 841.89,
  mTop: 32, mRight: 60, mBottom: 32, mLeft: 60,
  hdrH: 42,   // badge 30px + 6px pad top & bottom
  hdrGap: 8,  // gap: header bottom → content top
  ftrH: 20,   // footer zone
  ftrGap: 8,  // gap: content bottom → footer top
};
PL.contentW   = PL.cssW  - PL.mLeft - PL.mRight;              // 674 px
PL.contentTop = PL.mTop  + PL.hdrH  + PL.hdrGap;             //  82 px from top
PL.contentBot = PL.cssH  - PL.mBottom - PL.ftrH - PL.ftrGap; // 1063 px from top
PL.contentH   = PL.contentBot - PL.contentTop;                 //  981 px
PL.pt         = PL.ptW   / PL.cssW;                            // ~0.7497 pt/px

// Post-process a PDF chunk element to reduce excessive default spacing.
// Only called in the PDF generation path — never touches the editor preview.
// Normalises line-heights that default to 2.0 in the editor but are too
// spread-out for print, and trims excessive margins/padding.
function pdfCompactify(el) {
  if (PDF_DENSITY !== 'professional-compact') return;
  [el, ...el.querySelectorAll('[style]')].forEach(node => {
    if (!(node instanceof HTMLElement)) return;
    const s = node.style;
    const mt = parseFloat(s.marginTop);
    if (mt > 10) s.marginTop  = Math.round(mt  * 0.5) + 'px';
    const mb = parseFloat(s.marginBottom);
    if (mb > 6)  s.marginBottom = Math.round(mb * 0.55) + 'px';
    const pt = parseFloat(s.paddingTop);
    if (pt > 6)  s.paddingTop  = Math.round(pt  * 0.55) + 'px';
    const pb = parseFloat(s.paddingBottom);
    if (pb > 8)  s.paddingBottom = Math.round(pb * 0.55) + 'px';

    // ── Line-height capping ────────────────────────────────────────────
    // JNN Nastaleeq calligraphic glyphs have tall ascenders and descenders.
    // Below line-height 1.8 the ink overflows the CSS line box and overlaps
    // the adjacent line — exactly what the user sees as "مخرج نمبر overlap".
    // Arabic Naskh is more compact and is safe at 1.8 too.
    // We check direction OR explicit fontFamily to classify the node.
    const ff2 = s.fontFamily || '';
    const isNastaleeq = ff2.indexOf('Jameel')    !== -1 ||
                        ff2.indexOf('Nastaleeq') !== -1 ||
                        ff2.indexOf('Nastaliq')  !== -1;
    const isRTLNode = s.direction === 'rtl' || isNastaleeq;
    const lh2 = parseFloat(s.lineHeight);
    if (!isNaN(lh2)) {
      if (isRTLNode) {
        // RTL / Nastaleeq: cap at 1.8 from above (never reduce below 1.8)
        if (lh2 > 1.8) {
          s.lineHeight = '1.8';
          console.log(`[PDF_LINE_HEIGHT_APPLIED] ${lh2}→1.8 (RTL cap)`);
          console.log(`[PDF_TRIMMED_EMPTY_SPACE] inflated lh ${lh2} replaced with 1.8 — recovered ~${Math.round((lh2 - 1.8) * 16)}px per line`);
        }
      } else {
        // LTR: compact for print
        if (lh2 > 1.45) {
          const prev = lh2;
          s.lineHeight = '1.45';
          console.log(`[PDF_TRIMMED_EMPTY_SPACE] LTR lh ${prev}→1.45`);
        }
      }
    }

    if (s.direction === 'rtl') {
      // Prevent word-break or hyphenation breaking Urdu words mid-character.
      s.overflowWrap = 'normal';
      s.wordBreak    = 'normal';
      s.hyphens      = 'none';
      // Do NOT force word-spacing here. Adding 3 px widens each space, which
      // can cause a short phrase like "مخرج نمبر" to wrap when it previously
      // fit on one line. Combined with the tight line-height this made the two
      // wrapped lines' glyphs overlap — the very bug being reported.
      console.log(`[PDF_URDU_STYLE_APPLIED] overflowWrap/wordBreak/hyphens set`);
    }

    // letter-spacing on Nastaleeq forces html2canvas to treat each code-point
    // as a separate text run. Run placement ignores ligature widths → glyphs
    // land on top of each other. Strip it unconditionally for these fonts.
    const ff3 = s.fontFamily || '';
    if (ff3.indexOf('Jameel')    !== -1 ||
        ff3.indexOf('Nastaleeq') !== -1 ||
        ff3.indexOf('Nastaliq')  !== -1) {
      s.letterSpacing = '';
    }
  });
}

// ── Decorative header: [page-num badge] [──SVG──] [title badge] ──────
function pdfDecorativeHeader(doc, pageNum) {
  const ff       = `'${doc.headerFontFamily || 'Noto Naskh Arabic'}',serif`;
  const fs       = doc.headerFontSize || 10;
  const showPN   = doc.showPageNumber !== false;
  const pnPos    = doc.pageNumberPosition || 'header-right';
  const showLP   = showPN && pnPos.startsWith('header');
  const title    = doc.headerRight || doc.name || '';

  const badgeH = PL.hdrH - 12; // hdrH minus 6px top pad + 6px bottom pad
  const B = [
    'display:inline-flex',
    'align-items:center',
    'justify-content:center',
    'border:1.2px solid #1a1a1a',
    'border-radius:999px',
    `font-family:${ff}`,
    `font-size:${fs}px`,
    `height:${badgeH}px`,
    'box-sizing:border-box',
    'color:#1a1a1a',
    'white-space:nowrap',
  ].join(';');

  const leftBadge = showLP
    ? `<span style="${B};flex-shrink:0;padding:0 14px;min-width:42px;text-align:center;">${pageNum}</span>`
    : `<span style="${B};flex-shrink:0;padding:0 14px;opacity:0;border-color:transparent;"> </span>`;

  const rightBadge = title
    ? `<span style="${B};flex-shrink:1;min-width:0;max-width:240px;padding:0 16px;overflow:hidden;text-overflow:ellipsis;direction:rtl;">${title}</span>`
    : `<span style="${B};flex-shrink:0;padding:0 14px;opacity:0;border-color:transparent;"> </span>`;

  const svg =
    `<svg width="100%" height="30" viewBox="0 0 400 22" preserveAspectRatio="xMidYMid meet">` +
    `<g transform="translate(200,11)">` +
    `<line x1="0" y1="-6" x2="0" y2="6" stroke="#1a1a1a" stroke-width="0.8"/>` +
    `<line x1="-5.2" y1="-3" x2="5.2" y2="3" stroke="#1a1a1a" stroke-width="0.8"/>` +
    `<line x1="-5.2" y1="3" x2="5.2" y2="-3" stroke="#1a1a1a" stroke-width="0.8"/>` +
    `<circle cx="0" cy="0" r="2.5" fill="none" stroke="#1a1a1a" stroke-width="0.7"/></g>` +
    `<path d="M208 11 Q218 7 228 11 Q238 15 248 11 Q258 7 268 11 Q278 15 288 11" fill="none" stroke="#1a1a1a" stroke-width="0.7"/>` +
    `<path d="M218 8 Q220 3 224 5" fill="none" stroke="#1a1a1a" stroke-width="0.6"/>` +
    `<path d="M238 14 Q242 19 246 17" fill="none" stroke="#1a1a1a" stroke-width="0.6"/>` +
    `<path d="M258 8 Q260 3 264 5" fill="none" stroke="#1a1a1a" stroke-width="0.6"/>` +
    `<path d="M278 14 Q282 19 286 17" fill="none" stroke="#1a1a1a" stroke-width="0.6"/>` +
    `<line x1="288" y1="11" x2="396" y2="11" stroke="#1a1a1a" stroke-width="0.4"/>` +
    `<path d="M192 11 Q182 7 172 11 Q162 15 152 11 Q142 7 132 11 Q122 15 112 11" fill="none" stroke="#1a1a1a" stroke-width="0.7"/>` +
    `<path d="M182 8 Q180 3 176 5" fill="none" stroke="#1a1a1a" stroke-width="0.6"/>` +
    `<path d="M162 14 Q158 19 154 17" fill="none" stroke="#1a1a1a" stroke-width="0.6"/>` +
    `<path d="M142 8 Q140 3 136 5" fill="none" stroke="#1a1a1a" stroke-width="0.6"/>` +
    `<path d="M122 14 Q118 19 114 17" fill="none" stroke="#1a1a1a" stroke-width="0.6"/>` +
    `<line x1="112" y1="11" x2="4" y2="11" stroke="#1a1a1a" stroke-width="0.4"/>` +
    `</svg>`;

  return (
    `<div style="display:flex;flex-direction:row;align-items:center;justify-content:space-between;` +
    `gap:8px;height:${PL.hdrH}px;box-sizing:border-box;padding:6px 0;">` +
    leftBadge +
    `<div style="flex:1;min-width:0;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:0 4px;">${svg}</div>` +
    rightBadge +
    `</div>`
  );
}

// ── Plain (non-decorative) header ────────────────────────────────────
function pdfPlainHeader(doc, pageNum) {
  const hff    = `'${doc.headerFontFamily || 'Noto Naskh Arabic'}',serif`;
  const hfs    = doc.headerFontSize || 10;
  const showPN = doc.showPageNumber !== false;
  const pnPos  = showPN ? (doc.pageNumberPosition || 'header-right') : 'none';
  const right  = pnPos === 'header-right'  ? String(pageNum) : (doc.headerRight  || '');
  const center = pnPos === 'header-center' ? String(pageNum) : (doc.headerCenter || doc.name || '');
  const left   = pnPos === 'header-left'   ? String(pageNum) : (doc.headerLeft   || '');
  return (
    `<div style="display:flex;justify-content:space-between;align-items:center;` +
    `height:${PL.hdrH}px;box-sizing:border-box;padding:4px 0;` +
    `font-family:${hff};font-size:${hfs}px;color:#555;direction:rtl;">` +
    `<span>${right}</span><span>${center}</span><span>${left}</span>` +
    `</div>`
  );
}

// ── Footer (with optional page number) ──────────────────────────────
function pdfFooter(doc, pageNum) {
  const fff    = `'${doc.footerFontFamily || 'Noto Naskh Arabic'}',serif`;
  const ffs    = doc.footerFontSize || 9;
  const showPN = doc.showPageNumber !== false;
  const pnPos  = showPN ? (doc.pageNumberPosition || 'header-right') : 'none';
  const right  = pnPos === 'footer-right'  ? String(pageNum) : (doc.footerRight  || '');
  const center = pnPos === 'footer-center' ? String(pageNum) : (doc.footerCenter || '');
  const left   = pnPos === 'footer-left'   ? String(pageNum) : (doc.footerLeft   || '');
  const hl     = doc.footerHairline !== false
    ? `<div style="width:100%;height:0.5px;background:#1a1a1a;margin-bottom:4px;"></div>` : '';
  return (
    `<div style="height:${PL.ftrH}px;box-sizing:border-box;">` +
    hl +
    `<div style="display:flex;justify-content:space-between;align-items:center;` +
    `font-family:${fff};font-size:${ffs}px;color:#555;direction:rtl;">` +
    `<span>${right}</span><span>${center}</span><span>${left}</span>` +
    `</div></div>`
  );
}

// ── Complete A4 page shell ───────────────────────────────────────────
// Contains positioned header, empty content zone, and footer.
// Content zone is filled by the pagination engine.
function pdfPageShell(doc, pageNum) {
  const hdr = doc.headerStyle === 'decorative'
    ? pdfDecorativeHeader(doc, pageNum)
    : pdfPlainHeader(doc, pageNum);
  const ftr = pdfFooter(doc, pageNum);
  return (
    `<div data-pdf-page style="background:#fff;width:${PL.cssW}px;height:${PL.cssH}px;` +
    `box-sizing:border-box;position:relative;overflow:hidden;-webkit-font-smoothing:antialiased;">` +
    `<div data-pdf-header style="position:absolute;left:${PL.mLeft}px;right:${PL.mRight}px;` +
    `top:${PL.mTop}px;height:${PL.hdrH}px;box-sizing:border-box;overflow:hidden;">${hdr}</div>` +
    `<div data-pdf-content style="position:absolute;left:${PL.mLeft}px;right:${PL.mRight}px;` +
    `top:${PL.contentTop}px;height:${PL.contentH}px;box-sizing:border-box;overflow:hidden;"></div>` +
    `<div data-pdf-footer style="position:absolute;left:${PL.mLeft}px;right:${PL.mRight}px;` +
    `bottom:${PL.mBottom}px;height:${PL.ftrH}px;box-sizing:border-box;">${ftr}</div>` +
    `</div>`
  );
}

// ── Chunk bisection utilities ────────────────────────────────────────
// Split raw text at the natural boundary closest to the midpoint.
// Priority: Urdu/Arabic sentence end → word space → character midpoint.
function bisectText(text) {
  if (!text || text.length < 2) return null;
  const mid = Math.floor(text.length / 2);

  // Sentence-ending punctuation closest to midpoint
  const re = /[۔؟!.?!؟؛]/g;
  let bestIdx = -1, bestDist = Infinity, m;
  while ((m = re.exec(text)) !== null) {
    const idx = m.index + 1;
    if (idx > 0 && idx < text.length) {
      const d = Math.abs(idx - mid);
      if (d < bestDist) { bestDist = d; bestIdx = idx; }
    }
  }
  if (bestIdx > 0) return [text.slice(0, bestIdx), text.slice(bestIdx).replace(/^\s+/, '')];

  // Word space closest to midpoint
  bestDist = Infinity; bestIdx = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === ' ' || text[i] === '‌' || text[i] === '​') {
      const d = Math.abs(i - mid);
      if (d < bestDist) { bestDist = d; bestIdx = i + 1; }
    }
  }
  if (bestIdx > 0 && bestIdx < text.length) return [text.slice(0, bestIdx), text.slice(bestIdx)];

  // Last resort: character midpoint
  return [text.slice(0, mid), text.slice(mid)];
}

// Split a DOM element into two sibling elements each with roughly half the
// content. Returns [firstHalf, secondHalf] preserving all inline styles,
// attributes, RTL direction, and Nastaleeq font inheritance.
// Returns null when the element cannot be split any further.
function bisectEl(el) {
  const kids = Array.from(el.childNodes);
  if (kids.length === 0) return null;

  // ── Single child element: recurse into it ───────────────────────────
  if (kids.length === 1 && kids[0].nodeType === Node.ELEMENT_NODE) {
    const inner = kids[0];
    if (inner.tagName === 'BR') return null;
    const halves = bisectEl(inner);
    if (!halves) return null;
    const elA = el.cloneNode(false); elA.appendChild(halves[0]);
    const elB = el.cloneNode(false); elB.appendChild(halves[1]);
    return [elA, elB];
  }

  // ── Single text node: split at text boundary ─────────────────────────
  if (kids.length === 1 && kids[0].nodeType === Node.TEXT_NODE) {
    const halves = bisectText(kids[0].textContent);
    if (!halves) return null;
    const elA = el.cloneNode(false); elA.appendChild(document.createTextNode(halves[0]));
    const elB = el.cloneNode(false); elB.appendChild(document.createTextNode(halves[1]));
    return [elA, elB];
  }

  // ── Multiple child nodes: find best split point near midpoint ─────────
  const mid = Math.ceil(kids.length / 2);
  let splitIdx = mid;
  const SENT = /[۔؟!.?!؟؛]\s*$/;

  outer: for (let off = 0; off < kids.length; off++) {
    for (const i of [mid + off, mid - off]) {
      if (i <= 0 || i >= kids.length) continue;
      const prev = kids[i - 1];
      if (prev.nodeType === Node.ELEMENT_NODE && prev.tagName === 'BR') { splitIdx = i; break outer; }
      if (prev.nodeType === Node.TEXT_NODE && SENT.test(prev.textContent)) { splitIdx = i; break outer; }
    }
  }

  // Guard: both halves must be non-empty
  if (splitIdx <= 0) splitIdx = 1;
  if (splitIdx >= kids.length) splitIdx = kids.length - 1;

  const elA = el.cloneNode(false);
  const elB = el.cloneNode(false);
  kids.slice(0, splitIdx).forEach(n => elA.appendChild(n.cloneNode(true)));
  kids.slice(splitIdx).forEach(n => elB.appendChild(n.cloneNode(true)));
  return [elA, elB];
}

// Standalone height oracle — mc is a persistent off-screen BFC container
// that the caller creates once and reuses across all measurements in a run.
function measureChunk(el, mc) {
  const savedMT = el.style.marginTop;
  const savedMB = el.style.marginBottom;
  el.style.marginTop    = '0';
  el.style.marginBottom = '0';
  mc.appendChild(el);
  void mc.offsetHeight;      // force synchronous layout
  const h = el.offsetHeight;
  mc.removeChild(el);
  el.style.marginTop    = savedMT;
  el.style.marginBottom = savedMB;
  return h;
}

function splitOversizedChunk(el, mc, maxPx, depth = 0) {
  const h = measureChunk(el, mc);
  console.log(
    '[PDF_SPLIT_ATTEMPT] depth=' + depth +
    ' h=' + h + ' max=' + maxPx
  );

  if (h <= maxPx || depth > 8) return [el];

  const nodes = Array.from(el.childNodes);
  if (nodes.length === 0) return [el];

  if (
    nodes.length === 1 &&
    nodes[0].nodeType === Node.TEXT_NODE
  ) {
    const text = nodes[0].textContent;
    if (text.length <= 2) return [el];
    const mid = Math.floor(text.length / 2);
    const a = el.cloneNode(false);
    a.appendChild(
      document.createTextNode(text.slice(0, mid))
    );
    const b = el.cloneNode(false);
    b.appendChild(
      document.createTextNode(text.slice(mid))
    );
    const result = [
      ...splitOversizedChunk(a, mc, maxPx, depth + 1),
      ...splitOversizedChunk(b, mc, maxPx, depth + 1),
    ];
    console.log('[PDF_SPLIT_RESULT] parts=' + result.length);
    return result;
  }

  const mid = Math.floor(nodes.length / 2);
  if (mid === 0) return [el];

  const firstEl = el.cloneNode(false);
  nodes.slice(0, mid).forEach(n =>
    firstEl.appendChild(n.cloneNode(true))
  );
  const secondEl = el.cloneNode(false);
  nodes.slice(mid).forEach(n =>
    secondEl.appendChild(n.cloneNode(true))
  );

  const result = [
    ...splitOversizedChunk(
      firstEl, mc, maxPx, depth + 1
    ),
    ...splitOversizedChunk(
      secondEl, mc, maxPx, depth + 1
    ),
  ];
  console.log('[PDF_SPLIT_RESULT] parts=' + result.length);
  return result;
}

// ── Page Layout Engine ───────────────────────────────────────────────
// Tracks currentY explicitly — no scrollHeight comparisons, no margin-
// collapse ambiguity.  measureChunk() is the sole height oracle.
class PageLayoutEngine {
  constructor(doc, container) {
    this.doc       = doc;
    this.container = container;
    this.pages     = [];
    this.pageNum   = doc.pageNumberStart || 1;
    this.zone      = null;
    this.currentY  = 0;
    this._openPage();
  }
  _openPage() {
    const wrap = document.createElement('div');
    wrap.innerHTML = pdfPageShell(this.doc, this.pageNum++);
    const page = wrap.firstElementChild;
    this.container.appendChild(page);
    this.pages.push(page);
    this.zone     = page.querySelector('[data-pdf-content]');
    this.currentY = 0;
    console.log(`[PDF_NEW_PAGE] page=${this.pages.length} contentH=${PL.contentH}`);
    console.log(`[PDF_HEADER_LAYOUT] pageNum=${this.pageNum - 1} hdrH=${PL.hdrH} contentTop=${PL.contentTop}`);
  }
  addPage() {
    this._openPage();
    console.log(`[PDF_PAGE_BREAK] → page ${this.pages.length}`);
  }
  // Measure el's intrinsic height in an isolated probe (margins stripped so
  // CHUNK_GAP is the sole source of inter-chunk spacing).
  measureChunk(el) {
    // Attach probe directly to document.body at a fixed off-screen position.
    // position:fixed guarantees Chrome always computes layout regardless of how
    // far off-screen the element is.
    // overflow:hidden creates a BFC that exactly matches the content zone's BFC
    // (which also has overflow:hidden), so child-margin collapse behaviour inside
    // el is identical in both the probe and the real zone.
    const probe = document.createElement('div');
    probe.style.cssText =
      `position:fixed;left:0;top:-${PL.cssH + 200}px;` +
      `width:${PL.contentW}px;height:auto;` +
      `overflow:hidden;visibility:hidden;pointer-events:none;`;
    document.body.appendChild(probe);
    const savedMT = el.style.marginTop;
    const savedMB = el.style.marginBottom;
    el.style.marginTop    = '0';
    el.style.marginBottom = '0';
    probe.appendChild(el);
    void probe.offsetHeight;        // force synchronous layout
    const h = el.offsetHeight;

    // Log actual rendered bounds so we can verify measurement matches visual content.
    // getBoundingClientRect reflects the post-font, post-lineheight paint bounds.
    const rect = el.getBoundingClientRect();
    console.log(`[PDF_VISIBLE_BOUNDS] offsetH=${h} rect.height=${rect.height.toFixed(1)} diff=${(h - rect.height).toFixed(1)}`);

    probe.removeChild(el);
    document.body.removeChild(probe);
    el.style.marginTop    = savedMT;
    el.style.marginBottom = savedMB;
    return h;
  }
  // Pure math — does chunkH fit in the remaining space on this page?
  fitsAt(chunkH) {
    const gap       = this.currentY > 0 ? CHUNK_GAP : 0;
    const remaining = PL.contentH - this.currentY;
    const needed    = gap + chunkH;
    const fits      = needed <= remaining;
    console.log(`[PDF_REMAINING_SPACE] remaining=${remaining} needed=${needed} (gap=${gap}+chunkH=${chunkH})`);
    if (!fits) {
      console.log(`[PDF_PAGE_BREAK_REASON] overflow by ${(needed - remaining).toFixed(1)}px — new page`);
    }
    return fits;
  }
  // Place el into the active zone, overriding its CSS margins with CHUNK_GAP.
  append(el, chunkH) {
    const gap = this.currentY > 0 ? CHUNK_GAP : 0;
    el.style.marginTop    = gap > 0 ? `${gap}px` : '0';
    el.style.marginBottom = '0';
    this.zone.appendChild(el);
    this.currentY += gap + chunkH;
    console.log(`[PDF_CHUNK_RENDER] page=${this.pages.length} h=${chunkH} gap=${gap} currentY=${this.currentY}/${PL.contentH}`);
  }
  isEmpty()  { return this.currentY === 0; }
  finalize() {
    if (this.pages.length > 1 && this.isEmpty()) this.pages.pop().remove();
    return this.pages;
  }
}

// ── Pagination Engine ────────────────────────────────────────────────
// Converts blocks into fine-grained chunks and flows them through
// PageLayoutEngine using a queue. When a chunk is too tall for an empty
// page it is recursively bisected until each piece fits. Chunks are never
// skipped — no content is lost.
class PaginationEngine {
  constructor(layout) { this.layout = layout; }

  run(blocks) {
    const allChunks = this._buildChunks(blocks);
    console.log(`[PDF_CONTENT_AREA] contentH=${PL.contentH} raw_chunks=${allChunks.length}`);

    // Persistent BFC probe — created once, shared across all measurements
    const mc = document.createElement('div');
    mc.style.cssText =
      `position:fixed;left:0;top:-${PL.cssH + 200}px;` +
      `width:${PL.contentW}px;height:auto;` +
      `overflow:hidden;visibility:hidden;pointer-events:none;`;
    document.body.appendChild(mc);

    const MAX_CONTENT_HEIGHT = PL.contentH;

    // ── Pagination algorithm ──────────────────────────────────────────────
    const pages    = [[]];
    let usedHeight = 0;

    for (const chunk of allChunks) {
      const h = measureChunk(chunk, mc);

      if (usedHeight + h <= MAX_CONTENT_HEIGHT) {
        pages[pages.length - 1].push(chunk);
        usedHeight += h;

      } else {
        pages.push([]);
        usedHeight = 0;

        if (h > MAX_CONTENT_HEIGHT) {
          const parts = splitOversizedChunk(
            chunk, mc, MAX_CONTENT_HEIGHT
          );
          for (const part of parts) {
            const ph = measureChunk(part, mc);
            if (usedHeight + ph <= MAX_CONTENT_HEIGHT) {
              pages[pages.length - 1].push(part);
              usedHeight += ph;
            } else {
              pages.push([part]);
              usedHeight = ph;
            }
          }
        } else {
          pages[pages.length - 1].push(chunk);
          usedHeight = h;
        }
      }
    }
    // ─────────────────────────────────────────────────────────────────────

    // Render computed chunk groups into DOM pages via the layout engine
    let firstPage = true;
    for (const pageChunks of pages) {
      if (pageChunks.length === 0) continue;
      if (!firstPage) this.layout.addPage();
      firstPage = false;
      for (const chunk of pageChunks) {
        const h = measureChunk(chunk, mc);
        this.layout.append(chunk, h);
      }
    }

    document.body.removeChild(mc);
    console.log(`[PDF_NO_CONTENT_DROPPED] total_chunks=${allChunks.length} pages=${this.layout.pages.length}`);
  }

  _buildChunks(blocks) {
    const out = [];
    for (const b of blocks) out.push(...this._blockToChunks(b));
    return out;
  }

  _blockToChunks(block) {
    switch (block.type) {
      case 'hadith':          return this._hadithChunks(block);
      case 'fiqh':            return this._fiqhChunks(block);
      case 'chapter_heading':
      case 'reference':
      case 'verse':           return this._singleChunk(block);
      case 'free_text':
      default:                return this._freeTextChunks(block);
    }
  }

  _singleChunk(block) {
    const t = document.createElement('div');
    t.innerHTML = renderBlockHTML(block);
    const el = t.firstElementChild;
    if (!el) return [];
    pdfCompactify(el);
    return [el];
  }

  _hadithChunks(block) {
    const el = document.createElement('div');
    el.style.marginTop = '12px'; // was 22px — compact mode
    el.innerHTML = renderHadithTableHTML(block);
    pdfCompactify(el);
    return [el];
  }

  _fiqhChunks(block) {
    const t = document.createElement('div');
    t.innerHTML = renderFiqhHTML(block);
    const out = [];
    while (t.firstElementChild) {
      const el = t.firstElementChild;
      t.removeChild(el);   // must detach before pushing; without this
                           // t.firstElementChild is always the same node → infinite loop
      pdfCompactify(el);
      out.push(el);
    }
    return out;
  }

  _freeTextChunks(block) {
    const ff  = block.fontFamily    || 'Jameel Noori Nastaleeq';
    const dir = block.direction     || 'rtl';
    const ta  = block.textAlign     || (dir === 'ltr' ? 'justify' : 'right');

    // JNN Nastaleeq calligraphic glyphs have tall ascenders/descenders.
    // At line-height < 1.8 the ink overflows the CSS line box and overlaps
    // the adjacent line (the root cause of "مخرج نمبر overlap").
    // Use 1.8 as the compact-safe minimum for ALL RTL text in PDF.
    const isNastaleeq = ff.indexOf('Jameel')    !== -1 ||
                        ff.indexOf('Nastaleeq') !== -1 ||
                        ff.indexOf('Nastaliq')  !== -1;
    const defaultLH = PDF_DENSITY === 'professional-compact'
      ? (dir === 'ltr' ? '1.45' : '1.8')   // was '1.55' — caused glyph overlap
      : (dir === 'ltr' ? '1.6'  : '2.0');
    const lh = block.lineHeight ? block.lineHeight : defaultLH;
    console.log(`[PDF_LINE_HEIGHT_APPLIED] font=${ff} dir=${dir} lh=${lh}`);

    // letter-spacing on Nastaleeq forces html2canvas into per-code-point runs;
    // ligature widths are ignored so glyphs stack. Strip unconditionally.
    const ls = (block.letterSpacing && !isNastaleeq) ? `letter-spacing:${block.letterSpacing};` : '';

    // Only apply explicit user word-spacing; do NOT add a default.
    // Auto-adding 3px caused short phrases to wrap and then overlap vertically
    // at the tight line-height — it was the primary source of reported overlap.
    const ws = block.wordSpacing ? `word-spacing:${block.wordSpacing};` : '';

    const mt  = block.marginTop    || '6px';
    const mb  = block.marginBottom || '6px';
    const rtlSafety = dir === 'rtl' ? 'overflow-wrap:normal;word-break:normal;hyphens:none;' : '';
    const base =
      `font-family:'${ff}',serif;font-size:16px;direction:${dir};` +
      `text-align:${ta};line-height:${lh};${ls}${ws}${rtlSafety}color:#000;`;

    const content = normalizeHighlights(styleListsInContent(clean(block.content || '')));
    const t = document.createElement('div');
    t.innerHTML = content;
    const kids = Array.from(t.children);

    // No element children (plain text or empty) — wrap as single chunk
    if (kids.length === 0) {
      if (!t.textContent.trim()) return [];
      const el = document.createElement('div');
      el.style.cssText = base + `margin-top:${mt};margin-bottom:${mb};`;
      el.innerHTML = content;
      // pdfCompactify normalises any inline styles baked into the editor HTML
      // (e.g. line-height:2.8 from a user preset). Without this call the chunk
      // is measured at the inflated line-height and fitsAt() returns false even
      // when 30–50 % of the page is still available — the blank-space bug.
      pdfCompactify(el);
      return [el];
    }

    // Single element — one chunk (splitOversizedChunk will bisect if needed)
    if (kids.length === 1) {
      const el = document.createElement('div');
      el.style.cssText = base + `margin-top:${mt};margin-bottom:${mb};`;
      el.appendChild(kids[0].cloneNode(true));
      pdfCompactify(el);
      return [el];
    }

    // Multiple elements — one chunk per element, each carrying the block styles
    return kids.map((child, idx) => {
      const w = document.createElement('div');
      w.style.cssText = base +
        `margin-top:${idx === 0 ? mt : '6px'};` +
        `margin-bottom:${idx === kids.length - 1 ? mb : '6px'};`;
      w.appendChild(child.cloneNode(true));
      pdfCompactify(w);
      return w;
    });
  }
}

// ── PDF pagination entry point ───────────────────────────────────────
function pdfPaginate(doc, container) {
  const layout = new PageLayoutEngine(doc, container);
  new PaginationEngine(layout).run(doc.blocks || []);
  return layout.finalize();
}

// ── Per-page capture ─────────────────────────────────────────────────
// html2canvas requires the element to be at the viewport origin (0,0).
// One page at a time to avoid off-viewport rendering bugs.
//
// Key decisions:
//  • z-index:9999  — page renders above app chrome so no other element
//                    bleeds into the capture
//  • overflow:visible — prevents the wrapper from clipping Nastaleeq glyphs
//                       whose ink extends outside their CSS line boxes
//  • NO windowWidth/windowHeight — these make html2canvas lie about the
//    viewport size. For RTL text, html2canvas uses window width to compute
//    the right-edge anchor of each text run. Forcing 794 when the real window
//    is e.g. 1920 px shifts every RTL run by (1920−794) px, causing glyphs
//    to land on top of each other. Omit them and let html2canvas read the
//    real window.innerWidth / window.innerHeight.
async function pdfCapturePage(html2canvas, pageEl) {
  // ── Issue 2 fix: force consistent font/direction on every content element
  // before capture. Some entries inherit a different font-family or miss an
  // explicit direction:rtl depending on how the editor stored the block, which
  // makes html2canvas use different font metrics → glyphs land at wrong X.
  // We target only [data-pdf-content] so the decorative header flex layout
  // (which needs its own direction context) is unaffected.
  const contentZone = pageEl.querySelector('[data-pdf-content]');
  if (contentZone) {
    contentZone.querySelectorAll('*').forEach(node => {
      if (!(node instanceof HTMLElement)) return;
      node.style.fontFamily    = "'Jameel Noori Nastaleeq', serif";
      node.style.direction     = 'rtl';
      node.style.unicodeBidi   = 'embed';
      node.style.fontSynthesis = 'none';
    });
    console.log(`[PDF_URDU_STYLE_APPLIED] forced JNN+RTL on ${contentZone.querySelectorAll('*').length} nodes`);
  }

  const wrap = document.createElement('div');
  wrap.style.cssText =
    `position:fixed;left:0;top:0;z-index:9999;pointer-events:none;` +
    `width:${PL.cssW}px;height:${PL.cssH}px;overflow:visible;`;
  document.body.appendChild(wrap);
  wrap.appendChild(pageEl);
  void pageEl.getBoundingClientRect();

  console.log(`[PDF_CANVAS_SCALE] scale=2 dpr=${window.devicePixelRatio}`);
  console.log(`[PDF_GLYPH_RENDER] capturing ${PL.cssW}×${PL.cssH} → canvas ${PL.cssW*2}×${PL.cssH*2}`);

  const canvas = await html2canvas(pageEl, {
    scale:           2,
    useCORS:         true,
    allowTaint:      false,
    backgroundColor: '#ffffff',
    logging:         false,
    width:           PL.cssW,
    height:          PL.cssH,
    x:               0,
    y:               0,
    scrollX:         0,
    scrollY:         0,
    imageTimeout:    15000,
    onclone: (clonedDoc) => {
      // Inject a stylesheet into the html2canvas clone. The cloneNode pass
      // copies inline styles but not always the cascaded computed value.
      // Adding !important here guarantees every content node uses JNN metrics,
      // eliminating the per-entry inconsistency where some glyphs used a
      // fallback font with different advance widths.
      const s = clonedDoc.createElement('style');
      s.textContent =
        `[data-pdf-content] * {` +
        ` font-family: 'Jameel Noori Nastaleeq', serif !important;` +
        ` font-synthesis: none !important;` +
        ` direction: rtl !important;` +
        ` unicode-bidi: embed !important;` +
        `}`;
      clonedDoc.head.appendChild(s);
    },
  });

  document.body.removeChild(wrap);
  return canvas;
}
function detectScriptLanguage(text) {
  if (!text) return 'ur';
  const stripped = text.replace(/<[^>]*>/g, '').replace(/\s/g, '');
  if (!stripped.length) return 'ur';
  const arabicUrduChars = (stripped.match(/[؀-ۿ]/g) || []).length;
  const ratio = arabicUrduChars / stripped.length;
  if (ratio < 0.15) return 'en';
  const hasUrduSpecific = /[ھیےہڈڑژگںک]/.test(text);
  return hasUrduSpecific ? 'ur' : 'ar';
}
function fontForLang(lang) {
  if (lang === 'en') return 'Georgia';
  if (lang === 'ar') return 'Noto Naskh Arabic';
  return 'Jameel Noori Nastaleeq';
}
function dirForLang(lang)    { return lang === 'en' ? 'ltr' : 'rtl'; }
function alignForLang(lang)  { return lang === 'en' ? 'justify' : 'right'; }
function lhForLang(lang)     { return lang === 'en' ? '1.6' : lang === 'ar' ? '1.8' : '2.0'; }

// ── Document helpers ────────────────────────────────────────────
function genId() { return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; }

function createEmptyDoc() {
  return {
    id: genId(), name: 'Untitled Document',
    headerLeft: '', headerCenter: '', headerRight: '',
    footerLeft: '',  footerCenter: '', footerRight: '',
    headerFontFamily: 'Noto Naskh Arabic', headerFontSize: 10,
    footerFontFamily: 'Noto Naskh Arabic', footerFontSize: 9,
    footerHairline: true, showPageNumber: true,
    pageNumberPosition: 'header-right', pageNumberStart: 1,
    headerStyle: 'plain',
    blocks: [], createdAt: Date.now(), updatedAt: Date.now(),
  };
}

function createBlock(type) {
  const id = genId();
  switch (type) {
    case 'chapter_heading': return { id, type, arabicTitle: '', urduSubtitle: '' };
    case 'hadith':          return { id, type, number: '', arabicMatn: '', urduTranslation: '', arabicFont: 'Noto Naskh Arabic' };
    case 'fiqh':            return { id, type, heading: 'فقہ الحدیث:', points: [''] };
    case 'reference':       return { id, type, content: '' };
    case 'verse':           return { id, type, arabicText: '', urduText: '' };
    default:                return { id, type: 'free_text', content: '' };
  }
}

function loadDocs() { try { return JSON.parse(localStorage.getItem(LS_KEY) || '[]'); } catch { return []; } }
function saveDocs(docs) { try { localStorage.setItem(LS_KEY, JSON.stringify(docs)); } catch {} }
function relDate(ts) {
  if (!ts) return '';
  const d = Math.floor((Date.now() - ts) / 86400000);
  return d === 0 ? 'today' : d === 1 ? 'yesterday' : `${d}d ago`;
}

// ── Composite Toolbar ───────────────────────────────────────────
function CompositeToolbar({ tab, onTabChange, doc, onDocChange, editorCtx }) {
  const { activeEditorRef, savedRangeRef, saveRange } = editorCtx;

  // Font size state (pt-based, Word-style)
  const [currentPt, setCurrentPt] = useState(12);
  const [customPtInput, setCustomPtInput] = useState('');

  // Spacing tab state
  const [customLH, setCustomLH]     = useState('');
  const [paraBefore, setParaBefore] = useState('');
  const [paraAfter, setParaAfter]   = useState('');
  const [customLS, setCustomLS]     = useState('');
  const [wordSpPx, setWordSpPx]     = useState(0);

  function restoreRange() {
    if (!activeEditorRef.current || !savedRangeRef.current) return false;
    try {
      activeEditorRef.current.focus();
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRangeRef.current);
      return true;
    } catch { return false; }
  }

  function execCmd(cmd) {
    activeEditorRef.current?.focus();
    document.execCommand(cmd, false, null);
    // Save range after execCommand so subsequent toolbar actions still work
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && activeEditorRef.current?.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  }

  // Apply a style property at the cursor position (no selection required)
  function applyAtCursor(prop, val) {
    const el = activeEditorRef.current;
    if (!el) return;
    el.focus();
    if (prop === 'fontFamily') {
      // execCommand fontName works at cursor position for next typed chars
      document.execCommand('fontName', false, val);
      return;
    }
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return;
    // Insert zero-width space inside a styled span so typing inherits the style
    const span = document.createElement('span');
    span.style[prop] = val;
    span.appendChild(document.createTextNode('​'));
    range.insertNode(span);
    const nr = document.createRange();
    nr.setStart(span.firstChild, 1);
    nr.collapse(true);
    sel.removeAllRanges();
    sel.addRange(nr);
    savedRangeRef.current = nr.cloneRange();
  }

  // Wraps selected text in a span with inline styles (preserved in HTML/PDF)
  function applyStyleSafely(range, styleProps) {
    const makeSpan = () => {
      const s = document.createElement('span');
      Object.entries(styleProps).forEach(([p, v]) => { s.style[p] = v; });
      return s;
    };
    try {
      const span = makeSpan();
      range.surroundContents(span);
      return span;
    } catch {}

    const ancestor = range.commonAncestorContainer;
    const root = ancestor.nodeType === Node.TEXT_NODE ? ancestor.parentNode : ancestor;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const textNodes = [];
    while (walker.nextNode()) {
      if (range.intersectsNode(walker.currentNode)) textNodes.push(walker.currentNode);
    }

    let lastSpan = null;
    textNodes.forEach(textNode => {
      if (!textNode.parentNode) return;
      const start = textNode === range.startContainer ? range.startOffset : 0;
      const end   = textNode === range.endContainer   ? range.endOffset   : textNode.length;
      if (start >= end) return;
      const nr = document.createRange();
      nr.setStart(textNode, start);
      nr.setEnd(textNode, end);
      const span = makeSpan();
      try { nr.surroundContents(span); lastSpan = span; } catch {}
    });
    return lastSpan;
  }

  function applySpanStyle(prop, val) {
    restoreRange();
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      applyAtCursor(prop, val);
      return;
    }
    const range = sel.getRangeAt(0);
    const lastSpan = applyStyleSafely(range, { [prop]: val });
    // Keep text selected after formatting so next toolbar action works immediately
    if (lastSpan) {
      const nr = document.createRange();
      nr.selectNodeContents(lastSpan);
      sel.removeAllRanges();
      sel.addRange(nr);
      savedRangeRef.current = nr.cloneRange();
    } else if (sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  }

  function applyColor(color) {
    restoreRange();
    document.execCommand('foreColor', false, color);
    // Save range so next toolbar action still has a target
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  }

  function applyHighlight(color) {
    restoreRange();
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const lastSpan = applyStyleSafely(range, { backgroundColor: color });
    if (lastSpan) {
      const nr = document.createRange();
      nr.selectNodeContents(lastSpan);
      sel.removeAllRanges();
      sel.addRange(nr);
      savedRangeRef.current = nr.cloneRange();
    } else if (sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  }

  // Applies a CSS property to the active block-level editor element
  function applyBlockProp(prop, val) {
    const el = activeEditorRef.current;
    if (!el) return;
    // Block-level layout properties must live on the container, not on inline children.
    // Applying textAlign/direction on a <span> has no visual effect.
    const CONTAINER_PROPS = new Set(['textAlign', 'direction', 'lineHeight', 'marginTop',
      'marginBottom', 'letterSpacing', 'wordSpacing']);
    if (CONTAINER_PROPS.has(prop)) {
      el.style[prop] = val;
      return;
    }
    // For other props, try to find the nearest direct-child block element
    const sel = window.getSelection();
    let target = el;
    const range = sel?.rangeCount > 0 ? sel.getRangeAt(0) : null;
    if (range) {
      let node = range.commonAncestorContainer;
      if (node.nodeType === 3) node = node.parentNode;
      while (node && node !== el && node.parentNode !== el) node = node.parentNode;
      if (node && node !== el) target = node;
    }
    target.style[prop] = val;
  }

  // Font size (pt → px conversion)
  function applyPtSize(pt) {
    setCurrentPt(pt);
    restoreRange();
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      applyAtCursor('fontSize', ptToPx(pt));
      return;
    }
    const range = sel.getRangeAt(0);
    const lastSpan = applyStyleSafely(range, { fontSize: ptToPx(pt) });
    if (lastSpan) {
      const nr = document.createRange();
      nr.selectNodeContents(lastSpan);
      sel.removeAllRanges();
      sel.addRange(nr);
      savedRangeRef.current = nr.cloneRange();
    } else if (sel.rangeCount > 0) {
      savedRangeRef.current = sel.getRangeAt(0).cloneRange();
    }
  }

  function increasePt() {
    const idx = PT_SIZES.indexOf(currentPt);
    applyPtSize(idx < PT_SIZES.length - 1 ? PT_SIZES[idx + 1] : currentPt);
  }

  function decreasePt() {
    const idx = PT_SIZES.indexOf(currentPt);
    applyPtSize(idx > 0 ? PT_SIZES[idx - 1] : currentPt);
  }

  function commitCustomPt() {
    const pt = parseInt(customPtInput, 10);
    if (pt > 0 && pt <= 400) applyPtSize(pt);
    setCustomPtInput('');
  }

  function applyPreset(preset) {
    restoreRange();
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) return;
    const range = sel.getRangeAt(0);
    const s = preset.styles;
    const styleProps = {};
    if (s.fontFamily) styleProps.fontFamily = s.fontFamily;
    if (s.fontSize)   styleProps.fontSize   = s.fontSize;
    if (s.fontWeight && s.fontWeight !== 'normal') styleProps.fontWeight = s.fontWeight;
    if (s.lineHeight) styleProps.lineHeight = s.lineHeight;
    const lastSpan = applyStyleSafely(range, styleProps);
    if (s.textAlign || s.direction) {
      let node = (lastSpan || range.commonAncestorContainer);
      if (node && node.nodeType === Node.TEXT_NODE) node = node.parentElement;
      while (node && node.parentNode !== activeEditorRef.current) node = node.parentNode;
      const tgt = (node && node !== activeEditorRef.current) ? node : activeEditorRef.current;
      if (tgt) {
        if (s.textAlign) tgt.style.textAlign = s.textAlign;
        if (s.direction) tgt.style.direction = s.direction;
      }
    }
  }

  // Spacing tab helpers — block-level changes (captured by FreeTextEditor on save)
  function applyBlockLineHeight(lh) { applyBlockProp('lineHeight', lh); }
  function applyBlockParaBefore(v) { applyBlockProp('marginTop', v + 'px'); }
  function applyBlockParaAfter(v)  { applyBlockProp('marginBottom', v + 'px'); }

  function applyBlockLetterSpacing(v) {
    // Apply inline (selection) if text is selected, else block-level
    const sel = window.getSelection();
    if (savedRangeRef.current) restoreRange();
    const s2 = window.getSelection();
    if (s2 && !s2.isCollapsed) {
      applySpanStyle('letterSpacing', v);
    } else {
      applyBlockProp('letterSpacing', v);
    }
  }

  function applyBlockWordSpacing(v) {
    const sel = window.getSelection();
    if (savedRangeRef.current) restoreRange();
    const s2 = window.getSelection();
    if (s2 && !s2.isCollapsed) {
      applySpanStyle('wordSpacing', v + 'px');
    } else {
      applyBlockProp('wordSpacing', v + 'px');
    }
    setWordSpPx(Number(v));
  }

  const tabCls = (t) =>
    `px-3 py-1.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
      tab === t ? 'border-[var(--brand)] text-[var(--brand)]' : 'border-transparent text-text-muted hover:text-text-secondary'
    }`;

  const btn = 'h-8 min-w-[32px] px-2 text-xs font-medium rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 flex items-center justify-center transition-colors touch-manipulation';
  const btnActive = 'h-8 min-w-[32px] px-2 text-xs font-medium rounded border bg-slate-700 text-white border-slate-700 flex items-center justify-center transition-colors touch-manipulation';
  const sel = 'h-8 px-1.5 text-xs rounded border border-slate-200 bg-white text-slate-700 cursor-pointer hover:bg-slate-50 touch-manipulation';

  return (
    <div className="border border-border rounded-xl bg-slate-50 overflow-hidden mb-3">
      {/* Tab bar */}
      <div className="flex gap-0 border-b border-slate-200 px-2 bg-white overflow-x-auto">
        <button className={tabCls('page')}   onClick={() => onTabChange('page')}>
          <Settings className="w-3 h-3 inline mr-1" />Page
        </button>
        <button className={tabCls('format')} onClick={() => onTabChange('format')}>
          <Type className="w-3 h-3 inline mr-1" />Format
        </button>
        <button className={tabCls('spacing')} onClick={() => onTabChange('spacing')}>
          <span className="inline mr-1 font-bold text-[10px]">¶</span>Spacing
        </button>
        <button className={tabCls('styles')} onClick={() => onTabChange('styles')}>
          <Palette className="w-3 h-3 inline mr-1" />Styles
        </button>
      </div>

      {/* ── PAGE tab ───────────────────────────────────────────── */}
      {tab === 'page' && (
        <div className="p-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <p className="text-[10px] text-text-muted font-semibold uppercase mb-1">Header</p>
              <div className="flex gap-1">
                {['headerRight','headerCenter','headerLeft'].map((k, i) => (
                  <input key={k} className="flex-1 h-6 px-1.5 text-xs border border-slate-200 rounded bg-white"
                    placeholder={['Right','Center','Left'][i]}
                    value={doc[k] || ''} onChange={e => onDocChange({ [k]: e.target.value })} />
                ))}
              </div>
              <div className="flex gap-1 mt-1">
                <select className={`${sel} flex-1`} value={doc.headerFontFamily || 'Noto Naskh Arabic'}
                  onChange={e => onDocChange({ headerFontFamily: e.target.value })}>
                  {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <input type="number" className="h-7 w-12 px-1 text-xs border border-slate-200 rounded bg-white"
                  value={doc.headerFontSize || 10}
                  onChange={e => onDocChange({ headerFontSize: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <p className="text-[10px] text-text-muted font-semibold uppercase mb-1">Footer</p>
              <div className="flex gap-1">
                {['footerRight','footerCenter','footerLeft'].map((k, i) => (
                  <input key={k} className="flex-1 h-6 px-1.5 text-xs border border-slate-200 rounded bg-white"
                    placeholder={['Right','Center','Left'][i]}
                    value={doc[k] || ''} onChange={e => onDocChange({ [k]: e.target.value })} />
                ))}
              </div>
              <div className="flex gap-1 mt-1">
                <select className={`${sel} flex-1`} value={doc.footerFontFamily || 'Noto Naskh Arabic'}
                  onChange={e => onDocChange({ footerFontFamily: e.target.value })}>
                  {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
                <input type="number" className="h-7 w-12 px-1 text-xs border border-slate-200 rounded bg-white"
                  value={doc.footerFontSize || 9}
                  onChange={e => onDocChange({ footerFontSize: Number(e.target.value) })} />
              </div>
            </div>
          </div>
          <div className="flex gap-2 items-center">
            <p className="text-[10px] text-text-muted font-semibold uppercase whitespace-nowrap">Header Style</p>
            <div className="flex gap-1">
              {['plain','decorative'].map(s => (
                <button key={s}
                  className={`h-6 px-3 text-xs rounded border transition-colors touch-manipulation ${(doc.headerStyle || 'plain') === s ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                  onClick={() => onDocChange({ headerStyle: s })}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-3 items-center">
            <label className="flex items-center gap-1 text-xs text-text-secondary cursor-pointer">
              <input type="checkbox" checked={doc.showPageNumber !== false}
                onChange={e => onDocChange({ showPageNumber: e.target.checked })} />
              Page Numbers
            </label>
            <select className={sel} value={doc.pageNumberPosition || 'header-right'}
              onChange={e => onDocChange({ pageNumberPosition: e.target.value })}>
              {['header-right','header-center','header-left','footer-right','footer-center','footer-left','none'].map(v => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <span className="text-xs text-text-muted">Start:</span>
            <input type="number" min="1" className="h-6 w-12 px-1 text-xs border border-slate-200 rounded bg-white"
              value={doc.pageNumberStart || 1}
              onChange={e => onDocChange({ pageNumberStart: Number(e.target.value) })} />
            <label className="flex items-center gap-1 text-xs text-text-secondary cursor-pointer">
              <input type="checkbox" checked={doc.footerHairline !== false}
                onChange={e => onDocChange({ footerHairline: e.target.checked })} />
              Footer hairline
            </label>
          </div>
        </div>
      )}

      {/* ── FORMAT tab (enhanced) ──────────────────────────────── */}
      {tab === 'format' && (
        <div className="p-2 space-y-1.5">

          {/* Row 1: Font family + pt size + Increase/Decrease + custom */}
          <div className="overflow-x-auto pb-0.5">
            <div className="flex gap-1 items-center min-w-max">
              {/* Font family grouped select */}
              <select className={`${sel} min-w-[150px]`} defaultValue=""
                onMouseDown={saveRange}
                onChange={e => { if (e.target.value) { applySpanStyle('fontFamily', e.target.value); e.target.value = ''; } }}>
                <option value="" disabled>Font Family</option>
                {FONT_GROUPS.map(g => (
                  <optgroup key={g.group} label={g.group}>
                    {g.fonts.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </optgroup>
                ))}
              </select>

              <div className="w-px h-5 bg-slate-200 shrink-0" />

              {/* Point size dropdown */}
              <select className={`${sel} w-16`} value={currentPt}
                onMouseDown={saveRange}
                onChange={e => applyPtSize(Number(e.target.value))}>
                {PT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>

              {/* Decrease / Increase buttons */}
              <button className={btn} title="Decrease font size"
                onMouseDown={e => { e.preventDefault(); decreasePt(); }}>
                <span className="text-[11px] font-bold">A-</span>
              </button>
              <button className={btn} title="Increase font size"
                onMouseDown={e => { e.preventDefault(); increasePt(); }}>
                <span className="text-[11px] font-bold">A+</span>
              </button>

              {/* Custom pt input */}
              <input type="number" min="1" max="400"
                className="h-8 w-14 px-1.5 text-xs border border-slate-200 rounded bg-white text-center"
                placeholder="pt"
                value={customPtInput}
                onMouseDown={saveRange}
                onChange={e => setCustomPtInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && commitCustomPt()}
                onBlur={commitCustomPt}
                title="Custom size (pt)" />
            </div>
          </div>

          {/* Row 2: Text decoration + colors + alignment + direction */}
          <div className="overflow-x-auto pb-0.5">
            <div className="flex gap-1 items-center min-w-max">
              {/* Basic formatting */}
              <button className={btn} title="Bold (Ctrl+B)"
                onMouseDown={e => { e.preventDefault(); execCmd('bold'); }}>
                <Bold className="w-3.5 h-3.5" />
              </button>
              <button className={btn} title="Italic (Ctrl+I)"
                onMouseDown={e => { e.preventDefault(); execCmd('italic'); }}>
                <Italic className="w-3.5 h-3.5" />
              </button>
              <button className={btn} title="Underline (Ctrl+U)"
                onMouseDown={e => { e.preventDefault(); execCmd('underline'); }}>
                <Underline className="w-3.5 h-3.5" />
              </button>
              <button className={btn} title="Strikethrough"
                onMouseDown={e => { e.preventDefault(); execCmd('strikeThrough'); }}>
                <Strikethrough className="w-3.5 h-3.5" />
              </button>
              <button className={btn} title="Superscript"
                onMouseDown={e => { e.preventDefault(); execCmd('superscript'); }}>
                <Superscript className="w-3.5 h-3.5" />
              </button>
              <button className={btn} title="Subscript"
                onMouseDown={e => { e.preventDefault(); execCmd('subscript'); }}>
                <Subscript className="w-3.5 h-3.5" />
              </button>

              <div className="w-px h-5 bg-slate-200 shrink-0" />

              {/* Text color */}
              <label className="relative cursor-pointer" title="Text color">
                <div className={`${btn} gap-1`}>
                  <span className="text-[10px] font-bold">A</span>
                  <span className="w-3 h-1 rounded-sm" id="txt-color-swatch" style={{ background: '#000000', display: 'block' }} />
                </div>
                <input type="color" className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  defaultValue="#000000"
                  onMouseDown={saveRange}
                  onChange={e => {
                    applyColor(e.target.value);
                    const sw = document.getElementById('txt-color-swatch');
                    if (sw) sw.style.background = e.target.value;
                  }} />
              </label>

              {/* Highlight color */}
              <label className="relative cursor-pointer" title="Highlight color">
                <div className={`${btn} gap-1`}>
                  <Highlighter className="w-3.5 h-3.5" />
                  <span className="w-3 h-1 rounded-sm" id="hl-color-swatch" style={{ background: '#ffff00', display: 'block' }} />
                </div>
                <input type="color" className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  defaultValue="#ffff00"
                  onMouseDown={saveRange}
                  onChange={e => {
                    applyHighlight(e.target.value);
                    const sw = document.getElementById('hl-color-swatch');
                    if (sw) sw.style.background = e.target.value;
                  }} />
              </label>

              {/* Clear formatting */}
              <button className={btn} title="Clear formatting"
                onMouseDown={e => {
                  e.preventDefault();
                  restoreRange();
                  document.execCommand('removeFormat', false, null);
                }}>
                <Eraser className="w-3.5 h-3.5" />
              </button>

              <div className="w-px h-5 bg-slate-200 shrink-0" />

              {/* Alignment */}
              <button className={btn} title="Align Right"
                onMouseDown={e => { e.preventDefault(); applyBlockProp('textAlign','right'); }}>
                <AlignRight className="w-3.5 h-3.5" />
              </button>
              <button className={btn} title="Align Center"
                onMouseDown={e => { e.preventDefault(); applyBlockProp('textAlign','center'); }}>
                <AlignCenter className="w-3.5 h-3.5" />
              </button>
              <button className={btn} title="Align Left"
                onMouseDown={e => { e.preventDefault(); applyBlockProp('textAlign','left'); }}>
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
              <button className={btn} title="Justify"
                onMouseDown={e => { e.preventDefault(); applyBlockProp('textAlign','justify'); }}>
                <AlignJustify className="w-3.5 h-3.5" />
              </button>

              <div className="w-px h-5 bg-slate-200 shrink-0" />

              {/* Direction */}
              <button className={btn} title="Right-to-Left"
                onMouseDown={e => { e.preventDefault(); applyBlockProp('direction','rtl'); }}>
                <span className="text-[10px] font-semibold">RTL</span>
              </button>
              <button className={btn} title="Left-to-Right"
                onMouseDown={e => { e.preventDefault(); applyBlockProp('direction','ltr'); }}>
                <span className="text-[10px] font-semibold">LTR</span>
              </button>
            </div>
          </div>

          {/* Row 3: Lists */}
          <div className="overflow-x-auto pb-0.5">
            <div className="flex gap-1 items-center min-w-max">
              <span className="text-[10px] text-text-muted font-semibold uppercase mr-1">Lists:</span>
              <button className={btn} title="Bullet list"
                onMouseDown={e => { e.preventDefault(); execCmd('insertUnorderedList'); }}>
                <List className="w-3.5 h-3.5" />
              </button>
              <button className={btn} title="Numbered list"
                onMouseDown={e => { e.preventDefault(); execCmd('insertOrderedList'); }}>
                <ListOrdered className="w-3.5 h-3.5" />
              </button>
              <button className={btn} title="Indent"
                onMouseDown={e => { e.preventDefault(); execCmd('indent'); }}>
                <span className="text-[10px]">→</span>
              </button>
              <button className={btn} title="Outdent"
                onMouseDown={e => { e.preventDefault(); execCmd('outdent'); }}>
                <span className="text-[10px]">←</span>
              </button>
              <div className="w-px h-5 bg-slate-200 shrink-0 mx-1" />
              <span className="text-[10px] text-text-muted">Tip: Ctrl+Z / Ctrl+Y to Undo / Redo</span>
            </div>
          </div>
        </div>
      )}

      {/* ── SPACING tab ────────────────────────────────────────── */}
      {tab === 'spacing' && (
        <div className="p-3 space-y-3">

          {/* Line Height */}
          <div>
            <p className="text-[10px] text-text-muted font-semibold uppercase mb-1.5">Line Spacing</p>
            <div className="flex gap-1 flex-wrap items-center">
              {LINE_HEIGHTS.map(lh => (
                <button key={lh}
                  className="h-7 px-2.5 text-xs rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition-colors"
                  onClick={() => applyBlockLineHeight(lh)}>
                  {lh}
                </button>
              ))}
              <div className="flex items-center gap-1 ml-1">
                <span className="text-[10px] text-text-muted">Custom:</span>
                <input type="number" step="0.1" min="0.5" max="5"
                  className="h-7 w-16 px-1.5 text-xs border border-slate-200 rounded bg-white"
                  placeholder="e.g. 1.8"
                  value={customLH}
                  onChange={e => setCustomLH(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && customLH) { applyBlockLineHeight(customLH); setCustomLH(''); } }}
                  onBlur={() => { if (customLH) { applyBlockLineHeight(customLH); setCustomLH(''); } }} />
              </div>
            </div>
          </div>

          {/* Paragraph Spacing */}
          <div>
            <p className="text-[10px] text-text-muted font-semibold uppercase mb-1.5">Paragraph Spacing</p>
            <div className="flex gap-3 items-center flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-text-muted whitespace-nowrap">Before (px):</span>
                <input type="number" min="0" max="200"
                  className="h-7 w-16 px-1.5 text-xs border border-slate-200 rounded bg-white"
                  value={paraBefore}
                  onChange={e => { setParaBefore(e.target.value); applyBlockParaBefore(e.target.value || '0'); }} />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-text-muted whitespace-nowrap">After (px):</span>
                <input type="number" min="0" max="200"
                  className="h-7 w-16 px-1.5 text-xs border border-slate-200 rounded bg-white"
                  value={paraAfter}
                  onChange={e => { setParaAfter(e.target.value); applyBlockParaAfter(e.target.value || '0'); }} />
              </div>
            </div>
          </div>

          {/* Letter Spacing */}
          <div>
            <p className="text-[10px] text-text-muted font-semibold uppercase mb-1.5">Letter Spacing</p>
            <div className="flex gap-1 flex-wrap items-center">
              {LETTER_SPACINGS.map(ls => (
                <button key={ls.value}
                  className="h-7 px-2.5 text-xs rounded border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition-colors"
                  onClick={() => applyBlockLetterSpacing(ls.value)}>
                  {ls.label}
                </button>
              ))}
              <div className="flex items-center gap-1 ml-1">
                <span className="text-[10px] text-text-muted">Custom (em):</span>
                <input type="number" step="0.01" min="-0.2" max="1"
                  className="h-7 w-16 px-1.5 text-xs border border-slate-200 rounded bg-white"
                  placeholder="0.05"
                  value={customLS}
                  onChange={e => setCustomLS(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && customLS) { applyBlockLetterSpacing(customLS + 'em'); setCustomLS(''); } }}
                  onBlur={() => { if (customLS) { applyBlockLetterSpacing(customLS + 'em'); setCustomLS(''); } }} />
              </div>
            </div>
          </div>

          {/* Word Spacing slider */}
          <div>
            <p className="text-[10px] text-text-muted font-semibold uppercase mb-1.5">
              Word Spacing &nbsp;<span className="font-normal normal-case">{wordSpPx}px</span>
            </p>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-text-muted">−5</span>
              <input type="range" min="-5" max="20" step="0.5"
                className="flex-1 h-1.5 accent-[var(--brand)]"
                value={wordSpPx}
                onChange={e => applyBlockWordSpacing(e.target.value)} />
              <span className="text-[10px] text-text-muted">20</span>
            </div>
          </div>

          <p className="text-[10px] text-text-muted border-t border-slate-100 pt-2">
            Line &amp; paragraph spacing apply to the current block editor. Letter / word spacing also apply to selected text inline (preserved in PDF).
          </p>
        </div>
      )}

      {/* ── STYLES tab (presets, unchanged behaviour) ──────────── */}
      {tab === 'styles' && (
        <div className="p-2">
          <div className="overflow-x-auto pb-1">
            <div className="flex gap-1 min-w-max flex-wrap max-w-none">
              {STYLE_PRESETS.map(p => (
                <button key={p.key}
                  className="h-8 px-2.5 text-[11px] rounded border border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100 transition-colors whitespace-nowrap touch-manipulation"
                  onMouseDown={e => { e.preventDefault(); applyPreset(p); }}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-text-muted mt-1.5">
            Select text first, then click a preset to apply its font/size/weight/alignment.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Shared contenteditable field helper ─────────────────────────
function CE({ value, editorCtx, className, style, placeholder, ...rest }) {
  const ref = useRef(null);
  const { activeEditorRef, savedRangeRef, saveRange } = editorCtx;

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || '')) {
      ref.current.innerHTML = value || '';
    }
  }, []); // mount only

  return (
    <div
      ref={ref}
      contentEditable
      suppressContentEditableWarning
      className={className}
      style={{ outline: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 10px', minHeight: 48, cursor: 'text', ...style }}
      data-placeholder={placeholder}
      onFocus={() => { activeEditorRef.current = ref.current; }}
      onKeyUp={saveRange}
      onSelect={saveRange}
      onMouseUp={saveRange}
      {...rest}
    />
  );
}

// ── Block Editors ───────────────────────────────────────────────
function ChapterHeadingEditor({ block, onSave, onCancel, editorCtx }) {
  const arabicRef = useRef(null);
  const urduRef   = useRef(null);
  useEffect(() => {
    if (arabicRef.current) arabicRef.current.innerHTML = block.arabicTitle  || '';
    if (urduRef.current)   urduRef.current.innerHTML   = block.urduSubtitle || '';
    setTimeout(() => arabicRef.current?.focus(), 50);
  }, [block.id]); // eslint-disable-line

  function handleSave() {
    onSave({ ...block, arabicTitle: arabicRef.current?.innerHTML || '', urduSubtitle: urduRef.current?.innerHTML || '' });
  }

  const ceProps = (ref) => ({
    onFocus: () => { editorCtx.activeEditorRef.current = ref.current; },
    onKeyUp: editorCtx.saveRange,
    onSelect: editorCtx.saveRange,
    onMouseUp: editorCtx.saveRange,
  });

  return (
    <div className="space-y-2">
      <div>
        <p className="text-[10px] text-text-muted mb-1 font-semibold">Arabic Title (Naskh, bold, center)</p>
        <div ref={arabicRef} contentEditable suppressContentEditableWarning
          style={{ fontFamily:"'Noto Naskh Arabic',serif", fontSize:22, direction:'rtl', textAlign:'center', outline:'1px solid #e2e8f0', borderRadius:6, padding:'8px 10px', minHeight:44 }}
          {...ceProps(arabicRef)} />
      </div>
      <div>
        <p className="text-[10px] text-text-muted mb-1 font-semibold">Urdu Subtitle (Nastaleeq, bold, center)</p>
        <div ref={urduRef} contentEditable suppressContentEditableWarning
          style={{ fontFamily:"'Jameel Noori Nastaleeq',serif", fontSize:20, direction:'rtl', textAlign:'center', outline:'1px solid #e2e8f0', borderRadius:6, padding:'8px 10px', minHeight:44 }}
          {...ceProps(urduRef)} />
      </div>
      <EditorActions onSave={handleSave} onCancel={onCancel} />
    </div>
  );
}

function HadithBlockEditor({ block, onSave, onCancel, editorCtx }) {
  const arabicRef = useRef(null);
  const urduRef   = useRef(null);
  const [number, setNumber]     = useState(block.number    || '');
  const [arabicFont, setArabicFont] = useState(block.arabicFont || 'Noto Naskh Arabic');

  useEffect(() => {
    if (arabicRef.current) arabicRef.current.innerHTML = block.arabicMatn      || '';
    if (urduRef.current)   urduRef.current.innerHTML   = block.urduTranslation  || '';
    setTimeout(() => arabicRef.current?.focus(), 50);
  }, [block.id]); // eslint-disable-line

  const ceProps = (ref) => ({
    onFocus: () => { editorCtx.activeEditorRef.current = ref.current; },
    onKeyUp: editorCtx.saveRange,
    onSelect: editorCtx.saveRange,
    onMouseUp: editorCtx.saveRange,
  });

  function handleSave() {
    onSave({ ...block, number, arabicFont, arabicMatn: arabicRef.current?.innerHTML || '', urduTranslation: urduRef.current?.innerHTML || '' });
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-center flex-wrap">
        <div>
          <p className="text-[10px] text-text-muted mb-0.5">Hadith #</p>
          <input className="h-7 px-2 text-sm border border-slate-200 rounded w-16 text-right" dir="rtl"
            value={number} onChange={e => setNumber(e.target.value)} placeholder="١" />
        </div>
        <div>
          <p className="text-[10px] text-text-muted mb-0.5">Arabic Font</p>
          <select className="h-7 px-1 text-xs border border-slate-200 rounded bg-white"
            value={arabicFont} onChange={e => setArabicFont(e.target.value)}>
            <option value="Noto Naskh Arabic">Noto Naskh Arabic</option>
            <option value="Amiri">Amiri</option>
            <option value="Scheherazade New">Scheherazade New</option>
            <option value="Lateef">Lateef</option>
          </select>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <p className="text-[10px] text-text-muted mb-1 font-semibold">Arabic Matn (right column)</p>
          <div ref={arabicRef} contentEditable suppressContentEditableWarning
            style={{ fontFamily:`'${arabicFont}',serif`, fontSize:16, direction:'rtl', textAlign:'justify', lineHeight:1.9, outline:'1px solid #e2e8f0', borderRadius:6, padding:'8px 10px', minHeight:120 }}
            {...ceProps(arabicRef)} />
        </div>
        <div>
          <p className="text-[10px] text-text-muted mb-1 font-semibold">Urdu Translation (left column)</p>
          <div ref={urduRef} contentEditable suppressContentEditableWarning
            style={{ fontFamily:"'Jameel Noori Nastaleeq',serif", fontSize:18, direction:'rtl', textAlign:'right', lineHeight:2.6, outline:'1px solid #e2e8f0', borderRadius:6, padding:'8px 10px', minHeight:120 }}
            {...ceProps(urduRef)} />
        </div>
      </div>
      <EditorActions onSave={handleSave} onCancel={onCancel} />
    </div>
  );
}

function FiqhBlockEditor({ block, onSave, onCancel, editorCtx }) {
  const headingRef = useRef(null);
  const pointsRef  = useRef(null);

  const [previewLines, setPreviewLines] = useState(() =>
    (block.points?.length ? block.points : []).map(html => {
      const d = document.createElement('div'); d.innerHTML = html || ''; return d.textContent || d.innerText || '';
    }).filter(Boolean)
  );

  useEffect(() => {
    if (headingRef.current) headingRef.current.innerHTML = block.heading || 'فقہ الحدیث:';
    if (pointsRef.current) {
      const pts = block.points?.length ? block.points : [''];
      pointsRef.current.innerHTML = pts.map(p => `<div>${p || '<br>'}</div>`).join('');
    }
    setTimeout(() => headingRef.current?.focus(), 50);
  }, [block.id]); // eslint-disable-line

  function readLines() {
    if (!pointsRef.current) return [];
    const divs = Array.from(pointsRef.current.querySelectorAll(':scope > div'));
    if (!divs.length) return [(pointsRef.current.textContent || '').trim()].filter(Boolean);
    return divs.map(d => d.textContent?.trim() || '').filter(Boolean);
  }

  function readPointsHTML() {
    if (!pointsRef.current) return [''];
    const divs = Array.from(pointsRef.current.querySelectorAll(':scope > div'));
    const pts = divs.length
      ? divs.map(d => d.innerHTML.replace(/<br\s*\/?>/gi, '').trim()).filter(Boolean)
      : [pointsRef.current.innerHTML.replace(/<br\s*\/?>/gi, '').trim()].filter(Boolean);
    return pts.length ? pts : [''];
  }

  function updatePreview() { setPreviewLines(readLines()); }

  function handleSave() {
    onSave({
      ...block,
      heading: headingRef.current?.innerHTML || 'فقہ الحدیث:',
      points: readPointsHTML(),
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[10px] text-text-muted mb-1 font-semibold">Section Heading (editable)</p>
        <div
          ref={headingRef}
          contentEditable suppressContentEditableWarning
          style={{ fontFamily:"'Noto Naskh Arabic',serif", fontSize:18, fontWeight:'bold', direction:'rtl', textAlign:'right', outline:'1px solid #e2e8f0', borderRadius:6, padding:'6px 10px', minHeight:36 }}
          onFocus={() => { editorCtx.activeEditorRef.current = headingRef.current; }}
          onKeyUp={editorCtx.saveRange} onSelect={editorCtx.saveRange} onMouseUp={editorCtx.saveRange}
        />
      </div>

      <div>
        <p className="text-[10px] text-text-muted mb-1 font-semibold">Points — one per line, ❶❷❸ added automatically</p>
        <div
          ref={pointsRef}
          contentEditable suppressContentEditableWarning
          style={{ fontFamily:"'Jameel Noori Nastaleeq',serif", fontSize:17, direction:'rtl', textAlign:'right', lineHeight:2.0, outline:'1px solid #e2e8f0', borderRadius:6, padding:'8px 10px', minHeight:100, color:'#000' }}
          onFocus={() => {
            editorCtx.activeEditorRef.current = pointsRef.current;
            document.execCommand('defaultParagraphSeparator', false, 'div');
          }}
          onKeyUp={e  => { editorCtx.saveRange(e);  updatePreview(); }}
          onMouseUp={e => { editorCtx.saveRange(e); updatePreview(); }}
          onSelect={editorCtx.saveRange}
          onInput={updatePreview}
        />
        <p className="text-[10px] text-text-muted mt-1">Press Enter between points. Numbers ❶❷❸ appear automatically in preview and PDF.</p>
      </div>

      {previewLines.length > 0 && (
        <div style={{ background:'#f8fafc', border:'1px solid #e2e8f0', borderRadius:6, padding:'10px 14px', direction:'rtl' }}>
          <p className="text-[10px] text-text-muted mb-2">Preview:</p>
          {previewLines.map((line, i) => (
            <div key={i} style={{ fontFamily:"'Jameel Noori Nastaleeq',serif", fontSize:16, direction:'rtl', textAlign:'right', lineHeight:2.0, color:'#000', marginBottom:1 }}>
              <span style={{ fontSize:22, marginLeft:16, verticalAlign:'middle' }}>{CIRCLED[i] || `(${i + 1})`}</span>{line}
            </div>
          ))}
        </div>
      )}

      <EditorActions onSave={handleSave} onCancel={onCancel} />
    </div>
  );
}

function ReferenceEditor({ block, onSave, onCancel, editorCtx }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = block.content || '';
    setTimeout(() => ref.current?.focus(), 50);
  }, [block.id]); // eslint-disable-line

  function handleSave() { onSave({ ...block, content: ref.current?.innerHTML || '' }); }

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-text-muted font-semibold">Reference / Takhrij (13px, thin top border in PDF)</p>
      <div ref={ref} contentEditable suppressContentEditableWarning
        style={{ fontSize:13, direction:'rtl', textAlign:'right', outline:'1px solid #e2e8f0', borderRadius:6, padding:'8px 10px', minHeight:44 }}
        onFocus={() => { editorCtx.activeEditorRef.current = ref.current; }}
        onKeyUp={editorCtx.saveRange} onSelect={editorCtx.saveRange} onMouseUp={editorCtx.saveRange} />
      <EditorActions onSave={handleSave} onCancel={onCancel} />
    </div>
  );
}

function VerseEditor({ block, onSave, onCancel, editorCtx }) {
  const arabicRef = useRef(null);
  const urduRef   = useRef(null);
  useEffect(() => {
    if (arabicRef.current) arabicRef.current.innerHTML = block.arabicText || '';
    if (urduRef.current)   urduRef.current.innerHTML   = block.urduText   || '';
    setTimeout(() => arabicRef.current?.focus(), 50);
  }, [block.id]); // eslint-disable-line

  const ceProps = (ref) => ({
    onFocus: () => { editorCtx.activeEditorRef.current = ref.current; },
    onKeyUp: editorCtx.saveRange,
    onSelect: editorCtx.saveRange,
    onMouseUp: editorCtx.saveRange,
  });

  function handleSave() {
    onSave({ ...block, arabicText: arabicRef.current?.innerHTML || '', urduText: urduRef.current?.innerHTML || '' });
  }

  return (
    <div className="space-y-2">
      <div>
        <p className="text-[10px] text-text-muted mb-1 font-semibold">Arabic Verse / Intro (centered)</p>
        <div ref={arabicRef} contentEditable suppressContentEditableWarning
          style={{ fontFamily:"'Noto Naskh Arabic',serif", fontSize:18, direction:'rtl', textAlign:'center', outline:'1px solid #e2e8f0', borderRadius:6, padding:'8px 10px', minHeight:44 }}
          {...ceProps(arabicRef)} />
      </div>
      <div>
        <p className="text-[10px] text-text-muted mb-1 font-semibold">Urdu Translation (centered, optional)</p>
        <div ref={urduRef} contentEditable suppressContentEditableWarning
          style={{ fontFamily:"'Jameel Noori Nastaleeq',serif", fontSize:17, direction:'rtl', textAlign:'center', outline:'1px solid #e2e8f0', borderRadius:6, padding:'8px 10px', minHeight:44 }}
          {...ceProps(urduRef)} />
      </div>
      <EditorActions onSave={handleSave} onCancel={onCancel} />
    </div>
  );
}

// FreeTextEditor captures block-level typography on save (font, direction, alignment, spacing)
function FreeTextEditor({ block, onSave, onCancel, editorCtx }) {
  const ref = useRef(null);

  // Resolve defaults from block properties or language detection
  const detectedLang = detectScriptLanguage(block.content || '');
  const initFont  = block.fontFamily  || fontForLang(detectedLang);
  const initDir   = block.direction   || dirForLang(detectedLang);
  const initAlign = block.textAlign   || alignForLang(detectedLang);
  const initLH    = block.lineHeight  || lhForLang(detectedLang);

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = block.content || '';
      // Restore ALL persisted block-level styling
      ref.current.style.fontFamily    = `'${initFont}',serif`;
      ref.current.style.direction     = initDir;
      ref.current.style.textAlign     = initAlign;
      ref.current.style.lineHeight    = initLH;
      if (block.letterSpacing) ref.current.style.letterSpacing = block.letterSpacing;
      if (block.wordSpacing)   ref.current.style.wordSpacing   = block.wordSpacing;
      if (block.marginTop)     ref.current.style.marginTop     = block.marginTop;
      if (block.marginBottom)  ref.current.style.marginBottom  = block.marginBottom;
    }
    setTimeout(() => ref.current?.focus(), 50);
  }, [block.id]); // eslint-disable-line

  function handleSave() {
    const saved = { ...block, content: ref.current?.innerHTML || '' };
    if (ref.current) {
      const s = ref.current.style;
      // Capture all block-level properties so they survive round-trips
      if (s.fontFamily) {
        // Strip the CSS wrapper quotes: "'Georgia',serif" → "Georgia"
        saved.fontFamily = s.fontFamily.replace(/^['"]|['"].*$/g, '').split(',')[0].trim();
      }
      if (s.direction)     saved.direction     = s.direction;
      if (s.textAlign)     saved.textAlign     = s.textAlign;
      if (s.lineHeight)    saved.lineHeight    = s.lineHeight;
      if (s.letterSpacing) saved.letterSpacing = s.letterSpacing;
      if (s.wordSpacing)   saved.wordSpacing   = s.wordSpacing;
      if (s.marginTop)     saved.marginTop     = s.marginTop;
      if (s.marginBottom)  saved.marginBottom  = s.marginBottom;
    }
    onSave(saved);
  }

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-text-muted font-semibold">Free Text Block</p>
      <div ref={ref} contentEditable suppressContentEditableWarning
        style={{
          fontFamily: `'${initFont}',serif`,
          fontSize: 18,
          direction: initDir,
          textAlign: initAlign,
          lineHeight: initLH,
          outline: '1px solid #e2e8f0', borderRadius: 6, padding: '8px 10px', minHeight: 80,
        }}
        onFocus={() => { editorCtx.activeEditorRef.current = ref.current; }}
        onKeyUp={editorCtx.saveRange} onSelect={editorCtx.saveRange} onMouseUp={editorCtx.saveRange} />
      <EditorActions onSave={handleSave} onCancel={onCancel} />
    </div>
  );
}

function EditorActions({ onSave, onCancel }) {
  return (
    <div className="flex gap-2 pt-1">
      <button onClick={onSave} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg transition-opacity hover:opacity-90"
        style={{ background: 'var(--brand)' }}>
        <Save className="w-3 h-3" /> Save Block
      </button>
      <button onClick={onCancel} className="px-3 py-1.5 text-xs font-semibold text-text-muted border border-border rounded-lg hover:bg-surface-2 transition-colors">
        Cancel
      </button>
    </div>
  );
}

// ── Block Card ──────────────────────────────────────────────────
function BlockCard({
  block, idx, total, nextBlock, isEditing,
  onEdit, onDelete, onMoveUp, onMoveDown, onSave, onCancel,
  onDuplicate, onChangeType, onMergeWithNext,
  onDragStart, onDragOver, onDrop, onDragEnd,
  isDragOver, isDragging,
  editorCtx,
}) {
  const [showTypeMenu, setShowTypeMenu] = useState(false);

  const typeLabel = {
    chapter_heading: 'Chapter Heading', hadith: 'Hadith Block',
    fiqh: 'Fiqh Points', reference: 'Reference', verse: 'Verse', free_text: 'Free Text',
  }[block.type] || block.type;

  const typeColor = {
    chapter_heading: 'bg-purple-50 text-purple-700 border-purple-200',
    hadith:          'bg-blue-50 text-blue-700 border-blue-200',
    fiqh:            'bg-green-50 text-green-700 border-green-200',
    reference:       'bg-amber-50 text-amber-700 border-amber-200',
    verse:           'bg-teal-50 text-teal-700 border-teal-200',
    free_text:       'bg-slate-50 text-slate-700 border-slate-200',
  }[block.type] || 'bg-slate-50 text-slate-600 border-slate-200';

  const canMerge = block.type === 'free_text' && nextBlock?.type === 'free_text';
  const htmlPreview = renderBlockHTML(block);

  return (
    <div
      className={`border rounded-xl overflow-hidden mb-2 bg-white transition-all duration-150 ${
        isDragging  ? 'opacity-40 scale-[0.98]' :
        isDragOver  ? 'border-[var(--brand)] shadow-md ring-1 ring-[var(--brand)]/30' :
                      'border-border'
      }`}
      onDragOver={e => { e.preventDefault(); onDragOver?.(e); }}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
    >
      {/* Card header */}
      <div className="flex items-center gap-1 px-2 py-2 bg-surface-2 border-b border-border">

        {/* Drag handle */}
        <div
          className="cursor-grab active:cursor-grabbing p-1 text-text-muted hover:text-text-primary touch-manipulation shrink-0"
          draggable={true}
          onDragStart={e => { e.dataTransfer.effectAllowed = 'move'; onDragStart?.(); }}
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>

        {/* Type badge with click-to-change-type menu */}
        <div className="relative shrink-0">
          <button
            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border cursor-pointer hover:opacity-80 transition-opacity ${typeColor}`}
            onClick={() => setShowTypeMenu(v => !v)}
            title="Change block type">
            {typeLabel} ▾
          </button>
          {showTypeMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowTypeMenu(false)} />
              <div className="absolute left-0 top-full mt-0.5 z-20 bg-white border border-border rounded-lg shadow-lg min-w-[150px] py-0.5">
                {ADD_BLOCK_TYPES.map(t => (
                  <button key={t.type}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-surface-2 transition-colors ${block.type === t.type ? 'font-semibold text-[var(--brand)]' : 'text-text-secondary'}`}
                    onClick={() => { onChangeType(t.type); setShowTypeMenu(false); }}>
                    {t.label.replace('+ ', '')}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex-1" />

        {/* Duplicate */}
        <button onClick={onDuplicate} title="Duplicate block"
          className="p-1 text-text-muted hover:text-[var(--brand)] transition-colors touch-manipulation">
          <Copy className="w-3.5 h-3.5" />
        </button>

        {/* Merge with next (free_text only) */}
        {canMerge && (
          <button onClick={onMergeWithNext} title="Merge with next Free Text block"
            className="p-1 text-[10px] font-semibold text-text-muted hover:text-green-600 transition-colors touch-manipulation whitespace-nowrap">
            ↓Merge
          </button>
        )}

        {/* Move up / down */}
        <button onClick={onMoveUp}   disabled={idx === 0}       title="Move up"
          className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors touch-manipulation">
          <ChevronUp   className="w-3.5 h-3.5" />
        </button>
        <button onClick={onMoveDown} disabled={idx === total-1} title="Move down"
          className="p-1 text-text-muted hover:text-text-primary disabled:opacity-30 transition-colors touch-manipulation">
          <ChevronDown className="w-3.5 h-3.5" />
        </button>

        {/* Edit toggle */}
        {!isEditing && (
          <button onClick={onEdit} title="Edit block"
            className="p-1 text-text-muted hover:text-[var(--brand)] transition-colors touch-manipulation">
            <Edit3 className="w-3.5 h-3.5" />
          </button>
        )}

        {/* Delete */}
        <button onClick={onDelete} title="Delete block"
          className="p-1 text-text-muted hover:text-red-500 transition-colors touch-manipulation">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* View mode: rendered HTML preview */}
      {!isEditing && (
        <div className="px-4 py-3 overflow-x-auto" style={{ background: '#fff', maxHeight: 280, overflowY: 'auto' }}>
          <div dangerouslySetInnerHTML={{ __html: htmlPreview }} style={{ pointerEvents: 'none' }} />
        </div>
      )}

      {/* Edit mode: type-specific editor */}
      {isEditing && (
        <div className="p-4">
          {block.type === 'chapter_heading' && <ChapterHeadingEditor block={block} onSave={onSave} onCancel={onCancel} editorCtx={editorCtx} />}
          {block.type === 'hadith'          && <HadithBlockEditor    block={block} onSave={onSave} onCancel={onCancel} editorCtx={editorCtx} />}
          {block.type === 'fiqh'            && <FiqhBlockEditor      block={block} onSave={onSave} onCancel={onCancel} editorCtx={editorCtx} />}
          {block.type === 'reference'       && <ReferenceEditor      block={block} onSave={onSave} onCancel={onCancel} editorCtx={editorCtx} />}
          {block.type === 'verse'           && <VerseEditor          block={block} onSave={onSave} onCancel={onCancel} editorCtx={editorCtx} />}
          {block.type === 'free_text'       && <FreeTextEditor       block={block} onSave={onSave} onCancel={onCancel} editorCtx={editorCtx} />}
        </div>
      )}
    </div>
  );
}

// ── Decorative header preview (mirrors PDF buildDecorativeHeaderTemplate) ──
function DecorativeHeaderPreview({ doc }) {
  const ff     = `'${doc.headerFontFamily || 'Noto Naskh Arabic'}',serif`;
  const fs     = doc.headerFontSize || 10;
  const showPN = doc.showPageNumber !== false;
  const name   = doc.headerRight || doc.name || '';
  const badge  = { display:'inline-block', border:'1px solid #000', borderRadius:999, fontFamily:ff, fontSize:fs, lineHeight:'20px', color:'#000', flexShrink:0, whiteSpace:'nowrap' };
  return (
    <div style={{ display:'flex', flexDirection:'row', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:16, paddingBottom:4 }}>
      {showPN
        ? <span style={{ ...badge, padding:'0 10px', minWidth:28, textAlign:'center' }}>ص ١</span>
        : <span style={{ ...badge, padding:'0 10px', opacity:0 }}>·</span>}
      <div style={{ flex:1, overflow:'hidden', display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px', minWidth:0 }}>
        <svg width="100%" height="22" viewBox="0 0 400 22" preserveAspectRatio="xMidYMid meet">
          <g transform="translate(200,11)">
            <line x1="0" y1="-6" x2="0" y2="6" stroke="#000" strokeWidth="0.8"/>
            <line x1="-5.2" y1="-3" x2="5.2" y2="3" stroke="#000" strokeWidth="0.8"/>
            <line x1="-5.2" y1="3" x2="5.2" y2="-3" stroke="#000" strokeWidth="0.8"/>
            <circle cx="0" cy="0" r="2.5" fill="none" stroke="#000" strokeWidth="0.7"/>
          </g>
          <path d="M208 11 Q218 7 228 11 Q238 15 248 11 Q258 7 268 11 Q278 15 288 11" fill="none" stroke="#000" strokeWidth="0.7"/>
          <path d="M218 8 Q220 3 224 5" fill="none" stroke="#000" strokeWidth="0.6"/>
          <path d="M238 14 Q242 19 246 17" fill="none" stroke="#000" strokeWidth="0.6"/>
          <path d="M258 8 Q260 3 264 5" fill="none" stroke="#000" strokeWidth="0.6"/>
          <path d="M278 14 Q282 19 286 17" fill="none" stroke="#000" strokeWidth="0.6"/>
          <line x1="288" y1="11" x2="396" y2="11" stroke="#000" strokeWidth="0.4"/>
          <path d="M192 11 Q182 7 172 11 Q162 15 152 11 Q142 7 132 11 Q122 15 112 11" fill="none" stroke="#000" strokeWidth="0.7"/>
          <path d="M182 8 Q180 3 176 5" fill="none" stroke="#000" strokeWidth="0.6"/>
          <path d="M162 14 Q158 19 154 17" fill="none" stroke="#000" strokeWidth="0.6"/>
          <path d="M142 8 Q140 3 136 5" fill="none" stroke="#000" strokeWidth="0.6"/>
          <path d="M122 14 Q118 19 114 17" fill="none" stroke="#000" strokeWidth="0.6"/>
          <line x1="112" y1="11" x2="4" y2="11" stroke="#000" strokeWidth="0.4"/>
        </svg>
      </div>
      <span style={{ ...badge, padding:'0 14px' }}>{name || ' '}</span>
    </div>
  );
}

// ── Preview Modal ────────────────────────────────────────────────
function PreviewModal({ doc, editorCtx, onClose, onDownload, generating, pdfErr }) {
  const [previewEditId, setPreviewEditId] = useState(null);
  const [toolbarTab, setToolbarTab]       = useState('format');
  const scrollRef = useRef(null);
  const [a4Scale, setA4Scale] = useState(1);
  const blocks = doc.blocks || [];

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      const avail = el.clientWidth - 48;
      setA4Scale(Math.min(1, avail / 794));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  function handlePreviewSave(updatedBlock) {
    onDownload('__save__', updatedBlock);
    setPreviewEditId(null);
  }

  // Simulated header
  const pnPos    = doc.showPageNumber !== false ? (doc.pageNumberPosition || 'header-right') : 'none';
  const hRight   = pnPos === 'header-right'  ? 'ص ١' : (doc.headerRight  || '');
  const hCenter  = pnPos === 'header-center' ? 'ص ١' : (doc.headerCenter || doc.name || '');
  const hLeft    = pnPos === 'header-left'   ? 'ص ١' : (doc.headerLeft   || '');
  const fRight   = pnPos === 'footer-right'  ? 'ص ١' : (doc.footerRight  || '');
  const fCenter  = pnPos === 'footer-center' ? 'ص ١' : (doc.footerCenter || '');
  const fLeft    = pnPos === 'footer-left'   ? 'ص ١' : (doc.footerLeft   || '');
  const hff = `'${doc.headerFontFamily || 'Noto Naskh Arabic'}',serif`;
  const fff = `'${doc.footerFontFamily || 'Noto Naskh Arabic'}',serif`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#e5e7eb' }}>
      {/* Top bar */}
      <div className="flex items-center gap-2 px-3 sm:px-4 min-h-[48px] py-2 bg-white border-b border-border shrink-0 flex-wrap">
        <button onClick={onClose} className="flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-primary transition-colors touch-manipulation">
          <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Back to Edit</span>
        </button>
        <div className="flex gap-0 border border-slate-200 rounded-lg overflow-hidden">
          {['page','format','spacing','styles'].map(t => (
            <button key={t} onClick={() => setToolbarTab(t)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors touch-manipulation capitalize ${toolbarTab === t ? 'bg-[var(--brand)] text-white' : 'bg-white text-text-muted hover:bg-slate-50'}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        {pdfErr && <span className="text-xs text-red-600 max-w-[160px] truncate">{pdfErr}</span>}
        <button onClick={() => onDownload('download')} disabled={generating}
          className="flex items-center gap-1.5 px-3 sm:px-4 py-1.5 text-sm font-semibold text-white rounded-lg transition-opacity hover:opacity-90 disabled:opacity-50 touch-manipulation"
          style={{ background: 'var(--brand)' }}>
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          <span className="hidden sm:inline">{generating ? 'Generating…' : 'Download PDF'}</span>
        </button>
      </div>

      {/* Toolbar row */}
      <div className="bg-white border-b border-border px-3 sm:px-4 py-1 shrink-0 overflow-x-auto">
        <CompositeToolbar tab={toolbarTab} onTabChange={setToolbarTab} doc={doc}
          onDocChange={(patch) => onDownload('__patch__', patch)} editorCtx={editorCtx} />
      </div>

      {/* Scrollable A4 preview area */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="flex flex-col xl:flex-row gap-4 items-center xl:items-start xl:justify-center">
          {/* A4 page */}
          <div style={{ width: 794, flexShrink: 0, zoom: a4Scale, alignSelf: 'flex-start' }}>
            <div style={{ background: 'white', boxShadow: '0 4px 24px rgba(0,0,0,0.18)', minHeight: 1123, padding: '40px 76px' }}>
              {/* Simulated header */}
              {doc.headerStyle === 'decorative'
                ? <DecorativeHeaderPreview doc={doc} />
                : <div style={{ display:'flex', justifyContent:'space-between', fontFamily: hff, fontSize: doc.headerFontSize || 10, color:'#555', direction:'rtl', marginBottom: 16, paddingBottom: 6 }}>
                    <span>{hRight}</span><span>{hCenter}</span><span>{hLeft}</span>
                  </div>
              }

              {/* Content blocks */}
              {blocks.length === 0 ? (
                <div className="flex items-center justify-center h-64 text-text-muted text-sm">No blocks yet. Go back and add content.</div>
              ) : (
                blocks.map((block) => (
                  <div key={block.id} className="relative group/pvb">
                    {previewEditId !== block.id && (
                      <button
                        onClick={() => setPreviewEditId(block.id)}
                        className="absolute -right-8 top-0 opacity-0 group-hover/pvb:opacity-100 transition-opacity p-1 bg-white border border-border rounded shadow-sm text-text-muted hover:text-[var(--brand)]"
                        title="Edit block">
                        <Edit3 className="w-3 h-3" />
                      </button>
                    )}
                    <div dangerouslySetInnerHTML={{ __html: renderBlockHTML(block) }} />
                  </div>
                ))
              )}

              {/* Simulated footer */}
              <div style={{ marginTop: 32 }}>
                {doc.footerHairline !== false && (
                  <div style={{ width: '100%', height: '0.5px', background: '#000', marginBottom: 4 }} />
                )}
                <div style={{ display:'flex', justifyContent:'space-between', fontFamily: fff, fontSize: doc.footerFontSize || 9, color:'#555', direction:'rtl' }}>
                  <span>{fRight}</span><span>{fCenter}</span><span>{fLeft}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Inline block editor panel */}
          {previewEditId && (() => {
            const block = blocks.find(b => b.id === previewEditId);
            if (!block) return null;
            return (
              <div className="w-full xl:w-[360px] xl:flex-shrink-0">
                <div className="bg-white rounded-xl shadow-lg border border-border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-semibold text-primary">Edit Block</span>
                    <button onClick={() => setPreviewEditId(null)} className="text-text-muted hover:text-primary"><X className="w-4 h-4" /></button>
                  </div>
                  {block.type === 'chapter_heading' && <ChapterHeadingEditor block={block} onSave={handlePreviewSave} onCancel={() => setPreviewEditId(null)} editorCtx={editorCtx} />}
                  {block.type === 'hadith'          && <HadithBlockEditor    block={block} onSave={handlePreviewSave} onCancel={() => setPreviewEditId(null)} editorCtx={editorCtx} />}
                  {block.type === 'fiqh'            && <FiqhBlockEditor      block={block} onSave={handlePreviewSave} onCancel={() => setPreviewEditId(null)} editorCtx={editorCtx} />}
                  {block.type === 'reference'       && <ReferenceEditor      block={block} onSave={handlePreviewSave} onCancel={() => setPreviewEditId(null)} editorCtx={editorCtx} />}
                  {block.type === 'verse'           && <VerseEditor          block={block} onSave={handlePreviewSave} onCancel={() => setPreviewEditId(null)} editorCtx={editorCtx} />}
                  {block.type === 'free_text'       && <FreeTextEditor       block={block} onSave={handlePreviewSave} onCancel={() => setPreviewEditId(null)} editorCtx={editorCtx} />}
                </div>
              </div>
            );
          })()}
        </div>
      </div>
    </div>
  );
}

// ── Document Manager ────────────────────────────────────────────
function DocumentManager({ documents, onOpen, onDelete, onNew, onImport }) {
  return (
    <div className="panel-card shadow-lg">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-semibold text-text-primary">Hadith Book Composer</span>
        </div>
      </div>
      <div className="p-5 space-y-4">
        {documents.length > 0 && (
          <div className="space-y-2">
            {documents.map(doc => (
              <div key={doc.id} className="flex items-center justify-between p-3 bg-surface-2 rounded-xl border border-border hover:border-border-strong transition-all">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center border shrink-0"
                    style={{ background:'color-mix(in srgb,var(--brand),white 90%)', borderColor:'color-mix(in srgb,var(--brand),transparent 80%)' }}>
                    <FileText className="w-4 h-4 text-[var(--brand)]" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm text-primary truncate">{doc.name || 'Untitled'}</p>
                    <p className="text-xs text-text-muted">{doc.blocks?.length || 0} blocks · {relDate(doc.updatedAt)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0 ml-2">
                  <button onClick={() => onOpen(doc)} className="px-3 py-1 text-xs font-semibold text-white rounded-lg hover:opacity-90" style={{ background:'var(--brand)' }}>Open</button>
                  <button onClick={() => onDelete(doc.id)} className="px-3 py-1 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100">Delete</button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={onNew} className="btn-primary flex-1 text-base py-2.5">
            <Plus className="w-4 h-4" /> New Document
          </button>
          <label className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-xl text-sm font-medium text-text-secondary hover:bg-surface-2 cursor-pointer transition-colors">
            <Upload className="w-4 h-4" /> Import JSON
            <input type="file" accept=".json" className="sr-only" onChange={onImport} />
          </label>
        </div>
        {documents.length === 0 && (
          <p className="text-center text-xs text-text-muted pt-2">No saved documents. Start a new one to begin composing.</p>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// Main Page
// ══════════════════════════════════════════════════════════════
export default function TextToPdfPage() {
  const [appState,       setAppState]       = useState('manager');
  const [showPreview,    setShowPreview]    = useState(false);
  const [documents,      setDocuments]      = useState([]);
  const [currentDoc,     setCurrentDoc]     = useState(null);
  const [editingBlockId, setEditingBlockId] = useState(null);
  const [toolbarTab,     setToolbarTab]     = useState('format');
  const [generating,     setGenerating]     = useState(false);
  const [pdfErr,         setPdfErr]         = useState('');

  // Drag-and-drop state
  const [dragIdx,     setDragIdx]     = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  // AI Quick Import
  const [showAI,  setShowAI]  = useState(false);
  const [aiText,  setAIText]  = useState('');
  const [aiLoad,  setAILoad]  = useState(false);
  const [aiErr,   setAIErr]   = useState('');

  // Doc name editing
  const [editingName, setEditingName] = useState(false);
  const [nameInput,   setNameInput]   = useState('');

  const activeEditorRef = useRef(null);
  const savedRangeRef   = useRef(null);

  const saveRange = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && activeEditorRef.current) {
      const range = sel.getRangeAt(0);
      if (activeEditorRef.current.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
      }
    }
  }, []);

  const editorCtx = { activeEditorRef, savedRangeRef, saveRange };

  // ── Inject fonts globally ──────────────────────────────────
  useEffect(() => {
    if (!document.getElementById('htbk-fonts')) {
      const link = document.createElement('link');
      link.id = 'htbk-fonts'; link.rel = 'stylesheet'; link.href = FONTS_URL;
      document.head.appendChild(link);
    }
    if (!document.getElementById('htbk-face')) {
      const style = document.createElement('style');
      style.id = 'htbk-face';
      style.textContent =
        `@font-face{font-family:'Jameel Noori Nastaleeq';src:local('Jameel Noori Nastaleeq'),local('JameelNooriNastaleeq');font-display:block;}` +
        `@font-face{font-family:'Noto Nastaliq Urdu';src:local('Noto Nastaliq Urdu');font-display:swap;}`;
      document.head.appendChild(style);
    }
  }, []);

  // ── Load docs ──────────────────────────────────────────────
  useEffect(() => { setDocuments(loadDocs()); }, []);

  // ── Auto-save ──────────────────────────────────────────────
  useEffect(() => {
    if (!currentDoc?.id) return;
    setDocuments(prev => {
      const next = prev.some(d => d.id === currentDoc.id)
        ? prev.map(d => d.id === currentDoc.id ? currentDoc : d)
        : [...prev, currentDoc];
      saveDocs(next);
      return next;
    });
  }, [currentDoc]);

  // ── Helpers ────────────────────────────────────────────────
  function patchDoc(patch) {
    setCurrentDoc(prev => ({ ...prev, ...patch, updatedAt: Date.now() }));
  }

  function openNew() {
    const doc = createEmptyDoc();
    setCurrentDoc(doc);
    setEditingBlockId(null);
    setAppState('editor');
  }

  function openDoc(doc) {
    setCurrentDoc(doc);
    setEditingBlockId(null);
    setAppState('editor');
  }

  function deleteDoc(id) {
    const next = documents.filter(d => d.id !== id);
    setDocuments(next); saveDocs(next);
    if (currentDoc?.id === id) { setCurrentDoc(null); setAppState('manager'); }
  }

  function addBlock(type) {
    const nb = createBlock(type);
    patchDoc({ blocks: [...(currentDoc?.blocks || []), nb] });
    setEditingBlockId(nb.id);
  }

  function saveBlock(updated) {
    patchDoc({ blocks: (currentDoc?.blocks || []).map(b => b.id === updated.id ? updated : b) });
    setEditingBlockId(null);
  }

  function deleteBlock(id) {
    patchDoc({ blocks: (currentDoc?.blocks || []).filter(b => b.id !== id) });
    if (editingBlockId === id) setEditingBlockId(null);
  }

  function moveBlock(idx, dir) {
    const blocks = [...(currentDoc?.blocks || [])];
    const to = idx + dir;
    if (to < 0 || to >= blocks.length) return;
    [blocks[idx], blocks[to]] = [blocks[to], blocks[idx]];
    patchDoc({ blocks });
  }

  // ── Block management: duplicate ────────────────────────────
  function duplicateBlock(id) {
    const bl = currentDoc?.blocks || [];
    const idx = bl.findIndex(b => b.id === id);
    if (idx === -1) return;
    const copy = { ...bl[idx], id: genId() };
    patchDoc({ blocks: [...bl.slice(0, idx + 1), copy, ...bl.slice(idx + 1)] });
  }

  // ── Block management: change type ──────────────────────────
  function changeBlockType(id, newType) {
    const bl = currentDoc?.blocks || [];
    const block = bl.find(b => b.id === id);
    if (!block || block.type === newType) return;

    const nb = createBlock(newType);
    nb.id = block.id;

    // Best-effort content migration
    const txt = block.content || block.arabicMatn || block.arabicTitle || block.arabicText || '';
    if (newType === 'free_text')       nb.content     = block.content || txt;
    if (newType === 'reference')       nb.content     = block.content || txt;
    if (newType === 'chapter_heading') nb.arabicTitle = block.arabicTitle || txt;
    if (newType === 'verse')           nb.arabicText  = block.arabicText  || txt;
    if (newType === 'hadith')          nb.arabicMatn  = block.arabicMatn  || txt;
    if (newType === 'fiqh' && txt)     nb.points      = [txt];

    patchDoc({ blocks: bl.map(b => b.id === id ? nb : b) });
    if (editingBlockId === id) setEditingBlockId(null);
  }

  // ── Block management: merge consecutive free_text ──────────
  function mergeWithNext(idx) {
    const bl = currentDoc?.blocks || [];
    if (idx >= bl.length - 1) return;
    const curr = bl[idx];
    const next = bl[idx + 1];
    if (curr.type !== 'free_text' || next.type !== 'free_text') return;
    const merged = { ...curr, content: (curr.content || '') + '<br><br>' + (next.content || '') };
    patchDoc({ blocks: [...bl.slice(0, idx), merged, ...bl.slice(idx + 2)] });
    if (editingBlockId === next.id) setEditingBlockId(null);
  }

  // ── Drag-and-drop ──────────────────────────────────────────
  function handleDrop(dropIdx) {
    if (dragIdx === null || dragIdx === dropIdx) { setDragIdx(null); setDragOverIdx(null); return; }
    const bl = [...(currentDoc?.blocks || [])];
    const [dragged] = bl.splice(dragIdx, 1);
    const adjustedIdx = dragIdx < dropIdx ? dropIdx - 1 : dropIdx;
    bl.splice(adjustedIdx, 0, dragged);
    patchDoc({ blocks: bl });
    setDragIdx(null);
    setDragOverIdx(null);
  }

  // ── PDF Download ──────────────────────────────────────────────────
  async function handleDownload() {
    console.log('[PDF v2.0] Export started');
    await document.fonts.ready;   // ensure all fonts are loaded before anything else
    if (!currentDoc?.blocks?.length) return;
    setGenerating(true); setPdfErr('');
    let root = null;
    try {
      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      root = document.createElement('div');
      root.style.cssText = 'position:fixed;left:-9999px;top:0;pointer-events:none;';
      document.body.appendChild(root);

      // ① Force-load every font used in this document so block heights
      //    measured during pagination use the real font metrics (not fallback).
      const fontsNeeded = new Set([
        'Jameel Noori Nastaleeq', 'Noto Naskh Arabic',
        currentDoc.headerFontFamily, currentDoc.footerFontFamily,
        ...(currentDoc.blocks || []).map(b => b.fontFamily),
      ].filter(Boolean));

      const warmup = document.createElement('div');
      warmup.style.cssText = 'position:absolute;opacity:0;left:0;top:0;';
      warmup.innerHTML = [...fontsNeeded].map((f, idx) =>
        `<div style="font-family:'${f}',serif;font-size:16px;direction:rtl;position:absolute;top:${idx * 24}px;">بسم اللہ الرحمن الرحیم ابتث</div>`
      ).join('');
      root.appendChild(warmup);
      await document.fonts.ready;
      console.log(`[PDF_FONT_READY] document.fonts.ready resolved`);
      console.log(`[PDF_DEVICE_PIXEL_RATIO] dpr=${window.devicePixelRatio}`);

      // Verify JNN is actually available — if only system fallback loaded,
      // glyph shaping will be wrong even though fonts.ready fired.
      const jnnSpec = `16px 'Jameel Noori Nastaleeq'`;
      const nnkSpec = `16px 'Noto Naskh Arabic'`;
      const jnnOk = document.fonts.check(jnnSpec);
      const nnkOk = document.fonts.check(nnkSpec);
      console.log(`[PDF_FONT_CHECK_JNN] loaded=${jnnOk} spec="${jnnSpec}"`);
      console.log(`[PDF_FONT_CHECK] JNN=${jnnOk} NNK=${nnkOk}`);

      // JNN Nastaleeq needs extra settle time: the shaping engine (HarfBuzz)
      // caches glyph metrics asynchronously after the font becomes "ready".
      // 600ms is the empirical minimum for multi-paragraph Urdu documents.
      await new Promise(r => setTimeout(r, 600));
      root.removeChild(warmup);

      console.log(`[PDF v2.0] Fonts loaded: ${[...fontsNeeded].join(', ')}`);

      // ② Paginate with accurate font metrics
      root.style.cssText =
        `position:fixed;left:-${PL.cssW + 20}px;top:0;pointer-events:none;width:${PL.cssW}px;`;
      const pages = pdfPaginate(currentDoc, root);
      console.log(`[PDF v2.0] ${pages.length} pages | contentTop=${PL.contentTop} contentH=${PL.contentH}`);

      // ③ Let layout settle
      await new Promise(r => setTimeout(r, 150));

      // ④ Capture each page and build PDF
      const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
      for (let i = 0; i < pages.length; i++) {
        const canvas = await pdfCapturePage(html2canvas, pages[i]);
        if (i > 0) pdf.addPage();
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.97), 'JPEG', 0, 0, PL.ptW, PL.ptH);
        console.log(`[PDF v2.0] Captured page ${i + 1}/${pages.length}`);
      }

      // ⑤ Save file
      const fname = (currentDoc.name || 'document')
        .replace(/[^a-zA-Z0-9\s_-]/g, '').trim().replace(/\s+/g, '_') || 'document';
      pdf.save(`${fname}.pdf`);
      console.log(`[PDF v2.0] Saved: ${fname}.pdf`);

    } catch (err) {
      console.error('[PDF v2.0]', err);
      setPdfErr('PDF generation failed. Please try again.');
    } finally {
      if (root && document.body.contains(root)) document.body.removeChild(root);
      setGenerating(false);
    }
  }
  // ── Preview modal callback ─────────────────────────────────
  function handlePreviewAction(action, data) {
    if (action === 'download') handleDownload();
    if (action === '__save__') saveBlock(data);
    if (action === '__patch__') patchDoc(data);
  }

  // ── AI Quick Import ────────────────────────────────────────
  async function handleAIImport() {
    if (!aiText.trim()) return;
    setAILoad(true); setAIErr('');
    try {
      const data = await api.post('/tools/text-to-pdf/format', { text: aiText.trim() });
      const newBlocks = (data.blocks || []).map(b => {
        const block = { ...b, id: genId() };
        // For free_text blocks: detect language and apply appropriate font/direction/alignment
        if (block.type === 'free_text' && !block.fontFamily) {
          const lang = detectScriptLanguage(block.content || '');
          block.fontFamily = fontForLang(lang);
          block.direction  = dirForLang(lang);
          block.textAlign  = alignForLang(lang);
          block.lineHeight = lhForLang(lang);
        }
        return block;
      });
      patchDoc({ blocks: [...(currentDoc?.blocks || []), ...newBlocks] });
      if (currentDoc?.name === 'Untitled Document' && data.name) patchDoc({ name: data.name });
      setAIText(''); setShowAI(false);
    } catch (err) {
      setAIErr(err.message || 'Formatting failed.');
    } finally {
      setAILoad(false);
    }
  }

  // ── Export / Import ────────────────────────────────────────
  function handleExport() {
    const blob = new Blob([JSON.stringify(currentDoc, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `${(currentDoc.name || 'document').replace(/\s+/g,'_')}.json`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleImport(e) {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data.blocks)) { setPdfErr('Invalid document file.'); return; }
        setCurrentDoc({ ...data, id: data.id || genId() });
        setEditingBlockId(null);
        setAppState('editor');
      } catch { setPdfErr('Invalid JSON file.'); }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const blocks = currentDoc?.blocks || [];

  // ── Render ─────────────────────────────────────────────────
  return (
    <ToolPageLayout slug="text-to-pdf">
      {/* Full-screen preview */}
      {showPreview && currentDoc && (
        <PreviewModal
          doc={currentDoc}
          editorCtx={editorCtx}
          generating={generating}
          pdfErr={pdfErr}
          onClose={() => setShowPreview(false)}
          onDownload={handlePreviewAction}
        />
      )}

      {/* Document Manager */}
      {appState === 'manager' && (
        <DocumentManager
          documents={documents}
          onOpen={openDoc}
          onDelete={deleteDoc}
          onNew={openNew}
          onImport={handleImport}
        />
      )}

      {/* Editor */}
      {appState === 'editor' && currentDoc && (
        <div className="panel-card shadow-lg">
          {/* Top bar */}
          <div className="panel-header">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={() => setAppState('manager')} className="btn-ghost p-1.5 shrink-0">
                <ArrowLeft className="w-3.5 h-3.5" />
              </button>
              {editingName ? (
                <input autoFocus value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onBlur={() => { patchDoc({ name: nameInput || 'Untitled Document' }); setEditingName(false); }}
                  onKeyDown={e => { if (e.key==='Enter') { patchDoc({ name: nameInput || 'Untitled Document' }); setEditingName(false); } if (e.key==='Escape') setEditingName(false); }}
                  className="text-sm font-semibold border-b border-[var(--brand)] outline-none bg-transparent flex-1 min-w-0" />
              ) : (
                <button onClick={() => { setNameInput(currentDoc.name || ''); setEditingName(true); }}
                  className="flex items-center gap-1 text-sm font-semibold text-primary hover:text-[var(--brand)] transition-colors truncate">
                  <span className="truncate">{currentDoc.name || 'Untitled Document'}</span>
                  <Edit3 className="w-3 h-3 opacity-40 shrink-0" />
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {blocks.length > 0 && (
                <button onClick={() => setShowPreview(true)} className="btn-ghost text-xs">
                  <Eye className="w-3.5 h-3.5" /> Preview
                </button>
              )}
              <button onClick={handleDownload} disabled={!blocks.length || generating}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-40 hover:opacity-90"
                style={{ background:'var(--brand)' }}>
                {generating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                {generating ? 'Generating…' : 'Download PDF'}
              </button>
            </div>
          </div>

          <div className="p-4">
            {/* Composite Toolbar */}
            <CompositeToolbar tab={toolbarTab} onTabChange={setToolbarTab}
              doc={currentDoc} onDocChange={patchDoc} editorCtx={editorCtx} />

            {/* AI Quick Import toggle */}
            <button onClick={() => setShowAI(v => !v)}
              className="flex items-center gap-1.5 text-xs text-text-muted hover:text-[var(--brand)] mb-3 transition-colors">
              <Sparkles className="w-3 h-3" />
              {showAI ? 'Close AI Import' : 'AI Quick Import (paste text → auto-generate blocks)'}
            </button>

            {showAI && (
              <div className="mb-4 p-3 border border-blue-200 bg-blue-50 rounded-xl">
                <textarea className="w-full text-sm border border-blue-300 rounded-lg p-2 bg-white resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
                  rows={4} dir="rtl" placeholder="متن یہاں پیسٹ کریں…"
                  value={aiText} onChange={e => setAIText(e.target.value)} disabled={aiLoad} />
                {aiErr && <p className="text-xs text-red-600 mt-1">{aiErr}</p>}
                <button onClick={handleAIImport} disabled={aiLoad || !aiText.trim()}
                  className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-40 hover:opacity-90"
                  style={{ background:'var(--brand)' }}>
                  {aiLoad ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {aiLoad ? 'Formatting…' : 'Format & Add Blocks'}
                </button>
              </div>
            )}

            {/* PDF error */}
            {pdfErr && (
              <div className="flex items-center gap-2 p-2.5 mb-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {pdfErr}
              </div>
            )}

            {/* Block list with drag-and-drop */}
            <div className="space-y-0">
              {blocks.length === 0 && (
                <div className="flex items-center justify-center h-32 border border-dashed border-border rounded-xl text-text-muted text-sm">
                  No blocks yet — add one below to start composing
                </div>
              )}
              {blocks.map((block, idx) => (
                <BlockCard
                  key={block.id}
                  block={block}
                  idx={idx}
                  total={blocks.length}
                  nextBlock={blocks[idx + 1]}
                  isEditing={editingBlockId === block.id}
                  onEdit={() => setEditingBlockId(editingBlockId === block.id ? null : block.id)}
                  onDelete={() => deleteBlock(block.id)}
                  onMoveUp={() => moveBlock(idx, -1)}
                  onMoveDown={() => moveBlock(idx, 1)}
                  onSave={saveBlock}
                  onCancel={() => setEditingBlockId(null)}
                  onDuplicate={() => duplicateBlock(block.id)}
                  onChangeType={(newType) => changeBlockType(block.id, newType)}
                  onMergeWithNext={() => mergeWithNext(idx)}
                  onDragStart={() => setDragIdx(idx)}
                  onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
                  isDragOver={dragOverIdx === idx && dragIdx !== idx}
                  isDragging={dragIdx === idx}
                  editorCtx={editorCtx}
                />
              ))}
            </div>

            {/* Add Block buttons */}
            <div className="mt-4 pt-4 border-t border-border">
              <p className="text-[10px] text-text-muted font-semibold uppercase mb-2">Add Block</p>
              <div className="flex flex-wrap gap-1.5">
                {ADD_BLOCK_TYPES.map(({ type, label }) => (
                  <button key={type} onClick={() => addBlock(type)}
                    className="px-3 py-1.5 text-xs font-medium border border-border rounded-lg bg-white hover:bg-surface-2 hover:border-[var(--brand)]/40 transition-colors text-text-secondary">
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Export/Import/Back */}
            <div className="mt-4 pt-3 border-t border-border flex flex-wrap gap-2">
              <button onClick={handleExport} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-surface-2 text-text-secondary">
                <Download className="w-3 h-3" /> Export JSON
              </button>
              <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-surface-2 text-text-secondary cursor-pointer">
                <Upload className="w-3 h-3" /> Import JSON
                <input type="file" accept=".json" className="sr-only" onChange={handleImport} />
              </label>
              <button onClick={() => setAppState('manager')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-border rounded-lg hover:bg-surface-2 text-text-secondary ml-auto">
                <Save className="w-3 h-3" /> Save & Back to Documents
              </button>
            </div>
          </div>
        </div>
      )}
    </ToolPageLayout>
  );
}