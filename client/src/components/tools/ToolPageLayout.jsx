import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import * as Icons from 'lucide-react';
import {
  ChevronRight, Plus, Minus, ArrowRight,
  CheckCircle2, Zap, Users, Clock,
} from 'lucide-react';
import api from '@/services/api';
import { useToolData } from '@/hooks/useToolData';
import AdSlot from '@/components/ads/AdSlot';

// ── Dynamic lucide icon from string name ─────────────────────
function ToolIcon({ name, size = 'md' }) {
  const Icon = (name && Icons[name]) ? Icons[name] : Icons.Wrench;
  const sz = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-7 h-7' }[size] || 'w-6 h-6';
  return <Icon className={sz} strokeWidth={1.75} />;
}

// ── Category labels ──────────────────────────────────────────
const CAT_LABEL = {
  'ai-writing':   'AI Writing',
  'text-tools':   'Text Tools',
  'image-tools':  'Image Tools',
  'media-tools':  'Media Tools',
  'productivity': 'Productivity',
  'seo-tools':    'SEO Tools',
};

// ── Loading skeleton ─────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 animate-pulse">
      {/* Breadcrumb */}
      <div className="flex gap-2 mb-8">
        <div className="h-3 w-12 bg-surface-3 rounded" />
        <div className="h-3 w-3 bg-surface-3 rounded" />
        <div className="h-3 w-24 bg-surface-3 rounded" />
        <div className="h-3 w-3 bg-surface-3 rounded" />
        <div className="h-3 w-32 bg-surface-3 rounded" />
      </div>
      {/* Hero */}
      <div className="flex gap-5 mb-10">
        <div className="w-16 h-16 bg-surface-3 rounded-2xl shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="h-8 w-64 bg-surface-3 rounded-xl" />
          <div className="h-4 w-full bg-surface-3 rounded" />
          <div className="h-4 w-2/3 bg-surface-3 rounded" />
        </div>
      </div>
      {/* Tool area */}
      <div className="h-72 bg-surface-3 rounded-2xl mb-10" />
      {/* Steps */}
      <div className="h-4 w-48 bg-surface-3 rounded mb-6" />
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex gap-4 mb-4">
          <div className="w-8 h-8 bg-surface-3 rounded-full shrink-0" />
          <div className="h-4 flex-1 bg-surface-3 rounded mt-2" />
        </div>
      ))}
    </div>
  );
}

// ── 404 / Inactive state ─────────────────────────────────────
function ToolNotFound() {
  const navigate = useNavigate();
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-20 h-20 bg-surface-2 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-border">
          <Icons.SearchX className="w-9 h-9 text-text-muted" strokeWidth={1.5} />
        </div>
        <h1 className="font-display font-bold text-2xl text-primary mb-2">Tool Not Found</h1>
        <p className="text-text-secondary mb-8">
          This tool doesn't exist or is currently disabled. Browse all available tools below.
        </p>
        <button
          onClick={() => navigate('/')}
          className="btn-primary px-8 py-3"
        >
          Browse All Tools
        </button>
      </div>
    </div>
  );
}

// ── Section 3: How To Use ────────────────────────────────────
function HowToUse({ steps, toolTitle }) {
  if (!steps?.length) return null;
  return (
    <section className="mt-16">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-8 h-8 bg-[#EFF6FF] rounded-lg flex items-center justify-center border" style={{ borderColor: 'color-mix(in srgb, var(--brand), transparent 80%)' }}>
          <CheckCircle2 className="w-4 h-4 text-[var(--brand)]" />
        </div>
        <h2 className="font-display font-bold text-xl text-primary tracking-tight">
          How to Use {toolTitle}
        </h2>
      </div>

      <div className="relative">
        {/* Vertical connector line */}
        <div
          className="absolute left-[18px] top-9 bottom-9 w-px"
          style={{ background: 'linear-gradient(to bottom, color-mix(in srgb, var(--brand), transparent 70%), transparent)' }}
          aria-hidden="true"
        />

        <ol className="space-y-5">
          {steps.map((step, i) => (
            <li key={i} className="flex gap-5 items-start group">
              {/* Number badge */}
              <div className="relative z-10 w-9 h-9 rounded-full bg-white border-2 text-[var(--brand)] font-bold text-sm flex items-center justify-center shrink-0 transition-colors duration-200 shadow-sm" style={{ borderColor: 'color-mix(in srgb, var(--brand), transparent 70%)' }}>
                {i + 1}
              </div>
              {/* Step text */}
              <div className="flex-1 bg-white border border-border rounded-xl px-5 py-3.5 shadow-xs group-hover:border-border-strong group-hover:shadow-sm transition-all duration-200 mt-0.5">
                <p className="text-text-secondary text-sm leading-relaxed">{step}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ── Section 4: FAQ ───────────────────────────────────────────
function FAQ({ faqs }) {
  const [open, setOpen] = useState(null);
  if (!faqs?.length) return null;

  return (
    <section className="mt-16">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-8 h-8 bg-[#EFF6FF] rounded-lg flex items-center justify-center border" style={{ borderColor: 'color-mix(in srgb, var(--brand), transparent 80%)' }}>
          <Icons.HelpCircle className="w-4 h-4 text-[var(--brand)]" />
        </div>
        <h2 className="font-display font-bold text-xl text-primary tracking-tight">
          Frequently Asked Questions
        </h2>
      </div>

      <div className="space-y-2.5">
        {faqs.map((faq, i) => (
          <div
            key={i}
            className={`bg-white border rounded-xl overflow-hidden transition-all duration-200 ${
              open === i ? 'shadow-sm' : 'border-border hover:border-border-strong'
            }`}
            style={open === i ? { borderColor: 'color-mix(in srgb, var(--brand), transparent 70%)' } : {}}
          >
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full text-left px-5 py-4 flex items-start justify-between gap-4 group"
              aria-expanded={open === i}
            >
              <span className="font-semibold text-text-primary text-sm leading-snug pt-0.5">
                {faq.question}
              </span>
              <span className={`shrink-0 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-200 mt-0.5 ${
                open === i
                  ? 'bg-[var(--brand)] text-white'
                  : 'bg-surface-2 border border-border text-text-muted group-hover:border-border-strong'
              }`}>
                {open === i
                  ? <Minus className="w-3 h-3" />
                  : <Plus className="w-3 h-3" />
                }
              </span>
            </button>

            <div className={`grid transition-all duration-250 ease-in-out ${
              open === i ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}>
              <div className="overflow-hidden">
                <div className="px-5 pb-5 pt-0">
                  <div className="h-px bg-border mb-4" />
                  <p className="text-text-secondary text-sm leading-relaxed">{faq.answer}</p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Section 5: Related Tools ─────────────────────────────────
function RelatedTools({ slugs }) {
  const [tools, setTools] = useState([]);

  useEffect(() => {
    if (!slugs?.length) return;
    Promise.all(
      slugs.slice(0, 3).map(s =>
        api.get(`/tools/${s}`).then(d => d.tool).catch(() => null)
      )
    ).then(results => setTools(results.filter(Boolean)));
  }, [slugs]);

  if (!tools.length) return null;

  return (
    <section className="mt-16">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-8 h-8 bg-[#EFF6FF] rounded-lg flex items-center justify-center border" style={{ borderColor: 'color-mix(in srgb, var(--brand), transparent 80%)' }}>
          <Icons.LayoutGrid className="w-4 h-4 text-[var(--brand)]" />
        </div>
        <h2 className="font-display font-bold text-xl text-primary tracking-tight">
          Related Tools
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {tools.map(tool => (
          <Link
            key={tool.slug}
            to={`/tools/${tool.slug}`}
            className="group bg-white border border-border rounded-2xl p-4 flex items-center gap-4 hover:shadow-card transition-all duration-200"
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'color-mix(in srgb, var(--brand), transparent 70%)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = ''; }}
          >
            <div className="w-11 h-11 bg-[#EFF6FF] rounded-xl flex items-center justify-center border shrink-0 transition-colors duration-200" style={{ borderColor: 'color-mix(in srgb, var(--brand), transparent 85%)' }}>
              <ToolIcon name={tool.icon} size="sm" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-primary group-hover:text-[var(--brand)] transition-colors duration-150 truncate">
                {tool.title}
              </p>
              <p className="text-xs text-text-muted mt-0.5 line-clamp-1">{tool.shortDesc}</p>
            </div>
            <ArrowRight className="w-4 h-4 text-text-muted shrink-0 group-hover:text-[var(--brand)] group-hover:translate-x-0.5 transition-all duration-150" />
          </Link>
        ))}
      </div>
    </section>
  );
}

// ── Section 6: What / Who / When ─────────────────────────────
function InfoCards({ tool }) {
  if (!tool.whatItDoes && !tool.whoShouldUse && !tool.whenToUse) return null;

  const cards = [
    { icon: Zap,   label: 'What It Does',     text: tool.whatItDoes },
    { icon: Users, label: 'Who Should Use It', text: tool.whoShouldUse },
    { icon: Clock, label: 'When To Use It',    text: tool.whenToUse },
  ].filter(c => c.text);

  return (
    <section className="mt-16 mb-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map(({ icon: Icon, label, text }) => (
          <div
            key={label}
            className="bg-white border border-border rounded-2xl p-5 shadow-xs hover:shadow-sm hover:border-border-strong transition-all duration-200"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-[#EFF6FF] rounded-lg flex items-center justify-center border" style={{ borderColor: 'color-mix(in srgb, var(--brand), transparent 85%)' }}>
                <Icon className="w-3.5 h-3.5 text-[var(--brand)]" strokeWidth={2} />
              </div>
              <p className="text-xs font-bold text-text-muted uppercase tracking-wider">{label}</p>
            </div>
            <p className="text-text-secondary text-sm leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ── Main layout ──────────────────────────────────────────────
export default function ToolPageLayout({ slug, children }) {
  const { tool, loading, notFound } = useToolData(slug);

  if (loading) return <PageSkeleton />;
  if (notFound || !tool) return <ToolNotFound />;

  const catLabel = CAT_LABEL[tool.category] || tool.category;

  return (
    <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">

      {/* ── Breadcrumb ───────────────────────────────────────── */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-text-muted mb-8 flex-wrap">
        <Link to="/" className="hover:text-[var(--brand)] transition-colors duration-150 font-medium">Home</Link>
        <ChevronRight className="w-3 h-3 text-border-strong" />
        <Link
          to={`/category/${tool.category}`}
          className="hover:text-[var(--brand)] transition-colors duration-150"
        >
          {catLabel}
        </Link>
        <ChevronRight className="w-3 h-3 text-border-strong" />
        <span className="text-text-secondary font-medium truncate max-w-[200px]">{tool.title}</span>
      </nav>

      {/* ── Section 1: Tool Header ───────────────────────────── */}
      <header className="mb-10">
        <div className="flex items-start gap-5">
          {/* Icon */}
          <div className="w-12 h-12 sm:w-16 sm:h-16 bg-[#EFF6FF] rounded-2xl flex items-center justify-center border shadow-sm shrink-0" style={{ borderColor: 'color-mix(in srgb, var(--brand), transparent 80%)' }}>
            <ToolIcon name={tool.icon} size="lg" />
          </div>

          {/* Meta */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h1 className="font-display font-bold text-2xl sm:text-3xl text-primary tracking-tight leading-tight">
                {tool.title}
              </h1>
              <span className="badge-accent">Free · No Signup</span>
              {tool.usageCount > 0 && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-text-muted bg-surface-2 border border-border px-2.5 py-1 rounded-full">
                  <Icons.TrendingUp className="w-3 h-3" />
                  {tool.usageCount.toLocaleString()} uses
                </span>
              )}
            </div>

            <p className="text-text-secondary leading-relaxed max-w-2xl">
              {tool.longDesc || tool.shortDesc}
            </p>

            <div className="flex items-center gap-2 flex-wrap mt-3">
              <span className="inline-flex items-center gap-1 text-xs font-medium text-text-muted bg-surface-2 border border-border px-2.5 py-1 rounded-full capitalize">
                {catLabel}
              </span>
              {tool.tags?.slice(0, 3).map(tag => (
                <span key={tag} className="inline-flex items-center text-xs text-text-muted bg-surface-2 border border-border px-2 py-0.5 rounded-full">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        </div>
      </header>

      {/* ── Ad: Below Tool Header ────────────────────────────── */}
      <AdSlot slot="belowToolHeader" />

      {/* ── Section 2: Tool Interface (children) ────────────── */}
      <section aria-label="Tool interface">
        {children}
      </section>

      {/* ── Ad: Below Tool Interface ──────────────────────────── */}
      <AdSlot slot="belowToolInterface" />

      {/* ── Divider ─────────────────────────────────────────── */}
      <div className="mt-16 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

      {/* ── Section 3: How To Use ────────────────────────────── */}
      <HowToUse steps={tool.howToUse} toolTitle={tool.title} />

      {/* ── Section 4: FAQ ───────────────────────────────────── */}
      <FAQ faqs={tool.faqs} />

      {/* ── Ad: Between FAQ & Related Tools ─────────────────── */}
      <AdSlot slot="betweenFaqAndRelated" />

      {/* ── Section 5: Related Tools ─────────────────────────── */}
      <RelatedTools slugs={tool.relatedTools} />

      {/* ── Section 6: What / Who / When ────────────────────── */}
      <InfoCards tool={tool} />

      {/* Bottom padding */}
      <div className="h-12" />
    </main>
  );
}
