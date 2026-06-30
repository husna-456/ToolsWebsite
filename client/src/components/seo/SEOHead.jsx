import { Helmet } from 'react-helmet-async';

const BASE_URL = 'https://globaltechtool.com';

export default function SEOHead({ tool, customTitle, customDesc }) {
  const title    = customTitle || tool?.seoTitle || tool?.metaTitle || 'Global Tech Tools — Free AI Tools';
  const desc     = customDesc  || tool?.seoDescription || tool?.metaDesc || 'Free AI tools for writers, students and creators.';
  const canonical = tool ? `${BASE_URL}/tools/${tool.slug}/` : `${BASE_URL}/`;

  // WebApplication schema
  const webAppSchema = tool ? {
    '@context':           'https://schema.org',
    '@type':              'WebApplication',
    name:                 tool.title,
    description:          tool.shortDesc,
    applicationCategory:  'UtilitiesApplication',
    operatingSystem:      'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    url:                  canonical,
  } : null;

  // FAQ schema
  const faqSchema = tool?.faqs?.length ? {
    '@context': 'https://schema.org',
    '@type':    'FAQPage',
    mainEntity: tool.faqs.map(faq => ({
      '@type':        'Question',
      name:           faq.question ?? faq.q,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer ?? faq.a },
    })),
  } : null;

  // HowTo schema — supports both howToUse (DB) and howTo (local TOOLS constant)
  const howToSteps = tool?.howToUse || tool?.howTo;
  const howToSchema = howToSteps?.length ? {
    '@context': 'https://schema.org',
    '@type':    'HowTo',
    name:       `How to use ${tool.title}`,
    step:       howToSteps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, text: s })),
  } : null;

  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description"         content={desc} />
      <link rel="canonical"            href={canonical} />
      <meta property="og:title"        content={title} />
      <meta property="og:description"  content={desc} />
      <meta property="og:url"          content={canonical} />
      <meta property="og:type"         content="website" />
      <meta name="twitter:card"        content="summary_large_image" />
      <meta name="twitter:title"       content={title} />
      <meta name="twitter:description" content={desc} />
      {webAppSchema && <script type="application/ld+json">{JSON.stringify(webAppSchema)}</script>}
      {faqSchema    && <script type="application/ld+json">{JSON.stringify(faqSchema)}</script>}
      {howToSchema  && <script type="application/ld+json">{JSON.stringify(howToSchema)}</script>}
    </Helmet>
  );
}
