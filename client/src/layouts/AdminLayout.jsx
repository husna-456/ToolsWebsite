import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Navigate, Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Settings, Mail, Wrench, Monitor, CreditCard,
  LayoutTemplate, Link2, ShieldCheck,
  FileText, FileCheck, MessageSquare, Users2,
  Users, UserCircle,
  LogOut, Bell, Menu, X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import usePublicSettings from '@/hooks/usePublicSettings';

// ── Nav structure ─────────────────────────────────────────────────────────────
const NAV_GROUPS = [
  {
    label: 'Administration',
    items: [
      { to: '/admin/dashboard',          icon: LayoutDashboard, label: 'Dashboard' },
      { to: '/admin/general-settings',   icon: Settings,        label: 'General Settings' },
      { to: '/admin/smtp-settings',      icon: Mail,            label: 'SMTP / Email' },
      { to: '/admin/web-tools-settings', icon: Wrench,          label: 'Web Tools Settings' },
      { to: '/admin/ad-settings',        icon: Monitor,         label: 'Ad Settings' },
      { to: '/admin/saas-settings',      icon: CreditCard,      label: 'SaaS / Subscriptions' },
      { to: '/admin/tool-page-settings', icon: LayoutTemplate,  label: 'Tool Page Settings' },
      { to: '/admin/tool-slugs',         icon: Link2,           label: 'Tool Slugs' },
      { to: '/admin/security',           icon: ShieldCheck,     label: 'Security' },
    ],
  },
  {
    label: 'Content',
    items: [
      { to: '/admin/blog-posts',  icon: FileText,      label: 'Blog Posts' },
      { to: '/admin/pages',       icon: FileCheck,     label: 'Pages' },
      { to: '/admin/contact',     icon: MessageSquare, label: 'Contact Submissions' },
      { to: '/admin/subscribers', icon: Users2,        label: 'Email Subscribers' },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/admin/users',   icon: Users,      label: 'Users' },
      { to: '/admin/profile', icon: UserCircle, label: 'My Profile' },
    ],
  },
];

// Map pathname → page title for topbar breadcrumb
const PAGE_TITLES = {
  '/admin/dashboard':          'Dashboard',
  '/admin/general-settings':   'General Settings',
  '/admin/smtp-settings':      'SMTP / Email',
  '/admin/web-tools-settings': 'Web Tools Settings',
  '/admin/ad-settings':        'Ad Settings',
  '/admin/saas-settings':      'SaaS / Subscriptions',
  '/admin/tool-page-settings': 'Tool Page Settings',
  '/admin/tool-slugs':         'Tool Slugs',
  '/admin/security':           'Security',
  '/admin/blog-posts':         'Blog Posts',
  '/admin/pages':              'Pages',
  '/admin/contact':            'Contact Submissions',
  '/admin/subscribers':        'Email Subscribers',
  '/admin/tools':              'Tools',
  '/admin/users':              'Users',
  '/admin/profile':            'My Profile',
};

// ── Sidebar gradient — derived from --admin-brand so Custom CSS can override ──
const SIDEBAR_STYLE = {
  background: 'linear-gradient(180deg, color-mix(in srgb, var(--admin-brand), black 40%) 0%, color-mix(in srgb, var(--admin-brand), black 10%) 100%)',
};

// ── Sidebar component ─────────────────────────────────────────────────────────
function Sidebar({ user, initials, onClose, onLogout }) {
  return (
    <aside
      className="flex flex-col w-60 h-screen border-r border-blue-400/20 shrink-0"
      style={SIDEBAR_STYLE}
    >
      {/* Brand */}
      <div className="flex items-center justify-between px-5 py-5 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0">
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M8 1.5L10 6L14.5 8L10 10L8 14.5L6 10L1.5 8L6 6Z" fill="white" fillOpacity="0.95"/>
            </svg>
          </div>
          <div>
            <p className="text-white font-semibold text-[15px] leading-none">Global Tech Tools</p>
            <p className="text-blue-200/60 text-[10px] tracking-[0.2em] uppercase mt-1">
              Admin Panel
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="lg:hidden text-blue-200/50 hover:text-white transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scrollable nav */}
      <nav className="flex-1 overflow-y-auto py-2 admin-nav-scroll">
        {NAV_GROUPS.map((group, gi) => (
          <div key={group.label} className={gi === 0 ? '' : 'mt-1'}>
            {/* Section label */}
            <p className="px-4 pt-5 pb-2 text-[10px] font-semibold tracking-[0.15em] uppercase text-blue-200/40 select-none">
              {group.label}
            </p>

            {/* Items */}
            <div className="space-y-0.5 px-2">
              {group.items.map(({ to, icon: Icon, label }) => (
                <NavLink
                  key={to}
                  to={to}
                  onClick={onClose}
                  className={({ isActive }) =>
                    isActive
                      ? [
                          'relative flex items-center gap-3 text-sm rounded-xl pl-3.5 pr-3 py-2.5',
                          'bg-white/15 text-white font-medium',
                          'shadow-[inset_0_0_12px_rgba(255,255,255,0.05)]',
                          'transition-all duration-150',
                        ].join(' ')
                      : [
                          'relative flex items-center gap-3 text-sm rounded-xl px-3 py-2.5',
                          'text-blue-100/70 hover:bg-white/[0.08] hover:text-white',
                          'transition-all duration-150',
                        ].join(' ')
                  }
                >
                  {({ isActive }) => (
                    <>
                      {/* Left accent bar — active only */}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-0.5 bg-white rounded-full" />
                      )}
                      <Icon
                        className={[
                          'w-[18px] h-[18px] shrink-0 transition-colors duration-150',
                          isActive ? 'text-white' : 'text-blue-200/60',
                        ].join(' ')}
                        strokeWidth={isActive ? 2 : 1.75}
                      />
                      <span className="truncate leading-none">{label}</span>
                    </>
                  )}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* User footer */}
      <div className="border-t border-white/10 px-4 py-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-white/15 flex items-center justify-center text-white text-xs font-semibold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white leading-tight truncate">
              {user.name || 'Admin'}
            </p>
            <p className="text-xs text-blue-200/50 truncate max-w-[130px] mt-0.5">
              {user.email}
            </p>
          </div>
          <button
            onClick={onLogout}
            title="Logout"
            className="w-7 h-7 flex items-center justify-center rounded-lg text-blue-200/50 hover:text-white hover:bg-white/10 transition-all duration-150 shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

// ── Topbar component ──────────────────────────────────────────────────────────
function Topbar({ user, initials, onOpenSidebar, onLogout }) {
  const { pathname } = useLocation();
  const pageTitle = PAGE_TITLES[pathname] || 'Admin';

  return (
    <header className="sticky top-0 z-10 h-14 bg-white border-b border-gray-100 flex items-center px-5 gap-4 shrink-0">
      {/* Mobile hamburger */}
      <button
        className="lg:hidden text-gray-400 hover:text-gray-700 transition-colors"
        onClick={onOpenSidebar}
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Breadcrumb / page title */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 hidden sm:block">Admin</span>
        <span className="text-xs text-gray-300 hidden sm:block">/</span>
        <span className="text-sm font-medium text-gray-800">{pageTitle}</span>
      </div>

      <div className="flex-1" />

      {/* Notification bell */}
      <div className="relative">
        <button className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition-colors">
          <Bell className="w-[18px] h-[18px]" />
        </button>
        {/* Unread dot */}
        <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-[var(--admin-brand)] ring-2 ring-white" />
      </div>

      {/* User pill */}
      <div
        className="hidden sm:flex items-center gap-2.5 pl-1.5 pr-3.5 py-1 rounded-full border border-gray-100 bg-white shadow-sm cursor-default"
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
          style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--admin-brand), black 10%), color-mix(in srgb, var(--admin-brand), white 20%))' }}
        >
          {initials}
        </div>
        <span className="text-sm font-medium text-gray-700 truncate max-w-[110px]">
          {user.name || 'Admin'}
        </span>
      </div>

      {/* Logout */}
      <button
        onClick={onLogout}
        title="Logout"
        className="w-9 h-9 flex items-center justify-center rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors"
      >
        <LogOut className="w-[18px] h-[18px]" />
      </button>
    </header>
  );
}

// ── Root layout ───────────────────────────────────────────────────────────────
export default function AdminLayout() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const settings = usePublicSettings();

  useEffect(() => {
    const css = settings?.general?.customCss;
    let tag = document.getElementById('admin-custom-css');
    if (css) {
      if (!tag) {
        tag = document.createElement('style');
        tag.id = 'admin-custom-css';
        document.head.appendChild(tag);
      }
      tag.textContent = css;
    } else if (tag) {
      tag.remove();
    }
  }, [settings?.general?.customCss]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-2 border-blue-200 border-t-[var(--admin-brand)] rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return <Navigate to="/admin/login" replace />;

  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white border border-gray-200 rounded-2xl p-8 text-center max-w-sm shadow-sm">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
               style={{ background: 'color-mix(in srgb, var(--admin-brand), white 90%)' }}>
            <ShieldCheck className="w-6 h-6 text-[var(--admin-brand)]" />
          </div>
          <p className="text-gray-900 font-semibold text-lg">Access Denied</p>
          <p className="text-gray-500 text-sm mt-1">This area is for admins only.</p>
          <button
            onClick={() => navigate('/')}
            className="mt-5 px-5 py-2 text-sm text-white rounded-lg transition-colors font-medium"
            style={{ background: 'var(--admin-brand)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'color-mix(in srgb, var(--admin-brand), black 15%)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--admin-brand)'}
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const initials = (user.name || user.email || '?').slice(0, 2).toUpperCase();

  const handleLogout = () => {
    logout();
    navigate('/admin/login');
  };

  return (
    <div className="h-screen overflow-hidden flex bg-gray-50">
      {/* Prevent search engines from indexing any admin panel page */}
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — desktop static, mobile slide-in */}
      <div
        className={[
          'fixed lg:static inset-y-0 left-0 z-30',
          'transition-transform duration-300 ease-in-out',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        ].join(' ')}
      >
        <Sidebar
          user={user}
          initials={initials}
          onClose={() => setSidebarOpen(false)}
          onLogout={handleLogout}
        />
      </div>

      {/* Right column */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Topbar
          user={user}
          initials={initials}
          onOpenSidebar={() => setSidebarOpen(true)}
          onLogout={handleLogout}
        />
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
