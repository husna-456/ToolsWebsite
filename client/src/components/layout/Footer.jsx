import { Link } from 'react-router-dom';
import { Mail, ArrowRight } from 'lucide-react';
import usePublicSettings from '@/hooks/usePublicSettings';

const DEFAULT_FOOTER_LINKS = [
  { url: '/',        label: 'Home' },
  { url: '/blog',    label: 'Blog' },
  { url: '/contact', label: 'Contact Us' },
  { url: '/privacy', label: 'Privacy Policy' },
  { url: '/terms',   label: 'Terms of Service' },
];

export default function Footer() {
  const settings = usePublicSettings();

  const footerLinks = (() => {
    const adminLinks = settings?.general?.links?.filter(
      l => l.position === 'footer' || l.position === 'both'
    );
    return adminLinks?.length ? adminLinks : DEFAULT_FOOTER_LINKS;
  })();

  return (
    <footer className="bg-white px-5 sm:px-8 py-10">
      <div className="max-w-6xl mx-auto">

        {/* Two-card row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

          {/* Contact card */}
          <div className="rounded-3xl p-8 sm:p-10 flex flex-col"
            style={{ background: 'linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)', border: '1px solid rgba(255,255,255,0.25)' }}>
            <p className="text-white/60 text-[11px] font-bold uppercase tracking-widest mb-3">Contact</p>
            <h2 className="font-display font-bold text-white text-2xl sm:text-3xl leading-tight mb-3">
              Missing something?
            </h2>
            <p className="text-white/70 text-sm leading-relaxed mb-8 max-w-xs">
              Feel free to request missing tools or give some feedback using our contact form.
            </p>
            <div className="mt-auto">
              <Link
                to="/contact"
                className="inline-flex items-center gap-2 bg-white font-bold text-sm px-6 py-3 rounded-full hover:bg-white/90 transition-colors duration-200"
                style={{ color: 'var(--brand)' }}
              >
                <Mail className="w-4 h-4" />
                Contact Us
              </Link>
            </div>
          </div>

          {/* Brand card */}
          <div className="rounded-3xl p-8 sm:p-10 flex flex-col"
            style={{ background: 'linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)', border: '1px solid rgba(255,255,255,0.25)' }}>
            {/* Logo */}
            <Link to="/" className="inline-flex items-center gap-2.5 mb-7">
              <>
                {settings?.general?.contrastingLogo ? (
                  <img
                    src={settings.general.contrastingLogo}
                    alt={settings.general.siteName || 'Logo'}
                    className="h-8 w-auto object-contain"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(255,255,255,0.2)' }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                      <path d="M8 1.5L10 6L14.5 8L10 10L8 14.5L6 10L1.5 8L6 6Z" fill="white" fillOpacity="0.95"/>
                    </svg>
                  </div>
                )}
                <span className="font-display font-extrabold text-[1.05rem] tracking-tight text-white">
                  {settings?.general?.siteName
                    ? settings.general.siteName
                    : <>Tool<span className="text-white/60">Nova</span></>}
                </span>
              </>
            </Link>

            {/* Links */}
            <nav className="flex flex-col gap-3">
              {footerLinks.map(({ url, label }) => (
                <Link
                  key={url}
                  to={url}
                  className="inline-flex items-center gap-1 text-sm text-white/60 hover:text-white transition-colors duration-150 w-fit"
                >
                  {label}
                  <ArrowRight className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                </Link>
              ))}
            </nav>

            {/* Copyright */}
            <p className="text-white/35 text-xs mt-auto pt-8">
              {settings?.general?.footerAttribution
                ? settings.general.footerAttribution
                : `© ${new Date().getFullYear()} ${settings?.general?.siteName || 'Global Tech Tools'}. All Rights Reserved.`}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
