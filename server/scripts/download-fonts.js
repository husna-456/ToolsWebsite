'use strict';
/**
 * Downloads Amiri Arabic TTF fonts into server/fonts/.
 * TTF is used deliberately — woff2 requires WebAssembly (wawoff2) which
 * may hang on Hostinger shared hosting. TTF is parsed by fontkit natively.
 *
 * Each font has multiple fallback URLs tried in order.
 * Script is non-fatal: always exits 0 so it never breaks deployment.
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const FONTS_DIR = path.join(__dirname, '../fonts');
const MIN_VALID_SIZE = 10000; // 10 KB — any real TTF is larger

const FONTS = [
  {
    filename: 'Amiri-Regular.ttf',
    urls: [
      'https://cdn.jsdelivr.net/npm/@expo-google-fonts/amiri/Amiri_400Regular.ttf',
      'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/amiri/Amiri-Regular.ttf',
      'https://fonts.gstatic.com/s/amiri/v27/J7aRnpd8CGxBHqUpvrIw74NL.ttf',
    ],
  },
  {
    filename: 'Amiri-Bold.ttf',
    urls: [
      'https://cdn.jsdelivr.net/npm/@expo-google-fonts/amiri/Amiri_700Bold.ttf',
      'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/amiri/Amiri-Bold.ttf',
      'https://fonts.gstatic.com/s/amiri/v27/J7acnpd8CGxBHpUdtaFB.ttf',
    ],
  },
];

function downloadOne(url, dest, redirects) {
  redirects = redirects || 0;
  return new Promise(function(resolve, reject) {
    if (redirects > 5) return reject(new Error('Too many redirects'));
    var proto = url.startsWith('https') ? https : http;
    var tmp = dest + '.tmp';
    var file = fs.createWriteStream(tmp);
    proto.get(url, function(res) {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        try { fs.unlinkSync(tmp); } catch (_) {}
        return downloadOne(res.headers.location, dest, redirects + 1).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close();
        try { fs.unlinkSync(tmp); } catch (_) {}
        return reject(new Error('HTTP ' + res.statusCode));
      }
      res.pipe(file);
      file.on('finish', function() {
        file.close(function() {
          try {
            var size = fs.statSync(tmp).size;
            if (size < MIN_VALID_SIZE) {
              fs.unlinkSync(tmp);
              return reject(new Error('File too small (' + size + ' bytes) — likely an error page'));
            }
            fs.renameSync(tmp, dest);
            console.log('[fonts] saved: ' + path.basename(dest) + ' (' + size + ' bytes)');
            resolve();
          } catch (e) { reject(e); }
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

async function downloadFont(filename, urls) {
  var dest = path.join(FONTS_DIR, filename);

  // Already downloaded and valid
  try {
    if (fs.existsSync(dest) && fs.statSync(dest).size > MIN_VALID_SIZE) {
      console.log('[fonts] already present: ' + filename + ' (' + fs.statSync(dest).size + ' bytes)');
      return true;
    }
  } catch (_) {}

  for (var i = 0; i < urls.length; i++) {
    try {
      console.log('[fonts] trying URL ' + (i + 1) + '/' + urls.length + ': ' + urls[i]);
      await downloadOne(urls[i], dest);
      return true;
    } catch (e) {
      console.warn('[fonts] URL ' + (i + 1) + ' failed: ' + e.message);
    }
  }
  console.error('[fonts] All URLs failed for ' + filename + ' — PDF will use Roboto fallback for Arabic.');
  return false;
}

async function main() {
  try {
    fs.mkdirSync(FONTS_DIR, { recursive: true });
  } catch (_) {}

  var ok = 0;
  for (var i = 0; i < FONTS.length; i++) {
    var f = FONTS[i];
    var success = await downloadFont(f.filename, f.urls);
    if (success) ok++;
  }

  console.log('[fonts] ' + ok + '/' + FONTS.length + ' Arabic TTF fonts ready.');
}

main().catch(function(e) {
  console.error('[fonts] fatal error (non-fatal for deploy):', e.message);
  process.exit(0);
});
