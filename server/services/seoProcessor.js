/**
 * seoProcessor.js — all SEO & web tool logic
 *
 * Exports:
 *   analyzeSeo(url, slug, options)   → Promise<{ result: object }>  (URL-fetching tools)
 *   generateSeoOutput(slug, fields)  → { result: string }           (generator tools)
 */

'use strict';

const axios   = require('axios');
const cheerio = require('cheerio');
const dns     = require('dns').promises;

// ── SSRF protection ─────────────────────────────────────────────────────────

const PRIVATE_IP_RE = /^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|::1$|fd[0-9a-f]{2}:)/i;

async function validatePublicUrl(rawUrl) {
  let urlObj;
  try { urlObj = new URL(rawUrl); } catch {
    throw Object.assign(new Error('Invalid URL. Please enter a valid https:// address.'), { code: 400 });
  }
  if (!['http:', 'https:'].includes(urlObj.protocol)) {
    throw Object.assign(new Error('Only http and https URLs are allowed.'), { code: 400 });
  }
  const host = urlObj.hostname;
  if (PRIVATE_IP_RE.test(host) || host === 'localhost') {
    throw Object.assign(new Error('Cannot fetch private or internal URLs.'), { code: 400 });
  }
  try {
    const { address } = await dns.lookup(host);
    if (PRIVATE_IP_RE.test(address)) {
      throw Object.assign(new Error('Cannot fetch private or internal URLs.'), { code: 400 });
    }
  } catch (e) {
    if (e.code === 400) throw e;
    // DNS failure — let axios handle it
  }
  return urlObj;
}

// ── Shared HTTP helper ───────────────────────────────────────────────────────

const UA = 'Mozilla/5.0 (compatible; Global Tech ToolsBot/1.0)';
const FETCH_OPTS = {
  timeout: 10000,
  maxRedirects: 5,
  headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml,*/*;q=0.8' },
};

async function fetchHtml(url) {
  const { data } = await axios.get(url, FETCH_OPTS);
  return typeof data === 'string' ? data : JSON.stringify(data);
}

// ── Stop-word list (English) ─────────────────────────────────────────────────

const STOP = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by',
  'from','is','are','was','were','be','been','have','has','had','do','does',
  'did','will','would','can','could','may','might','shall','should','that',
  'this','these','those','it','its','not','no','as','if','so','than','also',
  'all','some','such','just','about','up','out','then','than','too','very',
  'into','over','more','other','own','s','t','re','ve','ll','d','m','n',
]);

function extractWords(html) {
  const $ = cheerio.load(html);
  $('script,style,nav,footer,header,aside,noscript').remove();
  const text = $('body').text();
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOP.has(w));
}

function wordFrequency(words, n = 1) {
  const freq = {};
  const len  = words.length;
  for (let i = 0; i <= len - n; i++) {
    const phrase = words.slice(i, i + n).join(' ');
    freq[phrase] = (freq[phrase] || 0) + 1;
  }
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n === 1 ? 30 : n === 2 ? 20 : 10)
    .map(([phrase, count]) => ({
      phrase, count,
      density: parseFloat(((count / (len - n + 1)) * 100).toFixed(2)),
    }));
}

// ── SEO Analyzer ─────────────────────────────────────────────────────────────

async function analyzeSeoPage(url) {
  const t0   = Date.now();
  const html = await fetchHtml(url);
  const responseTime = Date.now() - t0;
  const $    = cheerio.load(html);

  const getMeta = (...names) => {
    for (const n of names) {
      const v = $(`meta[property="${n}"]`).attr('content') ||
                $(`meta[name="${n}"]`).attr('content');
      if (v?.trim()) return v.trim();
    }
    return '';
  };

  const title    = $('title').first().text().trim();
  const metaDesc = getMeta('description');

  // Collect headings with text (capped to avoid huge payloads)
  const h1Items = []; $('h1').each((_, el) => h1Items.push($(el).text().trim().slice(0, 120)));
  const h2Items = []; $('h2').each((_, el) => h2Items.push($(el).text().trim().slice(0, 120)));
  const h3Items = []; $('h3').each((_, el) => h3Items.push($(el).text().trim().slice(0, 120)));
  const h4Items = []; $('h4').each((_, el) => h4Items.push($(el).text().trim().slice(0, 120)));

  const allImgs     = $('img');
  const totalImages = allImgs.length;
  const withAlt     = allImgs.filter((_, el) => !!$(el).attr('alt')).length;

  const canonical   = $('link[rel="canonical"]').attr('href') || '';
  const robotsMeta  = getMeta('robots');
  const hasViewport = !!$('meta[name="viewport"]').attr('content');

  let internal = 0, external = 0;
  const baseHost = new URL(url).hostname;
  $('a[href]').each((_, el) => {
    try {
      const href = $(el).attr('href');
      if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
      const parsed = new URL(href, url);
      if (parsed.hostname === baseHost) internal++; else external++;
    } catch {}
  });

  const bodyText  = $('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = bodyText.split(/\s+/).filter(w => w.length > 1).length;

  const ogTitle = getMeta('og:title');
  const ogDesc  = getMeta('og:description');
  const ogImage = getMeta('og:image');
  const twCard  = getMeta('twitter:card');

  // ── Scoring (100 points total, per spec) ────────────────────────
  const titlePresent    = title.length > 0;
  const titleOptimal    = title.length >= 50 && title.length <= 60;
  const metaPresent     = metaDesc.length > 0;
  const metaOptimal     = metaDesc.length >= 150 && metaDesc.length <= 160;
  const h1Present       = h1Items.length > 0;
  const headingGood     = h1Items.length === 1 && h2Items.length > 0;
  const allImgsHaveAlt  = totalImages === 0 || withAlt === totalImages;
  const canonicalPresent = !!canonical;
  const viewportPresent  = hasViewport;
  const wordCountGood   = wordCount >= 300;
  const ogComplete      = !!(ogTitle && ogDesc && ogImage);
  const twitterPresent  = !!twCard;
  const fastResponse    = responseTime < 2000;

  let score = 0;
  if (titlePresent)     score += 10;
  if (titleOptimal)     score += 5;
  if (metaPresent)      score += 10;
  if (metaOptimal)      score += 5;
  if (h1Present)        score += 10;
  if (headingGood)      score += 5;
  if (allImgsHaveAlt)   score += 10;
  if (canonicalPresent) score += 5;
  if (viewportPresent)  score += 10;
  if (wordCountGood)    score += 10;
  if (ogComplete)       score += 10;
  if (twitterPresent)   score += 5;
  if (fastResponse)     score += 5;

  // ── Recommendations ─────────────────────────────────────────────
  const recommendations = [];
  if (!titlePresent)
    recommendations.push({ type: 'error',   text: 'Page has no <title> tag.' });
  else if (title.length < 50)
    recommendations.push({ type: 'warning', text: `Title too short (${title.length} chars). Aim for 50–60 characters.` });
  else if (title.length > 60)
    recommendations.push({ type: 'warning', text: `Title too long (${title.length} chars). Keep it under 60 characters.` });
  if (!metaPresent)
    recommendations.push({ type: 'error',   text: 'Meta description is missing.' });
  else if (metaDesc.length < 150)
    recommendations.push({ type: 'warning', text: `Meta description too short (${metaDesc.length} chars). Aim for 150–160.` });
  else if (metaDesc.length > 160)
    recommendations.push({ type: 'warning', text: `Meta description too long (${metaDesc.length} chars). Keep it under 160.` });
  if (h1Items.length === 0)
    recommendations.push({ type: 'error',   text: 'No H1 tag found. Every page should have exactly one H1.' });
  else if (h1Items.length > 1)
    recommendations.push({ type: 'warning', text: `Multiple H1 tags found (${h1Items.length}). Reduce to exactly one.` });
  if (h1Items.length === 1 && h2Items.length === 0)
    recommendations.push({ type: 'warning', text: 'No H2 tags found. Add subheadings to improve content structure.' });
  if (!canonicalPresent)
    recommendations.push({ type: 'warning', text: 'No canonical tag found. Add one to prevent duplicate content issues.' });
  if (!viewportPresent)
    recommendations.push({ type: 'error',   text: 'Missing viewport meta tag. Required for mobile-friendliness.' });
  if (totalImages > 0 && !allImgsHaveAlt)
    recommendations.push({ type: 'warning', text: `${totalImages - withAlt} image(s) missing alt text. Add descriptive alt attributes.` });
  if (!wordCountGood)
    recommendations.push({ type: 'warning', text: `Low word count (${wordCount} words). Aim for at least 300 words.` });
  if (!ogTitle)
    recommendations.push({ type: 'info',    text: 'Add og:title for better social media sharing.' });
  if (!ogDesc)
    recommendations.push({ type: 'info',    text: 'Add og:description for richer social media previews.' });
  if (!ogImage)
    recommendations.push({ type: 'info',    text: 'Add og:image for visual link previews on social platforms.' });
  if (!twitterPresent)
    recommendations.push({ type: 'info',    text: 'Add Twitter Card meta tags for richer Twitter link previews.' });
  if (!fastResponse)
    recommendations.push({ type: 'warning', text: `Slow server response (${responseTime}ms). Aim for under 2,000ms.` });

  return {
    url,
    score: Math.min(100, score),
    title:           { text: title,    length: title.length,    present: titlePresent, optimal: titleOptimal },
    metaDescription: { text: metaDesc, length: metaDesc.length, present: metaPresent,  optimal: metaOptimal },
    headings: {
      h1: { count: h1Items.length, items: h1Items },
      h2: { count: h2Items.length, items: h2Items.slice(0, 8) },
      h3: { count: h3Items.length, items: h3Items.slice(0, 5) },
      h4: { count: h4Items.length },
      isGood: headingGood,
    },
    images:      { total: totalImages, withAlt, withoutAlt: totalImages - withAlt, allHaveAlt: allImgsHaveAlt },
    links:       { internal, external },
    technical:   { canonical: canonical || null, robots: robotsMeta || null, hasViewport, wordCount },
    performance: { responseTime, isFast: fastResponse },
    openGraph:   { title: ogTitle, description: ogDesc, image: ogImage, isComplete: ogComplete },
    twitter:     { card: twCard, isPresent: twitterPresent },
    scoreBreakdown: {
      titlePresent, titleOptimal, metaPresent, metaOptimal, h1Present, headingGood,
      allImgsHaveAlt, canonicalPresent, viewportPresent, wordCountGood,
      ogComplete, twitterPresent, fastResponse,
    },
    recommendations,
  };
}

// ── Keyword Density Analyzer ─────────────────────────────────────────────────

// Static synonym / related-phrase map for keyword variations
const KW_SYNONYMS = {
  website:     ['web design',          'web development',   'online platform',     'web page'],
  software:    ['web application',     'software solution', 'digital tool',        'app development'],
  design:      ['UI design',           'graphic design',    'creative design',     'visual design'],
  development: ['web development',     'coding',            'programming',         'app development'],
  marketing:   ['digital marketing',   'online marketing',  'SEO strategy',        'content marketing'],
  business:    ['company strategy',    'enterprise',        'startup',             'business growth'],
  content:     ['blog post',           'article writing',   'content marketing',   'copywriting'],
  project:     ['project management',  'project planning',  'project ideas',       'academic project'],
  technology:  ['tech solution',       'digital technology','IT solution',         'innovation'],
  service:     ['professional service','managed service',   'consulting',          'service provider'],
  product:     ['product development', 'product launch',    'ecommerce product',   'product strategy'],
  data:        ['data analysis',       'data science',      'big data',            'data management'],
  security:    ['cybersecurity',       'data security',     'network security',    'IT security'],
  cloud:       ['cloud computing',     'cloud service',     'cloud storage',       'SaaS'],
  mobile:      ['mobile app',          'Android app',       'iOS app',             'responsive design'],
  social:      ['social media',        'social marketing',  'social media strategy','community'],
  ecommerce:   ['online store',        'digital commerce',  'online shopping',     'retail platform'],
  blog:        ['blogging',            'blog post',         'content creation',    'article writing'],
  video:       ['video marketing',     'YouTube SEO',       'video content',       'multimedia'],
  email:       ['email marketing',     'email campaign',    'newsletter',          'email automation'],
  seo:         ['search optimization', 'on-page SEO',       'technical SEO',       'link building'],
  analytics:   ['web analytics',       'data tracking',     'traffic analysis',    'Google Analytics'],
  performance: ['page speed',          'site optimization', 'core web vitals',     'load time'],
  hosting:     ['web hosting',         'cloud hosting',     'server setup',        'VPS'],
  domain:      ['domain name',         'URL structure',     'subdomain',           'domain authority'],
};

async function analyzeKeywords(url, text) {
  // ── Build word lists ─────────────────────────────────────────────
  let rawText;
  if (text) {
    rawText = text;
  } else {
    const html = await fetchHtml(url);
    const $    = cheerio.load(html);
    $('script,style,nav,footer,header,aside,noscript').remove();
    rawText = $('body').text();
  }

  const tokenize = str =>
    str.toLowerCase().replace(/[^a-z0-9\s'-]/g, ' ').split(/\s+/).filter(Boolean);

  const allTokens  = tokenize(rawText);
  const rawWordCount = allTokens.filter(w => w.length > 1).length;

  // Filtered: stopwords removed, minimum length 3
  const filteredWords = allTokens.filter(w => w.length > 2 && !STOP.has(w));
  const filteredCount = filteredWords.length;

  // ── Frequencies ──────────────────────────────────────────────────
  const keywords = wordFrequency(filteredWords, 1);
  const bigrams  = wordFrequency(filteredWords, 2);
  const trigrams = wordFrequency(filteredWords, 3);

  // Unfiltered keywords — for stopwords-on toggle
  const allKeywords = wordFrequency(allTokens.filter(w => w.length > 1), 1);

  // ── Primary keyword ──────────────────────────────────────────────
  const primaryKeyword = keywords[0]?.phrase || null;
  const primaryDensity = keywords[0]?.density || 0;

  // ── Insights ─────────────────────────────────────────────────────
  const overused       = keywords.filter(k => k.density > 3);
  const underused      = keywords.filter(k => k.density >= 0.1 && k.density < 0.5);
  const hasFocusKeyword = keywords.some(k => k.density >= 1);

  // ── SEO Score (0-100) ────────────────────────────────────────────
  let seoScore = 0;

  // 1. Primary keyword density balance (0-35 pts)
  const d = primaryDensity;
  if      (d >= 0.8 && d <= 2.5) seoScore += 35;   // optimal
  else if (d >= 0.5 && d < 0.8)  seoScore += 22;   // slightly sparse
  else if (d > 2.5  && d <= 3.5) seoScore += 22;   // slightly dense
  else if (d > 3.5  && d <= 5)   seoScore += 10;   // borderline stuffing
  else if (d >= 0.1 && d < 0.5)  seoScore +=  8;   // underused
  // d === 0 or d > 5: 0 pts

  // 2. Long-tail keyword presence (0-25 pts)
  const goodBigrams  = bigrams.filter(b => b.count >= 2).length;
  const goodTrigrams = trigrams.filter(t => t.count >= 2).length;
  seoScore += Math.min(15, goodBigrams  * 3);
  seoScore += Math.min(10, goodTrigrams * 5);

  // 3. Vocabulary richness / keyword diversity (0-20 pts)
  const uniqueKw = keywords.length;
  if      (uniqueKw >= 100) seoScore += 20;
  else if (uniqueKw >=  50) seoScore += 15;
  else if (uniqueKw >=  20) seoScore += 10;
  else if (uniqueKw >=  10) seoScore +=  5;

  // 4. Keyword balance / distribution (0-20 pts)
  if      (overused.length === 0 && uniqueKw >= 10) seoScore += 20;
  else if (overused.length <= 1  && uniqueKw >=  5) seoScore += 15;
  else if (overused.length <= 3)                    seoScore +=  8;
  else                                               seoScore +=  3;

  seoScore = Math.min(100, Math.round(seoScore));

  const scoreLabel = seoScore >= 90 ? 'Excellent'
    : seoScore >= 70 ? 'Good'
    : seoScore >= 50 ? 'Average'
    : 'Needs Improvement';

  // ── Smart suggestions ────────────────────────────────────────────
  const suggestions = [];

  if (d > 3.5) {
    suggestions.push(`"${primaryKeyword}" is overused (${d.toFixed(1)}%). Reduce repetition and use synonyms to avoid keyword stuffing penalties.`);
  } else if (d > 0 && d < 0.5) {
    suggestions.push(`"${primaryKeyword}" has very low density (${d.toFixed(1)}%). Use it more consistently to signal content focus to search engines.`);
  } else if (!primaryKeyword || d === 0) {
    suggestions.push('Content lacks a clear focus keyword. Identify your target keyword and use it with 1–2.5% density.');
  }

  if (!hasFocusKeyword) {
    suggestions.push('No keyword exceeds 1% density. Your content lacks a clear SEO focus — identify your primary topic and reinforce it throughout.');
  }

  if (overused.length > 0) {
    const ex = overused.slice(0, 2).map(k => `"${k.phrase}"`).join(', ');
    suggestions.push(`Replace some instances of ${ex} with synonyms or closely related terms to diversify usage.`);
  }

  if (goodBigrams < 3) {
    const top = bigrams.slice(0, 3).map(b => `"${b.phrase}"`).join(', ');
    suggestions.push(top
      ? `Add more long-tail keyword phrases. Top candidates from your content: ${top}.`
      : 'Include specific two-word or three-word keyword phrases for better long-tail SEO targeting.');
  }

  if (goodTrigrams === 0 && filteredCount > 100) {
    suggestions.push('Use specific 3-word phrases to capture targeted search traffic with lower competition.');
  }

  if (rawWordCount < 300) {
    suggestions.push('Content is too short for strong SEO. Aim for at least 300–500 words to improve search visibility.');
  } else if (rawWordCount < 800) {
    suggestions.push('Expanding content to 800+ words helps establish topical authority and improve rankings.');
  }

  if (uniqueKw < 10 && filteredCount > 50) {
    suggestions.push('Very limited keyword variety. Expand vocabulary to cover related subtopics and semantic variations.');
  }

  // ── Keyword variations ───────────────────────────────────────────
  const variations = [];
  if (primaryKeyword) {
    // Bigrams/trigrams that contain the primary keyword word
    [...bigrams, ...trigrams]
      .filter(b => b.phrase.split(' ').some(w => w === primaryKeyword || primaryKeyword.startsWith(w)))
      .slice(0, 3)
      .forEach(b => { if (!variations.includes(b.phrase)) variations.push(b.phrase); });

    // Static synonym map
    (KW_SYNONYMS[primaryKeyword] || []).forEach(v => {
      if (!variations.includes(v) && variations.length < 8) variations.push(v);
    });

    // Fill remaining slots with top bigrams
    bigrams.slice(0, 6).forEach(b => {
      if (!variations.includes(b.phrase) && variations.length < 8) variations.push(b.phrase);
    });
  }

  return {
    totalWords: rawWordCount,
    filteredWords: filteredCount,
    seoScore,
    scoreLabel,
    primaryKeyword,
    primaryDensity,
    keywords,
    allKeywords,
    bigrams,
    trigrams,
    overused,
    underused,
    hasFocusKeyword,
    suggestions,
    variations: variations.slice(0, 8),
  };
}

// ── Keyword Cloud Density ────────────────────────────────────────────────────

async function keywordCloud(url, text) {
  const { keywords, totalWords } = await analyzeKeywords(url, text);
  return {
    totalWords,
    words: keywords.map(k => ({ text: k.phrase, value: k.count })),
    topKeywords: keywords.slice(0, 10),
  };
}

// ── Redirect Checker ─────────────────────────────────────────────────────────

function statusText(code) {
  const map = { 301:'Moved Permanently', 302:'Found', 303:'See Other', 307:'Temporary Redirect', 308:'Permanent Redirect', 200:'OK', 404:'Not Found', 500:'Internal Server Error' };
  return map[code] || `HTTP ${code}`;
}

async function checkRedirects(startUrl) {
  const chain  = [];
  let current  = startUrl;
  let maxHops  = 12;

  while (maxHops-- > 0) {
    try {
      const resp = await axios.get(current, {
        timeout: 8000,
        maxRedirects: 0,
        validateStatus: () => true,
        headers: { 'User-Agent': UA },
      });
      chain.push({ url: current, statusCode: resp.status, statusText: statusText(resp.status) });

      if (resp.status >= 300 && resp.status < 400 && resp.headers.location) {
        const next = new URL(resp.headers.location, current).toString();
        if (next === current) break;
        current = next;
      } else break;
    } catch (err) {
      chain.push({ url: current, statusCode: 0, statusText: err.message.slice(0, 80) });
      break;
    }
  }

  return {
    chain,
    startUrl,
    finalUrl: current,
    totalRedirects: chain.filter(h => h.statusCode >= 300 && h.statusCode < 400).length,
    hasRedirects: chain.length > 1,
    isHttps: current.startsWith('https://'),
  };
}

// ── Schema Entity Relationship ───────────────────────────────────────────────

async function extractSchemaGraph(url) {
  const html    = await fetchHtml(url);
  const $       = cheerio.load(html);
  const nodes   = [];
  const edges   = [];
  const nodeMap = {};
  let   nodeIdx = 0;

  function ensureNode(id, type, label) {
    if (!nodeMap[id]) {
      nodeMap[id] = { id, type, label: (label || '').slice(0, 60) || type };
      nodes.push(nodeMap[id]);
    }
    return nodeMap[id];
  }

  function walk(item, parentId) {
    if (!item || typeof item !== 'object') return;
    const rawType = Array.isArray(item['@type']) ? item['@type'].join(' / ') : (item['@type'] || '');
    if (!rawType) return;
    const id    = item['@id'] || `auto-${nodeIdx++}`;
    const label = item.name || item.headline || item.title || rawType;
    const node  = ensureNode(id, rawType, label);

    if (parentId && parentId !== id) {
      edges.push({ from: parentId, to: id, relation: '' });
    }

    Object.entries(item).forEach(([key, val]) => {
      if (key.startsWith('@')) return;
      const targets = Array.isArray(val) ? val : [val];
      targets.forEach(t => {
        if (t && typeof t === 'object' && t['@type']) {
          const childType  = Array.isArray(t['@type']) ? t['@type'].join(' / ') : t['@type'];
          const childId    = t['@id'] || `auto-${nodeIdx++}`;
          const childLabel = t.name || t.headline || t.title || childType;
          ensureNode(childId, childType, childLabel);
          edges.push({ from: node.id, to: childId, relation: key });
          walk(t, null);
        }
      });
    });
  }

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const raw  = $(el).html();
      const data = JSON.parse(raw);
      const items = Array.isArray(data) ? data : (data['@graph'] ? data['@graph'] : [data]);
      items.forEach(item => walk(item, null));
    } catch {}
  });

  return { url, nodes, edges, schemaCount: nodes.length };
}

// ── Visual Site Crawler ──────────────────────────────────────────────────────

async function crawlSite(startUrl, maxPages = 15) {
  const cap     = Math.min(maxPages, 20);
  const base    = new URL(startUrl).hostname;
  const queue   = [{ url: startUrl, depth: 0, from: null }];
  const visited = new Set([startUrl]);
  const nodes   = [];
  const edges   = [];

  while (queue.length > 0 && nodes.length < cap) {
    const { url, depth, from } = queue.shift();
    try {
      const { data, status } = await axios.get(url, { ...FETCH_OPTS, timeout: 6000, maxRedirects: 3 });
      if (status < 200 || status >= 400) continue;

      const $     = cheerio.load(data);
      const title = $('title').first().text().trim() || url;

      nodes.push({ id: url, url, title: title.slice(0, 80), depth, status });
      if (from) edges.push({ from, to: url });

      if (depth < 3) {
        $('a[href]').each((_, el) => {
          try {
            const href   = $(el).attr('href');
            if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) return;
            const abs    = new URL(href, url).toString();
            const parsed = new URL(abs);
            if (parsed.hostname !== base) return;
            if (visited.has(abs) || visited.size >= cap * 3) return;
            visited.add(abs);
            queue.push({ url: abs, depth: depth + 1, from: url });
          } catch {}
        });
      }
    } catch {}
  }

  return {
    nodes, edges,
    stats: {
      pagesFound: nodes.length,
      maxDepth:   Math.max(0, ...nodes.map(n => n.depth)),
      startUrl,
    },
  };
}

// ── Social Analytics ─────────────────────────────────────────────────────────

async function analyzeSocialMeta(url) {
  const html = await fetchHtml(url);
  const $    = cheerio.load(html);
  const gm   = (...names) => {
    for (const n of names) {
      const v = $(`meta[property="${n}"]`).attr('content') || $(`meta[name="${n}"]`).attr('content');
      if (v?.trim()) return v.trim();
    }
    return '';
  };

  return {
    url,
    openGraph: {
      title:       gm('og:title'),
      description: gm('og:description'),
      image:       gm('og:image'),
      type:        gm('og:type'),
      url:         gm('og:url'),
      siteName:    gm('og:site_name'),
    },
    twitter: {
      card:        gm('twitter:card'),
      title:       gm('twitter:title'),
      description: gm('twitter:description'),
      image:       gm('twitter:image'),
      site:        gm('twitter:site'),
      creator:     gm('twitter:creator'),
    },
    general: {
      pageTitle:   $('title').first().text().trim(),
      description: gm('description'),
      keywords:    gm('keywords'),
      author:      gm('author'),
    },
  };
}

// ── Sitemap Visualizer ───────────────────────────────────────────────────────

async function visualizeSitemap(sitemapUrl) {
  const { data } = await axios.get(sitemapUrl, { ...FETCH_OPTS, timeout: 15000 });
  const $        = cheerio.load(typeof data === 'string' ? data : String(data), { xmlMode: true });

  const isSitemapIndex = $('sitemapindex').length > 0;

  if (isSitemapIndex) {
    const sitemaps = [];
    $('sitemap').each((_, el) => {
      sitemaps.push({
        loc:     $(el).find('loc').text().trim(),
        lastmod: $(el).find('lastmod').text().trim() || null,
      });
    });
    return { type: 'index', sitemaps, total: sitemaps.length, url: sitemapUrl };
  }

  const urls = [];
  $('url').each((_, el) => {
    urls.push({
      loc:        $(el).find('loc').text().trim(),
      lastmod:    $(el).find('lastmod').text().trim() || null,
      changefreq: $(el).find('changefreq').text().trim() || null,
      priority:   $(el).find('priority').text().trim() || null,
    });
  });

  return { type: 'sitemap', urls: urls.slice(0, 500), total: urls.length, url: sitemapUrl };
}

// ── JSON-LD Validator ─────────────────────────────────────────────────────────

async function validateJsonLd(url, jsonLdText) {
  let text = jsonLdText;

  if (url && !text) {
    const html = await fetchHtml(url);
    const $    = cheerio.load(html);
    const parts = [];
    $('script[type="application/ld+json"]').each((_, el) => parts.push($(el).html()));
    if (parts.length === 0) return { isValid: false, errors: ['No JSON-LD found on this page.'], types: [], formatted: '' };
    text = parts.length === 1 ? parts[0] : `[${parts.join(',')}]`;
  }

  const errors = [], warnings = [];
  let parsed;
  try { parsed = JSON.parse(text); } catch (e) {
    return { isValid: false, errors: [`JSON parse error: ${e.message}`], types: [], formatted: '' };
  }

  const items = Array.isArray(parsed) ? parsed : (parsed['@graph'] ? parsed['@graph'] : [parsed]);
  const types  = [];

  items.forEach((item, i) => {
    const pfx = items.length > 1 ? `Item ${i + 1}: ` : '';
    if (!item['@context'])         warnings.push(`${pfx}Missing @context (expected "https://schema.org")`);
    if (!item['@type'])            errors.push(`${pfx}Missing required @type field`);
    else {
      const t = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
      types.push(...t);
    }
  });

  return {
    isValid: errors.length === 0,
    formatted: JSON.stringify(parsed, null, 2),
    errors, warnings,
    types: [...new Set(types)],
    itemCount: items.length,
  };
}

// ── PWA Compatibility Checker ────────────────────────────────────────────────

async function checkPwa(url) {
  const html = await fetchHtml(url);
  const $    = cheerio.load(html);

  const manifestHref = $('link[rel="manifest"]').attr('href') || '';
  const checks = {
    isHttps:        url.startsWith('https://'),
    hasManifest:    !!manifestHref,
    hasThemeColor:  !!$('meta[name="theme-color"]').attr('content'),
    hasViewport:    !!$('meta[name="viewport"]').attr('content'),
    hasAppleIcon:   !!$('link[rel="apple-touch-icon"]').attr('href'),
    hasSWRegistration: $('script').toArray().some(el => {
      const src  = $(el).attr('src') || '';
      const code = $(el).html() || '';
      return src.includes('sw.js') || src.includes('service-worker') || code.includes('serviceWorker.register');
    }),
  };

  const weights = { isHttps: 25, hasManifest: 20, hasThemeColor: 10, hasViewport: 15, hasAppleIcon: 10, hasSWRegistration: 20 };
  const score   = Object.entries(weights).reduce((s, [k, w]) => s + (checks[k] ? w : 0), 0);

  let manifest = null;
  if (manifestHref) {
    try {
      const manifestUrl   = new URL(manifestHref, url).toString();
      const { data }      = await axios.get(manifestUrl, { ...FETCH_OPTS, timeout: 5000 });
      manifest            = typeof data === 'string' ? JSON.parse(data) : data;
    } catch {}
  }

  const recommendations = [];
  if (!checks.isHttps)           recommendations.push('Switch to HTTPS — required for PWA installability.');
  if (!checks.hasManifest)       recommendations.push('Add a web app manifest (<link rel="manifest" href="/manifest.json">).');
  if (!checks.hasThemeColor)     recommendations.push('Add <meta name="theme-color"> for browser UI customization.');
  if (!checks.hasViewport)       recommendations.push('Add a viewport meta tag for responsive design.');
  if (!checks.hasAppleIcon)      recommendations.push('Add <link rel="apple-touch-icon"> for iOS home screen icons.');
  if (!checks.hasSWRegistration) recommendations.push('Register a service worker for offline support and caching.');

  return { url, score, checks, manifest, recommendations };
}

// ── AMP Validator ─────────────────────────────────────────────────────────────

async function validateAmp(url, htmlText) {
  let html = htmlText;
  if (url && !html) html = await fetchHtml(url);

  const $      = cheerio.load(html);
  const errors = [], warnings = [];

  const isAmp  = $('html[⚡]').length > 0 || $('html[amp]').length > 0;
  if (!isAmp) {
    return {
      isAmp:    false,
      isValid:  false,
      errors:   ['This page does not appear to be an AMP page. The <html> tag must have ⚡ or amp attribute.'],
      warnings: [],
      score:    0,
    };
  }

  if (!html.includes('amp-boilerplate') && !html.includes('i-amphtml-'))
    errors.push({ code: 'MANDATORY_BOILERPLATE', message: 'AMP CSS boilerplate is missing.' });

  const hasAmpScript = $('script[src*="cdn.ampproject.org"]').length > 0 || $('script[async]').toArray().some(el => ($(el).attr('src') || '').includes('ampproject'));
  if (!hasAmpScript)
    errors.push({ code: 'MANDATORY_SCRIPT', message: 'AMP runtime script (cdn.ampproject.org/v0.js) is missing.' });

  const customJS = $('script').toArray().filter(el => {
    const src  = $(el).attr('src') || '';
    const type = $(el).attr('type') || '';
    return !src.includes('ampproject') && type !== 'application/ld+json' && type !== 'application/json';
  });
  if (customJS.length)
    errors.push({ code: 'DISALLOWED_SCRIPT', message: `Custom JavaScript is not allowed in AMP (${customJS.length} script tag(s) found).` });

  if (!$('meta[charset]').length)
    errors.push({ code: 'MISSING_CHARSET', message: '<meta charset="utf-8"> is required.' });

  if (!$('link[rel="canonical"]').attr('href'))
    warnings.push({ code: 'MISSING_CANONICAL', message: 'Add a canonical link pointing to the non-AMP version.' });

  const cssLen = ($('style[amp-custom]').html() || '').length;
  if (cssLen > 75000)
    errors.push({ code: 'CSS_TOO_LARGE', message: `AMP custom CSS exceeds 75 KB (found ~${Math.round(cssLen / 1024)} KB).` });

  return {
    isAmp,
    isValid: errors.length === 0,
    errors, warnings,
    score: Math.max(0, 100 - errors.length * 20 - warnings.length * 5),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// GENERATOR TOOLS
// ═══════════════════════════════════════════════════════════════════════════

function genSchemaJsonLd(fields) {
  const { schemaType = 'Article', ...f } = fields;

  const templates = {
    Article: {
      '@context': 'https://schema.org', '@type': 'Article',
      headline: f.headline || '', description: f.description || '',
      author: { '@type': 'Person', name: f.authorName || '' },
      datePublished: f.datePublished || new Date().toISOString().split('T')[0],
      publisher: { '@type': 'Organization', name: f.publisherName || '', logo: { '@type': 'ImageObject', url: f.publisherLogo || '' } },
      image: f.imageUrl || '', url: f.pageUrl || '',
    },
    Product: {
      '@context': 'https://schema.org', '@type': 'Product',
      name: f.name || '', description: f.description || '', image: f.imageUrl || '',
      brand: { '@type': 'Brand', name: f.brand || '' },
      offers: { '@type': 'Offer', price: f.price || '', priceCurrency: f.currency || 'USD', availability: 'https://schema.org/InStock', url: f.pageUrl || '' },
    },
    FAQ: {
      '@context': 'https://schema.org', '@type': 'FAQPage',
      mainEntity: (f.faqs || [{ question: 'Sample question?', answer: 'Sample answer.' }]).map(faq => ({
        '@type': 'Question', name: faq.question || '',
        acceptedAnswer: { '@type': 'Answer', text: faq.answer || '' },
      })),
    },
    LocalBusiness: {
      '@context': 'https://schema.org', '@type': 'LocalBusiness',
      name: f.name || '', description: f.description || '',
      telephone: f.phone || '', url: f.url || '',
      address: { '@type': 'PostalAddress', streetAddress: f.street || '', addressLocality: f.city || '', addressRegion: f.region || '', postalCode: f.postalCode || '', addressCountry: f.country || '' },
      openingHours: f.hours || 'Mo-Fr 09:00-17:00',
    },
    BreadcrumbList: {
      '@context': 'https://schema.org', '@type': 'BreadcrumbList',
      itemListElement: (f.items || [{ name: 'Home', url: '/' }, { name: 'Blog', url: '/blog' }]).map((item, i) => ({
        '@type': 'ListItem', position: i + 1, name: item.name || '', item: item.url || '',
      })),
    },
    Review: {
      '@context': 'https://schema.org', '@type': 'Review',
      reviewRating: { '@type': 'Rating', ratingValue: f.rating || '5', bestRating: '5' },
      author: { '@type': 'Person', name: f.authorName || '' },
      reviewBody: f.reviewBody || '',
      itemReviewed: { '@type': 'Thing', name: f.itemName || '' },
    },
    Event: {
      '@context': 'https://schema.org', '@type': 'Event',
      name: f.name || '', startDate: f.startDate || '', endDate: f.endDate || '',
      location: { '@type': 'Place', name: f.locationName || '', address: f.locationAddress || '' },
      organizer: { '@type': 'Organization', name: f.organizer || '' },
      description: f.description || '',
    },
    Person: {
      '@context': 'https://schema.org', '@type': 'Person',
      name: f.name || '', jobTitle: f.jobTitle || '', url: f.url || '',
      email: f.email || '',
      sameAs: (f.socialUrls || '').split('\n').map(s => s.trim()).filter(Boolean),
    },
    WebSite: {
      '@context': 'https://schema.org', '@type': 'WebSite',
      name: f.name || '', url: f.url || '',
      potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${f.url || ''}?q={search_term_string}` }, 'query-input': 'required name=search_term_string' },
    },
    HowTo: {
      '@context': 'https://schema.org', '@type': 'HowTo',
      name: f.name || '', description: f.description || '',
      step: (f.steps || [{ name: 'Step 1', text: 'Description of step 1.' }]).map((s, i) => ({
        '@type': 'HowToStep', position: i + 1, name: s.name || '', text: s.text || '',
      })),
    },
  };

  const schema = templates[schemaType] || templates.Article;
  return JSON.stringify(schema, null, 2);
}

function genHreflangTags(fields) {
  const pages = fields.pages || [];
  const tags  = pages.map(p => `<link rel="alternate" hreflang="${p.lang}" href="${p.url}" />`);
  const enPage = pages.find(p => p.lang === 'en' || p.lang === 'en-US');
  if (enPage) tags.push(`<link rel="alternate" hreflang="x-default" href="${enPage.url}" />`);
  return tags.join('\n') || `<link rel="alternate" hreflang="en" href="https://example.com/" />\n<link rel="alternate" hreflang="x-default" href="https://example.com/" />`;
}

function genCanonicalUrl(fields) {
  let { url = '' } = fields;
  let clean = url;
  try {
    const u = new URL(url);
    u.protocol = 'https:';
    ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','fbclid','gclid','ref'].forEach(p => u.searchParams.delete(p));
    if (u.pathname !== '/' && u.pathname.endsWith('/')) u.pathname = u.pathname.slice(0, -1);
    clean = u.toString();
  } catch {}
  return `<!-- HTML -->
<link rel="canonical" href="${clean}" />

<!-- HTTP Header equivalent -->
Link: <${clean}>; rel="canonical"`;
}

function genPwaManifest(fields) {
  const {
    name = 'My App', shortName, description = '', startUrl = '/',
    display = 'standalone', themeColor = '#2563EB', backgroundColor = '#FFFFFF',
    lang = 'en', orientation = 'any',
  } = fields;

  const manifest = {
    name, short_name: shortName || name, description,
    start_url: startUrl, display, theme_color: themeColor,
    background_color: backgroundColor, lang, orientation,
    icons: [72, 96, 128, 144, 152, 192, 384, 512].map(s => ({
      src: `/icons/icon-${s}x${s}.png`, sizes: `${s}x${s}`, type: 'image/png', purpose: 'maskable any',
    })),
  };
  return JSON.stringify(manifest, null, 2);
}

function genJsonLdToMicrodata(fields) {
  const { jsonLd = '' } = fields;
  let parsed;
  try { parsed = JSON.parse(jsonLd); } catch { return '<!-- Error: Invalid JSON-LD input. -->'; }

  function convert(item, indent = '') {
    if (!item || typeof item !== 'object') return '';
    const rawType = Array.isArray(item['@type']) ? item['@type'][0] : item['@type'];
    if (!rawType) return '';
    const schemaUrl = rawType.startsWith('http') ? rawType : `https://schema.org/${rawType}`;
    let html = `${indent}<div itemscope itemtype="${schemaUrl}">\n`;
    Object.entries(item).forEach(([k, v]) => {
      if (k.startsWith('@')) return;
      const vals = Array.isArray(v) ? v : [v];
      vals.forEach(val => {
        if (val && typeof val === 'object' && val['@type']) {
          html += `${indent}  <div itemprop="${k}">\n`;
          html += convert(val, indent + '    ');
          html += `${indent}  </div>\n`;
        } else if (val !== null && val !== undefined) {
          html += `${indent}  <span itemprop="${k}">${String(val)}</span>\n`;
        }
      });
    });
    html += `${indent}</div>`;
    return html;
  }

  const items = Array.isArray(parsed) ? parsed : [parsed];
  return items.map(i => convert(i)).join('\n\n');
}

function genSeoTags(fields) {
  const { title = '', description = '', url = '', image = '', type = 'website', author = '', keywords = '', siteName = '' } = fields;
  return [
    '<!-- ╔══════════════════════════════════════ -->',
    '<!-- ║  Generated by Global Tech Tools          -->',
    '<!-- ╚══════════════════════════════════════ -->',
    '',
    '<!-- Primary Meta Tags -->',
    `<title>${title}</title>`,
    `<meta name="title" content="${title}" />`,
    `<meta name="description" content="${description}" />`,
    keywords ? `<meta name="keywords" content="${keywords}" />` : null,
    author   ? `<meta name="author" content="${author}" />` : null,
    '',
    '<!-- Open Graph / Facebook -->',
    `<meta property="og:type" content="${type}" />`,
    `<meta property="og:url" content="${url}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    image    ? `<meta property="og:image" content="${image}" />` : null,
    siteName ? `<meta property="og:site_name" content="${siteName}" />` : null,
    '',
    '<!-- Twitter Card -->',
    `<meta property="twitter:card" content="summary_large_image" />`,
    `<meta property="twitter:url" content="${url}" />`,
    `<meta property="twitter:title" content="${title}" />`,
    `<meta property="twitter:description" content="${description}" />`,
    image ? `<meta property="twitter:image" content="${image}" />` : null,
  ].filter(l => l !== null).join('\n');
}

function genTwitterCard(fields) {
  const { title = '', description = '', imageUrl = '', siteHandle = '', creatorHandle = '', cardType = 'summary_large_image', url = '' } = fields;
  const fmtHandle = h => h ? (h.startsWith('@') ? h : `@${h}`) : null;
  return [
    `<meta name="twitter:card" content="${cardType}" />`,
    siteHandle    ? `<meta name="twitter:site" content="${fmtHandle(siteHandle)}" />` : null,
    creatorHandle ? `<meta name="twitter:creator" content="${fmtHandle(creatorHandle)}" />` : null,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
    imageUrl ? `<meta name="twitter:image" content="${imageUrl}" />` : null,
    imageUrl ? `<meta name="twitter:image:alt" content="${title}" />` : null,
    url      ? `<meta name="twitter:url" content="${url}" />` : null,
  ].filter(Boolean).join('\n');
}

function genPrivacyPolicy(fields) {
  const {
    companyName  = 'Company Name',
    website      = 'https://example.com',
    email        = 'privacy@example.com',
    dataCollected = 'name, email address, and usage data',
    thirdParties = 'analytics and payment providers',
    governingLaw = 'the laws of the United States',
    effectiveDate,
  } = fields;
  const date = effectiveDate || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return `# Privacy Policy

**Effective Date:** ${date}

## 1. Introduction

Welcome to ${companyName} ("we," "us," or "our"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit ${website}.

## 2. Information We Collect

We may collect the following information:

- **Personal Information:** ${dataCollected}
- **Usage Data:** Pages visited, time spent on pages, browser type, operating system, and referring URLs
- **Device Data:** IP address, device identifiers, and browser metadata

## 3. How We Use Your Information

We use the information we collect to:
- Provide, operate, and improve our services
- Respond to inquiries and send service-related communications
- Analyze usage trends and improve user experience
- Comply with legal obligations

## 4. Sharing of Information

We do not sell your personal data. We may share information with ${thirdParties} as necessary to deliver our services. Any third parties we share data with are bound by appropriate data protection agreements.

## 5. Cookies and Tracking

We use cookies and similar technologies to improve your browsing experience. You can control cookie preferences through your browser settings. Disabling cookies may affect certain features.

## 6. Data Security

We implement SSL encryption, access controls, and industry-standard security practices to protect your data. No method of internet transmission is 100% secure, and we cannot guarantee absolute security.

## 7. Data Retention

We retain personal data only as long as necessary to fulfill the purposes outlined in this policy, comply with legal requirements, and resolve disputes.

## 8. Your Rights

Depending on your jurisdiction, you may have the right to:
- Access and receive a copy of your personal data
- Request correction of inaccurate data
- Request deletion of your data
- Opt out of certain data processing
- Data portability

To exercise these rights, contact us at **${email}**.

## 9. Children's Privacy

Our services are not directed to individuals under the age of 13. We do not knowingly collect personal data from children.

## 10. Third-Party Links

Our website may link to third-party sites. We are not responsible for the privacy practices of those sites and encourage you to review their policies.

## 11. Changes to This Policy

We may update this Privacy Policy periodically. Material changes will be notified by posting the revised policy with an updated effective date.

## 12. Governing Law

This Privacy Policy is governed by ${governingLaw}.

## 13. Contact Us

**${companyName}**
Website: ${website}
Email: ${email}`;
}

function genTermsOfService(fields) {
  const {
    companyName  = 'Company Name',
    website      = 'https://example.com',
    email        = 'legal@example.com',
    governingLaw = 'the laws of the United States',
    effectiveDate,
  } = fields;
  const date = effectiveDate || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return `# Terms of Service

**Effective Date:** ${date}

## 1. Acceptance of Terms

By accessing or using ${website} (the "Service"), you agree to be bound by these Terms of Service ("Terms"). If you do not agree to these Terms, do not use the Service.

## 2. Description of Service

${companyName} provides online tools and utilities accessible through ${website}. We reserve the right to modify, suspend, or discontinue the Service at any time without prior notice.

## 3. User Responsibilities

By using the Service, you agree to:
- Use the Service only for lawful purposes
- Not upload malicious content, malware, or content that infringes third-party rights
- Not attempt to gain unauthorized access to our systems or other users' data
- Not interfere with the performance, security, or functionality of the Service
- Provide accurate information if you create an account

## 4. Intellectual Property

All content on this website — including text, graphics, logos, and software — is the property of ${companyName} and protected by applicable intellectual property laws. You may not reproduce, distribute, or create derivative works without written consent.

## 5. User Content

Files and data you submit are processed solely to deliver the requested service. We do not claim ownership of your content. By submitting content, you grant ${companyName} a limited, non-exclusive license to process it for service delivery purposes only.

## 6. Privacy

Your use of the Service is also governed by our Privacy Policy, incorporated herein by reference.

## 7. Disclaimers

THE SERVICE IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND. ${companyName.toUpperCase()} DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT.

## 8. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, ${companyName.toUpperCase()} SHALL NOT BE LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE SERVICE.

## 9. Indemnification

You agree to indemnify and hold harmless ${companyName}, its officers, employees, and agents from any claims, liabilities, or expenses arising from your use of the Service or violation of these Terms.

## 10. Termination

We may terminate or restrict your access to the Service at our sole discretion, without notice, for conduct that violates these Terms or is harmful to users, third parties, or us.

## 11. Governing Law

These Terms are governed by ${governingLaw}, without regard to conflict-of-law provisions. Disputes shall be resolved in the courts of that jurisdiction.

## 12. Changes to Terms

We may modify these Terms at any time. Significant changes will be communicated via the Service. Continued use after changes constitutes acceptance.

## 13. Contact

Questions about these Terms:

**${companyName}**
Website: ${website}
Email: ${email}`;
}

function genRobotsTxt(fields) {
  const { rules = [], sitemapUrl = '', crawlDelay } = fields;
  const groups = {};

  rules.forEach(r => {
    const ua = r.userAgent || '*';
    if (!groups[ua]) groups[ua] = { allow: [], disallow: [] };
    if (r.type === 'allow') groups[ua].allow.push(r.path || '/');
    else groups[ua].disallow.push(r.path || '/');
  });

  if (Object.keys(groups).length === 0) groups['*'] = { allow: ['/'], disallow: [] };

  const lines = [];
  Object.entries(groups).forEach(([ua, g]) => {
    lines.push(`User-agent: ${ua}`);
    g.allow.forEach(p => lines.push(`Allow: ${p}`));
    g.disallow.forEach(p => lines.push(`Disallow: ${p}`));
    if (crawlDelay) lines.push(`Crawl-delay: ${crawlDelay}`);
    lines.push('');
  });

  if (sitemapUrl) lines.push(`Sitemap: ${sitemapUrl}`);
  return lines.join('\n').trim();
}

function genHtaccessRedirects(fields) {
  const { redirects = [] } = fields;
  const lines = ['RewriteEngine On', ''];

  if (redirects.length === 0) {
    lines.push('# Example:');
    lines.push('RewriteRule ^old-page$ /new-page [R=301,L]');
  } else {
    redirects.forEach(r => {
      if (!r.oldUrl || !r.newUrl) return;
      const code    = r.type === '302' ? 'R=302' : 'R=301';
      const oldPath = r.oldUrl.startsWith('/') ? r.oldUrl.slice(1) : r.oldUrl;
      lines.push(`RewriteRule ^${oldPath}$ ${r.newUrl} [${code},L]`);
    });
  }

  return lines.join('\n');
}

// ── SERP Simulator (pure data — frontend renders preview) ────────────────────

function serpData(fields) {
  const { title = 'Page Title', description = 'Meta description text here.', url = 'https://example.com/page', device = 'desktop' } = fields;

  let displayUrl = url;
  try {
    const u = new URL(url);
    displayUrl = u.hostname + (u.pathname !== '/' ? u.pathname : '');
  } catch {}

  const titleLimit   = device === 'mobile' ? 55 : 60;
  const descLimit    = device === 'mobile' ? 120 : 155;
  const truncTitle   = title.length > titleLimit   ? title.slice(0, titleLimit - 1) + '…'   : title;
  const truncDesc    = description.length > descLimit ? description.slice(0, descLimit - 1) + '…' : description;

  return JSON.stringify({ displayUrl, title: truncTitle, description: truncDesc, device, url }, null, 2);
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

const URL_ANALYZE_SLUGS = new Set([
  'seo-analyzer', 'keyword-density-analyzer', 'keyword-cloud-density',
  'redirect-checker', 'schema-entity-relationship', 'visual-site-crawler',
  'social-analytics', 'sitemap-visualizer', 'json-ld-validator',
  'pwa-compatibility-checker', 'amp-validator',
]);

async function analyzeSeo(url, slug, options = {}) {
  if (!URL_ANALYZE_SLUGS.has(slug))
    throw Object.assign(new Error(`Unknown SEO analyze slug: ${slug}`), { code: 400 });

  // json-ld-validator and amp-validator can also accept pasted text
  const { text } = options;
  if (!url && !text)
    throw Object.assign(new Error('Please provide a URL or input text.'), { code: 400 });

  if (url) await validatePublicUrl(url);

  switch (slug) {
    case 'seo-analyzer':              return analyzeSeoPage(url);
    case 'keyword-density-analyzer':  return analyzeKeywords(url, text);
    case 'keyword-cloud-density':     return keywordCloud(url, text);
    case 'redirect-checker':          return checkRedirects(url);
    case 'schema-entity-relationship':return extractSchemaGraph(url);
    case 'visual-site-crawler':       return crawlSite(url, options.maxPages || 15);
    case 'social-analytics':          return analyzeSocialMeta(url);
    case 'sitemap-visualizer':        return visualizeSitemap(url);
    case 'json-ld-validator':         return validateJsonLd(url, text);
    case 'pwa-compatibility-checker': return checkPwa(url);
    case 'amp-validator':             return validateAmp(url, text);
    default: throw new Error('Unknown slug');
  }
}

const SEO_GENERATOR_SLUGS = new Set([
  'schema-json-ld-generator', 'hreflang-tag-generator', 'canonical-url-generator',
  'pwa-manifest-generator', 'json-ld-to-microdata', 'seo-tags-generator',
  'twitter-card-generator', 'privacy-policy-generator', 'terms-of-service-generator',
  'robots-txt-generator', 'htaccess-redirect-generator', 'serp-simulator',
]);

function generateSeoOutput(slug, fields = {}) {
  if (!SEO_GENERATOR_SLUGS.has(slug))
    throw Object.assign(new Error(`Unknown SEO generator slug: ${slug}`), { code: 400 });

  switch (slug) {
    case 'schema-json-ld-generator':    return genSchemaJsonLd(fields);
    case 'hreflang-tag-generator':      return genHreflangTags(fields);
    case 'canonical-url-generator':     return genCanonicalUrl(fields);
    case 'pwa-manifest-generator':      return genPwaManifest(fields);
    case 'json-ld-to-microdata':        return genJsonLdToMicrodata(fields);
    case 'seo-tags-generator':          return genSeoTags(fields);
    case 'twitter-card-generator':      return genTwitterCard(fields);
    case 'privacy-policy-generator':    return genPrivacyPolicy(fields);
    case 'terms-of-service-generator':  return genTermsOfService(fields);
    case 'robots-txt-generator':        return genRobotsTxt(fields);
    case 'htaccess-redirect-generator': return genHtaccessRedirects(fields);
    case 'serp-simulator':              return serpData(fields);
    default: throw new Error('Unknown slug');
  }
}

module.exports = { analyzeSeo, generateSeoOutput, URL_ANALYZE_SLUGS, SEO_GENERATOR_SLUGS };
