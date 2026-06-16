import { useEffect, useState, useCallback } from 'react';
import {
  Loader2, AlertCircle, Search, Ban, CheckCircle2, Users,
} from 'lucide-react';
import api from '@/services/api';

const PALETTE = [
  'bg-[var(--admin-brand)]',   'bg-blue-500',   'bg-purple-500', 'bg-fuchsia-500',
  'bg-pink-500',   'bg-rose-500',   'bg-sky-500',    'bg-violet-500',
  'bg-blue-400',   'bg-orange-500',
];

function UserAvatar({ email }) {
  const idx = (email || '').charCodeAt(0) % PALETTE.length;
  return (
    <div className={`w-9 h-9 rounded-full ${PALETTE[idx]} flex items-center justify-center text-xs font-bold text-white shrink-0`}>
      {(email || '?').slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function AdminUsers() {
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [search,  setSearch]  = useState('');
  const [banning, setBanning] = useState(null);

  useEffect(() => {
    api.get('/admin/users')
      .then(d => setUsers(d.users))
      .catch(e => setError(e.message || 'Failed to load users.'))
      .finally(() => setLoading(false));
  }, []);

  const handleToggleBan = useCallback(async (user) => {
    setBanning(user._id);
    try {
      const data = await api.patch(`/admin/users/${user._id}/ban`);
      setUsers(us => us.map(u => u._id === user._id ? { ...u, isBanned: data.isBanned } : u));
    } catch {
      // silently ignore — row reverts to previous state
    } finally {
      setBanning(null);
    }
  }, []);

  const filtered = users.filter(u =>
    !search ||
    (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
    (u.name  || '').toLowerCase().includes(search.toLowerCase())
  );

  const bannedCount = users.filter(u => u.isBanned).length;

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
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">

      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Users</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {users.length} total &middot;
            <span className="text-[var(--admin-brand)] font-medium"> {users.length - bannedCount} active</span>
            {bannedCount > 0 && (
              <span className="text-red-500 font-medium"> &middot; {bannedCount} banned</span>
            )}
          </p>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          <input
            type="search"
            placeholder="Search by email or name…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 pr-4 py-2 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-400 transition w-64 shadow-sm"
          />
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { label: 'Total Users',  value: users.length,                      color: 'from-blue-500 to-blue-700' },
          { label: 'Active Users', value: users.length - bannedCount,         color: 'from-blue-400 to-blue-600'    },
          { label: 'Banned',       value: bannedCount,                        color: 'from-rose-400 to-rose-600'    },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm">
            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center shadow-sm mb-3`}>
              <Users className="w-4 h-4 text-white" strokeWidth={2} />
            </div>
            <p className="text-[26px] font-bold text-slate-900 leading-none mb-1">{value}</p>
            <p className="text-slate-500 text-sm">{label}</p>
          </div>
        ))}
      </div>

      {/* ── User table ── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100">
          <h2 className="font-bold text-slate-900 text-[15px]">All Users</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {filtered.length} {search ? 'matching' : 'total'} — click a row's ban button to toggle access
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Search className="w-8 h-8 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-500 text-sm font-medium">No users found{search ? ` for "${search}"` : '.'}</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {filtered.map(u => (
              <div
                key={u._id}
                className={`flex items-center gap-4 px-6 py-3.5 transition-colors ${
                  u.isBanned ? 'bg-red-50/40' : 'hover:bg-slate-50/60'
                }`}
              >
                <UserAvatar email={u.email} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {u.name || u.email}
                    </p>
                    {u.isBanned && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 border border-red-200 shrink-0">
                        Banned
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5 truncate">{u.email}</p>
                </div>

                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border ${
                  u.role === 'admin'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-slate-50 text-slate-500 border-slate-200'
                }`}>
                  {u.role}
                </span>

                <span className="text-[11px] text-slate-400 shrink-0 hidden sm:block">
                  {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>

                <button
                  onClick={() => handleToggleBan(u)}
                  disabled={banning === u._id || u.role === 'admin'}
                  title={u.role === 'admin' ? 'Cannot ban admins' : u.isBanned ? 'Unban user' : 'Ban user'}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all duration-150 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed ${
                    u.isBanned
                      ? 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-[var(--admin-brand)] hover:border-blue-300'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-300'
                  }`}
                >
                  {banning === u._id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : u.isBanned ? (
                    <><CheckCircle2 className="w-3.5 h-3.5" />Unban</>
                  ) : (
                    <><Ban className="w-3.5 h-3.5" />Ban</>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
