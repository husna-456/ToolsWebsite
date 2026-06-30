const express = require('express');
const router  = express.Router();
const { TOOLS } = require('../constants/tools');

const BASE = 'https://globaltechtool.com';

const CATEGORY_SLUGS = [
  'ai-writing',
  'text-tools',
  'image-tools',
  'media-tools',
  'productivity',
  'seo-tools',
];

const STATIC_PAGES = [
  { url: BASE + '/',          priority: '1.0', changefreq: 'daily'   },
  { url: BASE + '/blog/',     priority: '0.9', changefreq: 'daily'   },
  { url: BASE + '/contact/',  priority: '0.6', changefreq: 'monthly' },
  { url: BASE + '/privacy/',  priority: '0.3', changefreq: 'yearly'  },
  { url: BASE + '/terms/',    priority: '0.3', changefreq: 'yearly'  },
];

router.get('/sitemap.xml', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);

  const entries = [
    ...STATIC_PAGES.map(p => ({ url: p.url, priority: p.priority, changefreq: p.changefreq })),
    ...CATEGORY_SLUGS.map(slug => ({
      url: `${BASE}/category/${slug}/`, priority: '0.7', changefreq: 'weekly',
    })),
    ...Object.keys(TOOLS).map(slug => ({
      url: `${BASE}/tools/${slug}/`, priority: '0.8', changefreq: 'monthly',
    })),
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map(e => `  <url>
    <loc>${e.url}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${e.changefreq}</changefreq>
    <priority>${e.priority}</priority>
  </url>`).join('\n')}
</urlset>`;

  res.header('Content-Type', 'application/xml');
  res.header('Cache-Control', 'public, max-age=3600');
  res.send(xml);
});

router.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.header('Cache-Control', 'public, max-age=86400');
  res.send(
`User-agent: *
Allow: /
Disallow: /admin/
Disallow: /api/

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
