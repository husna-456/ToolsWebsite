const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const os      = require('os');
const { v4: uuidv4 } = require('uuid');
const { spawn }      = require('child_process');
const ffmpeg         = require('fluent-ffmpeg');

const TMP_DIR     = path.join(os.tmpdir(), 'innovatetools');
const SCRIPT_PATH = path.join(__dirname, '../scripts/transcribe.py');

if (!fs.existsSync(TMP_DIR)) fs.mkdirSync(TMP_DIR, { recursive: true });

try {
  const bin = require('ffmpeg-static');
  if (bin) ffmpeg.setFfmpegPath(bin);
} catch { /* fall back to system ffmpeg */ }

// ── Upload ─────────────────────────────────────────────────────
const upload = multer({
  storage: multer.diskStorage({
    destination: TMP_DIR,
    filename: (_req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.mp4';
      cb(null, uuidv4() + ext);
    },
  }),
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^video\//.test(file.mimetype)) return cb(null, true);
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'].includes(ext)) return cb(null, true);
    cb(new Error('Only video files are accepted.'));
  },
});

// ── Language + model maps (English + Urdu only) ────────────────
const LANG_MAP  = { english: 'en', urdu: 'ur' };
// 'medium' gives accurate Urdu (~460 MB, downloads once); 'base' is fast for English
const MODEL_MAP = { en: 'base', ur: 'medium' };

// ── Helpers ────────────────────────────────────────────────────

function extractAudio(videoPath, audioPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(videoPath)
      .noVideo()
      .audioChannels(1)
      .audioFrequency(16000)
      .audioCodec('pcm_s16le')
      .output(audioPath)
      .on('end', resolve)
      .on('error', (err, _stdout, stderr) => {
        const s = (stderr || err.message || '').toLowerCase();
        if (s.includes('no audio') || s.includes('audio stream') || s.includes('invalid data')) {
          reject(Object.assign(new Error('NO_AUDIO'), { code: 'NO_AUDIO' }));
        } else {
          reject(Object.assign(new Error('EXTRACTION_FAILED'), { code: 'EXTRACTION_FAILED' }));
        }
      })
      .run();
  });
}

function findPython() {
  if (process.env.PYTHON_BIN) return process.env.PYTHON_BIN;
  return process.platform === 'win32' ? 'python' : 'python3';
}

// Whisper internally calls `ffmpeg` to decode audio. It must be on PATH.
// Inject our bundled ffmpeg-static directory so it's always found.
function buildEnvWithFfmpeg() {
  let ffmpegDir = '';
  try {
    const bin = require('ffmpeg-static');
    if (bin) ffmpegDir = path.dirname(bin);
  } catch {}
  const sep = process.platform === 'win32' ? ';' : ':';
  const basePath = ffmpegDir
    ? ffmpegDir + sep + (process.env.PATH || '')
    : (process.env.PATH || '');
  return {
    ...process.env,
    PATH:               basePath,
    PYTHONIOENCODING:   'utf-8',  // force UTF-8 stdout/stderr on Windows
    PYTHONUTF8:         '1',      // Python 3.7+ UTF-8 mode
  };
}

function runTranscribe(audioPath, langCode) {
  const model = MODEL_MAP[langCode] || 'base';
  return new Promise((resolve, reject) => {
    const proc = spawn(findPython(), [
      SCRIPT_PATH,
      '--audio',    audioPath,
      '--language', langCode,
      '--model',    model,
    ], {
      shell:       process.platform === 'win32',
      windowsHide: true,
      stdio:       ['ignore', 'pipe', 'pipe'],
      env:         buildEnvWithFfmpeg(),
    });

    let stdout = '';
    let stderr = '';
    proc.stdout.setEncoding('utf8');
    proc.stderr.setEncoding('utf8');
    proc.stdout.on('data', d => { stdout += d; });
    proc.stderr.on('data', d => { stderr += d; process.stderr.write('[whisper] ' + d); });

    proc.on('error', err => {
      if (err.code === 'ENOENT') {
        reject(Object.assign(new Error('PYTHON_NOT_FOUND'), { code: 'PYTHON_NOT_FOUND' }));
      } else {
        reject(err);
      }
    });

    proc.on('close', () => {
      const lastLine = stdout.trim().split('\n').pop() || '';
      try {
        const parsed = JSON.parse(lastLine);
        if (parsed.error) {
          reject(Object.assign(new Error(parsed.error), { code: parsed.error }));
        } else {
          resolve(parsed);
        }
      } catch {
        reject(Object.assign(new Error('TRANSCRIPTION_FAILED'), { code: 'TRANSCRIPTION_FAILED' }));
      }
    });
  });
}

function rm(...paths) {
  for (const p of paths) {
    try { if (p && fs.existsSync(p)) fs.unlinkSync(p); } catch {}
  }
}

function userError(err) {
  switch (err.code) {
    case 'NO_AUDIO':              return { status: 422, msg: 'This video has no audio track.' };
    case 'NO_SPEECH':             return { status: 422, msg: 'No speech found. Make sure the video has clear audio.' };
    case 'WHISPER_NOT_INSTALLED': return { status: 500, msg: 'Whisper is not installed on the server. Run: pip install openai-whisper' };
    case 'PYTHON_NOT_FOUND':      return { status: 500, msg: 'Python is not installed on the server.' };
    case 'EXTRACTION_FAILED':     return { status: 422, msg: 'Could not read the video file. Please try a different format.' };
    case 'AUDIO_NOT_FOUND':       return { status: 500, msg: 'Something went wrong processing the audio. Please try again.' };
    default:                      return { status: 500, msg: 'Something went wrong. Please try again.' };
  }
}

// ── Background model warmup ────────────────────────────────────
// Downloads both Whisper models at server startup so the first user
// request doesn't have to wait for a 140–460 MB download.
function warmupModel(modelName) {
  const env = buildEnvWithFfmpeg();
  const proc = spawn(findPython(), [SCRIPT_PATH, '--download-only', '--model', modelName], {
    shell: process.platform === 'win32',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env,
  });
  let out = '';
  proc.stdout.setEncoding('utf8');
  proc.stdout.on('data', d => { out += d; });
  proc.on('close', () => {
    try {
      const r = JSON.parse(out.trim().split('\n').pop() || '{}');
      if (r.status === 'ready') console.log(`[subtitles] Whisper "${modelName}" model ready`);
      else console.warn(`[subtitles] Warmup "${modelName}":`, r);
    } catch {
      console.warn(`[subtitles] Warmup "${modelName}" parse error`);
    }
  });
  proc.on('error', () => {}); // ignore if Python not yet available
}

// Fire both downloads in parallel, non-blocking
setImmediate(() => {
  [...new Set(Object.values(MODEL_MAP))].forEach(m => warmupModel(m));
});

// ── Route ──────────────────────────────────────────────────────
router.post('/', upload.single('file'), async (req, res) => {
  console.log('[API_REQUEST] POST /api/subtitles', { filename: req.file?.originalname, size: req.file?.size, language: req.body.language });

  const videoPath = req.file?.path;
  if (!videoPath) {
    console.log('[API_ERROR] POST /api/subtitles — no video file uploaded');
    return res.status(400).json({ error: 'Video file is required.' });
  }

  const langInput = (req.body.language || 'english').toLowerCase();
  const langCode  = LANG_MAP[langInput] ?? 'en';
  const audioName = uuidv4();
  const audioPath = path.join(TMP_DIR, audioName + '.wav');

  try {
    console.log(`[API_REQUEST] POST /api/subtitles — Step 1/3 — Extracting audio… (lang=${langCode})`);
    await extractAudio(videoPath, audioPath);

    const model = MODEL_MAP[langCode] || 'base';
    console.log(`[API_REQUEST] POST /api/subtitles — Step 2/3 — Running Whisper (model=${model})…`);
    const { srt, vtt } = await runTranscribe(audioPath, langCode);

    rm(videoPath, audioPath);

    if (!srt) {
      console.log('[API_ERROR] POST /api/subtitles — no speech found');
      return res.status(422).json({ error: 'No speech found. Make sure the video has clear audio.' });
    }

    console.log(`[API_RESPONSE] POST /api/subtitles — Done. ${srt.split('\n\n').length} subtitle block(s)`);
    res.json({ srt, vtt });

  } catch (err) {
    rm(videoPath, audioPath);
    console.error('[API_ERROR] POST /api/subtitles:', err.message);
    const { status, msg } = userError(err);
    res.status(status).json({ error: msg });
  }
});

module.exports = router;
