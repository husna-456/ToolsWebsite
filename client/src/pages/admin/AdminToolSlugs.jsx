import { useEffect, useState, useCallback } from 'react';
import {
  Loader2, AlertCircle, Check, X, ExternalLink, AlertTriangle, Search,
} from 'lucide-react';
import api from '@/services/api';

const SLUG_RE = /^[a-z0-9-]+$/;

function SlugRow({ tool, onSaved }) {
  const [editing,  setEditing]  = useState(false);
  const [value,    setValue]    = useState(tool.slug);
  const [saving,   setSaving]   = useState(false);
  const [error,    setError]    = useState('');
  const [success,  setSuccess]  = useState(false);
  const [warned,   setWarned]   = useState(false);

  const dirty     = value.trim() !== tool.slug;
  const slugValid = SLUG_RE.test(value.trim()) && value.trim().length > 0;

  const handleSave = useCallback(async () => {
    const newSlug = value.trim();
    if (!slugValid) { setError('Slug may only contain lowercase letters, numbers, and hyphens.'); return; }
    if (newSlug === tool.slug) { setEditing(false); return; }

    // First click shows the redirect warning; second click confirms
    if (!warned) { setWarned(true); return; }

    setError('');
    setSaving(true);
    try {
      const data = await api.patch(`/admin/tools/${tool._id}/slug`, { newSlug });
      setSuccess(true);
      onSaved(data.tool);
      setTimeout(() => setSuccess(false), 2000);
      setEditing(false);
      setWarned(false);
    } catch (err) {
      setError(err.message || 'Failed to save slug.');
    } finally {
      setSaving(false);
    }
  }, [value, tool, slugValid, warned, onSaved]);

  const handleCancel = () => {
    setValue(tool.slug);
    setEditing(false);
    setError('');
    setWarned(false);
  };

  return (
    <div className="px-5 py-4 hover:bg-gray-50/50 transition-colors">
      <div className="flex items-start gap-4">

        {/* Tool info */}
        <div className="w-44 shrink-0">
          <p className="text-sm font-medium text-gray-900 truncate">{tool.title}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">
            {tool.usageCount?.toLocaleString() ?? 0} uses
          </p>
        </div>

        {/* Slug editor */}
        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 shrink-0">/tools/</span>
                <input
                  autoFocus
                  value={value}
                  onChange={e => { setValue(e.target.value.toLowerCase()); setError(''); setWarned(false); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
                  className={`flex-1 px-3 py-1.5 text-sm font-mono rounded-lg border transition ${
                    !slugValid && value
                      ? 'border-red-300 bg-red-50 focus:ring-red-200'
                      : 'border-blue-300 bg-white focus:ring-blue-100'
                  } focus:outline-none focus:ring-2`}
                />
              </div>

              {/* Redirect warning */}
              {warned && dirty && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 leading-relaxed">
                    <strong>/{tool.slug}</strong> will 301-redirect to <strong>/{value.trim()}</strong>.
                    Click Save again to confirm.
                  </p>
                </div>
              )}

              {error && <p className="text-xs text-red-600">{error}</p>}

              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving || !slugValid}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[var(--admin-brand)] hover:bg-[color-mix(in_srgb,var(--admin-brand),black_15%)] text-white rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  {warned ? 'Confirm & Save' : 'Save'}
                </button>
                <button onClick={handleCancel} className="flex items-center gap-1 px-3 py-1.5 text-xs text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors">
                  <X className="w-3.5 h-3.5" /> Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                onClick={() => setEditing(true)}
                className="group flex items-center gap-1.5 text-sm font-mono text-gray-700 hover:text-[var(--admin-brand)] transition-colors"
                title="Click to edit slug"
              >
                <span className="text-gray-400">/tools/</span>
                <span className="underline decoration-dashed underline-offset-2 group-hover:decoration-solid">
                  {tool.slug}
                </span>
              </button>
              {success && (
                <span className="flex items-center gap-1 text-xs text-[var(--admin-brand)]">
                  <Check className="w-3.5 h-3.5" /> Saved
                </span>
              )}
              <a
                href={`/tools/${tool.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-gray-300 hover:text-[var(--admin-brand)] transition-colors"
                title="Open tool in new tab"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {/* Previous slugs */}
          {tool.previousSlugs?.length > 0 && !editing && (
            <p className="text-[10px] text-gray-400 mt-1">
              Redirects from: {tool.previousSlugs.map(s => `/${s}`).join(', ')}
            </p>
          )}
        </div>

        {/* Last changed */}
        <div className="shrink-0 text-right hidden sm:block">
          <p className="text-[11px] text-gray-400">
            {tool.updatedAt
              ? new Date(tool.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              : '—'}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AdminToolSlugs() {
  const [tools,   setTools]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [search,  setSearch]  = useState('');

  useEffect(() => {
    api.get('/admin/tools')
      .then(d => setTools(d.tools))
      .catch(e => setError(e.message || 'Failed to load tools.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSaved = useCallback((updated) => {
    setTools(ts => ts.map(t => t._id === updated._id ? updated : t));
  }, []);

  const filtered = tools.filter(t =>
    !search ||
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.slug.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-[var(--admin-brand)] animate-spin" /></div>;

  if (error) return (
    <div className="p-6">
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-4 flex items-center gap-3 text-sm">
        <AlertCircle className="w-5 h-5 shrink-0" />{error}
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-5">

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">Tool Slugs / Permalinks</h1>
          <p className="text-gray-500 text-sm mt-1">
            Click any slug to edit it. Changing a slug automatically adds a 301 redirect from the old URL.
          </p>
        </div>
        <div className="relative shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Search tools…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 bg-white text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition w-52 shadow-sm"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Table header */}
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-4">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider w-44 shrink-0">Tool</span>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex-1">Slug (click to edit)</span>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:block">Last Updated</span>
        </div>

        {/* Rows */}
        <div className="divide-y divide-gray-50">
          {filtered.map(tool => (
            <SlugRow key={tool._id} tool={tool} onSaved={handleSaved} />
          ))}
          {filtered.length === 0 && (
            <div className="px-5 py-12 text-center">
              <Search className="w-8 h-8 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No tools match "{search}"</p>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/50">
          <p className="text-xs text-gray-400">{filtered.length} of {tools.length} tools</p>
        </div>
      </div>
    </div>
  );
}
