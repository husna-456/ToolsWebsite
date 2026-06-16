import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, CheckCircle, Save } from 'lucide-react';
import api from '@/services/api';

const INPUT    = 'w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-[var(--admin-brand)] focus:bg-white transition';
const SELECT   = INPUT;

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-3 pt-2 pb-1">
      <div className="h-px flex-1 bg-gray-100" />
      <span className="text-[10px] font-bold tracking-[0.15em] text-[var(--admin-brand)] uppercase whitespace-nowrap">{children}</span>
      <div className="h-px flex-1 bg-gray-100" />
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange, disabled }) {
  return (
    <label className={`flex items-start justify-between gap-4 py-3 border-b border-gray-50 last:border-0 ${disabled ? 'opacity-40' : 'cursor-pointer group'}`}>
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <div className="relative shrink-0 mt-0.5" onClick={e => !disabled && e.stopPropagation()}>
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          disabled={disabled}
          onChange={e => !disabled && onChange(e.target.checked)}
        />
        <div
          onClick={() => !disabled && onChange(!checked)}
          className={`w-10 h-5 rounded-full transition-colors duration-200 cursor-pointer ${checked ? 'bg-[var(--admin-brand)]' : 'bg-gray-200'}`}
        />
        <div className={`pointer-events-none absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-5' : ''}`} />
      </div>
    </label>
  );
}

const DEFAULTS = {
  showHeader:         true,
  showHowTo:          true,
  showFaq:            true,
  showRelated:        true,
  showCards:          true,
  showProBanner:      false,
  showComments:       false,
  maxWidth:           '1200px',
  showCategoryBadge:  true,
  showUsageCount:     false,
  showLastUpdated:    false,
  autoScrollToResult: true,
  loadingStyle:       'spinner',
  defaultSortOrder:   'popular',
  seoTitleTemplate:       '{toolTitle} - Free Online Tool | {siteName}',
  seoDescriptionTemplate: '',
};

export default function AdminToolPageSettings() {
  const [form,    setForm]    = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.get('/admin/settings')
      .then(d => {
        if (d.settings?.toolPage) {
          setForm(prev => ({ ...prev, ...d.settings.toolPage }));
        }
      })
      .catch(e => setError(e.message || 'Failed to load settings.'))
      .finally(() => setLoading(false));
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      await api.put('/admin/settings/tool-page', form);
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
          <h1 className="text-2xl font-medium text-gray-900">Tool Page Settings</h1>
          <p className="text-gray-500 text-sm mt-1">Controls how every tool page renders — sections, layout, SEO templates.</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-[var(--admin-brand)] hover:bg-[color-mix(in_srgb,var(--admin-brand),black_15%)] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-60 shrink-0"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {error   && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3 flex items-center gap-2 text-sm"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
      {success && <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-xl px-5 py-3 flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 shrink-0" />Settings saved successfully.</div>}

      <div className="bg-white rounded-xl border border-gray-200 px-6 py-5 space-y-1">

        <SectionLabel>Page Sections</SectionLabel>
        <p className="text-xs text-gray-400 pb-2">Toggle which sections appear on every tool page.</p>

        <ToggleRow label="Tool Header"     hint="Icon, title, short description, category badge" checked={form.showHeader}    onChange={v => set('showHeader', v)} />
        <ToggleRow label="Tool Interface"  hint="Always on — cannot be hidden"                   checked={true}              onChange={() => {}} disabled />
        <ToggleRow label="How To Use"      hint="Numbered steps from tool data"                  checked={form.showHowTo}    onChange={v => set('showHowTo', v)} />
        <ToggleRow label="FAQ Accordion"   hint="Expand / collapse Q&A from tool data"           checked={form.showFaq}      onChange={v => set('showFaq', v)} />
        <ToggleRow label="Related Tools"   hint="3 cards from tool.relatedTools"                 checked={form.showRelated}  onChange={v => set('showRelated', v)} />
        <ToggleRow label="What/Who/When Cards" hint="3 info cards from tool data"                checked={form.showCards}    onChange={v => set('showCards', v)} />
        <ToggleRow label="Try Pro Banner"  hint="Phase 2 — no effect yet"                        checked={form.showProBanner} onChange={v => set('showProBanner', v)} />
        <ToggleRow label="Comments"        hint="Phase 2 — no effect yet"                        checked={form.showComments} onChange={v => set('showComments', v)} />

        <SectionLabel>Layout</SectionLabel>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Max Page Width</label>
            <input
              className={INPUT}
              placeholder="1200px"
              value={form.maxWidth}
              onChange={e => set('maxWidth', e.target.value)}
            />
            <p className="text-[11px] text-gray-400 mt-0.5">CSS value, e.g. 1200px or 80rem</p>
          </div>
        </div>

        <ToggleRow label="Show Category Badge"  hint="Colored badge below title"        checked={form.showCategoryBadge} onChange={v => set('showCategoryBadge', v)} />
        <ToggleRow label="Show Usage Count"     hint="e.g. '12,340 uses'"               checked={form.showUsageCount}   onChange={v => set('showUsageCount', v)} />
        <ToggleRow label="Show Last Updated"    hint="Date tool content was last saved"  checked={form.showLastUpdated}  onChange={v => set('showLastUpdated', v)} />

        <SectionLabel>Behavior</SectionLabel>

        <ToggleRow label="Auto-scroll to Result" hint="Scroll down after tool finishes processing" checked={form.autoScrollToResult} onChange={v => set('autoScrollToResult', v)} />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Loading Indicator Style</label>
            <select className={SELECT} value={form.loadingStyle} onChange={e => set('loadingStyle', e.target.value)}>
              <option value="spinner">Spinner (circular)</option>
              <option value="dots">Dots (pulsing)</option>
              <option value="bar">Progress bar</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Default Tool Sort Order</label>
            <select className={SELECT} value={form.defaultSortOrder} onChange={e => set('defaultSortOrder', e.target.value)}>
              <option value="popular">Most Popular</option>
              <option value="newest">Newest First</option>
              <option value="alphabetical">Alphabetical</option>
            </select>
          </div>
        </div>

        <SectionLabel>SEO Templates</SectionLabel>

        <div className="space-y-4 py-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SEO Title Template</label>
            <input
              className={INPUT}
              placeholder="{toolTitle} - Free Online Tool | {siteName}"
              value={form.seoTitleTemplate}
              onChange={e => set('seoTitleTemplate', e.target.value)}
            />
            <p className="text-[11px] text-gray-400 mt-1">Variables: <code className="bg-gray-100 px-1 rounded">{'{toolTitle}'}</code>, <code className="bg-gray-100 px-1 rounded">{'{siteName}'}</code>, <code className="bg-gray-100 px-1 rounded">{'{category}'}</code></p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">SEO Description Template</label>
            <textarea
              className={INPUT + ' resize-none'}
              rows={2}
              placeholder="Use {toolTitle} free online. {shortDesc}"
              value={form.seoDescriptionTemplate}
              onChange={e => set('seoDescriptionTemplate', e.target.value)}
            />
            <p className="text-[11px] text-gray-400 mt-1">Variables: <code className="bg-gray-100 px-1 rounded">{'{toolTitle}'}</code>, <code className="bg-gray-100 px-1 rounded">{'{shortDesc}'}</code>, <code className="bg-gray-100 px-1 rounded">{'{siteName}'}</code></p>
          </div>
        </div>

      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-0 bg-white/90 backdrop-blur-sm border-t border-gray-100 -mx-6 px-6 py-3 flex items-center justify-between">
        <div className="text-sm">
          {error   && <span className="text-red-600 flex items-center gap-1.5"><AlertCircle className="w-4 h-4 shrink-0" />{error}</span>}
          {success && <span className="text-[var(--admin-brand)] flex items-center gap-1.5"><CheckCircle className="w-4 h-4 shrink-0" />Saved!</span>}
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 bg-[var(--admin-brand)] hover:bg-[color-mix(in_srgb,var(--admin-brand),black_15%)] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
