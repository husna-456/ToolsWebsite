'use strict';
/**
 * Downloads all editor fonts as TTF files into server/fonts/.
 *
 * TTF is used deliberately — woff2 requires WebAssembly (wawoff2) which
 * hangs on Hostinger shared hosting. TTF is parsed natively by fontkit.
 *
 * Each font has multiple CDN URLs tried in order (jsDelivr → Google CDN).
 * Non-fatal: always exits 0 so it never blocks deployment.
 * If a download fails, the @expo-google-fonts npm package path is tried
 * first at runtime anyway — downloads are a fallback layer.
 *
 * Font naming convention: {FontName}-{Style}.ttf
 *   FontName: CamelCase, no spaces (matches pdfmake font key)
 *   Style: Regular | Bold | Italic | BoldItalic
 */

const https = require('https');
const http  = require('http');
const fs    = require('fs');
const path  = require('path');

const FONTS_DIR      = path.join(__dirname, '../fonts');
const MIN_VALID_SIZE = 10000; // real TTF > 10 KB

// jsDelivr npm CDN base for @expo-google-fonts packages
const EGF = 'https://cdn.jsdelivr.net/npm/@expo-google-fonts';

const FONTS = [
  // ── Amiri (Arabic/Urdu) ─────────────────────────────────────────
  { filename: 'Amiri-Regular.ttf', urls: [
    `${EGF}/amiri/Amiri_400Regular.ttf`,
    'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/amiri/Amiri-Regular.ttf',
  ]},
  { filename: 'Amiri-Bold.ttf', urls: [
    `${EGF}/amiri/Amiri_700Bold.ttf`,
    'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/amiri/Amiri-Bold.ttf',
  ]},
  { filename: 'Amiri-Italic.ttf', urls: [
    `${EGF}/amiri/Amiri_400Regular_Italic.ttf`,
    'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/amiri/Amiri-Italic.ttf',
  ]},
  { filename: 'Amiri-BoldItalic.ttf', urls: [
    `${EGF}/amiri/Amiri_700Bold_Italic.ttf`,
    'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/amiri/Amiri-BoldItalic.ttf',
  ]},

  // ── Noto Naskh Arabic ───────────────────────────────────────────
  { filename: 'NotoNaskhArabic-Regular.ttf', urls: [
    `${EGF}/noto-naskh-arabic/NotoNaskhArabic_400Regular.ttf`,
    'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notonaskharabic/NotoNaskhArabic-Regular.ttf',
    'https://fonts.gstatic.com/s/notonaskharabic/v36/RrQ5bpV-9Dd1b1OAGA6M9PkyDuVBePeKNaxcsss0Y7bwvc5krK0z9_Mnuw.ttf',
  ]},
  { filename: 'NotoNaskhArabic-Bold.ttf', urls: [
    `${EGF}/noto-naskh-arabic/NotoNaskhArabic_700Bold.ttf`,
    'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notonaskharabic/NotoNaskhArabic-Bold.ttf',
    'https://fonts.gstatic.com/s/notonaskharabic/v36/RrQ5bpV-9Dd1b1OAGA6M9PkyDuVBePeKNaxcsss0Y7bwvc5krK0z9_Mnuw.ttf',
  ]},

  // ── Noto Nastaliq Urdu (replaces Jameel Noori Nastaleeq in PDF) ─
  { filename: 'NotoNastaliqUrdu-Regular.ttf', urls: [
    `${EGF}/noto-nastaliq-urdu/NotoNastaliqUrdu_400Regular.ttf`,
    'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notonastaliqurdu/NotoNastaliqUrdu-Regular.ttf',
    'https://fonts.gstatic.com/s/notonastaliqurdu/v19/LhWNMUPbN-oZdNFcBy1-DJYsEoTq5pudQ9L9Sj5NAvQMajEJHDV_W5e9WTqXzNY.ttf',
  ]},
  { filename: 'NotoNastaliqUrdu-Bold.ttf', urls: [
    `${EGF}/noto-nastaliq-urdu/NotoNastaliqUrdu_700Bold.ttf`,
    'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notonastaliqurdu/NotoNastaliqUrdu-Bold.ttf',
  ]},

  // ── Scheherazade New ────────────────────────────────────────────
  { filename: 'ScheherazadeNew-Regular.ttf', urls: [
    `${EGF}/scheherazade-new/ScheherazadeNew_400Regular.ttf`,
    'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/scheherazadenew/ScheherazadeNew-Regular.ttf',
    'https://fonts.gstatic.com/s/scheherazadenew/v23/4UaerFhTLr3iddHqx0S4hKhT4a2lcGXJ8B4E0p_uAA.ttf',
  ]},
  { filename: 'ScheherazadeNew-Bold.ttf', urls: [
    `${EGF}/scheherazade-new/ScheherazadeNew_700Bold.ttf`,
    'https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/scheherazadenew/ScheherazadeNew-Bold.ttf',
    'https://fonts.gstatic.com/s/scheherazadenew/v23/4UaZrFhTLr3iddHqx0S4hKhT4a2lcGWU8B4E1OhDiA.ttf',
  ]},

  // ── Cairo (Arabic + Latin) ──────────────────────────────────────
  { filename: 'Cairo-Regular.ttf', urls: [
    `${EGF}/cairo/Cairo_400Regular.ttf`,
    'https://fonts.gstatic.com/s/cairo/v28/SLXGc1nY6HkvangtZmpcWmhzfH5lWWgchr_ggKozA.ttf',
  ]},
  { filename: 'Cairo-Bold.ttf', urls: [
    `${EGF}/cairo/Cairo_700Bold.ttf`,
    'https://fonts.gstatic.com/s/cairo/v28/SLXGc1nY6HkvangtZmpcWmhzfH5lWWgchr_gBq4zA.ttf',
  ]},

  // ── Tajawal (Arabic + Latin) ────────────────────────────────────
  { filename: 'Tajawal-Regular.ttf', urls: [
    `${EGF}/tajawal/Tajawal_400Regular.ttf`,
    'https://fonts.gstatic.com/s/tajawal/v11/Iura6YBj_oCad4k1rzaLCr5IlLA.ttf',
  ]},
  { filename: 'Tajawal-Bold.ttf', urls: [
    `${EGF}/tajawal/Tajawal_700Bold.ttf`,
    'https://fonts.gstatic.com/s/tajawal/v11/Iura6YBj_oCad4k1rzaLCr5IlLA.ttf',
  ]},

  // ── Reem Kufi (Arabic) ──────────────────────────────────────────
  { filename: 'ReemKufi-Regular.ttf', urls: [
    `${EGF}/reem-kufi/ReemKufi_400Regular.ttf`,
    'https://fonts.gstatic.com/s/reemkufi/v26/2sDcZGJLip7W6y81rPK_3lkTAiTmS7A.ttf',
  ]},

  // ── Lateef (Arabic/Urdu) ────────────────────────────────────────
  { filename: 'Lateef-Regular.ttf', urls: [
    `${EGF}/lateef/Lateef_400Regular.ttf`,
    'https://fonts.gstatic.com/s/lateef/v30/hESy6XlkNgAIABQABowqAD8.ttf',
  ]},

  // ── Roboto (Latin) ──────────────────────────────────────────────
  { filename: 'Roboto-Regular.ttf', urls: [
    `${EGF}/roboto/Roboto_400Regular.ttf`,
    'https://cdn.jsdelivr.net/gh/google/fonts@main/apache/roboto/static/Roboto-Regular.ttf',
  ]},
  { filename: 'Roboto-Bold.ttf', urls: [
    `${EGF}/roboto/Roboto_700Bold.ttf`,
    'https://cdn.jsdelivr.net/gh/google/fonts@main/apache/roboto/static/Roboto-Bold.ttf',
  ]},
  { filename: 'Roboto-Italic.ttf', urls: [
    `${EGF}/roboto/Roboto_400Regular_Italic.ttf`,
    'https://cdn.jsdelivr.net/gh/google/fonts@main/apache/roboto/static/Roboto-Italic.ttf',
  ]},
  { filename: 'Roboto-BoldItalic.ttf', urls: [
    `${EGF}/roboto/Roboto_700Bold_Italic.ttf`,
    'https://cdn.jsdelivr.net/gh/google/fonts@main/apache/roboto/static/Roboto-BoldItalic.ttf',
  ]},

  // ── Open Sans (Latin) ───────────────────────────────────────────
  { filename: 'OpenSans-Regular.ttf', urls: [
    `${EGF}/open-sans/OpenSans_400Regular.ttf`,
    'https://cdn.jsdelivr.net/gh/google/fonts@main/apache/opensans/static/OpenSans-Regular.ttf',
  ]},
  { filename: 'OpenSans-Bold.ttf', urls: [
    `${EGF}/open-sans/OpenSans_700Bold.ttf`,
    'https://cdn.jsdelivr.net/gh/google/fonts@main/apache/opensans/static/OpenSans-Bold.ttf',
  ]},
  { filename: 'OpenSans-Italic.ttf', urls: [
    `${EGF}/open-sans/OpenSans_400Regular_Italic.ttf`,
    'https://cdn.jsdelivr.net/gh/google/fonts@main/apache/opensans/static/OpenSans-Italic.ttf',
  ]},
  { filename: 'OpenSans-BoldItalic.ttf', urls: [
    `${EGF}/open-sans/OpenSans_700Bold_Italic.ttf`,
    'https://cdn.jsdelivr.net/gh/google/fonts@main/apache/opensans/static/OpenSans-BoldItalic.ttf',
  ]},

  // ── Lato (Latin) ────────────────────────────────────────────────
  { filename: 'Lato-Regular.ttf', urls: [
    `${EGF}/lato/Lato_400Regular.ttf`,
    'https://fonts.gstatic.com/s/lato/v24/S6uyw4BMUTPHjx4wXiWtFCc.ttf',
  ]},
  { filename: 'Lato-Bold.ttf', urls: [
    `${EGF}/lato/Lato_700Bold.ttf`,
    'https://fonts.gstatic.com/s/lato/v24/S6u9w4BMUTPHh6UVSwiPGQ3q5d0.ttf',
  ]},
  { filename: 'Lato-Italic.ttf', urls: [
    `${EGF}/lato/Lato_400Regular_Italic.ttf`,
    'https://fonts.gstatic.com/s/lato/v24/S6u8w4BMUTPHjxsAXC-v.ttf',
  ]},
  { filename: 'Lato-BoldItalic.ttf', urls: [
    `${EGF}/lato/Lato_700Bold_Italic.ttf`,
    'https://fonts.gstatic.com/s/lato/v24/S6u_w4BMUTPHjxsI5wq_Gwftx9897g.ttf',
  ]},

  // ── Poppins (Latin) ─────────────────────────────────────────────
  { filename: 'Poppins-Regular.ttf', urls: [
    `${EGF}/poppins/Poppins_400Regular.ttf`,
    'https://fonts.gstatic.com/s/poppins/v21/pxiEyp8kv8JHgFVrJJfecg.ttf',
  ]},
  { filename: 'Poppins-Bold.ttf', urls: [
    `${EGF}/poppins/Poppins_700Bold.ttf`,
    'https://fonts.gstatic.com/s/poppins/v21/pxiByp8kv8JHgFVrLCz7Z1xlFd2JQEk.ttf',
  ]},
  { filename: 'Poppins-Italic.ttf', urls: [
    `${EGF}/poppins/Poppins_400Regular_Italic.ttf`,
    'https://fonts.gstatic.com/s/poppins/v21/pxiGyp8kv8JHgFVrJJLedA.ttf',
  ]},
  { filename: 'Poppins-BoldItalic.ttf', urls: [
    `${EGF}/poppins/Poppins_700Bold_Italic.ttf`,
    'https://fonts.gstatic.com/s/poppins/v21/pxiDyp8kv8JHgFVrJJLm91xlEN2PQEhcqw.ttf',
  ]},

  // ── Inter (Latin) ───────────────────────────────────────────────
  { filename: 'Inter-Regular.ttf', urls: [
    `${EGF}/inter/Inter_400Regular.ttf`,
    'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiJ-Ek-_EeA.ttf',
  ]},
  { filename: 'Inter-Bold.ttf', urls: [
    `${EGF}/inter/Inter_700Bold.ttf`,
    'https://fonts.gstatic.com/s/inter/v18/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hiJ-Ek-_EeA.ttf',
  ]},
  { filename: 'Inter-Italic.ttf', urls: [
    `${EGF}/inter/Inter_400Regular_Italic.ttf`,
  ]},

  // ── Montserrat (Latin) ──────────────────────────────────────────
  { filename: 'Montserrat-Regular.ttf', urls: [
    `${EGF}/montserrat/Montserrat_400Regular.ttf`,
    'https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCtr6Hw5aXo.ttf',
  ]},
  { filename: 'Montserrat-Bold.ttf', urls: [
    `${EGF}/montserrat/Montserrat_700Bold.ttf`,
    'https://fonts.gstatic.com/s/montserrat/v29/JTUHjIg1_i6t8kCHKm4532VJOt5-QNFgpCuM73w5aXo.ttf',
  ]},
  { filename: 'Montserrat-Italic.ttf', urls: [
    `${EGF}/montserrat/Montserrat_400Regular_Italic.ttf`,
    'https://fonts.gstatic.com/s/montserrat/v29/JTUFjIg1_i6t8kCHKm459Wx7xQYXK0vOoz6jq6R8WXh0pg.ttf',
  ]},
  { filename: 'Montserrat-BoldItalic.ttf', urls: [
    `${EGF}/montserrat/Montserrat_700Bold_Italic.ttf`,
  ]},

  // ── Merriweather (Latin) ────────────────────────────────────────
  { filename: 'Merriweather-Regular.ttf', urls: [
    `${EGF}/merriweather/Merriweather_400Regular.ttf`,
    'https://fonts.gstatic.com/s/merriweather/v30/u-440qyriQwlOrhSvowK_l5-fCZMdeX3rg.ttf',
  ]},
  { filename: 'Merriweather-Bold.ttf', urls: [
    `${EGF}/merriweather/Merriweather_700Bold.ttf`,
    'https://fonts.gstatic.com/s/merriweather/v30/u-4n0qyriQwlOrhSvowK_l52xwNZWMf6.ttf',
  ]},
  { filename: 'Merriweather-Italic.ttf', urls: [
    `${EGF}/merriweather/Merriweather_400Regular_Italic.ttf`,
    'https://fonts.gstatic.com/s/merriweather/v30/u-4m0qyriQwlOrhSvowK_l5-eSZJdeX3rsU.ttf',
  ]},
  { filename: 'Merriweather-BoldItalic.ttf', urls: [
    `${EGF}/merriweather/Merriweather_700Bold_Italic.ttf`,
    'https://fonts.gstatic.com/s/merriweather/v30/u-4l0qyriQwlOrhSvowK_l52xwNZW8J3lQ.ttf',
  ]},

  // ── Lora (Latin serif) ──────────────────────────────────────────
  { filename: 'Lora-Regular.ttf', urls: [
    `${EGF}/lora/Lora_400Regular.ttf`,
    'https://fonts.gstatic.com/s/lora/v35/0QI6MX1D_JOxE7fSZtvbCfXCDg.ttf',
  ]},
  { filename: 'Lora-Bold.ttf', urls: [
    `${EGF}/lora/Lora_700Bold.ttf`,
    'https://fonts.gstatic.com/s/lora/v35/0QI6MX1D_JOxE7fSZtvb1fXCDg.ttf',
  ]},
  { filename: 'Lora-Italic.ttf', urls: [
    `${EGF}/lora/Lora_400Regular_Italic.ttf`,
    'https://fonts.gstatic.com/s/lora/v35/0QI8MX1D_JOxE7fSZtvmkpsDtYQ.ttf',
  ]},
  { filename: 'Lora-BoldItalic.ttf', urls: [
    `${EGF}/lora/Lora_700Bold_Italic.ttf`,
  ]},

  // ── Playfair Display (Latin) ────────────────────────────────────
  { filename: 'PlayfairDisplay-Regular.ttf', urls: [
    `${EGF}/playfair-display/PlayfairDisplay_400Regular.ttf`,
    'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKd3vXDXbtXK-F2qC0s.ttf',
  ]},
  { filename: 'PlayfairDisplay-Bold.ttf', urls: [
    `${EGF}/playfair-display/PlayfairDisplay_700Bold.ttf`,
    'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFvD-vYSZviVYUb_rj3ij__anPXJzDwcbmjWBN2PKd3vXDXbtXK-F2qC0s.ttf',
  ]},
  { filename: 'PlayfairDisplay-Italic.ttf', urls: [
    `${EGF}/playfair-display/PlayfairDisplay_400Regular_Italic.ttf`,
    'https://fonts.gstatic.com/s/playfairdisplay/v37/nuFRD-vYSZviVYUb_rj3ij__anPXDTzYgEM86xRbPQ.ttf',
  ]},
  { filename: 'PlayfairDisplay-BoldItalic.ttf', urls: [
    `${EGF}/playfair-display/PlayfairDisplay_700Bold_Italic.ttf`,
  ]},

  // ── EB Garamond (Latin) ─────────────────────────────────────────
  { filename: 'EBGaramond-Regular.ttf', urls: [
    `${EGF}/eb-garamond/EBGaramond_400Regular.ttf`,
    'https://fonts.gstatic.com/s/ebgaramond/v27/SlGDmQSNjdsmc35JDF1K5E55YMjF_7DPuGi-6_RUA4V-e6yHgQ.ttf',
  ]},
  { filename: 'EBGaramond-Bold.ttf', urls: [
    `${EGF}/eb-garamond/EBGaramond_700Bold.ttf`,
    'https://fonts.gstatic.com/s/ebgaramond/v27/SlGDmQSNjdsmc35JDF1K5E55YMjF_7DPuGi-2fFUA4V-e6yHgQ.ttf',
  ]},
  { filename: 'EBGaramond-Italic.ttf', urls: [
    `${EGF}/eb-garamond/EBGaramond_400Regular_Italic.ttf`,
    'https://fonts.gstatic.com/s/ebgaramond/v27/SlGFmQSNjdsmc35JDF1K5GRwSDo_ZiqmkqZRea2XrA.ttf',
  ]},
  { filename: 'EBGaramond-BoldItalic.ttf', urls: [
    `${EGF}/eb-garamond/EBGaramond_700Bold_Italic.ttf`,
  ]},
];

// ── Download helpers ────────────────────────────────────────────

function downloadOne(url, dest, redirects) {
  redirects = redirects || 0;
  return new Promise(function(resolve, reject) {
    if (redirects > 5) return reject(new Error('Too many redirects'));
    var proto = url.startsWith('https') ? https : http;
    var tmp   = dest + '.tmp';
    var file  = fs.createWriteStream(tmp);
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
      res.on('error', function(e) { file.close(); try { fs.unlinkSync(tmp); } catch (_) {} reject(e); });
    }).on('error', function(e) { file.close(); try { fs.unlinkSync(tmp); } catch (_) {} reject(e); });
  });
}

async function downloadFont(filename, urls) {
  var dest = path.join(FONTS_DIR, filename);
  try {
    if (fs.existsSync(dest) && fs.statSync(dest).size > MIN_VALID_SIZE) {
      console.log('[fonts] already present: ' + filename + ' (' + fs.statSync(dest).size + ' bytes)');
      return true;
    }
  } catch (_) {}

  for (var i = 0; i < urls.length; i++) {
    try {
      console.log('[fonts] trying (' + (i + 1) + '/' + urls.length + '): ' + urls[i]);
      await downloadOne(urls[i], dest);
      return true;
    } catch (e) {
      console.warn('[fonts] failed: ' + e.message);
    }
  }
  console.error('[fonts] All URLs failed for ' + filename);
  return false;
}

async function main() {
  try { fs.mkdirSync(FONTS_DIR, { recursive: true }); } catch (_) {}

  var ok = 0;
  for (var i = 0; i < FONTS.length; i++) {
    var f       = FONTS[i];
    var success = await downloadFont(f.filename, f.urls);
    if (success) ok++;
  }
  console.log('[fonts] ' + ok + '/' + FONTS.length + ' fonts ready in server/fonts/');
}

main().catch(function(e) {
  console.error('[fonts] fatal (non-fatal for deploy):', e.message);
  process.exit(0);
});
