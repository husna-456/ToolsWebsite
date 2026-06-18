import { useEffect, useState, useCallback } from 'react';
import { Loader2, AlertCircle, Settings, X, CheckCircle, ChevronDown, ChevronRight } from 'lucide-react';
import api from '@/services/api';

const CATEGORY_LABELS = {
  'ai-writing':   'AI Writing',
  'text-tools':   'Text Tools',
  'image-tools':  'Image Tools',
  'media-tools':  'Media Tools',
  'productivity': 'Productivity',
  'seo-tools':    'SEO Tools',
};

const INPUT    = 'w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-[var(--admin-brand)] focus:bg-white transition';
const TEXTAREA = `${INPUT} resize-none`;
const LABEL    = 'block text-sm font-medium text-gray-700 mb-1';
const SECTION  = 'text-[10px] font-bold tracking-widest uppercase text-gray-400 mb-3 mt-1';

function SectionHeading({ children }) {
  return <p className={SECTION}>{children}</p>;
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className={LABEL}>{label}</label>
      {children}
      {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <div
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${checked ? 'bg-[var(--admin-brand)]' : 'bg-gray-200'}`}
      >
        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </div>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

function emptyForm(tool) {
  const rs = tool.runtimeSettings || {};
  return {
    title:          tool.title          ?? '',
    shortDesc:      tool.shortDesc      ?? '',
    longDesc:       tool.longDesc       ?? '',
    icon:           tool.icon           ?? '',
    category:       tool.category       ?? '',
    isActive:       tool.isActive       ?? true,
    isPremium:      tool.isPremium      ?? false,
    seoTitle:       tool.seoTitle       ?? '',
    seoDescription: tool.seoDescription ?? '',
    seoKeywords:    tool.seoKeywords    ?? '',
    maxFileSizeMb:    rs.maxFileSizeMb    ?? '',
    defaultQuality:   rs.defaultQuality   ?? '',
    aiModel:          rs.aiModel          ?? '',
    rateLimitPerMin:  rs.rateLimitPerMin  ?? '',
    cacheTtlSeconds:  rs.cacheTtlSeconds  ?? '',
    costPerUse:       rs.costPerUse       ?? '',
  };
}

// ── Settings Modal ────────────────────────────────────────────────────────────
function ToolSettingsModal({ tool, onClose, onSaved }) {
  const [form,    setForm]    = useState(() => emptyForm(tool));
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      const runtimeSettings = {};
      if (form.maxFileSizeMb   !== '') runtimeSettings.maxFileSizeMb   = Number(form.maxFileSizeMb);
      if (form.defaultQuality  !== '') runtimeSettings.defaultQuality  = Number(form.defaultQuality);
      if (form.aiModel.trim()  !== '') runtimeSettings.aiModel         = form.aiModel.trim();
      if (form.rateLimitPerMin !== '') runtimeSettings.rateLimitPerMin = Number(form.rateLimitPerMin);
      if (form.cacheTtlSeconds !== '') runtimeSettings.cacheTtlSeconds = Number(form.cacheTtlSeconds);
      if (form.costPerUse      !== '') runtimeSettings.costPerUse      = Number(form.costPerUse);

      const payload = {
        title:          form.title.trim(),
        shortDesc:      form.shortDesc.trim(),
        longDesc:       form.longDesc.trim(),
        icon:           form.icon.trim(),
        category:       form.category,
        isActive:       form.isActive,
        isPremium:      form.isPremium,
        seoTitle:       form.seoTitle.trim(),
        seoDescription: form.seoDescription.trim(),
        seoKeywords:    form.seoKeywords.trim(),
        runtimeSettings,
      };

      const data = await api.put(`/admin/web-tools-settings/${tool.slug}`, payload);
      setSuccess(true);
      onSaved(data.tool);
      setTimeout(() => { setSuccess(false); onClose(); }, 900);
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-gray-200 shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{tool.title} Settings</h2>
            <p className="text-sm text-gray-500 mt-0.5">Tool-specific overrides</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* ── Tool Info ── */}
          <div>
            <SectionHeading>Tool Info</SectionHeading>
            <div className="space-y-4">
              <Field label="Tool Name">
                <input className={INPUT} type="text" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. AI Summarizer" />
              </Field>

              <Field label="Tool Slug" hint="Read-only — manage slugs in Tool Slugs page">
                <input className={`${INPUT} opacity-60 cursor-not-allowed`} type="text" value={tool.slug} readOnly />
              </Field>

              <Field label="Short Description" hint="Shown on tool card — max 120 chars">
                <textarea className={TEXTAREA} rows={2} value={form.shortDesc} onChange={e => set('shortDesc', e.target.value)} placeholder="Brief one-line description..." />
              </Field>

              <Field label="Long Description" hint="Shown on tool page — max 500 chars">
                <textarea className={TEXTAREA} rows={3} value={form.longDesc} onChange={e => set('longDesc', e.target.value)} placeholder="Detailed description..." />
              </Field>

              <Field label="Category">
                <select className={INPUT} value={form.category} onChange={e => set('category', e.target.value)}>
                  {Object.entries(CATEGORY_LABELS).map(([v, l]) => (
                    <option key={v} value={v}>{l}</option>
                  ))}
                </select>
              </Field>

              <Field label="Tool Icon" hint="Lucide icon name (e.g. Wrench) or image URL">
                <input className={INPUT} type="text" value={form.icon} onChange={e => set('icon', e.target.value)} placeholder="Wrench" />
              </Field>

              <div className="space-y-3 pt-1">
                <Toggle label="Active — visible on frontend" checked={form.isActive} onChange={v => set('isActive', v)} />
                <Toggle label="Pro Only — lock behind subscription" checked={form.isPremium} onChange={v => set('isPremium', v)} />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* ── SEO ── */}
          <div>
            <SectionHeading>SEO</SectionHeading>
            <div className="space-y-4">
              <Field label="Meta Title">
                <input className={INPUT} type="text" value={form.seoTitle} onChange={e => set('seoTitle', e.target.value)} placeholder="e.g. Free AI Summarizer — ToolNova" />
              </Field>

              <Field label="Meta Description">
                <textarea className={TEXTAREA} rows={2} value={form.seoDescription} onChange={e => set('seoDescription', e.target.value)} placeholder="Short page description for search engines..." />
              </Field>

              <Field label="Meta Keywords" hint="Comma-separated: ai, summarizer, free tool">
                <input className={INPUT} type="text" value={form.seoKeywords} onChange={e => set('seoKeywords', e.target.value)} placeholder="ai, summarizer, free tool" />
              </Field>
            </div>
          </div>

          <div className="border-t border-gray-100" />

          {/* ── Technical Settings ── */}
          <div>
            <SectionHeading>Technical Settings</SectionHeading>
            <p className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 leading-relaxed mb-4">
              Leave any field blank to inherit the global default.
            </p>
            <div className="space-y-4">
              <Field label="Max File Size (MB)" hint="Leave blank to use global default">
                <input className={INPUT} type="number" min={1} placeholder="— global default —" value={form.maxFileSizeMb} onChange={e => set('maxFileSizeMb', e.target.value)} />
              </Field>

              <Field label="Default Quality (0–100)" hint="For image compression tools">
                <input className={INPUT} type="number" min={0} max={100} placeholder="— global default —" value={form.defaultQuality} onChange={e => set('defaultQuality', e.target.value)} />
              </Field>

              <Field label="AI Model Override" hint="e.g. llama-3.3-70b-versatile">
                <input className={INPUT} type="text" placeholder="— global default —" value={form.aiModel} onChange={e => set('aiModel', e.target.value)} />
              </Field>

              <Field label="Rate Limit / Min" hint="Requests per IP per minute">
                <input className={INPUT} type="number" min={1} placeholder="— global default —" value={form.rateLimitPerMin} onChange={e => set('rateLimitPerMin', e.target.value)} />
              </Field>

              <Field label="Cache TTL (seconds)" hint="How long to cache result for same input">
                <input className={INPUT} type="number" min={0} placeholder="— global default —" value={form.cacheTtlSeconds} onChange={e => set('cacheTtlSeconds', e.target.value)} />
              </Field>

              <Field label="Cost Per Use (tokens)" hint="Used for Pro plan accounting">
                <input className={INPUT} type="number" min={0} placeholder="— global default —" value={form.costPerUse} onChange={e => set('costPerUse', e.target.value)} />
              </Field>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex items-center justify-between gap-4">
          <div className="text-sm min-w-0">
            {error   && <span className="text-red-600 flex items-center gap-1.5 text-xs"><AlertCircle className="w-4 h-4 shrink-0" />{error}</span>}
            {success && <span className="text-[var(--admin-brand)] flex items-center gap-1.5 text-xs"><CheckCircle className="w-4 h-4 shrink-0" />Saved!</span>}
          </div>
          <div className="flex gap-2 shrink-0">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-[var(--admin-brand)] hover:bg-[color-mix(in_srgb,var(--admin-brand),black_15%)] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Category accordion ────────────────────────────────────────────────────────
function CategorySection({ category, tools, onSettings }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-gray-900">{CATEGORY_LABELS[category] || category}</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {tools.length} tool{tools.length !== 1 ? 's' : ''}
          </span>
        </div>
        {open ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-100 divide-y divide-gray-50">
          {tools.map(tool => {
            const rs = tool.runtimeSettings || {};
            const overrides = [
              rs.maxFileSizeMb   && `${rs.maxFileSizeMb} MB`,
              rs.rateLimitPerMin && `${rs.rateLimitPerMin}/min`,
              rs.aiModel         && rs.aiModel,
            ].filter(Boolean);

            return (
              <div key={tool._id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900">{tool.title}</p>
                    {overrides.length > 0 && (
                      <span className="text-[10px] font-semibold text-[var(--admin-brand)] bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full">
                        overrides active
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <p className="text-[11px] font-mono text-gray-400">{tool.slug}</p>
                    {overrides.map(o => (
                      <span key={o} className="text-[11px] text-gray-400">{o}</span>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => onSettings(tool)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[var(--admin-brand)] bg-blue-50 hover:bg-[var(--admin-brand)] hover:text-white border border-blue-200 hover:border-[var(--admin-brand)] rounded-lg transition-all duration-150 shrink-0"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Settings
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function AdminWebToolsSettings() {
  const [tools,     setTools]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [modalTool, setModalTool] = useState(null);

  useEffect(() => {
    api.get('/admin/web-tools-settings')
      .then(d => setTools(d.tools))
      .catch(e => setError(e.message || 'Failed to load tools.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSaved = useCallback((updated) => {
    setTools(ts => ts.map(t => t._id === updated._id ? updated : t));
  }, []);

  const grouped = tools.reduce((acc, t) => {
    const cat = t.category || 'other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(t);
    return acc;
  }, {});

  const ORDER = ['ai-writing', 'text-tools', 'image-tools', 'media-tools', 'productivity', 'seo-tools'];
  const sortedCats = [
    ...ORDER.filter(c => grouped[c]),
    ...Object.keys(grouped).filter(c => !ORDER.includes(c)),
  ];

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-[var(--admin-brand)] animate-spin" /></div>;

  if (error) return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 flex items-center gap-3 text-sm">
        <AlertCircle className="w-5 h-5 shrink-0" />{error}
      </div>
    </div>
  );

  return (
    <>
      {modalTool && (
        <ToolSettingsModal
          tool={modalTool}
          onClose={() => setModalTool(null)}
          onSaved={(u) => { handleSaved(u); }}
        />
      )}

      <div className="p-6 space-y-5">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">Web Tools Settings</h1>
          <p className="text-gray-500 text-sm mt-1">
            Per-tool runtime overrides — file size, AI model, rate limits, cache. Blank = global default.
          </p>
        </div>
        {sortedCats.map(cat => (
          <CategorySection key={cat} category={cat} tools={grouped[cat]} onSettings={setModalTool} />
        ))}
      </div>
    </>
  );
}
