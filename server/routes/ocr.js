const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const Groq    = require('groq-sdk');
const fs      = require('fs');
const path    = require('path');

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: uploadDir,
  limits: { fileSize: 10 * 1024 * 1024 }
});

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

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

    const base64Image = imageBuffer.toString('base64');
    console.log('[OCR_WORKER_CREATED] Groq vision model ready');
    console.log('[OCR_WORKER_INITIALIZED]');

    console.log('[OCR_RECOGNIZE_START] sending to Groq vision...');
    const response = await groq.chat.completions.create({
      model: 'meta-llama/llama-4-scout-17b-16e-instruct',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64Image}` },
            },
            {
              type: 'text',
              text: 'Extract and return all text visible in this image exactly as it appears. Return only the extracted text — no explanations, no markdown, no commentary.',
            },
          ],
        },
      ],
      max_tokens:  4096,
      temperature: 0.1,
    });

    const text = response.choices[0]?.message?.content?.trim() || '';
    console.log('[OCR_RECOGNIZE_SUCCESS] chars:', text.length);

    try { fs.unlinkSync(req.file.path); } catch {}
    console.log('[OCR_WORKER_TERMINATED]');

    if (!text) {
      return res.status(422).json({ success: false, error: 'No text found. Please upload a clear image with readable text.' });
    }

    res.json({ success: true, result: text });

  } catch (err) {
    console.error('[OCR_ERROR]', err.message, '\n', err.stack);
    try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
