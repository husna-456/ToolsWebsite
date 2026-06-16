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
  if (!req.file) {
    return res.status(400).json({ error: 'No image uploaded' });
  }

  const processedPath = req.file.path + '_processed.png';

  try {
    // Step 1 — Image preprocess karo (accuracy improve)
    await sharp(req.file.path)
      .greyscale()    // Black & white — OCR ke liye better
    .sharpen({ sigma: 2 })        // Text edges sharp karo
      .normalise()  // Contrast improve karo
       .threshold(180)      
      .toFile(processedPath);

console.log('Processed image saved at:', processedPath);
console.log('Original:', req.file.path);

    // Step 2 — OCR chalao processed image par
    const text = await tesseract.recognize(processedPath, TESSERACT_CONFIG);

    // Step 3 — Temp files delete karo
    if (fs.existsSync(req.file.path))  fs.unlinkSync(req.file.path);
    if (fs.existsSync(processedPath))  fs.unlinkSync(processedPath);

   if (!text.trim()) {
      return res.status(422).json({
        error: 'No text found. Please upload a clear image with readable text.'
      });
    }

    res.json({ success: true, result: text.trim() });

  } catch (err) {
    console.error('OCR Error:', err.message);
    // Cleanup on error
    if (fs.existsSync(req.file.path))  fs.unlinkSync(req.file.path);
    if (fs.existsSync(processedPath))  fs.unlinkSync(processedPath);
    res.status(500).json({ error: 'OCR processing failed. Please try again.' });
  }
});

module.exports = router;
