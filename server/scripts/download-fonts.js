'use strict';
/**
 * Downloads Arabic font files needed by pdfGeneratorMake.js.
 * Called automatically from server/package.json install:fonts script.
 * Non-fatal: exits 0 even on failure so it never breaks deployment.
 *
 * Fonts are sourced from jsDelivr (CDN mirror of npm packages) — no
 * additional npm packages required; just Node.js built-in https module.
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const FONTS_DIR = path.join(__dirname, '../fonts');

const FONTS = [
  {
    filename: 'Amiri-Regular.woff2',
    url: 'https://cdn.jsdelivr.net/npm/@fontsource/amiri@5/files/amiri-arabic-400-normal.woff2',
  },
  {
    filename: 'Amiri-Bold.woff2',
    url: 'https://cdn.jsdelivr.net/npm/@fontsource/amiri@5/files/amiri-arabic-700-normal.woff2',
  },
];

function download(fileUrl, dest, redirects = 0) {
  return new Promise((resolve, reject) => {
    if (redirects > 5) return reject(new Error('Too many redirects'));
    if (fs.existsSync(dest)) {
      const size = fs.statSync(dest).size;
      if (size > 1000) {
        console.log(`[fonts] already present: ${path.basename(dest)} (${size} bytes)`);
        return resolve();
      }
      fs.unlinkSync(dest);
    }
    console.log(`[fonts] downloading: ${path.basename(dest)}`);
    const protocol = fileUrl.startsWith('https') ? https : http;
    const tmp = dest + '.tmp';
    const file = fs.createWriteStream(tmp);
    protocol.get(fileUrl, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        try { fs.unlinkSync(tmp); } catch (_) {}
        return download(res.headers.location, dest, redirects + 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(tmp); } catch (_) {}
        return reject(new Error(`HTTP ${res.statusCode} from ${fileUrl}`));
      }
      res.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          fs.renameSync(tmp, dest);
          console.log(`[fonts] saved: ${path.basename(dest)} (${fs.statSync(dest).size} bytes)`);
          resolve();
        });
      });
      res.on('error', (err) => {
        file.close();
        try { fs.unlinkSync(tmp); } catch (_) {}
        reject(err);
      });
    }).on('error', (err) => {
      file.close();
      try { fs.unlinkSync(tmp); } catch (_) {}
      reject(err);
    });
  });
}

async function main() {
  if (!fs.existsSync(FONTS_DIR)) fs.mkdirSync(FONTS_DIR, { recursive: true });
  let failed = 0;
  for (const font of FONTS) {
    try {
      await download(font.url, path.join(FONTS_DIR, font.filename));
    } catch (err) {
      console.error(`[fonts] WARN: could not download ${font.filename}: ${err.message}`);
      failed++;
    }
  }
  if (failed === 0) {
    console.log('[fonts] All Arabic fonts ready.');
  } else {
    console.warn(`[fonts] ${failed} font(s) unavailable — PDFs will use Roboto fallback.`);
  }
}

main().catch((err) => {
  console.error('[fonts] font download error (non-fatal):', err.message);
  process.exit(0);
});
