const express   = require('express');
const router    = express.Router();
const multer    = require('multer');
const tesseract = require('node-tesseract-ocr');
const sharp     = require('sharp');
const fs        = require('fs');

const upload = multer({
  dest: 'uploads/',
  limits: { fileSize: 10 * 1024 * 1024 }
});

const TESSERACT_CONFIG = {
  lang:   'eng',
  oem:    1,
  psm:    6,
  binary: '"C:\\Program Files\\Tesseract-OCR\\tesseract.exe"'
};

router.post('/run', upload.single('image'), async (req, res) => {
  console.log('[API_REQUEST] POST /api/ocr/run', { filename: req.file?.originalname, size: req.file?.size });

  if (!req.file) {
    console.log('[API_ERROR] POST /api/ocr/run — no image uploaded');
    return res.status(400).json({ error: 'No image uploaded' });
  }

  const processedPath = req.file.path + '_processed.png';

  try {
    // Step 1 — Preprocess image for better OCR accuracy
    await sharp(req.file.path)
      .greyscale()
      .sharpen({ sigma: 2 })
      .normalise()
      .threshold(180)
      .toFile(processedPath);

    console.log('[API_REQUEST] OCR processing:', processedPath);

    // Step 2 — Run OCR on processed image
    const text = await tesseract.recognize(processedPath, TESSERACT_CONFIG);

    // Step 3 — Cleanup temp files
    if (fs.existsSync(req.file.path))  fs.unlinkSync(req.file.path);
    if (fs.existsSync(processedPath))  fs.unlinkSync(processedPath);

    if (!text.trim()) {
      console.log('[API_ERROR] POST /api/ocr/run — no text found in image');
      return res.status(422).json({
        error: 'No text found. Please upload a clear image with readable text.'
      });
    }

    console.log('[API_RESPONSE] POST /api/ocr/run — success, chars:', text.trim().length);
    res.json({ success: true, result: text.trim() });

  } catch (err) {
    console.error('[API_ERROR] POST /api/ocr/run:', err.message);
    // Cleanup on error
    if (fs.existsSync(req.file.path))  fs.unlinkSync(req.file.path);
    if (fs.existsSync(processedPath))  fs.unlinkSync(processedPath);
    res.status(500).json({ error: 'OCR processing failed. Please try again.' });
  }
});

module.exports = router;
