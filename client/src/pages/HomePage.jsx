import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, ArrowRight, CheckCircle, Zap, Shield, Globe, Loader2,
  ImageIcon, FileText, Scissors, QrCode, Mic, Video,
  Lock, Palette, Type, Code, Eraser, RefreshCw,
  PenLine, ScanSearch, ShieldCheck, Wand2, Hash,
} from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import SEOHead from '@/components/seo/SEOHead';
import ToolCard from '@/components/tools/ToolCard';
import { CATEGORIES } from '@/data/tools';
import { useTools } from '@/hooks/useTools';

/* ── Category icon ─────────────────────────────────────────── */
function CatIcon({ icon, colored }) {
  if (!icon || (typeof icon === 'string' && icon.length <= 2)) {
    return <span className="text-base">{icon || '🔧'}</span>;
  }
  if (typeof icon === 'string') {
    const Icon = LucideIcons[icon] || LucideIcons.Wrench;
    return <Icon className={`w-7 h-7 ${colored ? 'text-white' : 'text-[var(--brand)]'}`} strokeWidth={2} />;
  }
  const Icon = icon;
  return <Icon className={`w-7 h-7 ${colored ? 'text-white' : 'text-[var(--brand)]'}`} strokeWidth={2} />;
}

/* ── Tool showcase tiles ───────────────────────────────────── */
const COL1_TILES = [
  { Icon: ImageIcon, name: 'Image Converter', color: 'text-blue-500' },
  { Icon: Scissors,  name: 'Audio Cutter',    color: 'text-purple-500' },
  { Icon: Mic,       name: 'Text to Speech',  color: 'text-orange-500' },
  { Icon: Lock,      name: 'Password Gen',    color: 'text-indigo-500' },
  { Icon: Type,      name: 'Word Counter',    color: 'text-teal-500' },
  { Icon: Eraser,    name: 'Background Remover', color: 'text-rose-500' },
];
const COL2_TILES = [
  { Icon: FileText,  name: 'PDF Merger',       color: 'text-red-500' },
  { Icon: QrCode,    name: 'QR Generator',     color: 'text-green-500' },
  { Icon: Video,     name: 'Video Compressor', color: 'text-pink-500' },
  { Icon: Palette,   name: 'Color Picker',     color: 'text-yellow-500' },
  { Icon: Code,      name: 'JSON Formatter',   color: 'text-cyan-500' },
  { Icon: RefreshCw, name: 'Unit Converter',   color: 'text-violet-500' },
];

function ToolTile({ Icon, name, color }) {
  return (
    <div className="flex flex-col items-center gap-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex-shrink-0">
      <Icon className={`w-6 h-6 ${color}`} strokeWidth={1.8} />
      <span className="text-xs text-gray-500 font-medium text-center leading-tight">{name}</span>
    </div>
  );
}

const CATEGORY_ORDER = ['ai-writing', 'text-tools', 'image-tools', 'media-tools', 'productivity', 'seo-tools'];

export default function HomePage() {
  const [search,   setSearch]   = useState('');
  const [category, setCategory] = useState('all');
  const { tools: allTools, loading } = useTools();

  const filtered = allTools.filter(t => {
    const matchSearch = !search ||
      t.title.toLowerCase().includes(search.toLowerCase()) ||
      t.shortDesc.toLowerCase().includes(search.toLowerCase());
    return matchSearch && (category === 'all' || t.category === category);
  });

  const showGrouped = category === 'all' && !search;
  const grouped = CATEGORY_ORDER
    .map(key => ({
      key,
      label: CATEGORIES[key]?.label || key,
      icon:  CATEGORIES[key]?.icon,
      tools: allTools.filter(t => t.category === key),
    }))
    .filter(g => g.tools.length > 0);

  return (
    <>
      <SEOHead
        customTitle="ToolNova — Free AI Tools for Writers, Students & Creators"
        customDesc="Free AI Humanizer, AI Detector, Plagiarism Checker, Tone Changer & Word Counter. No signup needed. Used by 50,000+ people."
      />

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-white min-h-[520px]">

        {/* Animated gradient orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden="true">
          {/* Orb 1 — large, blue-500/20, top-right */}
          <div
            className="absolute rounded-full bg-blue-500/20 blur-3xl"
            style={{ width: 520, height: 520, top: -120, right: -120, animation: 'float1 10s ease-in-out infinite' }}
          />
          {/* Orb 2 — medium, blue-300/15, bottom-left */}
          <div
            className="absolute rounded-full bg-blue-300/15 blur-3xl"
            style={{ width: 380, height: 380, bottom: -90, left: -90, animation: 'float2 8s ease-in-out infinite' }}
          />
          {/* Orb 3 — small, indigo-400/10, center-right */}
          <div
            className="absolute rounded-full bg-indigo-400/10 blur-3xl"
            style={{ width: 260, height: 260, top: '35%', right: '28%', animation: 'float3 6s ease-in-out infinite' }}
          />
        </div>

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 py-16 sm:py-24">
          <div className="flex items-center gap-10 xl:gap-16">

            {/* ── Left column ── */}
            <div className="flex-1 min-w-0">
              <p
                className="text-[#94A3B8] text-[11px] font-bold uppercase tracking-widest mb-4"
                style={{ animation: 'fadeInUp 0.5s ease 0s both' }}
              >
                WebTools
              </p>

              <h1
                className="font-display font-extrabold text-[2.4rem] sm:text-[3.2rem] leading-[1.06] text-[#0F172A] tracking-tight mb-8 max-w-[540px]"
                style={{ animation: 'fadeInUp 0.5s ease 0.1s both' }}
              >
                {allTools.length > 0 ? `${allTools.length}+` : '75+'} Useful Tools &amp; Utilities to make life easier.
              </h1>

              {/* Search bar */}
              <div
                className="relative w-full max-w-2xl"
                style={{ animation: 'fadeInUp 0.5s ease 0.2s both' }}
              >
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#94A3B8] pointer-events-none z-10" />
                <input
                  type="text"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setCategory('all'); }}
                  placeholder="Search any tool..."
                  className="w-full pl-12 pr-[108px] py-4 rounded-2xl border border-[#E2E8F0] text-[#0F172A] text-[15px] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#BFDBFE] shadow-md bg-white placeholder:text-[#94A3B8] transition-all duration-200"
                />
                <button
                  onClick={() => {}}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-[var(--brand)] hover:bg-[var(--brand-dark)] active:scale-95 text-white font-semibold text-sm px-5 py-2.5 rounded-xl transition-all duration-150"
                >
                  Search
                </button>
              </div>
            </div>

            {/* ── Right column — scrolling tool grid ── */}
            <div
              className="hidden lg:flex gap-3 flex-shrink-0 overflow-hidden"
              style={{
                width: 320,
                height: 420,
                animation: 'scaleIn 0.6s ease 0.3s both',
                maskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
                WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%)',
              }}
            >
              {/* Column 1 — scrolls upward */}
              <div className="flex flex-col gap-3 flex-1" style={{ animation: 'scrollUp 18s linear infinite' }}>
                {[...COL1_TILES, ...COL1_TILES].map((tile, i) => (
                  <ToolTile key={i} {...tile} />
                ))}
              </div>

              {/* Column 2 — scrolls downward */}
              <div className="flex flex-col gap-3 flex-1" style={{ animation: 'scrollDown 18s linear infinite' }}>
                {[...COL2_TILES, ...COL2_TILES].map((tile, i) => (
                  <ToolTile key={i} {...tile} />
                ))}
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ── TOOLS SECTION ───────────────────────────────────── */}
      <section className="bg-white py-10 pb-16">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">

          {/* Category filter pills */}
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-2 mb-8 flex-wrap">
            <button
              onClick={() => { setCategory('all'); setSearch(''); }}
              className={`px-4 py-2 rounded-full text-base font-semibold whitespace-nowrap border transition-all duration-150 cursor-pointer hover:scale-105 ${
                category === 'all'
                  ? 'text-white border-transparent shadow-sm'
                  : 'bg-white text-[#475569] border-[#E2E8F0] hover:border-[#BFDBFE] hover:text-[var(--brand)]'
              }`}
              style={category === 'all' ? { background: 'linear-gradient(135deg, var(--brand-gradient-from), var(--brand-gradient-to))' } : {}}
            >
              All Tools
            </button>
            {Object.entries(CATEGORIES).map(([key, cat]) => (
              <button
                key={key}
                onClick={() => { setCategory(key); setSearch(''); }}
                className={`px-4 py-2 rounded-full text-base font-semibold whitespace-nowrap border transition-all duration-150 cursor-pointer hover:scale-105 ${
                  category === key
                    ? 'text-white border-transparent shadow-sm'
                    : 'bg-white text-[#475569] border-[#E2E8F0] hover:border-[#BFDBFE] hover:text-[var(--brand)]'
                }`}
                style={category === key ? { background: 'linear-gradient(135deg, var(--brand-gradient-from), var(--brand-gradient-to))' } : {}}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Tool grid */}
          {loading && (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-7 h-7 animate-spin text-[var(--brand)]" />
            </div>
          )}

          {!loading && showGrouped ? (
            <div className="space-y-12">
              {grouped.map(group => (
                <div key={group.key}>
                  <div className="flex items-center gap-3 mb-5 pb-4 border-b border-[#F1F5F9]">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                      style={{ background: 'linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)' }}
                    >
                      <CatIcon icon={group.icon} colored />
                    </div>
                    <h2 className="font-display font-bold text-[1.4rem] text-[#0F172A]">{group.label}</h2>
                    <Link
                      to={`/category/${group.key}`}
                      className="ml-auto flex items-center gap-1 text-sm font-semibold transition-colors"
                      style={{ color: 'var(--brand)' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#4338CA'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--brand)'}
                    >
                      View all <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {group.tools.map(tool => <ToolCard key={tool.slug} tool={tool} />)}
                  </div>
                </div>
              ))}
            </div>
          ) : !loading && filtered.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filtered.map(tool => <ToolCard key={tool.slug} tool={tool} />)}
            </div>
          ) : !loading ? (
            <div className="text-center py-20 border border-dashed border-[#E2E8F0] rounded-2xl bg-[#F8FAFC]">
              <Search className="w-10 h-10 mx-auto mb-3 text-[#CBD5E1]" />
              <p className="font-semibold text-[#0F172A]">No tools found for &ldquo;{search}&rdquo;</p>
              <p className="text-sm text-[#94A3B8] mt-1">Try a different keyword</p>
              <button
                onClick={() => { setSearch(''); setCategory('all'); }}
                className="mt-4 text-sm font-semibold underline transition-colors"
                style={{ color: 'var(--brand)' }}
              >
                Clear search
              </button>
            </div>
          ) : null}
        </div>
      </section>

      {/* ── WHY US ─────────────────────────────────────────── */}
      <section className="py-20 bg-[#F8FAFC] border-t border-[#E2E8F0]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-14">
            <div
              className="inline-flex items-center gap-2 text-xs font-bold px-4 py-1.5 rounded-full mb-4"
              style={{ background: 'color-mix(in srgb, var(--brand), transparent 92%)', color: 'var(--brand)', border: '1px solid color-mix(in srgb, var(--brand), transparent 85%)' }}
            >
              <Zap className="w-3.5 h-3.5" /> Why ToolNova
            </div>
            <h2 className="font-display font-bold text-3xl sm:text-4xl text-[#0F172A] tracking-tight mt-2">
              Everything you need, nothing you don't
            </h2>
            <p className="text-[#64748B] mt-3 max-w-lg mx-auto text-sm leading-relaxed">
              No ads, no paywalls. Just the best free AI tools, ready when you are.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              { icon: Zap,    grad: 'linear-gradient(135deg,#F59E0B,#EF4444)', title: 'Instant Results',   desc: 'AI-powered output in 2–4 seconds using Google Gemini. No waiting, no queues — just fast results.' },
              { icon: Shield, grad: 'linear-gradient(135deg,var(--brand-gradient-from),var(--brand-gradient-to))', title: 'Privacy First',     desc: 'Your text is never stored or shared. Every request is processed in real time and immediately discarded.' },
              { icon: Globe,  grad: 'linear-gradient(135deg,var(--brand-gradient-from),var(--brand-gradient-to))', title: 'Works Everywhere',  desc: 'Fully responsive on mobile, tablet, and desktop. Open your browser and start — no app needed.' },
            ].map(({ icon: Icon, grad, title, desc }) => (
              <div
                key={title}
                className="bg-white rounded-2xl p-6 border border-[#E2E8F0] hover:-translate-y-0.5 transition-all duration-200"
                style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.05)' }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(37,99,235,0.10)'; e.currentTarget.style.borderColor = '#BFDBFE'; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(15,23,42,0.05)'; e.currentTarget.style.borderColor = '#E2E8F0'; }}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: grad }}>
                  <Icon className="w-5 h-5 text-white" strokeWidth={2} />
                </div>
                <h3 className="font-display font-bold text-[#0F172A] text-[0.95rem] mb-2">{title}</h3>
                <p className="text-[#64748B] text-sm leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES HIGHLIGHT ─────────────────────────────── */}
      <section className="py-20 bg-white border-t border-[#E2E8F0]">
        <div className="max-w-6xl mx-auto px-5 sm:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-14 items-center">

            {/* Left */}
            <div>
              <div
                className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full mb-5"
                style={{ background: 'color-mix(in srgb, var(--brand), transparent 92%)', color: 'var(--brand)', border: '1px solid color-mix(in srgb, var(--brand), transparent 85%)' }}
              >
                <CheckCircle className="w-3.5 h-3.5" /> Built Different
              </div>
              <h2 className="font-display font-bold text-3xl text-[#0F172A] tracking-tight mt-2 mb-5">
                The tools you need, exactly when you need them
              </h2>
              <p className="text-[#64748B] leading-relaxed mb-8 text-sm">
                No fluff, no upsells. Every tool on ToolNova is designed to solve a real problem — fast.
              </p>
              <ul className="space-y-3.5">
                {[
                  'No account or credit card needed ever',
                  'Powered by Google Gemini AI',
                  'Results in under 4 seconds',
                  'Works on any device and browser',
                  'Your data is never stored or sold',
                ].map(point => (
                  <li key={point} className="flex items-center gap-3 text-sm text-[#475569]">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: 'linear-gradient(135deg, var(--brand-gradient-from), var(--brand-gradient-to))' }}
                    >
                      <CheckCircle className="w-3 h-3 text-white" />
                    </div>
                    {point}
                  </li>
                ))}
              </ul>
            </div>

            {/* Right — mini tool preview cards */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'AI Humanizer',      desc: 'Make AI text sound human',   Icon: PenLine,     iconCls: 'text-blue-500',    iconBg: '#DBEAFE', bg: '#EFF6FF' },
                { label: 'AI Detector',       desc: 'Spot AI-written content',    Icon: ScanSearch,  iconCls: 'text-indigo-500',  iconBg: '#E0E7FF', bg: '#EEF2FF' },
                { label: 'Plagiarism Check',  desc: 'Verify text originality',    Icon: ShieldCheck, iconCls: 'text-emerald-500', iconBg: '#D1FAE5', bg: '#ECFDF5' },
                { label: 'Tone Changer',      desc: 'Rewrite in any tone',        Icon: Wand2,       iconCls: 'text-rose-500',    iconBg: '#FFE4E6', bg: '#FFF1F2' },
                { label: 'Word Counter',      desc: 'Live stats as you type',     Icon: Hash,        iconCls: 'text-amber-500',   iconBg: '#FEF3C7', bg: '#FFFBEB' },
                { label: 'Summarizer',        desc: 'Condense long text fast',    Icon: FileText,    iconCls: 'text-sky-500',     iconBg: '#BAE6FD', bg: '#F0F9FF' },
              ].map(({ label, desc, Icon, iconCls, iconBg, bg }) => (
                <div
                  key={label}
                  className="rounded-xl p-4 border border-[#E2E8F0] hover:-translate-y-0.5 transition-all duration-200 cursor-default"
                  style={{ background: bg }}
                >
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center mb-2.5"
                    style={{ background: iconBg }}
                  >
                    <Icon className={`w-4 h-4 ${iconCls}`} strokeWidth={2} />
                  </div>
                  <p className="font-semibold text-[#0F172A] text-xs leading-tight">{label}</p>
                  <p className="text-[#94A3B8] text-[11px] mt-0.5 leading-snug">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
