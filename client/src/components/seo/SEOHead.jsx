import { Helmet } from 'react-helmet-async';
import { useLocation } from 'react-router-dom';
import { CATEGORIES } from '@/data/tools';

const BASE_URL = 'https://globaltechtool.com';
const OG_IMAGE = `${BASE_URL}/og-image.png`;

/**
 * SEOHead — per-page SEO, Open Graph, Twitter Card, and JSON-LD schemas.
 *
 * Props:
 *   tool            — tool object from TOOLS constant or DB; drives WebApp/FAQ/HowTo/Breadcrumb schemas
 *   customTitle     — override page <title>
 *   customDesc      — override meta description
 *   customCanonical — override canonical URL (auto-derived from URL path when omitted)
 *   robots          — robots meta value (default: 'index, follow')
 *   ogType          — og:type value (default: 'website'; pass 'article' for blog posts)
 */
export default function SEOHead({ tool, customTitle, customDesc, customCanonical, robots, ogType }) {
  const { pathname } = useLocation();

  const title      = customTitle || tool?.seoTitle || tool?.metaTitle || 'Global Tech Tools — Free AI Tools';
  const desc       = customDesc  || tool?.seoDescription || tool?.metaDesc || 'Free AI tools for writers, students and creators.';
  const robotsMeta = robots  || 'index, follow';
  const ogTypeMeta = ogType  || 'website';

  // Canonical: explicit prop → tool slug → current URL path (with trailing slash)
  // Using useLocation() ensures every page gets its own correct canonical
  // without callers needing to pass customCanonical manually.
  const pathWithSlash = pathname === '/' ? '/' : pathname.replace(/\/$/, '') + '/';
  const canonical = customCanonical
    || (tool ? `${BASE_URL}/tools/${tool.slug}/` : `${BASE_URL}${pathWithSlash}`);

  // ── JSON-LD: WebApplication (tool pages) ─────────────────────────────────
  const webAppSchema = tool ? {
    '@context':          'https://schema.org',
    '@type':             'WebApplication',
    name:                tool.title,
    description:         tool.shortDesc,
    applicationCategory: 'UtilitiesApplication',
    operatingSystem:     'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    url:                 canonical,
  } : null;

  // ── JSON-LD: FAQPage (tool pages with faqs) ───────────────────────────────
  const faqSchema = tool?.faqs?.length ? {
    '@context': 'https://schema.org',
    '@type':    'FAQPage',
    mainEntity: tool.faqs.map(faq => ({
      '@type':        'Question',
      name:           faq.question ?? faq.q,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer ?? faq.a },
    })),
  } : null;

  // ── JSON-LD: HowTo (tool pages with steps) ───────────────────────────────
  const howToSteps = tool?.howToUse || tool?.howTo;
  const howToSchema = howToSteps?.length ? {
    '@context': 'https://schema.org',
    '@type':    'HowTo',
    name:       `How to use ${tool.title}`,
    step:       howToSteps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, text: s })),
  } : null;

  // ── JSON-LD: BreadcrumbList (tool pages with a known category) ───────────
  const catLabel = tool?.category ? (CATEGORIES[tool.category]?.label || tool.category) : null;
  const breadcrumbSchema = tool?.category ? {
    '@context': 'https://schema.org',
    '@type':    'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home',      item: `${BASE_URL}/` },
      { '@type': 'ListItem', position: 2, name: catLabel,    item: `${BASE_URL}/category/${tool.category}/` },
      { '@type': 'ListItem', position: 3, name: tool.title,  item: canonical },
    ],
  } : null;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description"            content={desc} />
      <meta name="robots"                 content={robotsMeta} />
      <link rel="canonical"               href={canonical} />

      {/* Open Graph */}
      <meta property="og:type"            content={ogTypeMeta} />
      <meta property="og:site_name"       content="Global Tech Tools" />
      <meta property="og:locale"          content="en_US" />
      <meta property="og:title"           content={title} />
      <meta property="og:description"     content={desc} />
      <meta property="og:url"             content={canonical} />
      <meta property="og:image"           content={OG_IMAGE} />
      <meta property="og:image:width"     content="1200" />
      <meta property="og:image:height"    content="630" />
      <meta property="og:image:alt"       content="Global Tech Tools — Free AI Tools" />

      {/* Twitter Card */}
      <meta name="twitter:card"           content="summary_large_image" />
      <meta name="twitter:title"          content={title} />
      <meta name="twitter:description"    content={desc} />
      <meta name="twitter:image"          content={OG_IMAGE} />
      <meta name="twitter:image:alt"      content="Global Tech Tools — Free AI Tools" />

      {webAppSchema    && <script type="application/ld+json">{JSON.stringify(webAppSchema)}</script>}
      {faqSchema       && <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>}
      {howToSchema     && <script type="application/ld+json">{JSON.stringify(howToSchema)}</script>}
      {breadcrumbSchema && <script type="application/ld+json">{JSON.stringify(breadcrumbSchema)}</script>}
    </Helmet>
  );
}
