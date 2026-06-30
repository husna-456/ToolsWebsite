import { useState, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { Menu, X, ArrowRight } from 'lucide-react';
import usePublicSettings from '@/hooks/usePublicSettings';

const DEFAULT_NAV = [
  { url: '/',        label: 'Home',       exact: true },
  { url: '/blog',    label: 'Blog' },
  { url: '/contact', label: 'Contact Us' },
];

export default function Navbar() {
  const [open,     setOpen]     = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const settings = usePublicSettings();

  const navLinks = (() => {
    const adminLinks = settings?.general?.links?.filter(
      l => l.position === 'header' || l.position === 'both'
    );
    return adminLinks?.length ? adminLinks : DEFAULT_NAV;
  })();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className="sticky top-0 z-50 bg-white transition-shadow duration-300"
      style={{ boxShadow: scrolled ? '0 1px 16px rgba(15,23,42,0.10)' : 'none' }}
    >
      <nav className="max-w-7xl mx-auto px-5 sm:px-8 h-[4.25rem] flex items-center justify-between gap-6">

        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0">
          <>
            {settings?.general?.logo ? (
              <img
                src={settings.general.logo}
                alt={settings.general.siteName || 'Logo'}
                className="h-8 w-auto object-contain"
              />
            ) : (
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'linear-gradient(135deg, #1D4ED8, #3B82F6)' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                  <path d="M8 1.5L10 6L14.5 8L10 10L8 14.5L6 10L1.5 8L6 6Z" fill="white" fillOpacity="0.95"/>
                </svg>
              </div>
            )}
            <span className="font-display font-extrabold text-[1.05rem] tracking-tight">
              {settings?.general?.siteName
                ? settings.general.siteName
                : (
                  <>
                    <span style={{ color: '#0F172A' }}>Global Tech </span>
                    <span style={{ background: 'linear-gradient(90deg, #2563EB, #60A5FA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>Tools</span>
                  </>
                )}
            </span>
          </>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-1 flex-1 justify-center">
          {navLinks.map(({ url, label, exact }) => (
            <NavLink
              key={url}
              to={url}
              end={exact}
              className={({ isActive }) =>
                `px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-150 ${
                  isActive
                    ? 'text-white shadow-sm'
                    : 'text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
                }`
              }
              style={({ isActive }) =>
                isActive ? { background: 'linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)' } : {}
              }
            >
              {label}
            </NavLink>
          ))}
        </div>

        {/* Try Free — desktop only */}
        <div className="hidden md:flex items-center flex-shrink-0">
          <Link
            to="/tools/ai-humanizer"
            className="inline-flex items-center gap-1.5 text-white font-semibold text-sm px-4 py-2 rounded-lg transition-all duration-150 shadow-sm"
            style={{ background: 'linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)' }}
          >
            Try Free
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden w-11 h-11 rounded-lg flex items-center justify-center text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC] transition-colors"
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </nav>

      {/* Mobile drawer */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-200 ease-in-out border-t border-[#E2E8F0] ${
          open ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0 border-transparent'
        }`}
      >
        <div className="px-4 py-3 space-y-1 bg-white">
          {navLinks.map(({ url, label, exact }) => (
            <NavLink
              key={url}
              to={url}
              end={exact}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center w-full px-4 py-3 text-sm font-semibold rounded-xl transition-all duration-150 ${
                  isActive
                    ? 'text-white shadow-sm'
                    : 'text-[#475569] hover:text-[#0F172A] hover:bg-[#F8FAFC]'
                }`
              }
              style={({ isActive }) =>
                isActive ? { background: 'linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)' } : {}
              }
            >
              {label}
            </NavLink>
          ))}
          <div className="pt-2 mt-1 border-t border-[#E2E8F0]">
            <Link
              to="/tools/ai-humanizer"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-2 w-full text-white font-semibold text-sm py-3 rounded-xl mt-2 transition-colors"
              style={{ background: 'linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)' }}
            >
              Try Free Tools
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
