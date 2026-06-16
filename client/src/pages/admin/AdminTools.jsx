import { useEffect, useState, useCallback } from 'react';
import {
  Pencil, ToggleLeft, ToggleRight, Loader2, AlertCircle,
  Plus, Trash2, CheckCircle, Search, X,
} from 'lucide-react';
import api from '@/services/api';

// ── Constants ────────────────────────────────────────────────
const CATEGORIES = [
  { value: 'ai-writing',   label: 'AI Writing' },
  { value: 'text-tools',   label: 'Text Tools' },
  { value: 'image-tools',  label: 'Image Tools' },
  { value: 'media-tools',  label: 'Media Tools' },
  { value: 'productivity', label: 'Productivity' },
  { value: 'seo-tools',    label: 'SEO Tools' },
];

const CATEGORY_LABEL = Object.fromEntries(CATEGORIES.map(c => [c.value, c.label]));

const CAT_STYLE = {
  'ai-writing':   'bg-blue-50  text-blue-700  border-blue-200',
  'text-tools':   'bg-blue-50    text-blue-700    border-blue-200',
  'image-tools':  'bg-blue-50  text-blue-700  border-blue-200',
  'media-tools':  'bg-orange-50  text-orange-700  border-orange-200',
  'productivity': 'bg-pink-50    text-pink-700    border-pink-200',
  'seo-tools':    'bg-blue-50    text-blue-700    border-blue-200',
};

const INPUT    = 'w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-900 text-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:border-[var(--admin-brand)] focus:bg-white transition';
const TEXTAREA = INPUT + ' resize-none';

// ── Helpers ──────────────────────────────────────────────────
function emptyForm(tool = {}) {
  return {
    title:          tool.title          ?? '',
    shortDesc:      tool.shortDesc      ?? '',
    longDesc:       tool.longDesc       ?? '',
    icon:           tool.icon           ?? '',
    category:       tool.category       ?? 'ai-writing',
    subcategory:    tool.subcategory    ?? '',
    tags:           (tool.tags          ?? []).join(', '),
    isActive:       tool.isActive       ?? true,
    isFree:         tool.isFree         ?? true,
    isPremium:      tool.isPremium      ?? false,
    order:          tool.order          ?? 0,
    seoTitle:       tool.seoTitle       ?? '',
    seoDescription: tool.seoDescription ?? '',
    seoKeywords:    tool.seoKeywords    ?? '',
    howToUse:       tool.howToUse       ? [...tool.howToUse] : [],
    faqs:           tool.faqs           ? tool.faqs.map(f => ({ question: f.question || '', answer: f.answer || '' })) : [],
    relatedTools:   (tool.relatedTools  ?? []).join(', '),
    whatItDoes:     tool.whatItDoes     ?? '',
    whoShouldUse:   tool.whoShouldUse   ?? '',
    whenToUse:      tool.whenToUse      ?? '',
  };
}

function SectionHead({ title }) {
  return (
    <div className="flex items-center gap-3 pt-6 pb-3 first:pt-0">
      <div className="h-px flex-1 bg-slate-100" />
      <span className="text-[10px] font-bold tracking-[0.15em] text-[var(--admin-brand)] uppercase whitespace-nowrap">{title}</span>
      <div className="h-px flex-1 bg-slate-100" />
    </div>
  );
}

function Label({ children, hint }) {
  return (
    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
      {children}
      {hint && <span className="ml-1.5 text-slate-400 font-normal text-xs">({hint})</span>}
    </label>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer group select-none">
      <div className="relative">
        <input type="checkbox" className="sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
        <div className={`w-10 h-5 rounded-full transition-colors duration-200 ${checked ? 'bg-[var(--admin-brand)]' : 'bg-slate-200'}`} />
        <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-5' : ''}`} />
      </div>
      <span className="text-sm text-slate-700 group-hover:text-slate-900 transition-colors">{label}</span>
    </label>
  );
}

// ── Edit Modal ───────────────────────────────────────────────
function EditModal({ tool, onClose, onSaved }) {
  const [form,        setForm]        = useState(() => emptyForm(tool));
  const [saving,      setSaving]      = useState(false);
  const [saveError,   setSaveError]   = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const addStep    = ()        => set('howToUse', [...form.howToUse, '']);
  const updateStep = (i, v)    => set('howToUse', form.howToUse.map((s, idx) => idx === i ? v : s));
  const removeStep = (i)       => set('howToUse', form.howToUse.filter((_, idx) => idx !== i));

  const addFaq    = ()         => set('faqs', [...form.faqs, { question: '', answer: '' }]);
  const updateFaq = (i, k, v) => set('faqs', form.faqs.map((f, idx) => idx === i ? { ...f, [k]: v } : f));
  const removeFaq = (i)        => set('faqs', form.faqs.filter((_, idx) => idx !== i));

  const handleSave = async () => {
    setSaveError('');
    setSaveSuccess(false);
    setSaving(true);
    try {
      const payload = {
        ...form,
        order:        Number(form.order) || 0,
        tags:         form.tags.split(',').map(t => t.trim()).filter(Boolean),
        relatedTools: form.relatedTools.split(',').map(t => t.trim()).filter(Boolean),
        howToUse:     form.howToUse.filter(s => s.trim()),
        faqs:         form.faqs.filter(f => f.question.trim() && f.answer.trim()),
      };
      const data = await api.put(`/admin/tools/${tool._id}`, payload);
      setSaveSuccess(true);
      onSaved(data.tool);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err) {
      setSaveError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-8 px-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-2xl">

        {/* Modal header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white rounded-t-2xl z-10">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">Edit Tool</h2>
            <p className="text-[11px] text-slate-400 font-mono mt-0.5 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded inline-block">
              {tool.slug}
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal body */}
        <div className="px-6 py-5 space-y-4">

          <SectionHead title="Basic Info" />

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label>Title</Label>
              <input className={INPUT} value={form.title} onChange={e => set('title', e.target.value)} />
            </div>
            <div className="col-span-2">
              <Label hint="max 120 chars">Short Description</Label>
              <input className={INPUT} maxLength={120} value={form.shortDesc} onChange={e => set('shortDesc', e.target.value)} />
              <p className={`text-xs mt-1 text-right ${form.shortDesc.length > 100 ? 'text-amber-500' : 'text-slate-400'}`}>
                {form.shortDesc.length}/120
              </p>
            </div>
            <div className="col-span-2">
              <Label hint="max 500 chars">Long Description</Label>
              <textarea className={TEXTAREA} rows={3} maxLength={500} value={form.longDesc} onChange={e => set('longDesc', e.target.value)} />
            </div>
            <div>
              <Label hint="lucide icon name">Icon</Label>
              <input className={INPUT} placeholder="e.g. ImageDown" value={form.icon} onChange={e => set('icon', e.target.value)} />
            </div>
            <div>
              <Label>Display Order</Label>
              <input className={INPUT} type="number" min={0} value={form.order} onChange={e => set('order', e.target.value)} />
            </div>
            <div>
              <Label>Category</Label>
              <select className={INPUT} value={form.category} onChange={e => set('category', e.target.value)}>
                {CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div>
              <Label hint="optional">Subcategory</Label>
              <input className={INPUT} value={form.subcategory} onChange={e => set('subcategory', e.target.value)} />
            </div>
          </div>

          <SectionHead title="Status Flags" />

          <div className="flex gap-8 flex-wrap bg-slate-50 border border-slate-200 rounded-xl px-5 py-4">
            <Toggle key="isActive"  checked={form.isActive}  onChange={v => set('isActive', v)}  label="Active (visible to users)" />
            <Toggle key="isFree"    checked={form.isFree}    onChange={v => set('isFree', v)}    label="Free" />
            <Toggle key="isPremium" checked={form.isPremium} onChange={v => set('isPremium', v)} label="Premium" />
          </div>

          <SectionHead title="Content" />

          {/* How To Use */}
          <div>
            <Label>How To Use Steps</Label>
            <div className="space-y-2">
              {form.howToUse.map((step, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center shrink-0">
                    {i + 1}
                  </div>
                  <input
                    className={INPUT}
                    placeholder={`Step ${i + 1}`}
                    value={step}
                    onChange={e => updateStep(i, e.target.value)}
                  />
                  <button onClick={() => removeStep(i)} className="text-slate-300 hover:text-red-500 transition-colors shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <button onClick={addStep} className="mt-2.5 flex items-center gap-1.5 text-sm text-[var(--admin-brand)] hover:text-blue-700 font-semibold">
              <Plus className="w-4 h-4" /> Add Step
            </button>
          </div>

          {/* FAQs */}
          <div>
            <Label>FAQs</Label>
            <div className="space-y-3">
              {form.faqs.map((faq, i) => (
                <div key={i} className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold tracking-wider text-[var(--admin-brand)] uppercase">FAQ {i + 1}</span>
                    <button onClick={() => removeFaq(i)} className="text-slate-300 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <input
                    className={INPUT}
                    placeholder="Question"
                    value={faq.question}
                    onChange={e => updateFaq(i, 'question', e.target.value)}
                  />
                  <textarea
                    className={TEXTAREA}
                    rows={2}
                    placeholder="Answer"
                    value={faq.answer}
                    onChange={e => updateFaq(i, 'answer', e.target.value)}
                  />
                </div>
              ))}
            </div>
            <button onClick={addFaq} className="mt-2.5 flex items-center gap-1.5 text-sm text-[var(--admin-brand)] hover:text-blue-700 font-semibold">
              <Plus className="w-4 h-4" /> Add FAQ
            </button>
          </div>

          {/* What / Who / When */}
          {[
            { key: 'whatItDoes',   label: 'What It Does' },
            { key: 'whoShouldUse', label: 'Who Should Use It' },
            { key: 'whenToUse',    label: 'When To Use It' },
          ].map(({ key, label }) => (
            <div key={key}>
              <Label>{label}</Label>
              <textarea className={TEXTAREA} rows={2} value={form[key]} onChange={e => set(key, e.target.value)} />
            </div>
          ))}

          <SectionHead title="SEO & Discovery" />

          <div>
            <Label>SEO Title</Label>
            <input className={INPUT} value={form.seoTitle} onChange={e => set('seoTitle', e.target.value)} />
          </div>
          <div>
            <Label>SEO Description</Label>
            <textarea className={TEXTAREA} rows={2} value={form.seoDescription} onChange={e => set('seoDescription', e.target.value)} />
          </div>
          <div>
            <Label hint="comma-separated">SEO Keywords</Label>
            <input className={INPUT} value={form.seoKeywords} onChange={e => set('seoKeywords', e.target.value)} />
          </div>
          <div>
            <Label hint="comma-separated">Tags</Label>
            <input className={INPUT} placeholder="compress, image, optimize" value={form.tags} onChange={e => set('tags', e.target.value)} />
          </div>
          <div>
            <Label hint="comma-separated slugs">Related Tools</Label>
            <input className={INPUT} placeholder="image-resizer, image-converter" value={form.relatedTools} onChange={e => set('relatedTools', e.target.value)} />
          </div>

        </div>

        {/* Modal footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between gap-4 sticky bottom-0 bg-white rounded-b-2xl">
          <div className="flex-1 min-w-0">
            {saveError && (
              <p className="text-sm text-red-600 flex items-center gap-1.5 truncate">
                <AlertCircle className="w-4 h-4 shrink-0" />{saveError}
              </p>
            )}
            {saveSuccess && (
              <p className="text-sm text-[var(--admin-brand)] flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 shrink-0" />Saved successfully!
              </p>
            )}
          </div>
          <div className="flex gap-2.5 shrink-0">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 bg-[var(--admin-brand)] hover:bg-[color-mix(in_srgb,var(--admin-brand),black_15%)] text-white text-sm font-semibold px-5 py-2 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
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

// ── Main Page ────────────────────────────────────────────────
export default function AdminTools() {
  const [tools,          setTools]          = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState('');
  const [editTool,       setEditTool]       = useState(null);
  const [toggling,       setToggling]       = useState(null);
  const [search,         setSearch]         = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  useEffect(() => {
    api.get('/admin/tools')
      .then(d => setTools(d.tools))
      .catch(e => setError(e.message || 'Failed to load tools.'))
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = useCallback(async (tool) => {
    setToggling(tool._id);
    try {
      const data = await api.patch(`/admin/tools/${tool._id}/toggle`);
      setTools(ts => ts.map(t => t._id === tool._id ? { ...t, isActive: data.isActive } : t));
    } catch {
      // silently ignore
    } finally {
      setToggling(null);
    }
  }, []);

  const handleSaved = useCallback((updated) => {
    setTools(ts => ts.map(t => t._id === updated._id ? updated : t));
  }, []);

  const filtered = tools.filter(t => {
    const matchSearch = !search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.slug.toLowerCase().includes(search.toLowerCase());
    const matchCat = categoryFilter === 'all' || t.category === categoryFilter;
    return matchSearch && matchCat;
  });

  const activeCount = tools.filter(t => t.isActive).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-[var(--admin-brand)] animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />{error}
        </div>
      </div>
    );
  }

  return (
    <>
      {editTool && (
        <EditModal
          tool={editTool}
          onClose={() => setEditTool(null)}
          onSaved={(updated) => { handleSaved(updated); }}
        />
      )}

      <div className="p-8 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tools Manager</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              {tools.length} total &middot; <span className="text-[var(--admin-brand)] font-medium">{activeCount} active</span>
              {' '}&middot; <span className="text-slate-400">{tools.length - activeCount} inactive</span>
            </p>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <input
              type="search"
              placeholder="Search tools…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition w-56 shadow-sm"
            />
          </div>
        </div>

        {/* ── Category filter pills ── */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setCategoryFilter('all')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${
              categoryFilter === 'all'
                ? 'bg-[var(--admin-brand)] text-white border-blue-600 shadow-sm'
                : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
            }`}
          >
            All ({tools.length})
          </button>
          {CATEGORIES.map(cat => {
            const count = tools.filter(t => t.category === cat.value).length;
            const active = categoryFilter === cat.value;
            return (
              <button
                key={cat.value}
                onClick={() => setCategoryFilter(cat.value)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all duration-150 ${
                  active
                    ? 'bg-[var(--admin-brand)] text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                {cat.label} ({count})
              </button>
            );
          })}
        </div>

        {/* ── Table ── */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left bg-slate-50/70">
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Tool</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider">Category</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Status</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Uses</th>
                  <th className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wider text-center">Edit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(tool => (
                  <tr key={tool._id} className="hover:bg-slate-50/60 transition-colors group">

                    <td className="px-5 py-3.5">
                      <p className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors">{tool.title}</p>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">{tool.slug}</p>
                    </td>

                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center text-[11px] font-bold px-2.5 py-1 rounded-full border ${CAT_STYLE[tool.category] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                        {CATEGORY_LABEL[tool.category] || tool.category}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-center">
                      <button
                        onClick={() => handleToggle(tool)}
                        disabled={toggling === tool._id}
                        className="inline-flex items-center gap-1.5 transition-all duration-150 disabled:opacity-50"
                        title={tool.isActive ? 'Click to deactivate' : 'Click to activate'}
                      >
                        {toggling === tool._id ? (
                          <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                        ) : tool.isActive ? (
                          <>
                            <ToggleRight className="w-6 h-6 text-[var(--admin-brand)]" />
                            <span className="text-xs font-semibold text-[var(--admin-brand)]">Active</span>
                          </>
                        ) : (
                          <>
                            <ToggleLeft className="w-6 h-6 text-slate-300" />
                            <span className="text-xs font-semibold text-slate-400">Off</span>
                          </>
                        )}
                      </button>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <span className="font-bold text-slate-700 tabular-nums">
                        {(tool.usageCount || 0).toLocaleString()}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-center">
                      <button
                        onClick={() => setEditTool(tool)}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--admin-brand)] hover:text-white bg-blue-50 hover:bg-[var(--admin-brand)] border border-blue-200 hover:border-[var(--admin-brand)] px-3 py-1.5 rounded-lg transition-all duration-150"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-14 text-center text-slate-400">
                      <Search className="w-8 h-8 mx-auto mb-3 text-slate-200" />
                      No tools match your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {filtered.length > 0 && (
            <div className="px-5 py-3 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Showing {filtered.length} of {tools.length} tools
              </p>
              {(search || categoryFilter !== 'all') && (
                <button
                  onClick={() => { setSearch(''); setCategoryFilter('all'); }}
                  className="text-xs font-medium text-[var(--admin-brand)] hover:text-blue-700 flex items-center gap-1"
                >
                  <X className="w-3 h-3" /> Clear filters
                </button>
              )}
            </div>
          )}
        </div>

      </div>
    </>
  );
}
