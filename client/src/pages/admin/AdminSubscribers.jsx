import { useEffect, useState, useCallback } from 'react';
import {
  Loader2, AlertCircle, Search, Trash2, Download, Mail, Filter,
} from 'lucide-react';
import api from '@/services/api';

const SOURCE_LABELS = {
  contact:    'Contact Form',
  footer:     'Footer',
  newsletter: 'Newsletter',
  tool:       'Tool Page',
  blog:       'Blog',
};

function SubscriberRow({ subscriber, onDelete }) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    if (!window.confirm(`Remove ${subscriber.email} from subscribers?`)) return;
    setDeleting(true);
    try { await onDelete(subscriber._id); } finally { setDeleting(false); }
  }, [subscriber, onDelete]);

  const sourceLabel = SOURCE_LABELS[subscriber.source] || subscriber.source || '—';

  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-gray-50 last:border-0 hover:bg-gray-50/50 transition-colors">
      <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
        <Mail className="w-4 h-4 text-blue-400" />
      </div>

      <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
        <p className="text-sm font-medium text-gray-800 truncate">{subscriber.email}</p>

        <p className="text-sm text-gray-500 truncate">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
            {sourceLabel}
          </span>
        </p>

        <p className="text-xs text-gray-400 hidden sm:block">
          {new Date(subscriber.subscribedAt || subscriber.createdAt).toLocaleDateString('en-US', {
            month: 'short', day: 'numeric', year: 'numeric',
          })}
        </p>
      </div>

      <button
        onClick={handleDelete}
        disabled={deleting}
        className="shrink-0 p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-40"
        title="Remove subscriber"
      >
        {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function AdminSubscribers() {
  const [subscribers, setSubscribers] = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [search,      setSearch]      = useState('');
  const [sourceFilter,setSourceFilter]= useState('all');
  const [exporting,   setExporting]   = useState(false);

  useEffect(() => {
    api.get('/admin/subscribers')
      .then(d => setSubscribers(d.subscribers))
      .catch(e => setError(e.message || 'Failed to load subscribers.'))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = useCallback(async (id) => {
    await api.delete(`/admin/subscribers/${id}`);
    setSubscribers(ss => ss.filter(s => s._id !== id));
  }, []);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (search)                  params.set('search', search);
      if (sourceFilter !== 'all')  params.set('source', sourceFilter);
      const query = params.toString() ? `?${params}` : '';

      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'https://globaltechtools.thefiveriverz.com';
      const res = await fetch(`${API_BASE_URL}/api/admin/subscribers/export${query}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('it_token')}` },
      });
      if (!res.ok) throw new Error('Export failed');

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `subscribers-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Export failed.');
    } finally {
      setExporting(false);
    }
  }, [search, sourceFilter]);

  const sources = ['all', ...Array.from(new Set(subscribers.map(s => s.source).filter(Boolean)))];

  const filtered = subscribers.filter(s => {
    const matchSearch = !search || s.email.toLowerCase().includes(search.toLowerCase());
    const matchSource = sourceFilter === 'all' || s.source === sourceFilter;
    return matchSearch && matchSource;
  });

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
          <h1 className="text-2xl font-medium text-gray-900">Email Subscribers</h1>
          <p className="text-gray-500 text-sm mt-1">
            {subscribers.length} total subscribers
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-[var(--admin-brand)] hover:bg-[color-mix(in_srgb,var(--admin-brand),black_15%)] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-60 shrink-0"
        >
          {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {exporting ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Search by email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition w-60 shadow-sm"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="w-3.5 h-3.5 text-gray-400 mr-1" />
          {sources.map(s => (
            <button
              key={s}
              onClick={() => setSourceFilter(s)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${
                sourceFilter === s ? 'bg-[var(--admin-brand)] text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300'
              }`}
            >
              {s === 'all' ? 'All Sources' : (SOURCE_LABELS[s] || s)}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center gap-4">
          <div className="w-8 shrink-0" />
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</span>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Source</span>
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider hidden sm:block">Date Subscribed</span>
          </div>
          <div className="w-8 shrink-0" />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 text-[var(--admin-brand)] animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Mail className="w-8 h-8 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">
              {search || sourceFilter !== 'all' ? 'No subscribers match your filters.' : 'No subscribers yet.'}
            </p>
          </div>
        ) : (
          <div>
            {filtered.map(s => (
              <SubscriberRow key={s._id} subscriber={s} onDelete={handleDelete} />
            ))}
          </div>
        )}

        {filtered.length > 0 && (
          <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50/50">
            <p className="text-xs text-gray-400">{filtered.length} of {subscribers.length} subscribers</p>
          </div>
        )}
      </div>
    </div>
  );
}
