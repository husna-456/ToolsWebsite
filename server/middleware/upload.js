const multer = require('multer');
const path   = require('path');
const os     = require('os');
const fs     = require('fs');
const { v4: uuidv4 } = require('uuid');

const TMP_DIR = path.join(os.tmpdir(), 'Global Tech Tools');
if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

// ── Slug whitelists ──────────────────────────────────────────
const IMAGE_SLUGS = [
  // Original 9
  'image-compressor', 'image-resizer', 'image-converter', 'image-cropper',
  'background-remover', 'image-to-grayscale', 'image-rotator',
  'image-watermark', 'image-to-base64',
  // New core image tools (Step 12)
  'image-censor', 'metadata-exif-remover', 'meme-generator', 'image-merger',
  'image-rotate', 'image-filters', 'image-adjustment', 'qr-code-reader', 'image-ocr',
];

// Format converters — need broader MIME acceptance (SVG, ICO, HEIC, TIFF)
const CONVERTER_SLUGS = [
  'jpg-to-png', 'jpg-to-webp', 'jpg-to-ico',
  'png-to-jpg', 'png-to-webp', 'png-to-ico',
  'webp-to-jpg', 'webp-to-png', 'webp-to-ico',
  'svg-to-png', 'svg-to-webp', 'svg-to-jpg', 'svg-to-ico',
  'jfif-to-png', 'jfif-to-webp',
  'ico-to-png', 'ico-to-jpg', 'ico-to-webp',
  'heic-to-jpg', 'heic-to-png', 'heic-to-webp',
  'tiff-to-png', 'tiff-to-jpg',
];

const AUDIO_SLUGS = [
  'audio-converter', 'audio-compressor', 'audio-trimmer',
  'audio-merger', 'audio-volume-booster',
  'audio-recorder',
];
const VIDEO_SLUGS = [
  'audio-extractor',
  'video-converter', 'video-compressor', 'video-trimmer',
  'video-to-gif', 'mute-video', 'change-video-speed',
  'video-to-webp', 'video-to-apng', 'video-rotate-flip',
  'video-merger', 'video-watermarker', 'hardcode-subtitles',
  'screen-recorder', // server-side FFmpeg fix: audio encoding + faststart seekability
];

const FILE_SLUGS = [...IMAGE_SLUGS, ...CONVERTER_SLUGS, ...AUDIO_SLUGS, ...VIDEO_SLUGS];

// ── Shared disk storage ──────────────────────────────────────
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, TMP_DIR),
  filename:    (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    cb(null, uuidv4() + ext);
  },
});

// ── Per-type multer instances ────────────────────────────────
const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const imageUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (IMAGE_MIMES.has(file.mimetype)) return cb(null, true);
    cb(new Error('Only JPEG, PNG, WebP, and GIF images are accepted.'));
  },
});

// Converters accept SVG, ICO, HEIC, TIFF and all standard image types
const CONVERTER_MIMES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon',
  'image/heic', 'image/heif', 'image/tiff', 'image/tif',
]);

// Windows Chrome often sends HEIC/TIFF/ICO as application/octet-stream because
// those MIME types aren't registered in the OS. Accept by extension as a fallback.
const CONVERTER_EXTS = new Set([
  '.jpg', '.jpeg', '.jfif', '.png', '.webp', '.gif',
  '.svg', '.ico', '.heic', '.heif', '.tiff', '.tif',
]);

const converterUpload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (CONVERTER_MIMES.has(file.mimetype) ||
        file.mimetype.startsWith('image/') ||
        CONVERTER_EXTS.has(ext)) {
      return cb(null, true);
    }
    cb(new Error('Only image files are accepted for conversion.'));
  },
});

// Shared audio fileFilter — accepts audio/* MIME, known extensions, and files
// with no extension / application/octet-stream (Android Documents Picker strips
// both the MIME type and the file extension when returning localized display names).
// The frontend accept="audio/*" attribute already filtered the native picker;
// only reject files whose type is positively non-audio (image/*, video/*, text/*).
const AUDIO_EXTS = new Set(['.mp3', '.wav', '.ogg', '.aac', '.m4a', '.m4b', '.flac', '.opus', '.wma', '.webm', '.mpeg', '.mpg', '.aiff', '.aif', '.amr']);

function audioFileFilter(_req, file, cb) {
  const mime = file.mimetype || '';
  const ext  = path.extname(file.originalname || '').toLowerCase();

  if (/^audio\//.test(mime))          return cb(null, true); // audio/* MIME — definitely audio
  if (AUDIO_EXTS.has(ext))            return cb(null, true); // known audio extension
  if (mime === 'application/octet-stream') return cb(null, true); // Android / Drive: empty type
  if (!ext && !mime)                  return cb(null, true); // Android Documents Picker: no ext, no MIME
  if (!ext)                           return cb(null, true); // no extension — trust accept="audio/*" picker

  // Only reject when we have positive evidence it's not audio
  if (/^image\/|^video\/|^text\//.test(mime))
    return cb(new Error('Only audio files are accepted.'));

  // Unknown MIME with unrecognized extension — let it through
  console.warn(`[audioFileFilter] Unknown file: mimetype="${mime}" ext="${ext}" name="${file.originalname}" — accepting`);
  cb(null, true);
}

const audioUpload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: audioFileFilter,
});


const videoUpload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^video\//.test(file.mimetype)) return cb(null, true);
    // Some browsers send AVI/MKV as application/octet-stream — accept by extension too
    const ext = path.extname(file.originalname).toLowerCase();
    const VIDEO_EXTS = new Set(['.mp4', '.webm', '.mov', '.avi', '.mkv', '.flv', '.wmv', '.m4v']);
    if (VIDEO_EXTS.has(ext)) return cb(null, true);
    cb(new Error('Only video files are accepted.'));
  },
});

// Accepts video for 'file' field and any file for 'subtitle' field (SRT/VTT are text)
const subtitleMixedUpload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === 'subtitle') return cb(null, true);
    if (/^video\//.test(file.mimetype)) return cb(null, true);
    cb(new Error('Please upload a valid video file.'));
  },
});

// ── Adaptive middleware — picks the right multer by slug ─────
function adaptiveUpload(req, res, next) {
  const { slug } = req.params;

  if (!FILE_SLUGS.includes(slug)) {
    return res.status(404).json({ success: false, error: 'Tool not found.' });
  }

  const onErr = (err) => {
    if (!err) return next();
    const msg = err.code === 'LIMIT_FILE_SIZE'
      ? 'File is too large.'
      : err.message || 'Upload error.';
    res.status(400).json({ success: false, error: msg });
  };

  // Audio converter uses disk storage like other audio tools.
  // The in-memory piped mode (pipe:0→FFmpeg→pipe:1) stalled through nginx's proxy
  // on shared hosting, causing the client to see "Network Error" on large files.
  if (slug === 'audio-converter') {
    audioUpload.single('file')(req, res, onErr);
    return;
  }

  // Special multi-file and dual-file cases
  if (slug === 'image-merger') {
    imageUpload.array('files', 10)(req, res, onErr);
    return;
  }
  if (slug === 'audio-merger') {
    audioUpload.array('files', 10)(req, res, onErr);
    return;
  }
  if (slug === 'video-merger') {
    videoUpload.array('files', 5)(req, res, onErr);
    return;
  }
  if (slug === 'hardcode-subtitles') {
    subtitleMixedUpload.fields([
      { name: 'file', maxCount: 1 },
      { name: 'subtitle', maxCount: 1 },
    ])(req, res, onErr);
    return;
  }

  let instance;
  if      (CONVERTER_SLUGS.includes(slug)) instance = converterUpload;
  else if (IMAGE_SLUGS.includes(slug))     instance = imageUpload;
  else if (AUDIO_SLUGS.includes(slug))     instance = audioUpload;
  else                                      instance = videoUpload;

  instance.single('file')(req, res, onErr);
}

module.exports = {
  TMP_DIR,
  IMAGE_SLUGS, CONVERTER_SLUGS, AUDIO_SLUGS, VIDEO_SLUGS, FILE_SLUGS,
  adaptiveUpload,
};
