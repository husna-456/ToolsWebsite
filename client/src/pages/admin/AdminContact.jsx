import { useEffect, useState, useCallback } from 'react';
import {
  Loader2, AlertCircle, CheckCircle, Search, Trash2, ChevronDown, ChevronUp,
  Mail, MailOpen, Reply, Filter, Sparkles, Send,
} from 'lucide-react';
import api from '@/services/api';

const STATUS_STYLE = {
  new:      'bg-blue-50 text-blue-700 border-blue-200',
  read:     'bg-gray-100 text-gray-600 border-gray-200',
  replied:  'bg-green-50 text-green-700 border-green-200',
  archived: 'bg-gray-50 text-gray-400 border-gray-100',
};

const STATUS_OPTIONS = ['new', 'read', 'replied', 'archived'];

const TEXTAREA = 'w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[var(--admin-brand)] focus:bg-white transition resize-none';

function ContactRow({ submission, onUpdate, onDelete }) {
  const [expanded,   setExpanded]   = useState(false);
  const [updating,   setUpdating]   = useState(false);
  const [deleting,   setDeleting]   = useState(false);

  // Reply state
  const [showReply,  setShowReply]  = useState(false);
  const [replyBody,  setReplyBody]  = useState('');
  const [generating, setGenerating] = useState(false);
  const [sending,    setSending]    = useState(false);
  const [replyResult,setReplyResult]= useState(null); // { ok, message }
  const [genError,   setGenError]   = useState('');

  const handleStatus = useCallback(async (status) => {
    setUpdating(true);
    try {
      const data = await api.patch(`/admin/contact/${submission._id}`, { status });
      // data = { success, contact } — use data.contact for the updated doc
      onUpdate(data.contact || { ...submission, status });
    } finally {
      setUpdating(false);
    }
  }, [submission, onUpdate]);

  const handleExpand = useCallback(() => {
    setExpanded(v => !v);
    if (submission.status === 'new') handleStatus('read');
  }, [submission.status, handleStatus]);

  const handleDelete = useCallback(async () => {
    if (!window.confirm('Delete this submission?')) return;
    setDeleting(true);
    try { await onDelete(submission._id); } finally { setDeleting(false); }
  }, [submission, onDelete]);

  const openReply = useCallback(() => {
    setShowReply(v => {
      if (v) { setReplyBody(''); setReplyResult(null); setGenError(''); }
      return !v;
    });
  }, []);

  const handleGenerateAiReply = useCallback(async () => {
    setGenerating(true);
    setGenError('');
    try {
      const data = await api.post(`/admin/contact/${submission._id}/ai-reply`);
      setReplyBody(data.reply || '');
    } catch (err) {
      setGenError(err.message || 'AI generation failed.');
    } finally {
      setGenerating(false);
    }
  }, [submission._id]);

  const handleSendReply = useCallback(async () => {
    if (!replyBody.trim()) return;
    setSending(true);
    setReplyResult(null);
    try {
      const data = await api.post(`/admin/contact/${submission._id}/send-reply`, { replyBody });
      setReplyResult({ ok: true, message: data.message || 'Reply sent successfully.' });
      // Update status to 'replied' in parent list
      onUpdate({ ...submission, status: 'replied' });
      // Auto-close after success
      setTimeout(() => { setShowReply(false); setReplyBody(''); setReplyResult(null); }, 3000);
    } catch (err) {
      setReplyResult({ ok: false, message: err.message || 'Failed to send reply.' });
    } finally {
      setSending(false);
    }
  }, [submission, replyBody, onUpdate]);

  const isNew = submission.status === 'new';

  return (
    <div className={`border-b border-gray-50 last:border-0 transition-colors ${isNew ? 'bg-blue-50/30' : ''}`}>

      {/* ── Row summary ── */}
      <div
        className="flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-gray-50/60 transition-colors"
        onClick={handleExpand}
      >
        <div className="shrink-0">
          {isNew
            ? <Mail className="w-4 h-4 text-[var(--admin-brand)]" />
            : <MailOpen className="w-4 h-4 text-gray-300" />}
        </div>

        <div className="flex-1 min-w-0 grid grid-cols-1 sm:grid-cols-3 gap-1 sm:gap-4">
          <p className={`text-sm truncate ${isNew ? 'font-semibold text-gray-900' : 'font-medium text-gray-700'}`}>
            {submission.name}
            <span className="text-gray-400 font-normal ml-1.5 text-xs">{submission.email}</span>
          </p>
          <p className="text-sm text-gray-600 truncate sm:col-span-1">{submission.subject}</p>
          <p className="text-xs text-gray-400 hidden sm:block text-right">
            {new Date(submission.submittedAt || submission.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        <span className={`hidden sm:inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${STATUS_STYLE[submission.status] || STATUS_STYLE.read}`}>
          {submission.status}
        </span>

        {expanded
          ? <ChevronUp className="w-4 h-4 text-gray-300 shrink-0" />
          : <ChevronDown className="w-4 h-4 text-gray-300 shrink-0" />}
      </div>

      {/* ── Expanded detail ── */}
      {expanded && (
        <div className="px-5 pb-5 pt-2 border-t border-gray-100 bg-white">
          <div className="flex items-start gap-4 flex-wrap">

            {/* Left: message + reply panel */}
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-500 mb-2 flex items-center gap-3 flex-wrap">
                <span><strong>From:</strong> {submission.name} &lt;{submission.email}&gt;</span>
                <span><strong>Subject:</strong> {submission.subject}</span>
                {submission.ipAddress && <span className="font-mono text-gray-400">{submission.ipAddress}</span>}
              </div>

              {/* Original message */}
              <div className="bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">
                {submission.message}
              </div>

              {/* ── Reply panel ── */}
              {showReply && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
                    <p className="text-xs font-semibold text-gray-700">
                      Reply to {submission.name}
                    </p>
                    <button
                      onClick={handleGenerateAiReply}
                      disabled={generating}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 hover:bg-purple-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {generating
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Sparkles className="w-3.5 h-3.5" />}
                      {generating ? 'Generating…' : 'Generate AI Draft'}
                    </button>
                  </div>

                  {genError && (
                    <div className="mb-2.5 flex items-center gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />{genError}
                    </div>
                  )}

                  <textarea
                    className={TEXTAREA}
                    rows={9}
                    placeholder="Type your reply or click 'Generate AI Draft' to auto-write one…"
                    value={replyBody}
                    onChange={e => { setReplyBody(e.target.value); setReplyResult(null); }}
                  />

                  <div className="flex items-center gap-2.5 mt-2.5 flex-wrap">
                    <button
                      onClick={handleSendReply}
                      disabled={sending || !replyBody.trim()}
                      className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50 bg-[var(--admin-brand)] hover:bg-[color-mix(in_srgb,var(--admin-brand),black_15%)]"
                    >
                      {sending
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <Send className="w-4 h-4" />}
                      {sending ? 'Sending…' : 'Send Reply'}
                    </button>
                    <button
                      onClick={openReply}
                      className="px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-200 rounded-lg hover:border-gray-300 transition-colors"
                    >
                      Cancel
                    </button>
                    <span className="text-xs text-gray-400 ml-auto">
                      Sending to {submission.email}
                    </span>
                  </div>

                  {replyResult && (
                    <div className={`mt-3 flex items-center gap-2 text-sm rounded-lg px-4 py-3 ${
                      replyResult.ok
                        ? 'bg-green-50 border border-green-200 text-green-700'
                        : 'bg-red-50 border border-red-200 text-red-700'
                    }`}>
                      {replyResult.ok
                        ? <CheckCircle className="w-4 h-4 shrink-0" />
                        : <AlertCircle className="w-4 h-4 shrink-0" />}
                      {replyResult.message}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: actions */}
            <div className="flex flex-col gap-1.5 shrink-0 min-w-[130px]">

              {/* Status buttons */}
              {STATUS_OPTIONS.filter(s => s !== submission.status).map(s => (
                <button
                  key={s}
                  onClick={() => handleStatus(s)}
                  disabled={updating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 hover:border-[var(--admin-brand)]/40 hover:text-[var(--admin-brand)] rounded-lg transition-colors disabled:opacity-40 capitalize"
                >
                  {updating && <Loader2 className="w-3 h-3 animate-spin" />}
                  Mark as {s}
                </button>
              ))}

              {/* Reply toggle */}
              <button
                onClick={openReply}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
                  showReply
                    ? 'bg-[var(--admin-brand)] text-white border-[var(--admin-brand)]'
                    : 'text-[var(--admin-brand)] bg-blue-50 border-blue-200 hover:bg-blue-100'
                }`}
              >
                <Reply className="w-3.5 h-3.5" />
                {showReply ? 'Close Reply' : 'Reply'}
              </button>

              {/* Delete */}
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-500 bg-red-50 border border-red-200 hover:bg-red-100 rounded-lg transition-colors disabled:opacity-40"
              >
                {deleting
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  : <Trash2 className="w-3.5 h-3.5" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminContact() {
  const [submissions,  setSubmissions]  = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState('');
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  useEffect(() => {
    api.get('/admin/contact')
      .then(d => setSubmissions(Array.isArray(d) ? d : (d.contacts ?? d.submissions ?? [])))
      .catch(e => setError(e.message || 'Failed to load submissions.'))
      .finally(() => setLoading(false));
  }, []);

  const handleUpdate = useCallback((updated) => {
    setSubmissions(ss => ss.map(s => s._id === updated._id ? updated : s));
  }, []);

  const handleDelete = useCallback(async (id) => {
    await api.delete(`/admin/contact/${id}`);
    setSubmissions(ss => ss.filter(s => s._id !== id));
  }, []);

  const filtered = submissions.filter(s => {
    const matchSearch = !search ||
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      s.subject.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || s.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const newCount = submissions.filter(s => s.status === 'new').length;

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
          <h1 className="text-2xl font-medium text-gray-900">Contact Submissions</h1>
          <p className="text-gray-500 text-sm mt-1">
            {submissions.length} total
            {newCount > 0 && (
              <span className="ml-1.5 text-[var(--admin-brand)] font-medium">· {newCount} unread</span>
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Search name, email, subject…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[var(--admin-brand)] transition w-60 shadow-sm"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="w-3.5 h-3.5 text-gray-400 mr-1" />
          {['all', ...STATUS_OPTIONS].map(s => (
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

      {/* List */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-7 h-7 text-[var(--admin-brand)] animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Mail className="w-8 h-8 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">
              {search || statusFilter !== 'all' ? 'No submissions match your filters.' : 'No submissions yet.'}
            </p>
          </div>
        ) : (
          <div>
            {filtered.map(s => (
              <ContactRow key={s._id} submission={s} onUpdate={handleUpdate} onDelete={handleDelete} />
            ))}
          </div>
        )}
        {filtered.length > 0 && (
          <div className="px-5 py-2.5 border-t border-gray-100 bg-gray-50/50">
            <p className="text-xs text-gray-400">{filtered.length} of {submissions.length} submissions</p>
          </div>
        )}
      </div>
    </div>
  );
}
