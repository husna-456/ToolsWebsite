const express = require('express');
const router  = express.Router();
const { TOOLS } = require('../constants/tools');

const BASE = 'https://tools.innovate.com.pk';

router.get('/sitemap.xml', (req, res) => {
  const staticUrls = [BASE + '/', BASE + '/category/ai-writing/', BASE + '/category/text-tools/'];
  const toolUrls   = Object.keys(TOOLS).map(slug => `${BASE}/tools/${slug}/`);
  const allUrls    = [...staticUrls, ...toolUrls];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allUrls.map(u => `  <url>
    <loc>${u}</loc>
    <changefreq>weekly</changefreq>
    <priority>${u === BASE + '/' ? '1.0' : '0.8'}</priority>
  </url>`).join('\n')}
</urlset>`;

  res.header('Content-Type', 'application/xml');
  res.send(xml);
});

router.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(
`User-agent: *
Allow: /

User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: GoogleOther
Allow: /

Sitemap: ${BASE}/sitemap.xml`
  );
});

module.exports = router;
