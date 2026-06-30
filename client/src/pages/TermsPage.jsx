import { Link } from 'react-router-dom';
import { FileText, ArrowLeft } from 'lucide-react';
import SEOHead from '@/components/seo/SEOHead';

const SECTIONS = [
  {
    title: 'Acceptance of Terms',
    body: [
      'By accessing or using Global Tech Tools ("the Service"), you agree to be bound by these Terms of Service. If you do not agree with any part of these terms, you may not use the Service.',
      'These Terms apply to all visitors, users, and others who access or use the Service.',
    ],
  },
  {
    title: 'Description of Service',
    body: [
      'Global Tech Tools provides a collection of free AI-powered and text-based tools including, but not limited to, an AI Humanizer, AI Detector, Plagiarism Checker, Tone Changer, Word Counter, and Summarizer.',
      'All tools are provided free of charge with a daily usage limit. No account is required to use the tools. Providing an email address may unlock additional daily uses.',
    ],
  },
  {
    title: 'Acceptable Use',
    body: [
      'You agree to use Global Tech Tools only for lawful purposes. You must not use the Service to process, generate, or distribute content that is illegal, harmful, abusive, defamatory, or infringes on the rights of others.',
      'You must not attempt to reverse-engineer, scrape, overload, or otherwise interfere with the Service or its underlying infrastructure.',
      'You must not use automated bots, scripts, or tools to artificially inflate usage or circumvent rate limits.',
      'Academic use: While our tools may assist with writing tasks, you are solely responsible for ensuring that your use of AI-generated content complies with your institution\'s academic integrity policies.',
    ],
  },
  {
    title: 'Intellectual Property',
    body: [
      'The Global Tech Tools website, branding, design, and code are the intellectual property of Global Tech Tools and are protected by copyright law.',
      'Content you submit to the tools remains yours. We claim no ownership over your input text or the outputs generated from it.',
      'AI-generated outputs are produced by third-party models (Google Gemini). We make no claim of authorship over such outputs and you use them at your own discretion.',
    ],
  },
  {
    title: 'Disclaimers & Limitation of Liability',
    body: [
      'The Service is provided "as is" and "as available" without any warranties of any kind, either express or implied, including but not limited to fitness for a particular purpose or accuracy.',
      'AI-generated content may contain errors, inaccuracies, or inappropriate material. Always review AI outputs before using them professionally, academically, or publicly.',
      'Global Tech Tools shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising from your use of, or inability to use, the Service.',
      'Our total liability to you for any claim arising under these Terms shall not exceed $0, as the Service is provided free of charge.',
    ],
  },
  {
    title: 'Third-Party Services',
    body: [
      'Our AI tools are powered by Google Gemini. By using these tools, you also agree to Google\'s Terms of Service and acceptable use policies.',
      'We are not responsible for the availability, accuracy, or content produced by third-party AI providers.',
    ],
  },
  {
    title: 'Service Availability & Modifications',
    body: [
      'We reserve the right to modify, suspend, or discontinue any part of the Service at any time without notice.',
      'We may update these Terms from time to time. Continued use of the Service after any changes constitutes your acceptance of the new Terms.',
      'We will update the "Last updated" date at the top of this page when changes are made.',
    ],
  },
  {
    title: 'Governing Law',
    body: [
      'These Terms shall be governed by and construed in accordance with applicable law. Any disputes arising under these Terms shall be resolved through good-faith negotiation before pursuing any other remedy.',
    ],
  },
  {
    title: 'Contact',
    body: [
      'If you have questions about these Terms, please contact us through our Contact page. We aim to respond within 24 hours.',
    ],
  },
];

export default function TermsPage() {
  return (
    <>
      <SEOHead
        customTitle="Terms of Service — Global Tech Tools"
        customDesc="Read the Global Tech Tools Terms of Service to understand your rights and responsibilities when using our free tools."
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
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="font-display font-extrabold text-3xl text-white tracking-tight">
                Terms of Service
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
          <FileText className="w-5 h-5 mt-0.5 shrink-0" style={{ color: '#4F46E5' }} />
          <p className="text-[#475569] text-sm leading-relaxed">
            Please read these Terms of Service carefully before using Global Tech Tools.{' '}
            <strong className="text-[#0F172A]">By using our tools, you agree to these terms.</strong>{' '}
            They are written in plain language — no legal jargon.
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
          <p className="text-xs text-[#94A3B8]">© {new Date().getFullYear()} Global Tech Tools. All rights reserved.</p>
          <div className="flex items-center gap-5">
            <Link to="/privacy" className="text-sm font-medium text-[#64748B] hover:text-[#4F46E5] transition-colors">
              Privacy Policy
            </Link>
            <Link
              to="/contact"
              className="text-sm font-semibold transition-colors"
              style={{ color: '#4F46E5' }}
            >
              Contact us →
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
