const express       = require('express');
const router        = express.Router();
const adminAuth     = require('../middleware/adminAuth');
const {
  getStats, getUsageChart,
  getAdminTools, updateTool, toggleTool, exportTools, importTools, changeSlug,
  getUsers, toggleBan, getUserById, createUser, updateUser, deleteUser,
  getPages, getPage, createPage, updatePage, deletePage,
  getPosts, getPostById, createPost, updatePost, deletePost, togglePublish,
  getContacts, updateContact, deleteContact,
  getContactById, aiReplyContact, sendReplyContact,
  getSubscribers, exportSubscribers, deleteSubscriber,
  getAllSettings, updateGeneralSettings, updateSmtpSettings, testSmtpSettings, updateAdsSettings,
  updateSaasSettings, updateToolPageSettings, updateSecuritySettings,
  getWebToolsSettings, updateWebToolSettings,
  getProfile, updateProfile, changePassword,
} = require('../controllers/adminController');
const textToPdfMetrics = require('../utils/textToPdfMetrics');

// All admin routes require a valid admin JWT
router.use(adminAuth);

// ── Stats ──────────────────────────────────────────────────────
router.get('/stats',              getStats);
router.get('/stats/usage',        getUsageChart);

// ── Tools ──────────────────────────────────────────────────────
router.get('/tools/export',       exportTools);        // must come before /:id
router.post('/tools/import',      importTools);
router.get('/tools',              getAdminTools);
router.put('/tools/:id',          updateTool);
router.patch('/tools/:id/toggle', toggleTool);
router.patch('/tools/:id/slug',   changeSlug);

// ── Users ──────────────────────────────────────────────────────
router.get('/users',              getUsers);
router.post('/users',             createUser);
router.get('/users/:id',          getUserById);
router.patch('/users/:id',        updateUser);
router.patch('/users/:id/ban',    toggleBan);
router.delete('/users/:id',       deleteUser);

// ── Pages ──────────────────────────────────────────────────────
router.get('/pages',               getPages);
router.post('/pages',              createPage);
router.get('/pages/:slug',         getPage);
router.put('/pages/:slug',         updatePage);
router.delete('/pages/:slug',      deletePage);

// ── Posts ──────────────────────────────────────────────────────
router.get('/posts',               getPosts);
router.post('/posts',              createPost);
router.get('/posts/:id',           getPostById);
router.put('/posts/:id',           updatePost);
router.delete('/posts/:id',        deletePost);
router.patch('/posts/:id/publish', togglePublish);

// ── Contact Submissions ────────────────────────────────────────
router.get('/contact',                    getContacts);
router.get('/contact/:id',                getContactById);
router.patch('/contact/:id',              updateContact);
router.delete('/contact/:id',             deleteContact);
router.post('/contact/:id/ai-reply',      aiReplyContact);
router.post('/contact/:id/send-reply',    sendReplyContact);

// ── Subscribers ────────────────────────────────────────────────
router.get('/subscribers/export',  exportSubscribers);   // must come before /:id
router.get('/subscribers',         getSubscribers);
router.delete('/subscribers/:id',  deleteSubscriber);

// ── Settings ───────────────────────────────────────────────────
router.get('/settings',                  getAllSettings);
router.put('/settings/general',          updateGeneralSettings);
router.put('/settings/smtp',             updateSmtpSettings);
router.post('/settings/smtp/test',       testSmtpSettings);
router.put('/settings/ads',              updateAdsSettings);
router.put('/settings/saas',             updateSaasSettings);
router.put('/settings/tool-page',        updateToolPageSettings);
router.put('/settings/security',         updateSecuritySettings);

// ── Per-tool runtime settings ──────────────────────────────────
router.get('/web-tools-settings',        getWebToolsSettings);
router.put('/web-tools-settings/:slug',  updateWebToolSettings);

// ── Monitoring ─────────────────────────────────────────────────
router.get('/text-to-pdf-metrics', (req, res) => res.json(textToPdfMetrics.getSnapshot()));

// ── Profile ────────────────────────────────────────────────────
router.get('/profile',             getProfile);
router.put('/profile',             updateProfile);
router.post('/profile/password',   changePassword);

module.exports = router;
