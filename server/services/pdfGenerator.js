const puppeteer = require('puppeteer');

// ── Font loading — English, Urdu, and Arabic professional fonts ──
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

// ── Safety strip of markdown artifacts only ──────────────────────
function stripMd(s) {
  return (s || '')
    .replace(/<hr\b[^>]*\/?>/gi, '')
    .replace(/\*\*(.*?)\*\*/gs, '$1')
    .replace(/__(.*?)__/gs,     '$1')
    .replace(/\*(.*?)\*/gs,     '$1')
    .replace(/_(.*?)_/gs,       '$1')
    .replace(/`(.*?)`/gs,       '$1');
}

// Clean but NEVER strip inline font-family/size/color/weight
function clean(html) { return stripMd(html || ''); }

// Puppeteer's headless HTML has no external CSS, so list markers are invisible by default.
// Inject inline styles on <ul>/<ol>/<li> tags so they render correctly in the PDF.
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

// ── Block renderers ──────────────────────────────────────────────
// These must produce output IDENTICAL to the frontend renderBlockHTML().

function renderChapterHeadingHTML(block) {
  const arabic  = clean(block.arabicTitle  || '');
  const urdu    = clean(block.urduSubtitle || '');
  return (
    `<div style="padding:10px 0 6px;text-align:center;` +
    `margin-top:20px;margin-bottom:8px;page-break-inside:avoid;break-inside:avoid;page-break-after:avoid;break-after:avoid;">` +
    `<div style="font-family:'Noto Naskh Arabic',serif;font-size:27px;font-weight:bold;` +
    `direction:rtl;text-align:center;line-height:1.6;color:#000;">${arabic}</div>` +
    (urdu
      ? `<div style="font-family:'Jameel Noori Nastaleeq',serif;font-size:22px;font-weight:bold;` +
        `direction:rtl;text-align:center;line-height:2.0;color:#000;margin-top:6px;">${urdu}</div>`
      : '') +
    `</div>`
  );
}

function renderHadithTableHTML(block) {
  const arabicFont = block.arabicFont || 'Noto Naskh Arabic';
  const num        = block.number
    ? `<span style="font-family:'${arabicFont}',serif;">﴿${block.number}﴾ </span>`
    : '';
  const arabic = clean(block.arabicMatn      || '');
  const urdu   = clean(block.urduTranslation || '');
  return (
    `<table style="width:100%;border-collapse:collapse;direction:rtl;table-layout:fixed;margin-bottom:0;">` +
    `<tbody><tr>` +
    `<td style="width:50%;vertical-align:top;padding:8px 0 12px 16px;">` +
    `<div style="font-family:'${arabicFont}',serif;font-size:18px;font-weight:400;` +
    `direction:rtl;text-align:justify;line-height:1.8;color:#000;">${num}${arabic}</div>` +
    `</td>` +
    `<td style="width:50%;vertical-align:top;padding:0 14px 12px 0;">` +
    `<div style="font-family:'Jameel Noori Nastaleeq',serif;font-size:18px;font-weight:400;` +
    `direction:rtl;text-align:right;line-height:2.0;color:#000;">${urdu}</div>` +
    `</td>` +
    `</tr></tbody></table>`
  );
}

function renderFiqhHTML(block) {
  const heading = clean(block.heading || 'فقہ الحدیث:');
  const pts = block.points || [];
  let html =
    `<div style="font-family:'Noto Naskh Arabic',serif;font-size:20px;font-weight:bold;` +
    `direction:rtl;text-align:right;color:#000;margin-top:8px;margin-bottom:6px;">${heading}</div>`;
  pts.forEach((pt, i) => {
    html +=
      `<div style="font-family:'Jameel Noori Nastaleeq',serif;font-size:17px;font-weight:400;` +
      `direction:rtl;text-align:right;line-height:2.0;color:#000;margin-bottom:1px;">` +
      `<span style="font-size:22px;margin-left:16px;vertical-align:middle;">${CIRCLED[i] || `(${i + 1})`}</span>${clean(pt)}</div>`;
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
  const arabic = clean(block.arabicText || '');
  const urdu   = clean(block.urduText   || '');
  return (
    `<div style="text-align:center;margin-top:12px;margin-bottom:10px;">` +
    `<div style="font-family:'Noto Naskh Arabic',serif;font-size:18px;font-weight:400;` +
    `direction:rtl;text-align:center;line-height:1.8;color:#000;">${arabic}</div>` +
    (urdu
      ? `<div style="font-family:'Jameel Noori Nastaleeq',serif;font-size:18px;font-weight:400;` +
        `direction:rtl;text-align:center;line-height:2.0;color:#000;margin-top:4px;">${urdu}</div>`
      : '') +
    `</div>`
  );
}

// Supports block-level: fontFamily, direction, textAlign, lineHeight, spacing, margins
function renderFreeTextHTML(block) {
  const ff  = block.fontFamily  || 'Jameel Noori Nastaleeq';
  const dir = block.direction   || 'rtl';
  const ta  = block.textAlign   || (dir === 'ltr' ? 'justify' : 'right');
  const lh  = block.lineHeight  || (dir === 'ltr' ? '1.6' : '2.0');
  const ls  = block.letterSpacing ? `letter-spacing:${block.letterSpacing};` : '';
  const ws  = block.wordSpacing   ? `word-spacing:${block.wordSpacing};`     : '';
  const mt  = block.marginTop     || '8px';
  const mb  = block.marginBottom  || '8px';
  const content = styleListsInContent(clean(block.content || ''));
  return (
    `<div style="font-family:'${ff}',serif;font-size:16px;direction:${dir};text-align:${ta};` +
    `line-height:${lh};${ls}${ws}margin-top:${mt};margin-bottom:${mb};color:#000;">${content}</div>`
  );
}

// ── Document body builder ────────────────────────────────────────
// Page-break strategy:
//   chapter_heading  → break-after:avoid  (stays with following hadith)
//   hadith table     → break-inside:avoid only (never splits mid-row)
//   fiqh section     → break-before:avoid (stays with hadith above, flows naturally across pages)
//   reference        → break-before:avoid (stays with last fiqh line, not orphaned)
// This avoids the "blank page 1" problem caused by wrapping long content in a single avoid container.
function buildDocumentBodyHTML(blocks) {
  const parts = [];
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];

    if (b.type === 'chapter_heading') {
      // break-after:avoid keeps the heading on the same page as the following block
      parts.push(renderChapterHeadingHTML(b));
      i++;
      continue;
    }

    if (b.type === 'hadith') {
      i++;
      // Collect consecutive fiqh blocks
      let fiqhHTML = '';
      while (i < blocks.length && blocks[i].type === 'fiqh') {
        fiqhHTML += renderFiqhHTML(blocks[i]);
        i++;
      }
      // Collect reference immediately after
      let refHTML = '';
      if (i < blocks.length && blocks[i].type === 'reference') {
        refHTML = renderReferenceHTML(blocks[i]);
        i++;
      }

      parts.push(
        `<div style="margin-top:22px;margin-bottom:0;">` +
        // Hadith table: never split the 2-column table in the middle
        `<div style="page-break-inside:avoid;break-inside:avoid;">${renderHadithTableHTML(b)}</div>` +
        // Fiqh: stay with hadith above, but allow natural page breaks within long fiqh lists
        (fiqhHTML
          ? `<div style="page-break-before:avoid;break-before:avoid;">${fiqhHTML}</div>`
          : '') +
        // Reference: stay with last fiqh line, never orphaned alone on a new page
        (refHTML
          ? `<div style="page-break-before:avoid;break-before:avoid;">${refHTML}</div>`
          : '') +
        `</div>`
      );
      continue;
    }

    if (b.type === 'fiqh')      { parts.push(renderFiqhHTML(b));      i++; continue; }
    if (b.type === 'reference') { parts.push(renderReferenceHTML(b)); i++; continue; }
    if (b.type === 'verse')     { parts.push(renderVerseHTML(b));     i++; continue; }

    parts.push(renderFreeTextHTML(b));
    i++;
  }
  return parts.join('\n');
}

// ── Header/footer templates for Puppeteer ───────────────────────

// Inline SVG vine flourish — black strokes, symmetrical, no external assets needed
const FLOURISH_SVG =
  `<svg width="100%" height="22" viewBox="0 0 400 22" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">` +
  `<g transform="translate(200,11)">` +
  `<line x1="0" y1="-6" x2="0" y2="6" stroke="#000" stroke-width="0.8"/>` +
  `<line x1="-5.2" y1="-3" x2="5.2" y2="3" stroke="#000" stroke-width="0.8"/>` +
  `<line x1="-5.2" y1="3" x2="5.2" y2="-3" stroke="#000" stroke-width="0.8"/>` +
  `<circle cx="0" cy="0" r="2.5" fill="none" stroke="#000" stroke-width="0.7"/>` +
  `</g>` +
  // Right vine
  `<path d="M208 11 Q218 7 228 11 Q238 15 248 11 Q258 7 268 11 Q278 15 288 11" fill="none" stroke="#000" stroke-width="0.7"/>` +
  `<path d="M218 8 Q220 3 224 5" fill="none" stroke="#000" stroke-width="0.6"/>` +
  `<path d="M238 14 Q242 19 246 17" fill="none" stroke="#000" stroke-width="0.6"/>` +
  `<path d="M258 8 Q260 3 264 5" fill="none" stroke="#000" stroke-width="0.6"/>` +
  `<path d="M278 14 Q282 19 286 17" fill="none" stroke="#000" stroke-width="0.6"/>` +
  `<line x1="288" y1="11" x2="396" y2="11" stroke="#000" stroke-width="0.4"/>` +
  // Left vine (mirror)
  `<path d="M192 11 Q182 7 172 11 Q162 15 152 11 Q142 7 132 11 Q122 15 112 11" fill="none" stroke="#000" stroke-width="0.7"/>` +
  `<path d="M182 8 Q180 3 176 5" fill="none" stroke="#000" stroke-width="0.6"/>` +
  `<path d="M162 14 Q158 19 154 17" fill="none" stroke="#000" stroke-width="0.6"/>` +
  `<path d="M142 8 Q140 3 136 5" fill="none" stroke="#000" stroke-width="0.6"/>` +
  `<path d="M122 14 Q118 19 114 17" fill="none" stroke="#000" stroke-width="0.6"/>` +
  `<line x1="112" y1="11" x2="4" y2="11" stroke="#000" stroke-width="0.4"/>` +
  `</svg>`;

function buildDecorativeHeaderTemplate(doc) {
  const ff     = doc.headerFontFamily || 'Noto Naskh Arabic';
  const fs     = doc.headerFontSize   || 10;
  const showPN = doc.showPageNumber   !== false;
  const name   = doc.headerRight || doc.name || '';

  const base = `display:inline-block;border:1px solid #000;border-radius:999px;font-family:'${ff}',serif;font-size:${fs}px;line-height:20px;color:#000;flex-shrink:0;white-space:nowrap;`;
  const leftBadge = showPN
    ? `<span class="pageNumber" style="${base}padding:0 10px;min-width:28px;text-align:center;"></span>`
    : `<span style="${base}padding:0 10px;opacity:0;">&#183;</span>`;

  return (
    `<div style="width:100%;padding:3px 2cm 0 2cm;box-sizing:border-box;display:flex;flex-direction:row;align-items:center;justify-content:space-between;gap:8px;">` +
    leftBadge +
    `<div style="flex:1;overflow:hidden;display:flex;align-items:center;justify-content:center;padding:0 4px;min-width:0;">${FLOURISH_SVG}</div>` +
    `<span style="${base}padding:0 14px;">${name}</span>` +
    `</div>`
  );
}

function resolveSlots(doc, side) {
  // side: 'header' | 'footer'
  const left   = side === 'header' ? (doc.headerLeft   || '') : (doc.footerLeft   || '');
  const center = side === 'header' ? (doc.headerCenter || doc.name || '') : (doc.footerCenter || '');
  const right  = side === 'header' ? (doc.headerRight  || '') : (doc.footerRight  || '');

  const pos = doc.showPageNumber !== false ? (doc.pageNumberPosition || 'header-right') : 'none';
  const pn  = `<span class="pageNumber"></span>`;

  return {
    left:   (pos === `${side}-left`   ? pn : left),
    center: (pos === `${side}-center` ? pn : center),
    right:  (pos === `${side}-right`  ? pn : right),
  };
}

function buildHeaderTemplate(doc) {
  if (doc.headerStyle === 'decorative') return buildDecorativeHeaderTemplate(doc);
  const ff = doc.headerFontFamily || 'Noto Naskh Arabic';
  const fs = doc.headerFontSize   || 10;
  const { left, center, right } = resolveSlots(doc, 'header');

  // NO line under the header (per spec)
  return (
    `<div style="width:100%;padding:4px 2cm 0 2cm;box-sizing:border-box;` +
    `display:flex;justify-content:space-between;align-items:flex-end;` +
    `font-family:'${ff}',serif;font-size:${fs}px;color:#555;direction:rtl;">` +
    `<span>${right}</span>` +
    `<span>${center}</span>` +
    `<span>${left}</span>` +
    `</div>`
  );
}

function buildFooterTemplate(doc) {
  const ff       = doc.footerFontFamily || 'Noto Naskh Arabic';
  const fs       = doc.footerFontSize   || 9;
  const hairline = doc.footerHairline   !== false;
  const { left, center, right } = resolveSlots(doc, 'footer');

  // Thin short centered hairline ABOVE the footer (default ON)
  const line = hairline
    ? `<div style="width:100%;height:0.5px;background:#000;margin-bottom:4px;display:block;"></div>`
    : '';

  return (
    `<div style="width:100%;padding:0 2cm;box-sizing:border-box;` +
    `font-family:'${ff}',serif;font-size:${fs}px;color:#555;direction:rtl;">` +
    line +
    `<div style="display:flex;justify-content:space-between;align-items:flex-start;">` +
    `<span>${right}</span>` +
    `<span>${center}</span>` +
    `<span>${left}</span>` +
    `</div>` +
    `</div>`
  );
}

// ── Full HTML document ───────────────────────────────────────────
function buildFullHTML(doc) {
  const bodyHTML = buildDocumentBodyHTML(doc.blocks || []);
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="${FONTS_URL}" rel="stylesheet">
  <style>
    @font-face {
      font-family: 'Jameel Noori Nastaleeq';
      src: local('Jameel Noori Nastaleeq'), local('JameelNooriNastaleeq');
      font-display: block;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { background: white; color: #000; }
    * { color: #000 !important; background: transparent !important; }
    html, body { background: white !important; }
  </style>
</head>
<body>${bodyHTML}</body>
</html>`;
}

// ── Main entry point ─────────────────────────────────────────────
async function generatePDF(doc) {
  const html = buildFullHTML(doc);

  const launchArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--no-first-run',
    '--no-zygote',
    '--single-process',
    '--disable-extensions',
    '--disable-background-networking',
    '--disable-default-apps',
    '--mute-audio',
  ];

  // Allow overriding the Chrome executable via env (useful on VPS/custom installs)
  const launchOptions = {
    headless:  true,
    args:      launchArgs,
    timeout:   30000,
  };
  if (process.env.CHROME_BIN) {
    launchOptions.executablePath = process.env.CHROME_BIN;
  }

  let browser;
  try {
    browser = await puppeteer.launch(launchOptions);
  } catch (launchErr) {
    console.error('Puppeteer failed to launch Chrome:', launchErr.message);
    throw new Error(
      'Chrome could not start on this server. ' +
      'Set CHROME_BIN env var to a valid Chromium path, or use the client-side PDF export instead. ' +
      `Launch error: ${launchErr.message}`
    );
  }

  try {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(60000);

    // Use domcontentloaded so the page doesn't hang waiting for Google Fonts network idle
    await page.setContent(html, { waitUntil: 'domcontentloaded', timeout: 60000 });

    // Give fonts up to 8s to load; proceed anyway if they time out
    await Promise.race([
      page.evaluate(() => document.fonts.ready),
      new Promise(r => setTimeout(r, 8000)),
    ]);

    const pdfData = await page.pdf({
      format:          'A4',
      margin:          { top: '2.5cm', bottom: '2.5cm', left: '2cm', right: '2cm' },
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: buildHeaderTemplate(doc),
      footerTemplate: buildFooterTemplate(doc),
    });

    return Buffer.isBuffer(pdfData) ? pdfData : Buffer.from(pdfData);
  } finally {
    await browser.close();
  }
}

module.exports = { generatePDF, buildDocumentBodyHTML };
