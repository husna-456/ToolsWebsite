const express          = require('express');
const router           = express.Router();
const multer           = require('multer');
const { createWorker } = require('tesseract.js');
const fs               = require('fs');
const path             = require('path');

const uploadDir   = path.join(__dirname, '..', 'uploads');
const tessDataDir = path.join(__dirname, '..', 'tmp', 'tessdata');

if (!fs.existsSync(uploadDir))   fs.mkdirSync(uploadDir,   { recursive: true });
if (!fs.existsSync(tessDataDir)) fs.mkdirSync(tessDataDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.post('/run', upload.single('image'), async (req, res) => {
  console.log('[OCR_START] POST /api/ocr/run');

  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No image uploaded' });
  }

  console.log('[OCR_FILE_RECEIVED]', req.file.originalname, req.file.size + ' bytes', req.file.path);

  let worker = null;

  try {
    if (!fs.existsSync(req.file.path)) {
      throw new Error('Uploaded file not found on disk: ' + req.file.path);
    }

    const imageBuffer = fs.readFileSync(req.file.path);
    console.log('[OCR_FILE_READY] buffer bytes:', imageBuffer.length);

    console.log('[OCR_WORKER_CREATED] initializing tesseract.js worker...');
    worker = await createWorker('eng', 1, {
      cachePath: tessDataDir,
      logger: m => {
        if (m.status) {
          const pct = m.progress != null ? ' ' + Math.round(m.progress * 100) + '%' : '';
          console.log('[TESS]', m.status + pct);
        }
      },
    });
    console.log('[OCR_WORKER_INITIALIZED]');

    console.log('[OCR_RECOGNIZE_START]');
    const { data: { text } } = await worker.recognize(imageBuffer);
    console.log('[OCR_RECOGNIZE_SUCCESS] chars:', text.trim().length);

    await worker.terminate();
    worker = null;
    console.log('[OCR_WORKER_TERMINATED]');

    try { fs.unlinkSync(req.file.path); } catch {}

    if (!text.trim()) {
      return res.status(422).json({ success: false, error: 'No text found. Please upload a clear image with readable text.' });
    }

    res.json({ success: true, result: text.trim() });

  } catch (err) {
    console.error('[OCR_ERROR]', err.message, '\n', err.stack);
    if (worker) { try { await worker.terminate(); } catch {} }
    try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
