import { Link } from 'react-router-dom';
import { Shield, ArrowLeft } from 'lucide-react';
import SEOHead from '@/components/seo/SEOHead';

const SECTIONS = [
  {
    title: 'Information We Collect',
    body: [
      'ToolNova is designed to be used without creating an account. We collect minimal information to provide our services.',
      'When you use our AI-powered tools, the text you submit is sent to our server solely to generate a result. We do not store, log, or retain your input text after processing is complete.',
      'If you choose to provide your email address to unlock additional daily uses, we store only your email and your daily usage counter. We do not collect your name, location, or any other personal details.',
      'We use standard server logs (IP address, browser type, page visited, timestamp) for security monitoring and abuse prevention. These logs are automatically purged after 30 days.',
    ],
  },
  {
    title: 'How We Use Your Information',
    body: [
      'Your email address (if provided) is used only to track your daily free usage allowance. We do not use it for marketing, profiling, or any other purpose.',
      'Text submitted to our tools is forwarded to Google Gemini AI to generate a response. It is not stored on our servers after the response is returned.',
      'Aggregated, anonymous usage statistics (e.g., "the AI Humanizer was used 5,000 times today") may be used to improve the service and inform which new tools to build.',
    ],
  },
  {
    title: 'Cookies & Local Storage',
    body: [
      'We use browser localStorage to remember your session and daily usage count without requiring a login. No third-party advertising or tracking cookies are used.',
      'Essential cookies may be set to maintain basic site functionality. You can disable cookies in your browser settings, but some features may not work correctly.',
    ],
  },
  {
    title: 'Third-Party Services',
    body: [
      'Google Gemini AI — Text submitted to AI tools is processed by Google\'s Gemini API. Google\'s privacy policy applies to their processing of this data.',
      'We do not sell, rent, or share your personal information with any other third parties for marketing or advertising purposes.',
    ],
  },
  {
    title: 'Data Retention & Deletion',
    body: [
      'If you provided an email address and wish to have it deleted from our records, contact us at the address below and we will remove it within 7 business days.',
      'Server logs are automatically purged after 30 days.',
      'Because we do not store your tool inputs, there is no content to delete from our side.',
    ],
  },
  {
    title: 'Children\'s Privacy',
    body: [
      'ToolNova is not directed at children under 13. We do not knowingly collect personal information from children under 13. If you believe we have inadvertently collected such information, please contact us immediately.',
    ],
  },
  {
    title: 'Changes to This Policy',
    body: [
      'We may update this Privacy Policy from time to time. When we do, we will update the "Last updated" date at the top of this page. Continued use of ToolNova after any changes constitutes your acceptance of the updated policy.',
    ],
  },
  {
    title: 'Contact Us',
    body: [
      'If you have any questions or concerns about this Privacy Policy or your data, please reach out via our Contact page and we will respond within 24 hours.',
    ],
  },
];

export default function PrivacyPage() {
  return (
    <>
      <SEOHead
        customTitle="Privacy Policy — ToolNova"
        customDesc="Learn how ToolNova collects, uses, and protects your information."
      />

      {/* Hero */}
      <section
        className="py-14 pb-16"
        style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}
      >
        <div className="max-w-3xl mx-auto px-5 sm:px-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors mb-7"
          >
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(255,255,255,0.18)', border: '1px solid rgba(255,255,255,0.28)' }}
            >
              <Shield className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-display font-extrabold text-3xl text-white tracking-tight">
                Privacy Policy
              </h1>
              <p className="text-white/55 text-sm mt-1">Last updated: May 16, 2025</p>
            </div>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-3xl mx-auto px-5 sm:px-8 py-14">
        {/* Intro */}
        <div
          className="rounded-2xl p-5 mb-10 flex items-start gap-4"
          style={{ background: 'rgba(79,70,229,0.06)', border: '1px solid rgba(79,70,229,0.14)' }}
        >
          <Shield className="w-5 h-5 mt-0.5 shrink-0" style={{ color: '#4F46E5' }} />
          <p className="text-[#475569] text-sm leading-relaxed">
            ToolNova is built on a simple principle: <strong className="text-[#0F172A]">use our tools without giving up your privacy.</strong>{' '}
            We collect as little data as possible, never sell it, and never use it to advertise to you.
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-10">
          {SECTIONS.map((sec, i) => (
            <div key={sec.title} className="border-b border-[#F1F5F9] pb-10 last:border-0 last:pb-0">
              <div className="flex items-center gap-3 mb-4">
                <span
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white shrink-0"
                  style={{ background: 'linear-gradient(135deg,#4F46E5,#7C3AED)' }}
                >
                  {i + 1}
                </span>
                <h2 className="font-display font-bold text-lg text-[#0F172A]">{sec.title}</h2>
              </div>
              <div className="space-y-3 pl-10">
                {sec.body.map((p, j) => (
                  <p key={j} className="text-[#475569] text-sm leading-relaxed">{p}</p>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer note */}
        <div className="mt-12 pt-8 border-t border-[#E2E8F0] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-xs text-[#94A3B8]">© {new Date().getFullYear()} ToolNova. All rights reserved.</p>
          <Link
            to="/contact"
            className="inline-flex items-center gap-1.5 text-sm font-semibold transition-colors"
            style={{ color: '#4F46E5' }}
          >
            Questions? Contact us →
          </Link>
        </div>
      </section>
    </>
  );
}
