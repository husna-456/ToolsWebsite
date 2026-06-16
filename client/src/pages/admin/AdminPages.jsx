import { useEffect, useState, useCallback } from 'react';
import {
  Loader2, AlertCircle, Plus, Pencil, Trash2, CheckCircle, ChevronLeft, Globe,
} from 'lucide-react';
import api from '@/services/api';

const INPUT  = 'w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-[var(--admin-brand)] focus:bg-white transition';
const SELECT = INPUT;

function mdToHtml(md = '') {
  return md
    .replace(/^### (.+)$/gm, '<h3 style="font-size:1.1rem;font-weight:700;margin:1rem 0 .4rem">$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2 style="font-size:1.3rem;font-weight:700;margin:1.2rem 0 .5rem">$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1 style="font-size:1.6rem;font-weight:700;margin:1.5rem 0 .6rem">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/`(.+?)`/g,       '<code style="background:#f1f5f9;padding:1px 5px;border-radius:4px;font-family:monospace;font-size:.85em">$1</code>')
    .replace(/^> (.+)$/gm,     '<blockquote style="border-left:3px solid #3b82f6;padding-left:.75rem;color:#6b7280;margin:.5rem 0">$1</blockquote>')
    .replace(/^- (.+)$/gm,     '<li style="margin-left:1.2rem;list-style:disc">$1</li>')
    .replace(/\n{2,}/g,        '</p><p style="margin-bottom:.75rem">')
    .replace(/\n/g,            '<br>')
    .replace(/^/, '<p style="margin-bottom:.75rem">')
    .replace(/$/, '</p>');
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function emptyPage(p = {}) {
  return {
    title:          p.title          ?? '',
    slug:           p.slug           ?? '',
    body:           p.body           ?? '',
    seoTitle:       p.seoTitle       ?? '',
    seoDescription: p.seoDescription ?? '',
    status:         p.status         ?? 'published',
    showInFooter:   p.showInFooter   ?? false,
    showInNavbar:   p.showInNavbar   ?? false,
    order:          p.order          ?? 0,
  };
}

function MarkdownEditor({ value, onChange }) {
  const [tab, setTab] = useState('write');
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex border-b border-gray-200 bg-gray-50">
        {['write', 'preview'].map(t => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t ? 'bg-white text-[var(--admin-brand)] border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-800'
            }`}
          >{t}</button>
        ))}
      </div>
      {tab === 'write' ? (
        <textarea
          className="w-full px-4 py-3 text-sm font-mono text-gray-900 bg-white focus:outline-none leading-relaxed"
          rows={20}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Write page content in Markdown…"
        />
      ) : (
        <div
          className="px-4 py-3 text-sm text-gray-800 bg-white leading-relaxed"
          style={{ minHeight: 480 }}
          dangerouslySetInnerHTML={{ __html: mdToHtml(value) || '<span style="color:#9ca3af">Nothing to preview yet.</span>' }}
        />
      )}
    </div>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer">
      <div onClick={() => onChange(!checked)} className={`w-10 h-5 rounded-full transition-colors cursor-pointer ${checked ? 'bg-[var(--admin-brand)]' : 'bg-gray-200'}`}>
        <div className={`w-4 h-4 rounded-full bg-white shadow-sm m-0.5 transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </div>
      <span className="text-sm text-gray-700">{label}</span>
    </label>
  );
}

// ── Page Editor ───────────────────────────────────────────────────────────────
function PageEditor({ page, onClose, onSaved }) {
  const isNew = !page._id;
  const [form,       setForm]       = useState(() => emptyPage(page));
  const [saving,     setSaving]     = useState(false);
  const [error,      setError]      = useState('');
  const [success,    setSuccess]    = useState(false);
  const [slugManual, setSlugManual] = useState(!isNew);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleTitleChange = (v) => {
    set('title', v);
    if (!slugManual) set('slug', slugify(v));
  };

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Title is required.'); return; }
    if (!form.slug.trim())  { setError('Slug is required.'); return; }
    setError('');
    setSaving(true);
    try {
      const data = isNew
        ? await api.post('/admin/pages', form)
        : await api.put(`/admin/pages/${page.slug}`, form);
      setSuccess(true);
      onSaved(data.page);
      setTimeout(() => { setSuccess(false); if (isNew) onClose(); }, 1000);
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <button onClick={onClose} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
        <ChevronLeft className="w-4 h-4" /> Back to Pages
      </button>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-medium text-gray-900">{isNew ? 'New Page' : 'Edit Page'}</h1>
        <div className="flex items-center gap-2">
          {error   && <span className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{error}</span>}
          {success && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />Saved!</span>}
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-[var(--admin-brand)] hover:bg-[color-mix(in_srgb,var(--admin-brand),black_15%)] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving…' : 'Save Page'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
              <input className={INPUT} placeholder="Page title…" value={form.title} onChange={e => handleTitleChange(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 shrink-0">/</span>
                <input
                  className={INPUT}
                  value={form.slug}
                  onChange={e => { set('slug', e.target.value.toLowerCase()); setSlugManual(true); }}
                />
              </div>
              <p className="text-[11px] text-gray-400 mt-0.5">Public URL: /{form.slug || 'slug'}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">Content (Markdown)</label>
            <MarkdownEditor value={form.body} onChange={v => set('body', v)} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <p className="text-sm font-semibold text-gray-700">SEO</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SEO Title</label>
              <input className={INPUT} placeholder="Leave blank to use page title" value={form.seoTitle} onChange={e => set('seoTitle', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SEO Description</label>
              <textarea className={INPUT + ' resize-none'} rows={2} maxLength={160} value={form.seoDescription} onChange={e => set('seoDescription', e.target.value)} />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <p className="text-sm font-semibold text-gray-700">Settings</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select className={SELECT} value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
              <input className={INPUT} type="number" min={0} value={form.order} onChange={e => set('order', Number(e.target.value))} />
            </div>
            <div className="space-y-3 pt-1">
              <Toggle checked={form.showInFooter} onChange={v => set('showInFooter', v)} label="Show in Footer" />
              <Toggle checked={form.showInNavbar} onChange={v => set('showInNavbar', v)} label="Show in Navbar" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page List ─────────────────────────────────────────────────────────────────
function PageList({ pages, loading, onNew, onEdit, onDelete }) {
  const [deleting, setDeleting] = useState(null);

  const handleDelete = async (page) => {
    if (!window.confirm(`Delete "${page.title}"?`)) return;
    setDeleting(page._id);
    try { await onDelete(page.slug); } finally { setDeleting(null); }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">Pages</h1>
          <p className="text-gray-500 text-sm mt-1">Static content pages — About, Privacy, Terms, etc.</p>
        </div>
        <button onClick={onNew} className="flex items-center gap-2 px-4 py-2.5 bg-[var(--admin-brand)] hover:bg-[color-mix(in_srgb,var(--admin-brand),black_15%)] text-white text-sm font-medium rounded-xl transition-colors">
          <Plus className="w-4 h-4" /> New Page
        </button>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="w-7 h-7 text-[var(--admin-brand)] animate-spin" /></div>
        ) : pages.length === 0 ? (
          <div className="py-16 text-center">
            <Globe className="w-8 h-8 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No pages yet.</p>
            <button onClick={onNew} className="mt-3 text-sm text-[var(--admin-brand)] hover:underline">Create your first page</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Navigation</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Order</th>
                <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pages.map(page => (
                <tr key={page._id} className="hover:bg-gray-50/60 transition-colors group">
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900 group-hover:text-[var(--admin-brand)] transition-colors">{page.title}</p>
                    <p className="text-[11px] font-mono text-gray-400 mt-0.5">/{page.slug}</p>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                      page.status === 'published' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-100 text-gray-600 border-gray-200'
                    }`}>
                      {page.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-2 text-[11px] text-gray-500">
                      {page.showInNavbar && <span className="bg-blue-50 text-[var(--admin-brand)] border border-blue-100 px-1.5 py-0.5 rounded-full">Navbar</span>}
                      {page.showInFooter && <span className="bg-gray-100 text-gray-600 border border-gray-200 px-1.5 py-0.5 rounded-full">Footer</span>}
                      {!page.showInNavbar && !page.showInFooter && <span className="text-gray-300">—</span>}
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 text-sm">{page.order}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button onClick={() => onEdit(page)} className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(page)}
                        disabled={deleting === page._id}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40"
                      >
                        {deleting === page._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function AdminPages() {
  const [pages,    setPages]    = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [editPage, setEditPage] = useState(null);
  const [isNew,    setIsNew]    = useState(false);

  useEffect(() => {
    api.get('/admin/pages')
      .then(d => setPages(d.pages))
      .catch(e => setError(e.message || 'Failed to load pages.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSaved = useCallback((saved) => {
    setPages(ps => {
      const idx = ps.findIndex(p => p._id === saved._id);
      if (idx >= 0) { const next = [...ps]; next[idx] = saved; return next; }
      return [...ps, saved];
    });
  }, []);

  const handleDelete = useCallback(async (slug) => {
    await api.delete(`/admin/pages/${slug}`);
    setPages(ps => ps.filter(p => p.slug !== slug));
  }, []);

  if (error) return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 flex items-center gap-3 text-sm">
        <AlertCircle className="w-5 h-5 shrink-0" />{error}
      </div>
    </div>
  );

  if (editPage || isNew) {
    return (
      <PageEditor
        page={editPage || {}}
        onClose={() => { setEditPage(null); setIsNew(false); }}
        onSaved={(saved) => { handleSaved(saved); if (editPage) setEditPage(saved); }}
      />
    );
  }

  return (
    <PageList
      pages={pages}
      loading={loading}
      onNew={() => { setEditPage(null); setIsNew(true); }}
      onEdit={setEditPage}
      onDelete={handleDelete}
    />
  );
}
