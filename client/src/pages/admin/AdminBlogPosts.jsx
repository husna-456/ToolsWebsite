import { useEffect, useState, useCallback } from 'react';
import {
  Loader2, AlertCircle, Plus, Pencil, Trash2, Search, X,
  Eye, EyeOff, CheckCircle, ChevronLeft, Star, Calendar,
} from 'lucide-react';
import api from '@/services/api';

// ── Tiny markdown → HTML preview ─────────────────────────────────────────────
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
    .replace(/^\d+\. (.+)$/gm, '<li style="margin-left:1.2rem;list-style:decimal">$1</li>')
    .replace(/\n{2,}/g,        '</p><p style="margin-bottom:.75rem">')
    .replace(/\n/g,            '<br>')
    .replace(/^/, '<p style="margin-bottom:.75rem">')
    .replace(/$/, '</p>');
}

// ── Shared field styles ───────────────────────────────────────────────────────
const INPUT    = 'w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-[var(--admin-brand)] focus:bg-white transition';
const TEXTAREA = INPUT + ' resize-none';
const SELECT   = INPUT;

const STATUS_STYLE = {
  published: 'bg-green-50 text-green-700 border-green-200',
  draft:     'bg-gray-100 text-gray-600 border-gray-200',
  scheduled: 'bg-amber-50 text-amber-700 border-amber-200',
};

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function emptyPost(p = {}) {
  return {
    title:          p.title          ?? '',
    slug:           p.slug           ?? '',
    excerpt:        p.excerpt        ?? '',
    body:           p.body           ?? '',
    category:       p.category       ?? '',
    tags:           (p.tags ?? []).join(', '),
    featured:       p.featured       ?? false,
    status:         p.status         ?? 'draft',
    publishDate:    p.publishDate    ? p.publishDate.slice(0, 16) : '',
    seoTitle:       p.seoTitle       ?? '',
    seoDescription: p.seoDescription ?? '',
    seoKeywords:    p.seoKeywords    ?? '',
    relatedTools:   (p.relatedTools  ?? []).join(', '),
  };
}

// ── Markdown Editor ───────────────────────────────────────────────────────────
function MarkdownEditor({ value, onChange, rows = 16 }) {
  const [tab, setTab] = useState('write');
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="flex border-b border-gray-200 bg-gray-50">
        {['write', 'preview'].map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'bg-white text-[var(--admin-brand)] border-b-2 border-blue-500'
                : 'text-gray-500 hover:text-gray-800'
            }`}
          >
            {t}
          </button>
        ))}
      </div>
      {tab === 'write' ? (
        <textarea
          className="w-full px-4 py-3 text-sm font-mono text-gray-900 bg-white focus:outline-none leading-relaxed"
          rows={rows}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Write your content in Markdown…"
        />
      ) : (
        <div
          className="px-4 py-3 text-sm text-gray-800 bg-white min-h-[200px] leading-relaxed"
          style={{ minHeight: rows * 24 + 'px' }}
          dangerouslySetInnerHTML={{ __html: mdToHtml(value) || '<span style="color:#9ca3af">Nothing to preview yet.</span>' }}
        />
      )}
    </div>
  );
}

// ── Post Editor (full-page form) ──────────────────────────────────────────────
function PostEditor({ post, onClose, onSaved }) {
  const isNew = !post._id;
  const [form,    setForm]    = useState(() => emptyPost(post));
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);
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
      const payload = {
        ...form,
        tags:         form.tags.split(',').map(t => t.trim()).filter(Boolean),
        relatedTools: form.relatedTools.split(',').map(t => t.trim()).filter(Boolean),
        publishDate:  form.publishDate || undefined,
      };
      const data = isNew
        ? await api.post('/admin/posts', payload)
        : await api.put(`/admin/posts/${post._id}`, payload);
      setSuccess(true);
      onSaved(data.post);
      setTimeout(() => { setSuccess(false); if (isNew) onClose(); }, 1000);
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      {/* Back + header */}
      <div className="flex items-center gap-3">
        <button onClick={onClose} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
          <ChevronLeft className="w-4 h-4" />{isNew ? 'Back to Posts' : 'Back'}
        </button>
      </div>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-medium text-gray-900">{isNew ? 'New Blog Post' : 'Edit Post'}</h1>
        <div className="flex items-center gap-2">
          {error   && <span className="text-xs text-red-600 flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" />{error}</span>}
          {success && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />Saved!</span>}
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:bg-gray-100 rounded-lg transition-colors">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2 bg-[var(--admin-brand)] hover:bg-[color-mix(in_srgb,var(--admin-brand),black_15%)] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {saving ? 'Saving…' : 'Save Post'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Main content — 2/3 */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title <span className="text-red-500">*</span></label>
              <input className={INPUT} placeholder="Post title…" value={form.title} onChange={e => handleTitleChange(e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 shrink-0">/blog/</span>
                <input
                  className={INPUT}
                  value={form.slug}
                  onChange={e => { set('slug', e.target.value.toLowerCase()); setSlugManual(true); }}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Excerpt <span className="text-gray-400 font-normal">(max 300 chars)</span></label>
              <textarea className={TEXTAREA} rows={2} maxLength={300} placeholder="Short summary shown in listings…" value={form.excerpt} onChange={e => set('excerpt', e.target.value)} />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">Body (Markdown)</label>
            <MarkdownEditor value={form.body} onChange={v => set('body', v)} rows={20} />
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <p className="text-sm font-semibold text-gray-700">SEO</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SEO Title</label>
              <input className={INPUT} placeholder="Leave blank to use post title" value={form.seoTitle} onChange={e => set('seoTitle', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SEO Description</label>
              <textarea className={TEXTAREA} rows={2} maxLength={160} placeholder="~160 chars" value={form.seoDescription} onChange={e => set('seoDescription', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">SEO Keywords <span className="text-gray-400 font-normal">(comma-separated)</span></label>
              <input className={INPUT} value={form.seoKeywords} onChange={e => set('seoKeywords', e.target.value)} />
            </div>
          </div>
        </div>

        {/* Sidebar — 1/3 */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
            <p className="text-sm font-semibold text-gray-700">Publish</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select className={SELECT} value={form.status} onChange={e => set('status', e.target.value)}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>
            {form.status === 'scheduled' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Publish Date & Time</label>
                <input className={INPUT} type="datetime-local" value={form.publishDate} onChange={e => set('publishDate', e.target.value)} />
              </div>
            )}
            <label className="flex items-center gap-2.5 cursor-pointer">
              <div
                onClick={() => set('featured', !form.featured)}
                className={`w-10 h-5 rounded-full transition-colors ${form.featured ? 'bg-[var(--admin-brand)]' : 'bg-gray-200'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-white shadow-sm m-0.5 transition-transform ${form.featured ? 'translate-x-5' : ''}`} />
              </div>
              <span className="text-sm text-gray-700">Featured post</span>
            </label>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <p className="text-sm font-semibold text-gray-700">Category & Tags</p>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <input className={INPUT} placeholder="e.g. ai-writing" value={form.category} onChange={e => set('category', e.target.value)} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Tags <span className="text-gray-400 font-normal">(comma-separated)</span></label>
              <input className={INPUT} placeholder="seo, tutorial, ai" value={form.tags} onChange={e => set('tags', e.target.value)} />
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <label className="block text-sm font-medium text-gray-700 mb-1">Related Tools <span className="text-gray-400 font-normal">(slugs, comma-separated)</span></label>
            <input className={INPUT} placeholder="image-compressor, word-counter" value={form.relatedTools} onChange={e => set('relatedTools', e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Post List ─────────────────────────────────────────────────────────────────
function PostList({ posts, onNew, onEdit, onDelete, onTogglePublish, loading }) {
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deleting,     setDeleting]     = useState(null);
  const [toggling,     setToggling]     = useState(null);

  const filtered = posts.filter(p => {
    const matchSearch = !search || p.title.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const handleDelete = async (post) => {
    if (!window.confirm(`Delete "${post.title}"? This cannot be undone.`)) return;
    setDeleting(post._id);
    try { await onDelete(post._id); } finally { setDeleting(null); }
  };

  const handleToggle = async (post) => {
    setToggling(post._id);
    try { await onTogglePublish(post); } finally { setToggling(null); }
  };

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">Blog Posts</h1>
          <p className="text-gray-500 text-sm mt-1">{posts.length} total</p>
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--admin-brand)] hover:bg-[color-mix(in_srgb,var(--admin-brand),black_15%)] text-white text-sm font-medium rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" /> New Post
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Search posts…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition w-52 shadow-sm"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {['all', 'published', 'draft', 'scheduled'].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                statusFilter === s
                  ? 'bg-[var(--admin-brand)] text-white'
                  : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 text-[var(--admin-brand)] animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Search className="w-8 h-8 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">No posts found.</p>
            <button onClick={onNew} className="mt-3 text-sm text-[var(--admin-brand)] hover:underline">Create your first post</button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left">
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(post => (
                  <tr key={post._id} className="hover:bg-gray-50/60 transition-colors group">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        {post.featured && <Star className="w-3.5 h-3.5 text-amber-400 shrink-0" fill="currentColor" />}
                        <div>
                          <p className="font-medium text-gray-900 group-hover:text-[var(--admin-brand)] transition-colors">{post.title}</p>
                          <p className="text-[11px] font-mono text-gray-400 mt-0.5">{post.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs text-gray-500">{post.category || '—'}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLE[post.status] || STATUS_STYLE.draft}`}>
                        {post.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-xs text-gray-500">
                        {post.publishDate
                          ? new Date(post.publishDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                          : '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleToggle(post)}
                          disabled={toggling === post._id}
                          title={post.status === 'published' ? 'Unpublish' : 'Publish'}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-blue-50 hover:text-[var(--admin-brand)] transition-colors"
                        >
                          {toggling === post._id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : post.status === 'published'
                              ? <EyeOff className="w-3.5 h-3.5" />
                              : <Eye className="w-3.5 h-3.5" />
                          }
                        </button>
                        <button
                          onClick={() => onEdit(post)}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(post)}
                          disabled={deleting === post._id}
                          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40"
                        >
                          {deleting === post._id
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : <Trash2 className="w-3.5 h-3.5" />
                          }
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Root component ────────────────────────────────────────────────────────────
export default function AdminBlogPosts() {
  const [posts,   setPosts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [view,    setView]    = useState('list');   // 'list' | 'new' | post object
  const [editPost,setEditPost]= useState(null);

  useEffect(() => {
    api.get('/admin/posts')
      .then(d => setPosts(d.posts))
      .catch(e => setError(e.message || 'Failed to load posts.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSaved = useCallback((saved) => {
    setPosts(ps => {
      const idx = ps.findIndex(p => p._id === saved._id);
      if (idx >= 0) { const next = [...ps]; next[idx] = saved; return next; }
      return [saved, ...ps];
    });
  }, []);

  const handleDelete = useCallback(async (id) => {
    await api.delete(`/admin/posts/${id}`);
    setPosts(ps => ps.filter(p => p._id !== id));
  }, []);

  const handleTogglePublish = useCallback(async (post) => {
    const data = await api.patch(`/admin/posts/${post._id}/publish`);
    setPosts(ps => ps.map(p => p._id === post._id ? { ...p, status: data.status } : p));
  }, []);

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 shrink-0" />{error}
        </div>
      </div>
    );
  }

  if (view === 'new' || editPost) {
    return (
      <PostEditor
        post={editPost || {}}
        onClose={() => { setView('list'); setEditPost(null); }}
        onSaved={(saved) => { handleSaved(saved); if (editPost) { setEditPost(saved); } }}
      />
    );
  }

  return (
    <PostList
      posts={posts}
      loading={loading}
      onNew={() => { setEditPost(null); setView('new'); }}
      onEdit={(p) => { setEditPost(p); }}
      onDelete={handleDelete}
      onTogglePublish={handleTogglePublish}
    />
  );
}
