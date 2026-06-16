const path   = require('path');
const fs     = require('fs');
const { PassThrough } = require('stream');
const sharp  = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const QRCode = require('qrcode');
const { v4: uuidv4 } = require('uuid');
const { TMP_DIR }    = require('../middleware/upload');

// Bind bundled ffmpeg binary
try {
  const ffmpegPath = require('ffmpeg-static');
  if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
} catch { /* ffmpeg-static not available — rely on system PATH */ }

// ── Helpers ──────────────────────────────────────────────────

function outPath(ext) {
  return path.join(TMP_DIR, uuidv4() + '.' + ext);
}

// Converts a raw BMP DIB (no file header) from an ICO entry to RGBA pixel data.
// Returns { data: Buffer<RGBA>, width, height, channels: 4 }.
// Sharp on Windows rejects BMP buffers, so we parse pixels manually instead.
function dibToRgba(dib) {
  const infoSize  = dib.readUInt32LE(0);
  const biWidth   = Math.abs(dib.readInt32LE(4));
  const biHeight  = dib.readInt32LE(8);
  const bitCount  = dib.readUInt16LE(14);
  const compress  = dib.readUInt32LE(16);

  if (compress !== 0) throw new Error('Compressed BMP ICO images are not supported.');

  // ICO stores biHeight = 2 × actual height (XOR pixel data + AND mask rows).
  const topDown = biHeight < 0;
  const height  = Math.max(1, Math.floor(Math.abs(biHeight) / 2));
  const width   = biWidth;

  let clrUsed = dib.readUInt32LE(32);
  if (clrUsed === 0 && bitCount <= 8) clrUsed = 1 << bitCount;

  const pixelStart = infoSize + clrUsed * 4;
  const out        = Buffer.alloc(width * height * 4);

  if (bitCount === 32) {
    // BGRA, no row padding (already DWORD-aligned)
    for (let y = 0; y < height; y++) {
      const srcY = topDown ? y : height - 1 - y;
      for (let x = 0; x < width; x++) {
        const s = pixelStart + (srcY * width + x) * 4;
        const d = (y * width + x) * 4;
        out[d]     = dib[s + 2]; // R
        out[d + 1] = dib[s + 1]; // G
        out[d + 2] = dib[s];     // B
        out[d + 3] = dib[s + 3]; // A
      }
    }
    // If all alpha bytes are 0 (AND-mask-only transparency), treat as opaque
    let hasAlpha = false;
    for (let i = 3; i < out.length; i += 4) { if (out[i]) { hasAlpha = true; break; } }
    if (!hasAlpha) for (let i = 3; i < out.length; i += 4) out[i] = 255;

  } else if (bitCount === 24) {
    const stride = Math.ceil(width * 3 / 4) * 4;
    for (let y = 0; y < height; y++) {
      const srcY = topDown ? y : height - 1 - y;
      for (let x = 0; x < width; x++) {
        const s = pixelStart + srcY * stride + x * 3;
        const d = (y * width + x) * 4;
        out[d]     = dib[s + 2]; // R
        out[d + 1] = dib[s + 1]; // G
        out[d + 2] = dib[s];     // B
        out[d + 3] = 255;
      }
    }
  } else if (bitCount === 8) {
    const palette = [];
    for (let i = 0; i < clrUsed; i++) {
      const o = infoSize + i * 4;
      palette.push([dib[o + 2], dib[o + 1], dib[o]]);
    }
    const stride = Math.ceil(width / 4) * 4;
    for (let y = 0; y < height; y++) {
      const srcY = topDown ? y : height - 1 - y;
      for (let x = 0; x < width; x++) {
        const c = palette[dib[pixelStart + srcY * stride + x]] || [0, 0, 0];
        const d = (y * width + x) * 4;
        out[d] = c[0]; out[d + 1] = c[1]; out[d + 2] = c[2]; out[d + 3] = 255;
      }
    }
  } else if (bitCount === 4) {
    const palette = [];
    for (let i = 0; i < clrUsed; i++) {
      const o = infoSize + i * 4;
      palette.push([dib[o + 2], dib[o + 1], dib[o]]);
    }
    const stride = Math.ceil(width / 8) * 4;
    for (let y = 0; y < height; y++) {
      const srcY = topDown ? y : height - 1 - y;
      for (let x = 0; x < width; x++) {
        const byte = dib[pixelStart + srcY * stride + Math.floor(x / 2)];
        const idx  = x % 2 === 0 ? (byte >> 4) : (byte & 0x0f);
        const c    = palette[idx] || [0, 0, 0];
        const d    = (y * width + x) * 4;
        out[d] = c[0]; out[d + 1] = c[1]; out[d + 2] = c[2]; out[d + 3] = 255;
      }
    }
  } else if (bitCount === 1) {
    const c0 = clrUsed > 0 ? [dib[infoSize + 2], dib[infoSize + 1], dib[infoSize]]     : [0, 0, 0];
    const c1 = clrUsed > 1 ? [dib[infoSize + 6], dib[infoSize + 5], dib[infoSize + 4]] : [255, 255, 255];
    const stride = Math.ceil(width / 32) * 4;
    for (let y = 0; y < height; y++) {
      const srcY = topDown ? y : height - 1 - y;
      for (let x = 0; x < width; x++) {
        const bit = (dib[pixelStart + srcY * stride + Math.floor(x / 8)] >> (7 - x % 8)) & 1;
        const c   = bit ? c1 : c0;
        const d   = (y * width + x) * 4;
        out[d] = c[0]; out[d + 1] = c[1]; out[d + 2] = c[2]; out[d + 3] = 255;
      }
    }
  } else {
    throw new Error(`Unsupported BMP bit depth in ICO: ${bitCount}`);
  }

  return { data: out, width, height, channels: 4 };
}

// Reads an ICO file and returns { type:'png', buffer } or { type:'raw', data, width, height, channels }.
// No third-party dependencies — parses the ICO binary format directly.
function extractLargestIcoImage(inputPath) {
  const buf = fs.readFileSync(inputPath);

  if (buf.length < 6) throw new Error('File is too small to be a valid ICO.');
  if (buf.readUInt16LE(0) !== 0) throw new Error('Invalid ICO file.');
  if (buf.readUInt16LE(2) !== 1) throw new Error('File is not an ICO (type field must be 1).');

  const count = buf.readUInt16LE(4);
  if (count === 0) throw new Error('ICO file contains no images.');

  let best = null;
  let bestArea = -1;

  for (let i = 0; i < count; i++) {
    const base = 6 + i * 16;
    if (base + 16 > buf.length) break;
    const w        = buf[base]     || 256;
    const h        = buf[base + 1] || 256;
    const dataSize = buf.readUInt32LE(base + 8);
    const dataOff  = buf.readUInt32LE(base + 12);
    const area     = w * h;
    if (area > bestArea && dataSize > 0 && dataOff + dataSize <= buf.length) {
      bestArea = area;
      best = { dataSize, dataOff };
    }
  }

  if (!best) throw new Error('No valid image entries found in ICO file.');

  const img = buf.slice(best.dataOff, best.dataOff + best.dataSize);

  // Embedded PNG — check for PNG magic bytes (89 50 4E 47)
  if (img.length >= 4 && img[0] === 0x89 && img[1] === 0x50 &&
      img[2] === 0x4E && img[3] === 0x47) {
    return { type: 'png', buffer: img };
  }

  // Embedded BMP DIB — decode to raw RGBA (avoids passing BMP to sharp)
  return { type: 'raw', ...dibToRgba(img) };
}

function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function clamp(val, min, max) {
  const n = Number(val);
  return isNaN(n) ? min : Math.max(min, Math.min(max, n));
}

function runFfmpeg(buildFn) {
  return new Promise((resolve, reject) => {
    const cmd = ffmpeg();
    buildFn(cmd);
    cmd
      .on('end',   () => resolve())
      .on('error', (err) => reject(err))
      .run();
  });
}

// Like runFfmpeg but collects stdout into a Buffer instead of writing a file.
// setupCmd must NOT call cmd.output() — cmd.pipe() is called internally.
function runFfmpegToBuffer(setupCmd) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn, val) => { if (!settled) { settled = true; fn(val); } };
    const cmd = ffmpeg();
    setupCmd(cmd);
    const chunks = [];
    const outStream = cmd.pipe(); // starts FFmpeg, returns PassThrough for stdout
    outStream.on('data', (c) => chunks.push(c));
    cmd.on('end',   () => settle(resolve, Buffer.concat(chunks)));
    cmd.on('error', (e) => settle(reject, e));
  });
}

// Returns the duration of an audio/video file in seconds (0 if unknown).
// Hard-caps at 8 s so a slow/broken ffprobe never stalls the conversion.
function getMediaDuration(filePath) {
  return Promise.race([
    new Promise((resolve) => {
      ffmpeg.ffprobe(filePath, (err, meta) => {
        const d = meta?.format?.duration;
        resolve((!err && d && isFinite(d)) ? parseFloat(d) : 0);
      });
    }),
    new Promise((resolve) => setTimeout(() => resolve(0), 8000)),
  ]);
}

// Converts an ffmpeg timemark string ("HH:MM:SS.ms") to seconds.
function parseTimemark(mark) {
  if (!mark) return 0;
  const parts = String(mark).split(':').map(parseFloat);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

// ── IMAGE TOOLS (sharp) ──────────────────────────────────────

async function processImage(inputPath, slug, options = {}) {
  switch (slug) {

    case 'image-compressor': {
      const quality = clamp(parseInt(options.quality) || 80, 1, 100);
      const meta    = await sharp(inputPath).metadata();
      const isPng   = meta.format === 'png';
      const ext     = isPng ? 'png' : 'jpg';
      const mime    = isPng ? 'image/png' : 'image/jpeg';
      const output  = outPath(ext);
      if (isPng) {
        const lvl = Math.round((100 - quality) / 11);
        await sharp(inputPath).png({ compressionLevel: lvl }).toFile(output);
      } else {
        await sharp(inputPath).jpeg({ quality }).toFile(output);
      }
      return { outputPath: output, filename: `compressed.${ext}`, mimeType: mime };
    }

    case 'image-resizer': {
      const width  = parseInt(options.width)  || null;
      const height = parseInt(options.height) || null;
      const fit    = ['cover', 'contain', 'fill'].includes(options.fit) ? options.fit : 'cover';
      if (!width && !height) throw new Error('Width or height is required.');
      const meta   = await sharp(inputPath).metadata();
      const ext    = meta.format === 'png' ? 'png' : 'jpg';
      const mime   = ext === 'png' ? 'image/png' : 'image/jpeg';
      const output = outPath(ext);
      await sharp(inputPath).resize(width, height, { fit }).toFile(output);
      return { outputPath: output, filename: `resized.${ext}`, mimeType: mime };
    }

    case 'image-converter': {
      const fmtMap = { jpeg: 'jpg', jpg: 'jpg', png: 'png', webp: 'webp', gif: 'gif' };
      const mimeMap = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
      const rawFmt  = String(options.format || 'jpeg').toLowerCase();
      const ext     = fmtMap[rawFmt] || 'jpg';
      const sharpFmt = ext === 'jpg' ? 'jpeg' : ext;
      const output  = outPath(ext);
      await sharp(inputPath).toFormat(sharpFmt).toFile(output);
      return { outputPath: output, filename: `converted.${ext}`, mimeType: mimeMap[ext] };
    }

    case 'image-cropper': {
      const left   = clamp(parseInt(options.left)   || 0, 0, 99999);
      const top    = clamp(parseInt(options.top)    || 0, 0, 99999);
      const width  = clamp(parseInt(options.width)  || 100, 1, 99999);
      const height = clamp(parseInt(options.height) || 100, 1, 99999);
      const meta   = await sharp(inputPath).metadata();
      const ext    = meta.format === 'png' ? 'png' : 'jpg';
      const mime   = ext === 'png' ? 'image/png' : 'image/jpeg';
      const output = outPath(ext);
      await sharp(inputPath).extract({ left, top, width, height }).toFile(output);
      return { outputPath: output, filename: `cropped.${ext}`, mimeType: mime };
    }

    case 'background-remover': {
      if (!process.env.REMOVEBG_API_KEY) {
        return { comingSoon: true };
      }
      const axios    = require('axios');
      const FormData = require('form-data');
      const form     = new FormData();
      form.append('image_file', fs.createReadStream(inputPath));
      form.append('size', 'auto');
      const resp = await axios.post('https://api.remove.bg/v1.0/removebg', form, {
        headers: { 'X-Api-Key': process.env.REMOVEBG_API_KEY, ...form.getHeaders() },
        responseType: 'arraybuffer',
      });
      const output = outPath('png');
      fs.writeFileSync(output, resp.data);
      return { outputPath: output, filename: 'background-removed.png', mimeType: 'image/png' };
    }

    case 'image-to-grayscale': {
      const meta   = await sharp(inputPath).metadata();
      const ext    = meta.format === 'png' ? 'png' : 'jpg';
      const mime   = ext === 'png' ? 'image/png' : 'image/jpeg';
      const output = outPath(ext);
      await sharp(inputPath).grayscale().toFile(output);
      return { outputPath: output, filename: `grayscale.${ext}`, mimeType: mime };
    }

    case 'image-rotator': {
      const allowed = [90, 180, 270, -90];
      const angle   = allowed.includes(parseInt(options.angle)) ? parseInt(options.angle) : 90;
      const meta    = await sharp(inputPath).metadata();
      const ext     = meta.format === 'png' ? 'png' : 'jpg';
      const mime    = ext === 'png' ? 'image/png' : 'image/jpeg';
      const output  = outPath(ext);
      await sharp(inputPath).rotate(angle).toFile(output);
      return { outputPath: output, filename: `rotated.${ext}`, mimeType: mime };
    }

    case 'image-watermark': {
      const text     = escapeXml((options.text || 'Watermark').slice(0, 100));
      const position = ['center', 'bottomRight', 'bottomLeft'].includes(options.position)
        ? options.position : 'bottomRight';

      const meta = await sharp(inputPath).metadata();
      const w    = meta.width  || 800;
      const h    = meta.height || 600;
      const fs_  = Math.max(20, Math.round(w / 18));

      // Position text inside a full-canvas SVG
      let tx, ty, anchor;
      switch (position) {
        case 'center':
          tx = Math.round(w / 2); ty = Math.round(h / 2); anchor = 'middle'; break;
        case 'bottomLeft':
          tx = fs_; ty = h - Math.round(fs_ / 2); anchor = 'start'; break;
        default: // bottomRight
          tx = w - fs_; ty = h - Math.round(fs_ / 2); anchor = 'end'; break;
      }

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <text x="${tx}" y="${ty}" font-size="${fs_}px" font-family="Arial,sans-serif"
    fill="rgba(255,255,255,0.72)" stroke="rgba(0,0,0,0.4)" stroke-width="1.5"
    text-anchor="${anchor}" dominant-baseline="auto">${text}</text>
</svg>`;

      const ext    = meta.format === 'png' ? 'png' : 'jpg';
      const mime   = ext === 'png' ? 'image/png' : 'image/jpeg';
      const output = outPath(ext);
      await sharp(inputPath)
        .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
        .toFile(output);
      return { outputPath: output, filename: `watermarked.${ext}`, mimeType: mime };
    }

    case 'image-to-base64': {
      const mimeMap = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' };
      const meta    = await sharp(inputPath).metadata();
      const mime    = mimeMap[meta.format] || 'image/jpeg';
      const buffer  = fs.readFileSync(inputPath);
      return { base64: `data:${mime};base64,${buffer.toString('base64')}` };
    }

    case 'qr-code-generator': {
      const text       = String(options.text || '').trim();
      if (!text) throw new Error('Text is required for QR code generation.');
      const size       = clamp(parseInt(options.size) || 300, 100, 1000);
      const validLevels = ['L', 'M', 'Q', 'H'];
      const errorLevel = validLevels.includes(options.errorLevel) ? options.errorLevel : 'M';
      const output     = outPath('png');
      await QRCode.toFile(output, text, { width: size, errorCorrectionLevel: errorLevel });
      return { outputPath: output, filename: 'qr-code.png', mimeType: 'image/png' };
    }

    case 'image-censor': {
      let regions = [];
      try {
        regions = typeof options.regions === 'string'
          ? JSON.parse(options.regions)
          : (Array.isArray(options.regions) ? options.regions : []);
      } catch { regions = []; }
      const mode = ['blur', 'pixelate', 'blackout'].includes(options.mode) ? options.mode : 'blur';

      const meta = await sharp(inputPath).metadata();
      const w    = meta.width  || 800;
      const h    = meta.height || 600;
      const ext  = meta.format === 'png' ? 'png' : 'jpg';
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
      const output = outPath(ext);

      if (regions.length === 0) {
        await sharp(inputPath).toFile(output);
      } else {
        const composites = [];
        for (const region of regions) {
          const rx = clamp(parseInt(region.x) || 0, 0, w - 1);
          const ry = clamp(parseInt(region.y) || 0, 0, h - 1);
          const rw = clamp(parseInt(region.w) || 50, 1, w - rx);
          const rh = clamp(parseInt(region.h) || 50, 1, h - ry);

          if (mode === 'blackout') {
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect x="${rx}" y="${ry}" width="${rw}" height="${rh}" fill="black"/></svg>`;
            composites.push({ input: Buffer.from(svg), top: 0, left: 0 });
          } else if (mode === 'pixelate') {
            const pixW = Math.max(1, Math.round(rw / 10));
            const pixH = Math.max(1, Math.round(rh / 10));
            const patch = await sharp(inputPath)
              .extract({ left: rx, top: ry, width: rw, height: rh })
              .resize(pixW, pixH, { fit: 'fill' })
              .resize(rw, rh, { fit: 'fill', kernel: 'nearest' })
              .toBuffer();
            composites.push({ input: patch, top: ry, left: rx });
          } else {
            const patch = await sharp(inputPath)
              .extract({ left: rx, top: ry, width: rw, height: rh })
              .blur(20)
              .toBuffer();
            composites.push({ input: patch, top: ry, left: rx });
          }
        }
        await sharp(inputPath).composite(composites).toFile(output);
      }
      return { outputPath: output, filename: `censored.${ext}`, mimeType: mime };
    }

    case 'metadata-exif-remover': {
      const meta = await sharp(inputPath).metadata();
      const ext  = meta.format === 'png' ? 'png' : 'jpg';
      const mime = ext === 'png' ? 'image/png' : 'image/jpeg';
      const output = outPath(ext);

      // Decode to raw pixels — metadata cannot survive a pixel-level round-trip.
      // Then re-encode from scratch so the output file contains zero EXIF/XMP/IPTC.
      const { data, info } = await sharp(inputPath)
        .raw()
        .toBuffer({ resolveWithObject: true });

      const pipeline = sharp(data, {
        raw: { width: info.width, height: info.height, channels: info.channels },
      });

      if (ext === 'png') {
        await pipeline.png({ compressionLevel: 6 }).toFile(output);
      } else {
        await pipeline.jpeg({ quality: 92, mozjpeg: true }).toFile(output);
      }

      return { outputPath: output, filename: `cleaned.${ext}`, mimeType: mime };
    }

    case 'meme-generator': {
      const topText    = escapeXml((options.topText    || 'TOP TEXT').slice(0, 100).toUpperCase());
      const bottomText = escapeXml((options.bottomText || 'BOTTOM TEXT').slice(0, 100).toUpperCase());
      const fontSize   = clamp(parseInt(options.fontSize) || 48, 20, 120);
      const rawColor   = String(options.color || '#FFFFFF');
      const color      = /^#[0-9A-Fa-f]{6}$/.test(rawColor) ? escapeXml(rawColor) : '#FFFFFF';

      const meta = await sharp(inputPath).metadata();
      const w    = meta.width  || 800;
      const h    = meta.height || 600;
      const padY = Math.round(fontSize * 0.3);

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <text x="${Math.round(w/2)}" y="${fontSize + padY}"
    font-size="${fontSize}px" font-family="Impact,Arial Black,sans-serif"
    fill="${color}" stroke="black" stroke-width="3" paint-order="stroke"
    text-anchor="middle">${topText}</text>
  <text x="${Math.round(w/2)}" y="${h - padY}"
    font-size="${fontSize}px" font-family="Impact,Arial Black,sans-serif"
    fill="${color}" stroke="black" stroke-width="3" paint-order="stroke"
    text-anchor="middle">${bottomText}</text>
</svg>`;

      const ext    = meta.format === 'png' ? 'png' : 'jpg';
      const mime   = ext === 'png' ? 'image/png' : 'image/jpeg';
      const output = outPath(ext);
      await sharp(inputPath).composite([{ input: Buffer.from(svg), top: 0, left: 0 }]).toFile(output);
      return { outputPath: output, filename: `meme.${ext}`, mimeType: mime };
    }

    case 'image-merger': {
      const paths = Array.isArray(inputPath) ? inputPath : [inputPath];
      if (paths.length < 2) throw new Error('At least 2 images are required to merge.');

      const direction = options.direction === 'horizontal' ? 'horizontal' : 'vertical';
      const spacing   = clamp(parseInt(options.spacing) || 0, 0, 200);

      const metas = await Promise.all(paths.map(p => sharp(p).metadata()));
      let canvas, composites = [];

      if (direction === 'vertical') {
        const maxW     = Math.max(...metas.map(m => m.width  || 0));
        const totalH   = metas.reduce((s, m) => s + (m.height || 0), 0) + spacing * (paths.length - 1);
        canvas = sharp({ create: { width: maxW, height: totalH, channels: 3, background: { r: 255, g: 255, b: 255 } } });
        let yOff = 0;
        for (let i = 0; i < paths.length; i++) {
          composites.push({ input: await sharp(paths[i]).toBuffer(), top: yOff, left: 0 });
          yOff += (metas[i].height || 0) + spacing;
        }
      } else {
        const totalW   = metas.reduce((s, m) => s + (m.width || 0), 0) + spacing * (paths.length - 1);
        const maxH     = Math.max(...metas.map(m => m.height || 0));
        canvas = sharp({ create: { width: totalW, height: maxH, channels: 3, background: { r: 255, g: 255, b: 255 } } });
        let xOff = 0;
        for (let i = 0; i < paths.length; i++) {
          composites.push({ input: await sharp(paths[i]).toBuffer(), top: 0, left: xOff });
          xOff += (metas[i].width || 0) + spacing;
        }
      }

      const output = outPath('jpg');
      await canvas.composite(composites).jpeg({ quality: 90 }).toFile(output);
      return { outputPath: output, filename: 'merged.jpg', mimeType: 'image/jpeg' };
    }

    case 'image-rotate': {
      const angle = parseFloat(options.angle) || 0;
      const flip  = options.flip || 'none';

      const meta   = await sharp(inputPath).metadata();
      const ext    = meta.format === 'png' ? 'png' : 'jpg';
      const mime   = ext === 'png' ? 'image/png' : 'image/jpeg';
      const output = outPath(ext);

      let pipeline = sharp(inputPath).rotate(angle, { background: { r: 255, g: 255, b: 255, alpha: 1 } });
      if (flip === 'horizontal') pipeline = pipeline.flop();
      if (flip === 'vertical')   pipeline = pipeline.flip();
      await pipeline.toFile(output);
      return { outputPath: output, filename: `rotated.${ext}`, mimeType: mime };
    }

    case 'image-filters': {
      const filter  = options.filter || 'sepia';
      const meta    = await sharp(inputPath).metadata();
      const ext     = meta.format === 'png' ? 'png' : 'jpg';
      const mime    = ext === 'png' ? 'image/png' : 'image/jpeg';
      const output  = outPath(ext);

      let pipeline = sharp(inputPath);
      switch (filter) {
        case 'sepia':
          pipeline = pipeline.grayscale().tint({ r: 112, g: 66, b: 20 }); break;
        case 'vintage':
          pipeline = pipeline.modulate({ saturation: 0.6, brightness: 1.1 }).tint({ r: 255, g: 240, b: 200 }); break;
        case 'invert':
          pipeline = pipeline.negate(); break;
        case 'blur':
          pipeline = pipeline.blur(5); break;
        case 'sharpen':
          pipeline = pipeline.sharpen({ sigma: 2 }); break;
        case 'emboss':
          pipeline = pipeline.convolve({ width: 3, height: 3, kernel: [-2, -1, 0, -1, 1, 1, 0, 1, 2] }); break;
      }
      await pipeline.toFile(output);
      return { outputPath: output, filename: `filtered.${ext}`, mimeType: mime };
    }

    case 'image-adjustment': {
      const brightness = clamp(parseFloat(options.brightness) || 0, -100, 100);
      const contrast   = clamp(parseFloat(options.contrast)   || 0, -100, 100);
      const saturation = clamp(parseFloat(options.saturation) || 0, -100, 100);
      const hue        = clamp(parseFloat(options.hue)        || 0, -180, 180);

      const meta   = await sharp(inputPath).metadata();
      const ext    = meta.format === 'png' ? 'png' : 'jpg';
      const mime   = ext === 'png' ? 'image/png' : 'image/jpeg';
      const output = outPath(ext);

      const bMult = Math.max(0.01, 1 + brightness / 100);
      const sMult = Math.max(0,    1 + saturation / 100);
      const cMult = 1 + contrast / 100;

      await sharp(inputPath)
        .modulate({ brightness: bMult, saturation: sMult, hue })
        .linear(cMult, -(128 * cMult - 128))
        .toFile(output);
      return { outputPath: output, filename: `adjusted.${ext}`, mimeType: mime };
    }

    case 'qr-code-reader': {
      const jsQR = require('jsqr');
      const { data, info } = await sharp(inputPath)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      const code = jsQR(new Uint8ClampedArray(data.buffer), info.width, info.height);
      if (!code) throw new Error('No QR code detected. Ensure the image is clear and the QR code is fully visible.');
      return { text: code.data };
    }

    case 'image-ocr': {
      const { createWorker } = require('tesseract.js');
      const lang = /^[a-z]{3}$/.test(options.language || '') ? options.language : 'eng';
      const worker = await createWorker(lang);
      try {
        const { data: { text } } = await worker.recognize(inputPath);
        return { text: (text || '').trim() };
      } finally {
        await worker.terminate();
      }
    }

    // ── Image Format Converters ──────────────────────────────────

    case 'jpg-to-png': case 'jfif-to-png': case 'tiff-to-png':
    case 'webp-to-png': {
      const output = outPath('png');
      await sharp(inputPath).png().toFile(output);
      return { outputPath: output, filename: 'converted.png', mimeType: 'image/png' };
    }

    case 'jpg-to-webp': case 'jfif-to-webp':
    case 'png-to-webp': case 'webp-to-webp': {
      const output = outPath('webp');
      await sharp(inputPath).webp({ quality: 90 }).toFile(output);
      return { outputPath: output, filename: 'converted.webp', mimeType: 'image/webp' };
    }

    case 'png-to-jpg': case 'webp-to-jpg': case 'tiff-to-jpg': {
      const output = outPath('jpg');
      await sharp(inputPath).jpeg({ quality: 90 }).toFile(output);
      return { outputPath: output, filename: 'converted.jpg', mimeType: 'image/jpeg' };
    }

    case 'svg-to-png': {
      const output = outPath('png');
      await sharp(inputPath).png().toFile(output);
      return { outputPath: output, filename: 'converted.png', mimeType: 'image/png' };
    }

    case 'svg-to-webp': {
      const output = outPath('webp');
      await sharp(inputPath).webp({ quality: 90 }).toFile(output);
      return { outputPath: output, filename: 'converted.webp', mimeType: 'image/webp' };
    }

    case 'svg-to-jpg': {
      const output = outPath('jpg');
      await sharp(inputPath).flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toFile(output);
      return { outputPath: output, filename: 'converted.jpg', mimeType: 'image/jpeg' };
    }

    case 'jpg-to-ico': case 'png-to-ico': case 'webp-to-ico': case 'svg-to-ico': {
      const toIco    = require('to-ico');
      const sizes    = [16, 32, 48, 64, 128, 256];
      const buffers  = await Promise.all(sizes.map(s => sharp(inputPath).resize(s, s, { fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 } }).png().toBuffer()));
      const ico      = await toIco(buffers, { resize: false });
      const output   = outPath('ico');
      fs.writeFileSync(output, ico);
      return { outputPath: output, filename: 'converted.ico', mimeType: 'image/x-icon' };
    }

    case 'ico-to-png': {
      const img  = extractLargestIcoImage(inputPath);
      const src  = img.type === 'png'
        ? sharp(img.buffer)
        : sharp(img.data, { raw: { width: img.width, height: img.height, channels: img.channels } });
      const output = outPath('png');
      await src.png().toFile(output);
      return { outputPath: output, filename: 'converted.png', mimeType: 'image/png' };
    }

    case 'ico-to-jpg': {
      const img  = extractLargestIcoImage(inputPath);
      const src  = img.type === 'png'
        ? sharp(img.buffer)
        : sharp(img.data, { raw: { width: img.width, height: img.height, channels: img.channels } });
      const output = outPath('jpg');
      await src.flatten({ background: '#ffffff' }).jpeg({ quality: 90 }).toFile(output);
      return { outputPath: output, filename: 'converted.jpg', mimeType: 'image/jpeg' };
    }

    case 'ico-to-webp': {
      const img  = extractLargestIcoImage(inputPath);
      const src  = img.type === 'png'
        ? sharp(img.buffer)
        : sharp(img.data, { raw: { width: img.width, height: img.height, channels: img.channels } });
      const output = outPath('webp');
      await src.webp({ quality: 90 }).toFile(output);
      return { outputPath: output, filename: 'converted.webp', mimeType: 'image/webp' };
    }

    case 'heic-to-jpg': {
      const heicConvert = require('heic-convert');
      const inputBuf    = fs.readFileSync(inputPath);
      const outputBuf   = await heicConvert({ buffer: inputBuf, format: 'JPEG', quality: 0.9 });
      const output      = outPath('jpg');
      fs.writeFileSync(output, Buffer.from(outputBuf));
      return { outputPath: output, filename: 'converted.jpg', mimeType: 'image/jpeg' };
    }

    case 'heic-to-png': {
      const heicConvert = require('heic-convert');
      const inputBuf    = fs.readFileSync(inputPath);
      const outputBuf   = await heicConvert({ buffer: inputBuf, format: 'PNG' });
      const output      = outPath('png');
      fs.writeFileSync(output, Buffer.from(outputBuf));
      return { outputPath: output, filename: 'converted.png', mimeType: 'image/png' };
    }

    case 'heic-to-webp': {
      const heicConvert = require('heic-convert');
      const inputBuf    = fs.readFileSync(inputPath);
      const pngBuf      = await heicConvert({ buffer: inputBuf, format: 'PNG' });
      const output      = outPath('webp');
      await sharp(Buffer.from(pngBuf)).webp({ quality: 90 }).toFile(output);
      return { outputPath: output, filename: 'converted.webp', mimeType: 'image/webp' };
    }

    case 'base64-to-png': {
      const raw    = String(options.base64 || inputPath).replace(/^data:[^;,]+;base64,/i, '').trim();
      const buf    = Buffer.from(raw, 'base64');
      const output = outPath('png');
      await sharp(buf).png().toFile(output);
      return { outputPath: output, filename: 'converted.png', mimeType: 'image/png' };
    }

    case 'base64-to-jpg': {
      const raw    = String(options.base64 || inputPath).replace(/^data:[^;,]+;base64,/i, '').trim();
      const buf    = Buffer.from(raw, 'base64');
      const output = outPath('jpg');
      await sharp(buf).jpeg({ quality: 90 }).toFile(output);
      return { outputPath: output, filename: 'converted.jpg', mimeType: 'image/jpeg' };
    }

    default:
      throw new Error(`Unknown image slug: ${slug}`);
  }
}

// ── MEDIA TOOLS (fluent-ffmpeg) ──────────────────────────────

async function processMedia(inputPath, slug, options = {}) {
  switch (slug) {

    case 'audio-converter': {
      const validFmts = ['mp3', 'wav', 'ogg', 'aac', 'm4a'];
      const mimeMap   = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', aac: 'audio/aac', m4a: 'audio/mp4' };
      const fmt = validFmts.includes(options.format) ? options.format : 'mp3';
      const { progressStream } = options;
      const sendProgress = (pct, eta = null) => {
        if (!progressStream || progressStream.writableEnded) return;
        progressStream.write(`data: ${JSON.stringify({ percent: Math.min(99, Math.round(pct)), eta })}\n\n`);
      };

      // ── In-memory pipeline — no temp file, pipes buffer directly to FFmpeg ──
      if (options.inputBuffer) {
        const tStart = Date.now();
        console.log(`[audio-converter] START (piped) fmt=${fmt}  size=${(options.inputBuffer.length / 1024 / 1024).toFixed(2)} MB`);

        // Map original file extension to an ffmpeg input format name
        const ext = path.extname(options.originalname || '').slice(1).toLowerCase() || 'mp3';
        const extFmtMap = { mp3: 'mp3', wav: 'wav', ogg: 'ogg', aac: 'aac', m4a: 'mov', m4b: 'mov', flac: 'flac', opus: 'opus', wma: 'asf', webm: 'webm', mpeg: 'mpeg', mpg: 'mpeg', aiff: 'aiff', aif: 'aiff', amr: 'amr' };
        const inputFmt = extFmtMap[ext] || ext;

        const tFfmpeg = Date.now();
        const outputBuffer = await runFfmpegToBuffer(cmd => {
          const inStream = new PassThrough();
          inStream.end(options.inputBuffer);

          cmd.input(inStream).inputOptions(['-threads', '0']).inputFormat(inputFmt);

          switch (fmt) {
            case 'mp3': cmd.audioCodec('libmp3lame').outputOptions(['-q:a', '2']).toFormat('mp3'); break;
            case 'ogg': cmd.audioCodec('libvorbis').toFormat('ogg'); break;
            case 'aac': cmd.audioCodec('aac').audioBitrate('128k').toFormat('aac'); break;
            case 'm4a':
              // Piped output can't seek, so use frag_keyframe+empty_moov instead of +faststart
              cmd.audioCodec('aac').audioBitrate('128k')
                 .outputOptions(['-movflags', 'frag_keyframe+empty_moov'])
                 .toFormat('ipod');
              break;
            default: cmd.toFormat('wav');
          }

          cmd.on('start', cmdline => console.log(`[audio-converter] FFmpeg command: ${cmdline}`));
          cmd.on('progress', ({ timemark }) => {
            const elapsed = (Date.now() - tFfmpeg) / 1000;
            sendProgress(Math.min(95, elapsed * 3));
          });
        });

        console.log(`[audio-converter] FFmpeg done in ${Date.now() - tFfmpeg} ms  (total: ${Date.now() - tStart} ms)`);
        sendProgress(100);
        return { outputBuffer, filename: `converted.${fmt}`, mimeType: mimeMap[fmt] };
      }

      // ── Disk-based fallback (should not be reached in normal operation) ──
      const output = outPath(fmt);
      const t0 = Date.now();
      console.log(`[audio-converter] START (disk) fmt=${fmt}  file=${path.basename(inputPath)}  size=${(fs.statSync(inputPath).size/1024/1024).toFixed(2)} MB`);

      const duration = await getMediaDuration(inputPath);
      console.log(`[audio-converter] ffprobe done in ${Date.now()-t0} ms  duration=${duration.toFixed(1)} s`);

      const t1 = Date.now();
      await runFfmpeg(cmd => {
        cmd.addOption('-threads 0');
        cmd.input(inputPath);

        switch (fmt) {
          case 'mp3': cmd.audioCodec('libmp3lame').outputOptions(['-q:a', '2']).toFormat('mp3'); break;
          case 'ogg': cmd.audioCodec('libvorbis').toFormat('ogg'); break;
          case 'aac': cmd.audioCodec('aac').audioBitrate('128k').toFormat('aac'); break;
          case 'm4a':
            cmd.audioCodec('aac').audioBitrate('128k').outputOptions(['-movflags', '+faststart']);
            break;
          default: cmd.toFormat('wav');
        }

        cmd.on('start', cmdline => console.log(`[audio-converter] FFmpeg command: ${cmdline}`));

        if (duration > 0) {
          cmd.on('progress', ({ timemark }) => {
            const elapsed = (Date.now() - t1) / 1000;
            const current = parseTimemark(timemark);
            const pct     = (current / duration) * 100;
            const eta     = pct > 1 ? Math.max(0, Math.round(elapsed / (pct / 100) - elapsed)) : null;
            sendProgress(pct, eta);
          });
        }

        cmd.output(output);
      });

      console.log(`[audio-converter] FFmpeg done in ${Date.now() - t1} ms  (total incl. ffprobe: ${Date.now() - t0} ms)`);
      sendProgress(100);
      return { outputPath: output, filename: `converted.${fmt}`, mimeType: mimeMap[fmt] };
    }

    case 'screen-recorder': {
      // Transcode raw MediaRecorder output (WebM / MP4) to a properly encoded MP4:
      //  - libx264 + AAC  → guaranteed audio track (fixes no-audio bug)
      //  - -movflags +faststart → metadata at start of file (fixes seek bug)
      //  - -map 0:a:0?    → audio stream is optional (works even if no mic was captured)
      const output = outPath('mp4');
      const ts     = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

      await runFfmpeg(cmd => {
        cmd.input(inputPath)
           .outputOptions([
             '-c:v libx264',
             '-c:a aac',
             '-b:a 192k',
             '-ar 44100',
             '-preset fast',
             '-crf 23',
             '-pix_fmt yuv420p',
             '-movflags +faststart',
             '-threads 0',
             '-map 0:v:0',   // first video stream
             '-map 0:a:0?',  // first audio stream — optional (? = skip if absent)
           ])
           .on('start',  c   => console.log(`[screen-recorder] FFmpeg: ${c}`))
           .on('error',  (e, _o, s) => console.error(`[screen-recorder] Error: ${e.message}\n${s}`))
           .output(output);
      });

      return {
        outputPath: output,
        filename:   `screen-recording-${ts}.mp4`,
        mimeType:   'video/mp4',
      };
    }

    case 'audio-recorder': {
      // Transcode raw MediaRecorder WebM audio to seekable MP3:
      //  - libmp3lame → widely compatible MP3
      //  - -write_xing 1 → Xing/Info header so players know total duration (fixes seek bug)
      const output = outPath('mp3');
      const ts     = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');

      await runFfmpeg(cmd => {
        cmd.input(inputPath)
           .outputOptions([
             '-vn',              // drop any video stream
             '-c:a libmp3lame',
             '-b:a 192k',
             '-ar 44100',
             '-write_xing 1',   // Xing header → seekable MP3
           ])
           .on('start',  c         => console.log(`[audio-recorder] FFmpeg: ${c}`))
           .on('error',  (e, _o, s) => console.error(`[audio-recorder] Error: ${e.message}\n${s}`))
           .output(output);
      });

      return {
        outputPath: output,
        filename:   `audio-recording-${ts}.mp3`,
        mimeType:   'audio/mpeg',
      };
    }

    case 'video-converter': {
      const validFmts = ['mp4', 'webm', 'mov', 'avi', 'mkv'];
      const mimeMap   = {
        mp4:  'video/mp4',
        webm: 'video/webm',
        mov:  'video/quicktime',
        avi:  'video/x-msvideo',
        mkv:  'video/x-matroska',
      };
      const fmt    = validFmts.includes(options.format) ? options.format : 'mp4';
      const output = outPath(fmt);

      await runFfmpeg(cmd => {
        cmd.input(inputPath);

        switch (fmt) {
          case 'webm':
            // WebM requires VP9 + Opus — H.264 (libx264) is NOT a valid WebM codec
            cmd.videoCodec('libvpx-vp9')
               .audioCodec('libopus')
               .outputOptions([
                 '-b:v', '0',        // CRF / constant-quality mode
                 '-crf', '33',       // quality 0 (best)…63 (worst); 33 ≈ good
                 '-deadline', 'realtime',
                 '-cpu-used', '4',   // faster encode (0 slowest, 8 fastest)
               ])
               .toFormat('webm');
            break;

          case 'mov':
            cmd.videoCodec('libx264')
               .audioCodec('aac')
               .outputOptions(['-pix_fmt', 'yuv420p', '-movflags', '+faststart'])
               .toFormat('mov');
            break;

          case 'avi':
            cmd.videoCodec('libx264')
               .audioCodec('aac')
               .outputOptions(['-pix_fmt', 'yuv420p'])
               .toFormat('avi');
            break;

          case 'mkv':
            cmd.videoCodec('libx264')
               .audioCodec('aac')
               .outputOptions(['-pix_fmt', 'yuv420p'])
               .toFormat('matroska');
            break;

          default: // mp4
            cmd.videoCodec('libx264')
               .audioCodec('aac')
               .outputOptions(['-pix_fmt', 'yuv420p', '-movflags', '+faststart'])
               .toFormat('mp4');
        }

        cmd.on('start', cmdline => console.log(`[video-converter] FFmpeg command: ${cmdline}`));
        cmd.on('error', (err, _stdout, stderr) => console.error(`[video-converter] Error: ${err.message}\n${stderr}`));
        cmd.output(output);
      });

      return { outputPath: output, filename: `converted.${fmt}`, mimeType: mimeMap[fmt] };
    }

    case 'audio-compressor': {
      // Accept values like '64k', '128k', '128', 128 — strip non-digits then clamp
      const brNum = clamp(parseInt(String(options.bitrate || '').replace(/[^0-9]/g, '')) || 128, 32, 320);
      const output = outPath('mp3');
      await runFfmpeg(cmd =>
        cmd.input(inputPath).audioBitrate(`${brNum}k`).output(output)
      );
      return { outputPath: output, filename: 'compressed.mp3', mimeType: 'audio/mpeg' };
    }

    case 'video-compressor': {
      // Accept friendly quality strings OR a raw CRF number
      const qualityMap = { low: 35, medium: 28, high: 23 };
      const crf = options.quality && qualityMap[options.quality] !== undefined
        ? qualityMap[options.quality]
        : clamp(parseInt(options.crf) || 28, 18, 51);
      const output = outPath('mp4');
      await runFfmpeg(cmd =>
        cmd.input(inputPath)
           .videoCodec('libx264')
           .outputOptions(['-crf', String(crf), '-preset', 'fast'])
           .output(output)
      );
      return { outputPath: output, filename: 'compressed.mp4', mimeType: 'video/mp4' };
    }

    case 'audio-trimmer': {
      const start    = Math.max(0, parseFloat(options.start) || 0);
      const end      = parseFloat(options.end) || start + 30;
      const duration = Math.max(1, end - start);
      const output   = outPath('mp3');
      await runFfmpeg(cmd =>
        cmd.input(inputPath)
           .setStartTime(start)
           .setDuration(duration)
           .output(output)
      );
      return { outputPath: output, filename: 'trimmed.mp3', mimeType: 'audio/mpeg' };
    }

    case 'video-trimmer': {
      const start    = Math.max(0, parseFloat(options.start) || 0);
      const end      = parseFloat(options.end) || start + 30;
      const duration = Math.max(1, end - start);
      const output   = outPath('mp4');
      await runFfmpeg(cmd =>
        cmd.input(inputPath)
           .setStartTime(start)
           .setDuration(duration)
           .videoCodec('copy')
           .audioCodec('copy')
           .output(output)
      );
      return { outputPath: output, filename: 'trimmed.mp4', mimeType: 'video/mp4' };
    }

    case 'audio-extractor': {
      const validFmts = ['mp3', 'wav'];
      const mimeMap   = { mp3: 'audio/mpeg', wav: 'audio/wav' };
      const fmt    = validFmts.includes(options.format) ? options.format : 'mp3';
      const output = outPath(fmt);
      await runFfmpeg(cmd =>
        cmd.input(inputPath).noVideo().toFormat(fmt).output(output)
      );
      return { outputPath: output, filename: `audio.${fmt}`, mimeType: mimeMap[fmt] };
    }

    case 'video-to-gif': {
      const start = Math.max(0, parseFloat(options.start) || 0);
      // Accept either explicit duration OR end-time (frontend sends start+end)
      const rawDur = options.duration
        ? parseFloat(options.duration)
        : (parseFloat(options.end) || start + 5) - start;
      const duration = clamp(rawDur, 1, 30);
      const width    = clamp(parseInt(options.width) || 480, 100, 800);
      const fps      = clamp(parseInt(options.fps) || 10, 5, 15);
      const output   = outPath('gif');
      await runFfmpeg(cmd =>
        cmd.input(inputPath)
           .setStartTime(start)
           .setDuration(duration)
           .outputOptions(['-vf', `fps=${fps},scale=${width}:-1:flags=lanczos`])
           .output(output)
      );
      return { outputPath: output, filename: 'animation.gif', mimeType: 'image/gif' };
    }

    case 'mute-video': {
      const output = outPath('mp4');
      await runFfmpeg(cmd =>
        cmd.input(inputPath).noAudio().videoCodec('copy').output(output)
      );
      return { outputPath: output, filename: 'muted.mp4', mimeType: 'video/mp4' };
    }

    case 'change-video-speed': {
      // 0.75 and 1.25 are valid single-atempo values (range 0.5–2.0)
      const validSpeeds = [0.25, 0.5, 0.75, 1.25, 1.5, 2.0];
      const speed  = validSpeeds.includes(parseFloat(options.speed)) ? parseFloat(options.speed) : 1.5;
      const output = outPath('mp4');

      // 0.25 is outside atempo's 0.5–2.0 range — chain two 0.5× filters
      const atempoFilter = speed === 0.25
        ? 'atempo=0.5,atempo=0.5'
        : `atempo=${speed}`;

      await runFfmpeg(cmd =>
        cmd.input(inputPath)
           .videoFilters(`setpts=${(1 / speed).toFixed(4)}*PTS`)
           .audioFilters(atempoFilter)
           .output(output)
      );
      return { outputPath: output, filename: 'speed-adjusted.mp4', mimeType: 'video/mp4' };
    }

    case 'video-to-webp': {
      const start    = Math.max(0, parseFloat(options.start) || 0);
      const rawDur   = options.end
        ? Math.max(1, parseFloat(options.end) - start)
        : Math.max(1, parseFloat(options.duration) || 5);
      const duration = clamp(rawDur, 1, 30);
      const width    = clamp(parseInt(options.width) || 480, 100, 800);
      const fps      = clamp(parseInt(options.fps) || 10, 5, 20);
      const output   = outPath('webp');
      await runFfmpeg(cmd =>
        cmd.input(inputPath)
           .setStartTime(start)
           .setDuration(duration)
           .outputOptions([
             '-vf', `fps=${fps},scale=${width}:-1:flags=lanczos`,
             '-vcodec', 'libwebp',
             '-loop', '0',
             '-quality', '80',
             '-preset', 'default',
             '-an',
           ])
           .output(output)
      );
      return { outputPath: output, filename: 'animation.webp', mimeType: 'image/webp' };
    }

    case 'video-to-apng': {
      const start    = Math.max(0, parseFloat(options.start) || 0);
      const rawDur   = options.end
        ? Math.max(1, parseFloat(options.end) - start)
        : Math.max(1, parseFloat(options.duration) || 5);
      const duration = clamp(rawDur, 1, 20);
      const width    = clamp(parseInt(options.width) || 480, 100, 800);
      const fps      = clamp(parseInt(options.fps) || 10, 5, 20);
      const output   = outPath('apng');
      await runFfmpeg(cmd =>
        cmd.input(inputPath)
           .setStartTime(start)
           .setDuration(duration)
           .outputOptions([
             '-vf', `fps=${fps},scale=${width}:-1:flags=lanczos`,
             '-plays', '0',
             '-f', 'apng',
           ])
           .output(output)
      );
      return { outputPath: output, filename: 'animation.apng', mimeType: 'image/apng' };
    }

    case 'video-rotate-flip': {
      const rotate = ['0', '90', '180', '270'].includes(String(options.rotate))
        ? String(options.rotate) : '0';
      const flip   = ['none', 'horizontal', 'vertical'].includes(options.flip)
        ? options.flip : 'none';

      const filters = [];
      if (rotate === '90')  filters.push('transpose=1');
      if (rotate === '180') filters.push('transpose=2,transpose=2');
      if (rotate === '270') filters.push('transpose=2');
      if (flip === 'horizontal') filters.push('hflip');
      if (flip === 'vertical')   filters.push('vflip');

      const output = outPath('mp4');
      if (filters.length) {
        await runFfmpeg(cmd =>
          cmd.input(inputPath)
             .outputOptions(['-vf', filters.join(','), '-c:a', 'copy'])
             .output(output)
        );
      } else {
        await runFfmpeg(cmd =>
          cmd.input(inputPath).outputOptions(['-c', 'copy']).output(output)
        );
      }
      return { outputPath: output, filename: 'rotated.mp4', mimeType: 'video/mp4' };
    }

    case 'audio-merger': {
      const paths  = Array.isArray(inputPath) ? inputPath : [inputPath];
      if (paths.length < 2) throw new Error('At least 2 audio files are required.');
      const mode   = options.mode === 'overlay' ? 'overlay' : 'sequential';
      const format = ['mp3', 'wav'].includes(options.outputFormat) ? options.outputFormat : 'mp3';
      const ext    = format;
      const mime   = format === 'wav' ? 'audio/wav' : 'audio/mpeg';
      const output = outPath(ext);

      if (mode === 'sequential') {
        const listPath = outPath('txt');
        fs.writeFileSync(listPath, paths.map(p => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
        await runFfmpeg(cmd =>
          cmd.input(listPath)
             .inputOptions(['-f', 'concat', '-safe', '0'])
             .audioCodec(format === 'wav' ? 'pcm_s16le' : 'libmp3lame')
             .noVideo()
             .output(output)
        );
        fs.unlink(listPath, () => {});
      } else {
        const amixFilter = `amix=inputs=${paths.length}:duration=first:normalize=0`;
        await new Promise((resolve, reject) => {
          let cmd = ffmpeg();
          paths.forEach(p => { cmd = cmd.input(p); });
          cmd.complexFilter([amixFilter])
             .outputOptions(['-ac', '2'])
             .audioCodec(format === 'wav' ? 'pcm_s16le' : 'libmp3lame')
             .noVideo()
             .output(output)
             .on('end', resolve)
             .on('error', reject)
             .run();
        });
      }
      return { outputPath: output, filename: `merged.${ext}`, mimeType: mime };
    }

    case 'video-merger': {
      const paths = Array.isArray(inputPath) ? inputPath : [inputPath];
      if (paths.length < 2) throw new Error('At least 2 video files are required.');
      const output = outPath('mp4');

      // Use concat filter — handles codec differences across inputs
      const filterParts = paths.map((_, i) =>
        `[${i}:v]scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=30[v${i}];[${i}:a]aresample=44100[a${i}]`
      );
      const concatInputs = paths.map((_, i) => `[v${i}][a${i}]`).join('');
      const concatFilter = `${concatInputs}concat=n=${paths.length}:v=1:a=1[vout][aout]`;
      const filterGraph  = [...filterParts, concatFilter].join(';');

      await new Promise((resolve, reject) => {
        let cmd = ffmpeg();
        paths.forEach(p => { cmd = cmd.input(p); });
        cmd.complexFilter(filterGraph)
           .outputOptions([
             '-map', '[vout]',
             '-map', '[aout]',
             '-c:v', 'libx264',
             '-preset', 'fast',
             '-crf', '23',
             '-c:a', 'aac',
           ])
           .output(output)
           .on('end', resolve)
           .on('error', reject)
           .run();
      });
      return { outputPath: output, filename: 'merged.mp4', mimeType: 'video/mp4' };
    }

    case 'video-watermarker': {
      const rawText  = String(options.text || 'Watermark').replace(/['"\\:]/g, '');
      const position = ['topLeft', 'topRight', 'bottomLeft', 'bottomRight', 'center'].includes(options.position)
        ? options.position : 'bottomRight';
      const opacity  = (clamp(parseInt(options.opacity) || 70, 10, 100) / 100).toFixed(2);
      const fontSize = clamp(parseInt(options.fontSize) || 24, 12, 72);

      const posMap = {
        topLeft:     '10:10',
        topRight:    'W-tw-10:10',
        bottomLeft:  '10:H-th-10',
        bottomRight: 'W-tw-10:H-th-10',
        center:      '(W-tw)/2:(H-th)/2',
      };
      const xyPos     = posMap[position];
      const drawtext  = `drawtext=text='${rawText}':fontsize=${fontSize}:fontcolor=white@${opacity}:x=${xyPos}:box=1:boxcolor=black@0.35:boxborderw=6`;
      const output    = outPath('mp4');

      await runFfmpeg(cmd =>
        cmd.input(inputPath)
           .videoFilters(drawtext)
           .audioCodec('copy')
           .output(output)
      );
      return { outputPath: output, filename: 'watermarked.mp4', mimeType: 'video/mp4' };
    }

    case 'audio-volume-booster': {
      const boostDb = clamp(parseFloat(options.boostDb) || 5, 1, 20);

      // Probe to detect if input contains a video stream
      const probeData = await new Promise((resolve, reject) =>
        ffmpeg.ffprobe(inputPath, (err, data) => err ? reject(err) : resolve(data))
      );
      const hasVideo = probeData.streams.some(s => s.codec_type === 'video');
      const ext      = hasVideo ? 'mp4' : 'mp3';
      const mime     = hasVideo ? 'video/mp4' : 'audio/mpeg';
      const output   = outPath(ext);

      if (hasVideo) {
        await runFfmpeg(cmd =>
          cmd.input(inputPath)
             .videoCodec('copy')
             .audioFilters(`volume=${boostDb}dB`)
             .audioCodec('aac')
             .output(output)
        );
      } else {
        await runFfmpeg(cmd =>
          cmd.input(inputPath)
             .audioFilters(`volume=${boostDb}dB`)
             .audioCodec('libmp3lame')
             .noVideo()
             .output(output)
        );
      }
      return { outputPath: output, filename: `boosted.${ext}`, mimeType: mime };
    }

    case 'hardcode-subtitles': {
      const subtitlePath = options.subtitlePath;
      if (!subtitlePath || !fs.existsSync(subtitlePath))
        throw new Error('Subtitle file is required.');

      const fontName     = String(options.fontName || 'Arial').replace(/['"\\]/g, '');
      const fontSize     = clamp(parseInt(options.fontSize) || 24, 12, 72);
      const color        = String(options.color || 'white').replace(/['"\\]/g, '');
      const position     = ['top', 'center', 'bottom'].includes(options.position) ? options.position : 'bottom';
      const outlineColor = String(options.outlineColor || 'black').replace(/['"\\]/g, '');
      const outlineWidth = clamp(parseInt(options.outlineWidth) || 2, 0, 5);

      // Convert VTT to SRT if needed
      let srtPath = subtitlePath;
      const subContent = fs.readFileSync(subtitlePath, 'utf8');
      if (subContent.trimStart().startsWith('WEBVTT')) {
        let converted = subContent
          .replace(/^WEBVTT[^\n]*\n/, '')
          .replace(/(\d{2}:\d{2}:\d{2})\.(\d{3})/g, '$1,$2')
          .trim();
        // Add sequence numbers if missing
        let seq = 1;
        converted = converted.replace(/^(?!\d)/mg, () => `${seq++}\n`);
        srtPath = outPath('srt');
        fs.writeFileSync(srtPath, converted, 'utf8');
      }

      const alignMap = { top: 8, center: 5, bottom: 2 };
      const align    = alignMap[position];

      // ASS color format: &HBBGGRR (alpha=00 = opaque)
      const colorMap = {
        white:  '&H00FFFFFF', yellow: '&H0000FFFF', cyan:   '&H00FFFF00',
        black:  '&H00000000', red:    '&H000000FF', green:  '&H0000FF00',
      };
      const primaryColor = colorMap[color]   || '&H00FFFFFF';
      const outlineCol   = colorMap[outlineColor] || '&H00000000';

      const forceStyle = `FontName=${fontName},FontSize=${fontSize},PrimaryColour=${primaryColor},OutlineColour=${outlineCol},Outline=${outlineWidth},Alignment=${align},Bold=0`;

      // Escape path for ffmpeg subtitles filter
      const escapedSrt = srtPath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
      const subFilter  = `subtitles='${escapedSrt}':force_style='${forceStyle}'`;
      const output     = outPath('mp4');

      await runFfmpeg(cmd =>
        cmd.input(inputPath)
           .videoFilters(subFilter)
           .audioCodec('copy')
           .output(output)
      );

      if (srtPath !== subtitlePath) fs.unlink(srtPath, () => {});
      return { outputPath: output, filename: 'subtitled.mp4', mimeType: 'video/mp4' };
    }

    default:
      throw new Error(`Unknown media slug: ${slug}`);
  }
}

module.exports = { processImage, processMedia };
