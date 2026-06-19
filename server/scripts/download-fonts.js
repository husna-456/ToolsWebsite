'use strict';
/**
 * Downloads Arabic TTF font files needed by pdfGeneratorMake.js.
 * TTF format is used deliberately — woff2 requires WebAssembly (wawoff2)
 * which may not be available on all shared-hosting environments.
 *
 * Source: @expo-google-fonts/amiri on npm, served via jsDelivr CDN.
 * Non-fatal: always exits 0 so it never breaks deployment.
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const FONTS_DIR = path.join(__dirname, '../fonts');

const FONTS = [
  {
    filename: 'Amiri-Regular.ttf',
    url: 'https://cdn.jsdelivr.net/npm/@expo-google-fonts/amiri/Amiri_400Regular.ttf',
  },
  {
    filename: 'Amiri-Bold.ttf',
    url: 'https://cdn.jsdelivr.net/npm/@expo-google-fonts/amiri/Amiri_700Bold.ttf',
  },
];

function download(fileUrl, dest, redirects) {
  redirects = redirects || 0;
  return new Promise(function(resolve, reject) {
    if (redirects > 5) return reject(new Error('Too many redirects'));

    // Skip if already downloaded and looks valid (> 10 KB)
    try {
      if (fs.existsSync(dest) && fs.statSync(dest).size > 10000) {
        console.log('[fonts] already present: ' + path.basename(dest) +
                    ' (' + fs.statSync(dest).size + ' bytes)');
        return resolve();
      }
    } catch (_) {}

    console.log('[fonts] downloading: ' + path.basename(dest) + ' from ' + fileUrl);
    var protocol = fileUrl.startsWith('https') ? https : http;
    var tmp = dest + '.tmp';
    var file = fs.createWriteStream(tmp);

    protocol.get(fileUrl, function(res) {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        try { fs.unlinkSync(tmp); } catch (_) {}
        return download(res.headers.location, dest, redirects + 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(tmp); } catch (_) {}
        return reject(new Error('HTTP ' + res.statusCode + ' from ' + fileUrl));
      }
      res.pipe(file);
      file.on('finish', function() {
        file.close(function() {
          try {
            fs.renameSync(tmp, dest);
            var size = fs.statSync(dest).size;
            console.log('[fonts] saved: ' + path.basename(dest) + ' (' + size + ' bytes)');
            resolve();
          } catch (e) {
            reject(e);
          }
        });
      });
      res.on('error', function(e) {
        file.close();
        try { fs.unlinkSync(tmp); } catch (_) {}
        reject(e);
      });
    }).on('error', function(e) {
      file.close();
      try { fs.unlinkSync(tmp); } catch (_) {}
      reject(e);
    });
  });
}

async function main() {
  if (!fs.existsSync(FONTS_DIR)) {
    fs.mkdirSync(FONTS_DIR, { recursive: true });
  }

  var failed = 0;
  for (var i = 0; i < FONTS.length; i++) {
    var font = FONTS[i];
    try {
      await download(font.url, path.join(FONTS_DIR, font.filename));
    } catch (err) {
      console.error('[fonts] WARN: could not download ' + font.filename + ': ' + err.message);
      failed++;
    }
  }

  if (failed === 0) {
    console.log('[fonts] All Arabic TTF fonts ready.');
  } else {
    console.warn('[fonts] ' + failed + ' font(s) unavailable — PDFs will use Roboto fallback for Arabic.');
  }
}

main().catch(function(err) {
  console.error('[fonts] font download error (non-fatal):', err.message);
  process.exit(0);
});
