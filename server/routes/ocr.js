const express          = require('express');
const router           = express.Router();
const multer           = require('multer');
const { createWorker } = require('tesseract.js');
const fs               = require('fs');
const path             = require('path');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.post('/run', upload.single('image'), async (req, res) => {
  console.log('[API_REQUEST] POST /api/ocr/run', { filename: req.file?.originalname, size: req.file?.size });

  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }

  try {
    console.log('[OCR_STEP] creating worker');
    const worker = await createWorker('eng');
    console.log('[OCR_STEP] worker created, recognizing');
    const { data: { text } } = await worker.recognize(req.file.path);
    console.log('[OCR_STEP] done, terminating worker');
    await worker.terminate();

    try { fs.unlinkSync(req.file.path); } catch {}

    if (!text.trim()) {
      return res.status(422).json({ error: 'No text found. Please upload a clear image with readable text.' });
    }

    console.log('[API_RESPONSE] POST /api/ocr/run success, chars:', text.trim().length);
    res.json({ success: true, result: text.trim() });

  } catch (err) {
    console.error('[API_ERROR] POST /api/ocr/run:', err.message, err.stack);
    try { fs.unlinkSync(req.file.path); } catch {}
    // Return actual error message temporarily for diagnosis
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
