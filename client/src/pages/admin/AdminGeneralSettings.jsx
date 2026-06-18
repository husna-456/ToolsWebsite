import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, CheckCircle, Save, Plus, Trash2 } from 'lucide-react';
import api from '@/services/api';

const INPUT    = 'w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-[var(--admin-brand)] focus:bg-white transition';
const TEXTAREA = INPUT + ' resize-none';

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-3 pt-4 pb-1">
      <div className="h-px flex-1 bg-gray-100" />
      <span className="text-[10px] font-bold tracking-[0.15em] text-[var(--admin-brand)] uppercase whitespace-nowrap">{children}</span>
      <div className="h-px flex-1 bg-gray-100" />
    </div>
  );
}

const BRAND_DEFAULTS = { brand: '#2563EB', gradientFrom: '#2563EB', gradientTo: '#3B82F6' };

function parseBrandColors(css) {
  if (!css) return BRAND_DEFAULTS;
  const rootMatch = css.match(/:root\s*\{([^}]*)\}/);
  if (!rootMatch) return BRAND_DEFAULTS;
  const block = rootMatch[1];
  const get = (prop) => {
    const m = block.match(new RegExp(prop.replace(/-/g, '\\-') + '\\s*:\\s*(#[0-9a-fA-F]{3,8})'));
    return m?.[1] ?? null;
  };
  return {
    brand:        get('--brand')                || BRAND_DEFAULTS.brand,
    gradientFrom: get('--brand-gradient-from') || BRAND_DEFAULTS.gradientFrom,
    gradientTo:   get('--brand-gradient-to')   || BRAND_DEFAULTS.gradientTo,
  };
}

function injectRootBlock(existingCss, colors) {
  const block = `:root {\n  --brand: ${colors.brand};\n  --brand-gradient-from: ${colors.gradientFrom};\n  --brand-gradient-to: ${colors.gradientTo};\n}`;
  const rest = (existingCss || '').replace(/:root\s*\{[^}]*\}\s*\n?/g, '').trim();
  return rest ? `${block}\n${rest}` : block;
}

const DEFAULTS = {
  siteName:          'ToolNova',
  siteDescription:   '',
  keywords:          '',
  footerAttribution: '© ToolNova. All Rights Reserved.',
  logo:              '',
  contrastingLogo:   '',
  favicon:           '',
  ogImage:           '',
  googleAnalyticsId: '',
  customCss:         '',
  customHeaderTags:  '',
  customBodyTags:    '',
};

export default function AdminGeneralSettings() {
  const [form,    setForm]    = useState(DEFAULTS);
  const [links,   setLinks]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.get('/admin/settings')
      .then(d => {
        if (d.settings?.general) {
          const { links: l, customStylesheets, customScripts, ...rest } = d.settings.general;
          setForm(prev => ({ ...prev, ...rest }));
          setLinks(l || []);
        }
      })
      .catch(e => setError(e.message || 'Failed to load settings.'))
      .finally(() => setLoading(false));
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const brandColors = parseBrandColors(form.customCss);
  const setBrandColor = (key, value) => set('customCss', injectRootBlock(form.customCss, { ...brandColors, [key]: value }));

  const addLink    = () => setLinks(ls => [...ls, { label: '', url: '', position: 'footer' }]);
  const removeLink = i  => setLinks(ls => ls.filter((_, idx) => idx !== i));
  const setLink    = (i, k, v) => setLinks(ls => ls.map((l, idx) => idx === i ? { ...l, [k]: v } : l));

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      await api.put('/admin/settings/general', { ...form, links });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-[var(--admin-brand)] animate-spin" /></div>;

  return (
    <div className="p-6 space-y-5">

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">General Settings</h1>
          <p className="text-gray-500 text-sm mt-1">Site identity, branding, analytics, and custom code.</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-[var(--admin-brand)] hover:bg-[color-mix(in_srgb,var(--admin-brand),black_15%)] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-60 shrink-0">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {error   && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3 flex items-center gap-2 text-sm"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
      {success && <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-xl px-5 py-3 flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 shrink-0" />Settings saved.</div>}

      <div className="bg-white rounded-xl border border-gray-200 px-6 py-5 space-y-4">

        <SectionLabel>Site Identity</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Site Name</label>
            <input className={INPUT} value={form.siteName} onChange={e => set('siteName', e.target.value)} placeholder="ToolNova" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Footer Attribution</label>
            <input className={INPUT} value={form.footerAttribution} onChange={e => set('footerAttribution', e.target.value)} placeholder="© ToolNova. All Rights Reserved." />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Site Description</label>
          <textarea className={TEXTAREA} rows={2} value={form.siteDescription} onChange={e => set('siteDescription', e.target.value)} placeholder="Short description shown in search results and social cards" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Keywords</label>
          <input className={INPUT} value={form.keywords} onChange={e => set('keywords', e.target.value)} placeholder="online tools, free utilities, …" />
          <p className="text-[11px] text-gray-400 mt-0.5">Comma-separated</p>
        </div>

        <SectionLabel>Branding & Images</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
            <input className={INPUT} value={form.logo} onChange={e => set('logo', e.target.value)} placeholder="/images/logo.svg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contrasting Logo URL</label>
            <input className={INPUT} value={form.contrastingLogo} onChange={e => set('contrastingLogo', e.target.value)} placeholder="/images/logo-white.svg" />
            <p className="text-[11px] text-gray-400 mt-0.5">Used on dark backgrounds</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Favicon URL</label>
            <input className={INPUT} value={form.favicon} onChange={e => set('favicon', e.target.value)} placeholder="/favicon.ico" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default OG Image URL</label>
            <input className={INPUT} value={form.ogImage} onChange={e => set('ogImage', e.target.value)} placeholder="/images/og-default.png" />
            <p className="text-[11px] text-gray-400 mt-0.5">Social share image, 1200×630</p>
          </div>
        </div>

        <SectionLabel>Nav & Footer Links</SectionLabel>
        <div className="space-y-2">
          {links.length === 0 && (
            <p className="text-xs text-gray-400 py-1">No links yet. Add one below.</p>
          )}
          {links.map((link, i) => (
            <div key={i} className="flex items-center gap-2">
              <input className={INPUT} value={link.label} onChange={e => setLink(i, 'label', e.target.value)} placeholder="Label" />
              <input className={INPUT} value={link.url}   onChange={e => setLink(i, 'url',   e.target.value)} placeholder="https://…" />
              <select
                className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-[var(--admin-brand)] transition shrink-0"
                value={link.position}
                onChange={e => setLink(i, 'position', e.target.value)}
              >
                <option value="footer">Footer</option>
                <option value="header">Header</option>
                <option value="both">Both</option>
              </select>
              <button onClick={() => removeLink(i)} className="p-2 text-gray-300 hover:text-red-500 transition-colors shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          <button onClick={addLink} className="flex items-center gap-1.5 text-xs text-[var(--admin-brand)] hover:text-blue-800 font-medium transition-colors mt-1">
            <Plus className="w-3.5 h-3.5" /> Add Link
          </button>
        </div>

        <SectionLabel>Analytics</SectionLabel>
        <div className="max-w-xs">
          <label className="block text-sm font-medium text-gray-700 mb-1">Google Analytics ID</label>
          <input className={INPUT} value={form.googleAnalyticsId} onChange={e => set('googleAnalyticsId', e.target.value)} placeholder="G-XXXXXXXXXX" />
        </div>

        <SectionLabel>Brand Colors</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Brand Color',   key: 'brand',        value: brandColors.brand },
            { label: 'Gradient From', key: 'gradientFrom', value: brandColors.gradientFrom },
            { label: 'Gradient To',   key: 'gradientTo',   value: brandColors.gradientTo },
          ].map(({ label, key, value }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={value}
                  onChange={e => setBrandColor(key, e.target.value)}
                  className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5 bg-gray-50"
                />
                <span className="text-xs font-mono text-gray-500">{value}</span>
              </div>
            </div>
          ))}
        </div>

        <SectionLabel>Custom Code</SectionLabel>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Custom CSS</label>
            <textarea className={`${TEXTAREA} font-mono text-xs`} rows={5} value={form.customCss} onChange={e => set('customCss', e.target.value)} placeholder=":root { --brand: #7c3aed; }" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Custom &lt;head&gt; Tags</label>
            <textarea className={`${TEXTAREA} font-mono text-xs`} rows={3} value={form.customHeaderTags} onChange={e => set('customHeaderTags', e.target.value)} placeholder={'<meta name="theme-color" content="#fff">'} />
            <p className="text-[11px] text-gray-400 mt-0.5">Injected inside &lt;head&gt;</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Custom &lt;body&gt; Tags</label>
            <textarea className={`${TEXTAREA} font-mono text-xs`} rows={3} value={form.customBodyTags} onChange={e => set('customBodyTags', e.target.value)} placeholder={'<script src="…"></script>'} />
            <p className="text-[11px] text-gray-400 mt-0.5">Injected before &lt;/body&gt;</p>
          </div>
        </div>

      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-0 bg-white/90 backdrop-blur-sm border-t border-gray-100 -mx-6 px-6 py-3 flex items-center justify-between">
        <div className="text-sm">
          {error   && <span className="text-red-600 flex items-center gap-1.5"><AlertCircle className="w-4 h-4 shrink-0" />{error}</span>}
          {success && <span className="text-[var(--admin-brand)] flex items-center gap-1.5"><CheckCircle className="w-4 h-4 shrink-0" />Saved!</span>}
        </div>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-[var(--admin-brand)] hover:bg-[color-mix(in_srgb,var(--admin-brand),black_15%)] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
