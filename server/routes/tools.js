const express = require('express');
const router  = express.Router();
const {
  getTools, getCategories, getTool, getUsage, runTool,
  captureEmail, fetchSource, processFile, runQRCode, runBase64Convert,
  analyzeSeoTool, getAudioProgress, runMemeCaption,
} = require('../controllers/toolController');
const { checkUsageLimit } = require('../middleware/usageCheck');
const { adaptiveUpload }  = require('../middleware/upload');
const {
  textToPdfFormat, textToPdfGenerate, textToPdfLimiter,
} = require('../controllers/textToPdfController');

router.get('/',              getTools);
router.get('/categories',    getCategories);
router.post('/capture-email', captureEmail);

// ── Special fixed routes (must come before /:slug) ───────────
router.get('/audio-converter/progress/:jobId',  getAudioProgress);
router.post('/citation-generator/fetch-source', fetchSource);
router.post('/qr-code-generator/run',           runQRCode);
router.post('/base64-to-png/run',               runBase64Convert);
router.post('/base64-to-jpg/run',               runBase64Convert);
router.post('/meme-studio/caption',             runMemeCaption);

// ── Text to PDF ───────────────────────────────────────────────
router.post('/text-to-pdf/format',   textToPdfLimiter, textToPdfFormat);
router.post('/text-to-pdf/generate', textToPdfLimiter, textToPdfGenerate);

// ── Generic slug routes ───────────────────────────────────────
router.get('/:slug',            getTool);
router.get('/:slug/usage',      checkUsageLimit, getUsage);
router.post('/:slug/run',       checkUsageLimit, runTool);
router.post('/:slug/process',   adaptiveUpload,  processFile);
router.post('/:slug/analyze',   analyzeSeoTool);

module.exports = router;
