const express    = require('express');
const router     = express.Router();
const {
  getPublicPage,
  getPublicPosts,
  getPublicPost,
  submitContact,
  getPublicSettings,
} = require('../controllers/publicController');

// ── Settings ──────────────────────────────────────────────────
router.get('/settings/public', getPublicSettings);

// ── Pages ─────────────────────────────────────────────────────
router.get('/pages/:slug', getPublicPage);

// ── Blog Posts ────────────────────────────────────────────────
router.get('/posts',       getPublicPosts);
router.get('/posts/:slug', getPublicPost);

// ── Contact ───────────────────────────────────────────────────
router.post('/contact',    submitContact);

module.exports = router;
