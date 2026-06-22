const express              = require('express');
const router               = express.Router();
const multer               = require('multer');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const fs                   = require('fs');
const path                 = require('path');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 }
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post('/run', upload.single('image'), async (req, res) => {
  console.log('[OCR_START] POST /api/ocr/run');

  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No image uploaded' });
  }

  console.log('[OCR_FILE_RECEIVED]', req.file.originalname, req.file.size + ' bytes', req.file.path);

  try {
    if (!fs.existsSync(req.file.path)) {
      throw new Error('Uploaded file not found on disk: ' + req.file.path);
    }

    const imageBuffer = fs.readFileSync(req.file.path);
    console.log('[OCR_FILE_READY] buffer bytes:', imageBuffer.length);

    const mimeType = (req.file.mimetype && req.file.mimetype.startsWith('image/'))
      ? req.file.mimetype
      : 'image/jpeg';

    console.log('[OCR_WORKER_CREATED] Gemini Vision model initialised');
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    console.log('[OCR_WORKER_INITIALIZED]');

    console.log('[OCR_RECOGNIZE_START] sending to Gemini Vision...');
    const result = await model.generateContent([
      {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType,
        },
      },
      'Extract and return every piece of text visible in this image exactly as it appears. ' +
      'Return only the extracted text — no explanations, no markdown, no commentary.',
    ]);

    const text = result.response.text();
    console.log('[OCR_RECOGNIZE_SUCCESS] chars:', text.trim().length);

    try { fs.unlinkSync(req.file.path); } catch {}
    console.log('[OCR_WORKER_TERMINATED]');

    if (!text.trim()) {
      return res.status(422).json({ success: false, error: 'No text found. Please upload a clear image with readable text.' });
    }

    res.json({ success: true, result: text.trim() });

  } catch (err) {
    console.error('[OCR_ERROR]', err.message, '\n', err.stack);
    try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
