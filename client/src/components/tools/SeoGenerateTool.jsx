import { useState } from 'react';
import { Code, Copy, Check, Loader2, AlertCircle, Wand2 } from 'lucide-react';
import api from '@/services/api';

const SLUG_FIELDS = {
  'schema-json-ld-generator': [
    {
      name: 'schemaType', label: 'Schema Type', type: 'select',
      options: ['Article', 'Product', 'FAQ', 'LocalBusiness', 'BreadcrumbList', 'Review', 'Event', 'Person', 'WebSite', 'HowTo'],
    },
    { name: 'name',        label: 'Name / Title',   type: 'text',     placeholder: 'My Business' },
    { name: 'url',         label: 'URL',             type: 'text',     placeholder: 'https://example.com' },
    { name: 'description', label: 'Description',     type: 'textarea', placeholder: 'Brief description…' },
  ],
  'hreflang-tag-generator': [
    { name: 'xDefault',  label: 'Default URL (x-default)',                    type: 'text',     placeholder: 'https://example.com/' },
    { name: 'urlsText',  label: 'Hreflang URLs (one per line: lang url)',      type: 'textarea', placeholder: 'en https://example.com/en/\nfr https://example.com/fr/' },
  ],
  'canonical-url-generator': [
    { name: 'baseUrl', label: 'Base URL', type: 'text', placeholder: 'https://example.com' },
    { name: 'path',    label: 'Path',     type: 'text', placeholder: '/blog/my-post' },
  ],
  'pwa-manifest-generator': [
    { name: 'name',       label: 'App Name',        type: 'text',     placeholder: 'My App' },
    { name: 'shortName',  label: 'Short Name',       type: 'text',     placeholder: 'App' },
    { name: 'themeColor', label: 'Theme Color',      type: 'color' },
    { name: 'bgColor',    label: 'Background Color', type: 'color' },
    { name: 'startUrl',   label: 'Start URL',        type: 'text',     placeholder: '/' },
    { name: 'display',    label: 'Display Mode',     type: 'select',   options: ['standalone', 'fullscreen', 'minimal-ui', 'browser'] },
  ],
  'json-ld-to-microdata': [
    { name: 'jsonLd', label: 'JSON-LD Code', type: 'textarea', placeholder: '{\n  "@context": "https://schema.org",\n  "@type": "Article"\n}' },
  ],
  'seo-tags-generator': [
    { name: 'title',       label: 'Page Title',                   type: 'text',     placeholder: 'My Page Title' },
    { name: 'description', label: 'Meta Description',             type: 'textarea', placeholder: 'Brief description of the page…' },
    { name: 'keywords',    label: 'Keywords (comma-separated)',   type: 'text',     placeholder: 'seo, tools, website' },
    { name: 'url',         label: 'Canonical URL',                type: 'text',     placeholder: 'https://example.com/page' },
    { name: 'author',      label: 'Author',                       type: 'text',     placeholder: 'John Doe' },
  ],
  'twitter-card-generator': [
    { name: 'title',       label: 'Title',           type: 'text',     placeholder: 'My Article Title' },
    { name: 'description', label: 'Description',     type: 'textarea', placeholder: 'Brief description…' },
    { name: 'imageUrl',    label: 'Image URL',       type: 'text',     placeholder: 'https://example.com/image.jpg' },
    { name: 'siteHandle',  label: 'Twitter Handle',  type: 'text',     placeholder: '@mysite' },
    { name: 'cardType',    label: 'Card Type',        type: 'select',   options: ['summary', 'summary_large_image', 'app', 'player'] },
  ],
  'privacy-policy-generator': [
    { name: 'companyName', label: 'Company Name',        type: 'text', placeholder: 'Acme Corp' },
    { name: 'website',     label: 'Website URL',         type: 'text', placeholder: 'https://example.com' },
    { name: 'email',       label: 'Contact Email',       type: 'text', placeholder: 'privacy@example.com' },
    { name: 'country',     label: 'Country / Jurisdiction', type: 'text', placeholder: 'United States' },
  ],
  'terms-of-service-generator': [
    { name: 'companyName', label: 'Company Name',    type: 'text', placeholder: 'Acme Corp' },
    { name: 'website',     label: 'Website URL',     type: 'text', placeholder: 'https://example.com' },
    { name: 'email',       label: 'Contact Email',   type: 'text', placeholder: 'legal@example.com' },
    { name: 'jurisdiction', label: 'Governing Law',  type: 'text', placeholder: 'California, USA' },
  ],
  'robots-txt-generator': [
    { name: 'sitemapUrl',     label: 'Sitemap URL',                         type: 'text',     placeholder: 'https://example.com/sitemap.xml' },
    { name: 'disallowRules',  label: 'Disallow Paths (one per line)',        type: 'textarea', placeholder: '/admin/\n/private/' },
    { name: 'crawlDelay',     label: 'Crawl Delay (seconds)',                type: 'text',     placeholder: '10' },
    { name: 'allowBots',      label: 'Allowed Bots (blank = all)',           type: 'text',     placeholder: 'Googlebot, Bingbot' },
  ],
  'htaccess-redirect-generator': [
    { name: 'redirectsText', label: 'Redirects (one per line: /old /new 301)', type: 'textarea', placeholder: '/old-page /new-page 301\n/another /destination 302' },
  ],
};

const COLOR_DEFAULTS = { themeColor: '#2563EB', bgColor: '#ffffff' };

function initValues(fields) {
  const obj = {};
  fields.forEach(f => {
    obj[f.name] = f.type === 'color'
      ? (COLOR_DEFAULTS[f.name] || '#2563EB')
      : f.type === 'select'
        ? (f.options?.[0] || '')
        : '';
  });
  return obj;
}

export default function SeoGenerateTool({ tool }) {
  const fields = SLUG_FIELDS[tool.slug] || [];
  const [values,  setValues]  = useState(() => initValues(fields));
  const [result,  setResult]  = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [copied,  setCopied]  = useState(false);

  const setValue = (name, val) => setValues(v => ({ ...v, [name]: val }));

  const handleGenerate = async () => {
    setLoading(true); setError(''); setResult('');
    try {
      const data = await api.post(`/tools/${tool.slug}/run`, { fields: values });
      setResult(data.result || '');
    } catch (err) {
      setError(err.message || 'Generation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="panel-card shadow-lg">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <Wand2 className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-semibold text-text-primary">{tool.title || 'SEO Generator'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">

        {/* LEFT: form fields */}
        <div className="p-5 space-y-4">
          {fields.map(field => (
            <div key={field.name}>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">
                {field.label}
              </label>

              {field.type === 'select' ? (
                <select
                  className="tool-input"
                  value={values[field.name]}
                  onChange={e => setValue(field.name, e.target.value)}
                >
                  {field.options.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              ) : field.type === 'textarea' ? (
                <textarea
                  className="tool-textarea"
                  style={{ minHeight: '100px' }}
                  placeholder={field.placeholder}
                  value={values[field.name]}
                  onChange={e => setValue(field.name, e.target.value)}
                />
              ) : field.type === 'color' ? (
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    className="w-10 h-10 rounded-lg border border-border cursor-pointer flex-shrink-0"
                    value={values[field.name]}
                    onChange={e => setValue(field.name, e.target.value)}
                  />
                  <input
                    type="text"
                    className="tool-input flex-1"
                    value={values[field.name]}
                    onChange={e => setValue(field.name, e.target.value)}
                    placeholder="#2563EB"
                  />
                </div>
              ) : (
                <input
                  type="text"
                  className="tool-input"
                  placeholder={field.placeholder}
                  value={values[field.name]}
                  onChange={e => setValue(field.name, e.target.value)}
                />
              )}
            </div>
          ))}

          <button
            onClick={handleGenerate}
            disabled={loading}
            className="btn-primary w-full h-12 text-[15px]"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" />Generating…</>
              : <><Wand2 className="w-4 h-4" />Generate</>
            }
          </button>
        </div>

        {/* RIGHT: output */}
        <div className="flex flex-col">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <Code className="w-4 h-4 text-text-muted" />
              <span className="text-sm font-semibold text-text-primary">Output</span>
            </div>
            {result && (
              <button onClick={handleCopy} className="btn-ghost">
                {copied
                  ? <><Check className="w-3.5 h-3.5 text-green-600" />Copied!</>
                  : <><Copy className="w-3.5 h-3.5" />Copy</>
                }
              </button>
            )}
          </div>

          <div className="flex-1 p-4" style={{ minHeight: '320px' }}>
            {!result && !loading && !error && (
              <div className="h-full flex flex-col items-center justify-center text-center py-16">
                <Wand2 className="w-10 h-10 text-text-muted/30 mb-3" />
                <p className="text-sm font-semibold text-text-secondary">Fill the form and click Generate</p>
                <p className="text-xs text-text-muted mt-1">Your code will appear here</p>
              </div>
            )}

            {loading && (
              <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {result && !loading && (
              <textarea
                readOnly
                value={result}
                className="tool-textarea bg-accent-subtle/25 border-accent/20 h-full font-mono text-xs"
                style={{ minHeight: '280px' }}
                aria-label="Generated output"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
