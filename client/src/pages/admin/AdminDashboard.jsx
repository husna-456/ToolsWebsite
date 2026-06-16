import { useEffect, useState } from 'react';
import { Users, Zap, TrendingUp, CheckSquare, Loader2, AlertCircle, Activity } from 'lucide-react';
import api from '@/services/api';
import { useAuth } from '@/context/AuthContext';

const CATEGORY_LABELS = {
  'ai-writing':   'AI Writing',
  'text-tools':   'Text Tools',
  'image-tools':  'Image Tools',
  'media-tools':  'Media Tools',
  'productivity': 'Productivity',
  'seo-tools':    'SEO Tools',
};

const STAT_CONFIGS = [
  { key: 'totalUsers',  label: 'Total Users',    icon: Users       },
  { key: 'todayUses',   label: "Today's Uses",   icon: Zap         },
  { key: 'allTimeUses', label: 'All-Time Uses',   icon: TrendingUp  },
  { key: 'activeTools', label: 'Active Tools',    icon: CheckSquare },
];

function StatCard({ icon: Icon, label, value }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-200 hover:shadow-sm transition-shadow duration-200">
      <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center mb-4">
        <Icon className="w-5 h-5 text-white" strokeWidth={2} />
      </div>
      <p className="text-2xl font-semibold text-gray-900 leading-none mb-1 tabular-nums">{value ?? '—'}</p>
      <p className="text-gray-500 text-sm">{label}</p>
    </div>
  );
}

function UserInitial({ email }) {
  return (
    <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-xs font-bold text-white shrink-0">
      {(email || '?').slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    api.get('/admin/stats')
      .then(setData)
      .catch((err) => setError(err.message || 'Failed to load stats.'))
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

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

  const { stats, topTools, recentUsers } = data;
  const maxUsage = Math.max(...topTools.map(t => t.usageCount), 1);

  return (
    <div className="p-6 space-y-6">

      {/* ── Page header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-gray-500 text-sm mb-1">{today}</p>
          <h1 className="text-2xl font-medium text-gray-900">
            {greeting}, {user?.name || 'Admin'}
          </h1>
          <p className="text-gray-500 text-sm mt-1">Here's an overview of InnovateTools today.</p>
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2 shrink-0">
          <Activity className="w-4 h-4 text-[var(--admin-brand)]" />
          <span className="text-sm font-medium text-gray-700">Live Dashboard</span>
          <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
        </div>
      </div>

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {STAT_CONFIGS.map(({ key, label, icon }) => (
          <StatCard
            key={key}
            icon={icon}
            label={label}
            value={(stats[key] ?? 0).toLocaleString()}
          />
        ))}
      </div>

      {/* ── Two-column ── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

        {/* Top tools — 3/5 */}
        <div className="xl:col-span-3 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h2 className="font-medium text-gray-900">Top Tools by Usage</h2>
              <p className="text-xs text-gray-500 mt-0.5">All-time leaderboard</p>
            </div>
            <span className="text-xs font-semibold text-[var(--admin-brand)] bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-full">
              Top {topTools.length}
            </span>
          </div>

          <div className="divide-y divide-gray-50">
            {topTools.length === 0 ? (
              <p className="px-6 py-10 text-center text-gray-400 text-sm">No usage data yet.</p>
            ) : (
              topTools.map((tool, i) => (
                <div key={tool._id} className="flex items-center gap-4 px-6 py-3.5 hover:bg-gray-50/60 transition-colors">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                    i === 0 ? 'bg-blue-500 text-white'
                    : i < 3  ? 'bg-blue-50 text-[var(--admin-brand)] border border-blue-200'
                    : 'bg-gray-100 text-gray-500'
                  }`}>
                    {i + 1}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{tool.title}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all duration-500"
                          style={{ width: `${(tool.usageCount / maxUsage) * 100}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        {CATEGORY_LABELS[tool.category] || tool.category}
                      </span>
                    </div>
                  </div>

                  <span className="text-sm font-semibold text-gray-700 tabular-nums shrink-0">
                    {tool.usageCount.toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent users — 2/5 */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-medium text-gray-900">Recent Users</h2>
            <p className="text-xs text-gray-500 mt-0.5">Last 10 registrations</p>
          </div>

          <div className="divide-y divide-gray-50">
            {recentUsers.length === 0 ? (
              <p className="px-6 py-10 text-center text-gray-400 text-sm">No users yet.</p>
            ) : (
              recentUsers.map((u) => (
                <div key={u._id} className="flex items-center gap-3 px-6 py-3 hover:bg-gray-50/60 transition-colors">
                  <UserInitial email={u.email} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{u.email}</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {new Date(u.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full shrink-0 border ${
                    u.role === 'admin'
                      ? 'bg-blue-50 text-[var(--admin-brand)] border-blue-200'
                      : 'bg-gray-50 text-gray-500 border-gray-200'
                  }`}>
                    {u.role}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
