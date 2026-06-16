import { useState } from 'react';
import { Search, Globe, AlertCircle, Check, X, ChevronRight, Loader2, CheckCircle2, XCircle, AlertTriangle, FileText, Hash, Link2, Share2, Lightbulb, Sparkles, BarChart2 } from 'lucide-react';
import { useSeoAnalyze } from '@/hooks/useSeoAnalyze';

// These slugs accept optional pasted text alongside a URL
const NEEDS_TEXT = new Set([
  'keyword-density-analyzer', 'keyword-cloud-density',
  'json-ld-validator', 'amp-validator',
]);

// ── Sub-renderers ────────────────────────────────────────────────────────────

function ScoreRing({ score }) {
  const color = score >= 80 ? '#22C55E' : score >= 50 ? '#F59E0B' : '#EF4444';
  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return (
    <div className="flex flex-col items-center flex-shrink-0">
      <svg width="96" height="96" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="#E5E7EB" strokeWidth="8" />
        <circle
          cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
        <text x="50" y="55" textAnchor="middle" fontSize="20" fontWeight="bold" fill={color}>{score}</text>
      </svg>
      <p className="text-xs font-semibold text-text-muted -mt-1">Score</p>
    </div>
  );
}

function ChecksGrid({ checks }) {
  const labels = {
    hasTitle: 'Title Tag', hasMeta: 'Meta Description', hasH1: 'H1 Tag',
    hasFavicon: 'Favicon', hasCanonical: 'Canonical URL', hasOG: 'Open Graph',
    hasViewport: 'Viewport Meta', hasRobots: 'Robots.txt',
    hasStructuredData: 'Structured Data', isMobileReady: 'Mobile Ready',
    isHttps: 'HTTPS', hasManifest: 'Web Manifest', hasThemeColor: 'Theme Color',
    hasAppleIcon: 'Apple Touch Icon', hasSWRegistration: 'Service Worker',
  };
  return (
    <div className="grid grid-cols-2 gap-2">
      {Object.entries(checks).map(([key, val]) => (
        <div
          key={key}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium ${
            val
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-600'
          }`}
        >
          {val ? <Check className="w-3.5 h-3.5 flex-shrink-0" /> : <X className="w-3.5 h-3.5 flex-shrink-0" />}
          {labels[key] || key}
        </div>
      ))}
    </div>
  );
}

function KwTable({ title, items, cols }) {
  if (!items?.length) return null;
  return (
    <div>
      <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">{title}</p>
      <div className="border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 border-b border-border">
            <tr>
              {cols.map(c => (
                <th key={c.key} className="text-left px-3 py-2 text-xs font-semibold text-text-muted">{c.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.slice(0, 15).map((item, i) => (
              <tr key={i} className="border-b border-border last:border-0 hover:bg-surface-2/50">
                {cols.map(c => (
                  <td key={c.key} className={`px-3 py-2 ${c.muted ? 'text-text-muted' : 'text-text-primary'}`}>
                    {item[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Full SEO Analyzer components ─────────────────────────────────────────────

function CheckRow({ pass, warn = false, label, detail, points }) {
  const bgCls = pass ? 'bg-green-50 border-green-100' : warn ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100';
  const Icon  = pass ? CheckCircle2 : warn ? AlertTriangle : XCircle;
  const iconCls = pass ? 'text-green-500' : warn ? 'text-amber-500' : 'text-red-500';
  return (
    <div className={`flex items-start gap-2.5 px-3 py-2.5 rounded-lg border ${bgCls}`}>
      <Icon className={`w-4 h-4 flex-shrink-0 mt-0.5 ${iconCls}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-text-primary">{label}</span>
          {points !== undefined && (
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${
              pass ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
            }`}>{pass ? `+${points}` : '0 pts'}</span>
          )}
        </div>
        {detail && <p className="text-[11px] text-text-muted mt-0.5 break-words leading-relaxed">{detail}</p>}
      </div>
    </div>
  );
}

function SectionLabel({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-2 pt-1">
      <Icon className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
      <span className="text-[10px] font-bold text-text-primary uppercase tracking-widest">{label}</span>
      <div className="flex-1 h-px bg-slate-200" />
    </div>
  );
}

function FullSeoResult({ result }) {
  const {
    score, title, metaDescription, headings, images, links,
    technical, performance, openGraph, twitter,
    scoreBreakdown: sb = {}, recommendations = [],
  } = result;

  const scoreColor = score >= 71 ? '#22C55E' : score >= 41 ? '#F59E0B' : '#EF4444';
  const scoreLabel = score >= 71 ? 'Good' : score >= 41 ? 'Needs Work' : 'Poor';
  const scoreBgCls = score >= 71
    ? 'bg-green-50 border-green-200'
    : score >= 41 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200';

  const circ = 2 * Math.PI * 50;
  const dash = circ - (score / 100) * circ;

  // Support both old shape (h2: number) and new shape (h2: {count, items})
  const h1      = headings?.h1 || {};
  const h2Raw   = headings?.h2;
  const h3Raw   = headings?.h3;
  const h2Count = typeof h2Raw === 'object' ? (h2Raw?.count ?? 0) : (h2Raw ?? 0);
  const h3Count = typeof h3Raw === 'object' ? (h3Raw?.count ?? 0) : (h3Raw ?? 0);
  const h4Count = headings?.h4?.count ?? 0;
  const h1Items = h1?.items ?? (h1?.text ? [h1.text] : []);
  const h2Items = typeof h2Raw === 'object' ? (h2Raw?.items ?? []) : [];
  const h3Items = typeof h3Raw === 'object' ? (h3Raw?.items ?? []) : [];

  const allHeadings = [
    ...h1Items.map(t => ({ level: 'H1', t })),
    ...h2Items.map(t => ({ level: 'H2', t })),
    ...h3Items.map(t => ({ level: 'H3', t })),
  ];

  const errors   = recommendations.filter(r => r.type === 'error');
  const warnings = recommendations.filter(r => r.type === 'warning');
  const infos    = recommendations.filter(r => r.type === 'info');

  return (
    <div className="space-y-2.5">

      {/* Score banner */}
      <div className={`flex items-center gap-4 p-4 rounded-xl border ${scoreBgCls}`}>
        <svg width="104" height="104" viewBox="0 0 120 120" className="flex-shrink-0">
          <circle cx="60" cy="60" r="50" fill="none" stroke="#E5E7EB" strokeWidth="10" />
          <circle cx="60" cy="60" r="50" fill="none" stroke={scoreColor} strokeWidth="10"
            strokeDasharray={circ} strokeDashoffset={dash} strokeLinecap="round"
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 1s ease' }} />
          <text x="60" y="56" textAnchor="middle" fontSize="26" fontWeight="bold" fill={scoreColor}>{score}</text>
          <text x="60" y="72" textAnchor="middle" fontSize="11" fill="#6B7280">/ 100</text>
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-lg font-bold text-text-primary leading-tight">{scoreLabel} SEO</p>
          <p className="text-xs text-text-muted mt-0.5">{score} / 100 points</p>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-xs text-text-muted">
            {links?.internal !== undefined && <span>{links.internal} internal links</span>}
            {links?.external !== undefined && <span>{links.external} external links</span>}
            {technical?.wordCount !== undefined && (
              <span>{technical.wordCount.toLocaleString()} words</span>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <SectionLabel icon={FileText} label="Content" />
      <div className="space-y-1.5">
        <CheckRow
          pass={title?.present ?? title?.length > 0}
          label="Title Tag" points={10}
          detail={title?.text
            ? `"${title.text.slice(0, 72)}${title.text.length > 72 ? '…' : ''}" — ${title.length} chars`
            : 'No title tag found'} />
        <CheckRow
          pass={!!sb.titleOptimal}
          warn={(title?.present ?? title?.length > 0) && !sb.titleOptimal}
          label="Title Length (50–60 chars ideal)" points={5}
          detail={title?.length > 0
            ? `${title.length} chars — ${title.length < 50 ? 'too short' : title.length > 60 ? 'too long' : 'optimal ✓'}`
            : 'No title to measure'} />
        <CheckRow
          pass={metaDescription?.present ?? metaDescription?.length > 0}
          label="Meta Description" points={10}
          detail={metaDescription?.text
            ? `"${metaDescription.text.slice(0, 88)}${metaDescription.text.length > 88 ? '…' : ''}" — ${metaDescription.length} chars`
            : 'No meta description found'} />
        <CheckRow
          pass={!!sb.metaOptimal}
          warn={(metaDescription?.present ?? metaDescription?.length > 0) && !sb.metaOptimal}
          label="Meta Description Length (150–160 chars ideal)" points={5}
          detail={metaDescription?.length > 0
            ? `${metaDescription.length} chars — ${metaDescription.length < 150 ? 'too short' : metaDescription.length > 160 ? 'too long' : 'optimal ✓'}`
            : 'No description to measure'} />
        <CheckRow
          pass={sb.wordCountGood ?? (technical?.wordCount >= 300)}
          warn={!sb.wordCountGood && (technical?.wordCount ?? 0) > 0}
          label="Word Count (300+ recommended)" points={10}
          detail={`${(technical?.wordCount ?? 0).toLocaleString()} words${(technical?.wordCount ?? 0) < 300 ? ' — consider adding more content' : ''}`} />
      </div>

      {/* Headings */}
      <SectionLabel icon={Hash} label="Heading Structure" />
      <div className="space-y-1.5">
        <CheckRow
          pass={sb.h1Present ?? (h1?.count ?? h1Items.length) > 0}
          label="H1 Tag" points={10}
          detail={(h1?.count ?? h1Items.length) > 0
            ? (h1Items[0] ? `"${h1Items[0].slice(0, 72)}${h1Items[0].length > 72 ? '…' : ''}"` : `${h1.count} H1 found`)
            : 'Critical: No H1 tag found on this page'} />
        <CheckRow
          pass={sb.headingGood ?? headings?.isGood}
          warn={(sb.h1Present ?? h1Items.length > 0) && !(sb.headingGood ?? headings?.isGood)}
          label="Heading Structure" points={5}
          detail={`H1: ${h1?.count ?? h1Items.length}  •  H2: ${h2Count}  •  H3: ${h3Count}${h4Count ? `  •  H4: ${h4Count}` : ''}${(h1?.count ?? h1Items.length) > 1 ? ' — multiple H1s detected' : h2Count === 0 ? ' — no H2 subheadings' : ''}`} />
        {allHeadings.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest px-3 py-1.5 bg-slate-50 border-b border-slate-200">
              Headings Found
            </p>
            <div className="max-h-36 overflow-y-auto">
              {allHeadings.map((h, i) => (
                <div key={i} className="flex items-baseline gap-2 px-3 py-1.5 border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <span className={`text-[10px] font-bold flex-shrink-0 w-5 ${
                    h.level === 'H1' ? 'text-purple-600' : h.level === 'H2' ? 'text-blue-600' : 'text-slate-400'
                  }`}>{h.level}</span>
                  <span className="text-xs text-text-secondary truncate">{h.t}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Technical */}
      <SectionLabel icon={Link2} label="Technical SEO" />
      <div className="space-y-1.5">
        <CheckRow
          pass={sb.allImgsHaveAlt ?? images?.allHaveAlt ?? images?.total === 0}
          warn={images?.total > 0 && !(sb.allImgsHaveAlt ?? images?.allHaveAlt) && (images?.withoutAlt ?? 0) <= (images?.total ?? 0) / 2}
          label="Image Alt Text" points={10}
          detail={images?.total === 0
            ? 'No images found'
            : `${images.withAlt} of ${images.total} images have alt text${images.withoutAlt > 0 ? ` (${images.withoutAlt} missing)` : ' ✓'}`} />
        <CheckRow
          pass={sb.canonicalPresent ?? !!technical?.canonical}
          label="Canonical Tag" points={5}
          detail={technical?.canonical
            ? `${technical.canonical.slice(0, 64)}${technical.canonical.length > 64 ? '…' : ''}`
            : 'No canonical URL — may cause duplicate content issues'} />
        <CheckRow
          pass={sb.viewportPresent ?? technical?.hasViewport}
          label="Viewport Meta (Mobile)" points={10}
          detail={technical?.hasViewport ? 'Mobile viewport configured ✓' : 'Missing viewport meta — required for mobile'} />
        {performance && (
          <CheckRow
            pass={sb.fastResponse ?? performance?.isFast}
            warn={!(sb.fastResponse ?? performance?.isFast) && performance.responseTime < 4000}
            label="Server Response Time" points={5}
            detail={`${performance.responseTime}ms — ${performance.responseTime < 2000 ? 'Fast ✓ (under 2s)' : performance.responseTime < 4000 ? 'Average (2–4s)' : 'Slow (over 4s)'}`} />
        )}
      </div>

      {/* Social */}
      <SectionLabel icon={Share2} label="Social Media Tags" />
      <div className="space-y-1.5">
        <CheckRow
          pass={sb.ogComplete ?? openGraph?.isComplete}
          warn={!!(openGraph?.title || openGraph?.description || openGraph?.image) && !(sb.ogComplete ?? openGraph?.isComplete)}
          label="Open Graph Tags (Complete)" points={10}
          detail={[
            openGraph?.title       ? '✓ og:title'       : '✗ og:title',
            openGraph?.description ? '✓ og:description' : '✗ og:description',
            openGraph?.image       ? '✓ og:image'       : '✗ og:image',
          ].join('   ')} />
        <CheckRow
          pass={sb.twitterPresent ?? twitter?.isPresent ?? !!twitter?.card}
          label="Twitter Card" points={5}
          detail={twitter?.card ? `twitter:card = "${twitter.card}"` : 'No Twitter Card meta tags found'} />
      </div>

      {/* Recommendations */}
      {(errors.length + warnings.length + infos.length) > 0 && (
        <>
          <SectionLabel icon={AlertTriangle} label={`Recommendations (${recommendations.length})`} />
          <div className="space-y-1.5">
            {errors.map((r, i) => (
              <div key={i} className="flex gap-2 items-start px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
                <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-xs text-red-700">{r.text}</span>
              </div>
            ))}
            {warnings.map((r, i) => (
              <div key={i} className="flex gap-2 items-start px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                <span className="text-xs text-amber-700">{r.text}</span>
              </div>
            ))}
            {infos.map((r, i) => (
              <div key={i} className="flex gap-2 items-start px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                <AlertCircle className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                <span className="text-xs text-blue-700">{r.text}</span>
              </div>
            ))}
          </div>
        </>
      )}

    </div>
  );
}

// ── Keyword density bar row ──────────────────────────────────────────────────

function KwRow({ item, maxDensity = 5 }) {
  const bw  = Math.min(100, (item.density / Math.max(maxDensity, 5)) * 100);
  const cls = item.density > 3    ? 'bg-red-100 text-red-700 border-red-200'
    : item.density > 2.5          ? 'bg-amber-100 text-amber-700 border-amber-200'
    : item.density >= 0.8         ? 'bg-green-100 text-green-700 border-green-200'
    :                               'bg-slate-100 text-slate-600 border-slate-200';
  const bar = item.density > 3    ? 'bg-red-400'
    : item.density > 2.5          ? 'bg-amber-400'
    : item.density >= 0.8         ? 'bg-blue-400'
    :                               'bg-slate-300';
  return (
    <tr className="border-b border-border last:border-0 hover:bg-surface-2/50">
      <td className="px-3 py-2 text-xs text-text-primary font-medium">{item.phrase}</td>
      <td className="px-3 py-2 text-xs text-text-muted text-right tabular-nums">{item.count}</td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border flex-shrink-0 ${cls}`}>
            {item.density}%
          </span>
          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden min-w-[28px]">
            <div className={`h-full rounded-full transition-all duration-500 ${bar}`} style={{ width: `${bw}%` }} />
          </div>
        </div>
      </td>
    </tr>
  );
}

// ── Phrase table (bigrams / trigrams) ────────────────────────────────────────

function PhraseTable({ items, label }) {
  if (!items?.length) return null;
  const max = items[0]?.density || 5;
  return (
    <div>
      <div className="flex items-center gap-2 pt-1">
        <BarChart2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
        <span className="text-[10px] font-bold text-text-primary uppercase tracking-widest">{label}</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>
      <div className="mt-1.5 border border-border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-surface-2 border-b border-border">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-semibold text-text-muted">Phrase</th>
              <th className="text-right px-3 py-2 text-xs font-semibold text-text-muted">Count</th>
              <th className="px-3 py-2 text-xs font-semibold text-text-muted">Density</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, i) => <KwRow key={i} item={item} maxDensity={max} />)}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Enhanced Keyword Density Result ──────────────────────────────────────────

function EnhancedKeywordResult({ result }) {
  const [excludeStop, setExcludeStop] = useState(true);

  const {
    totalWords = 0, filteredWords = 0,
    seoScore = 0, scoreLabel = '',
    primaryKeyword = null, primaryDensity = 0,
    keywords = [], allKeywords = [],
    bigrams = [], trigrams = [],
    overused = [], underused = [],
    hasFocusKeyword = false,
    suggestions = [], variations = [],
  } = result;

  const displayKw = excludeStop ? keywords : (allKeywords.length ? allKeywords : keywords);
  const maxDensity = displayKw[0]?.density || 5;

  const scoreColor = seoScore >= 90 ? '#22C55E'
    : seoScore >= 70 ? '#3B82F6'
    : seoScore >= 50 ? '#F59E0B'
    : '#EF4444';
  const scoreBgCls = seoScore >= 90 ? 'bg-green-50 border-green-200'
    : seoScore >= 70 ? 'bg-blue-50 border-blue-200'
    : seoScore >= 50 ? 'bg-amber-50 border-amber-200'
    : 'bg-red-50 border-red-200';

  const circ = 2 * Math.PI * 42;
  const dash = circ - (seoScore / 100) * circ;

  return (
    <div className="space-y-3">

      {/* ── Score + primary keyword ── */}
      <div className={`flex items-center gap-4 p-4 rounded-xl border ${scoreBgCls}`}>
        <svg width="96" height="96" viewBox="0 0 100 100" className="flex-shrink-0">
          <circle cx="50" cy="50" r="42" fill="none" stroke="#E5E7EB" strokeWidth="9" />
          <circle cx="50" cy="50" r="42" fill="none" stroke={scoreColor} strokeWidth="9"
            strokeDasharray={circ} strokeDashoffset={dash} strokeLinecap="round"
            transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset 1s ease' }} />
          <text x="50" y="47" textAnchor="middle" fontSize="22" fontWeight="bold" fill={scoreColor}>{seoScore}</text>
          <text x="50" y="62" textAnchor="middle" fontSize="10" fill="#6B7280">/ 100</text>
        </svg>
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-text-primary leading-tight">{scoreLabel}</p>
          <p className="text-xs text-text-muted">SEO Content Score</p>
          {primaryKeyword && (
            <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
              <span className="text-xs text-text-muted">Primary:</span>
              <span className="text-xs font-bold px-2.5 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                {primaryKeyword}
              </span>
              <span className="text-[11px] text-text-muted">{primaryDensity}% density</span>
            </div>
          )}
          <div className="flex flex-wrap gap-x-3 mt-1.5 text-xs text-text-muted">
            <span>{totalWords.toLocaleString()} words</span>
            {filteredWords > 0 && <span>{filteredWords.toLocaleString()} keywords</span>}
          </div>
        </div>
      </div>

      {/* ── Insights: 3 stat cards ── */}
      <div className="grid grid-cols-3 gap-2">
        <div className={`p-2.5 rounded-lg border text-center ${
          overused.length === 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}>
          <p className={`text-xl font-bold ${overused.length === 0 ? 'text-green-600' : 'text-red-600'}`}>
            {overused.length}
          </p>
          <p className={`text-[10px] font-semibold mt-0.5 ${overused.length === 0 ? 'text-green-600' : 'text-red-600'}`}>
            Overused
          </p>
          <p className="text-[10px] text-text-muted">density &gt;3%</p>
        </div>
        <div className={`p-2.5 rounded-lg border text-center ${
          underused.length > 3 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'
        }`}>
          <p className={`text-xl font-bold ${underused.length > 3 ? 'text-amber-600' : 'text-green-600'}`}>
            {underused.length}
          </p>
          <p className={`text-[10px] font-semibold mt-0.5 ${underused.length > 3 ? 'text-amber-600' : 'text-green-600'}`}>
            Underused
          </p>
          <p className="text-[10px] text-text-muted">&lt;0.5% density</p>
        </div>
        <div className={`p-2.5 rounded-lg border text-center ${
          hasFocusKeyword ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
        }`}>
          <p className={`text-sm font-bold mt-1.5 ${hasFocusKeyword ? 'text-green-600' : 'text-red-600'}`}>
            {hasFocusKeyword ? '✓ Yes' : '✗ No'}
          </p>
          <p className={`text-[10px] font-semibold mt-0.5 ${hasFocusKeyword ? 'text-green-600' : 'text-red-600'}`}>
            Focus KW
          </p>
          <p className="text-[10px] text-text-muted">density ≥1%</p>
        </div>
      </div>

      {/* ── Overused keywords ── */}
      {overused.length > 0 && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs font-bold text-red-700 mb-1.5">Overused Keywords (&gt;3% density)</p>
          <div className="flex flex-wrap gap-1.5">
            {overused.map((k, i) => (
              <span key={i} className="text-[11px] px-2 py-0.5 bg-red-100 text-red-700 rounded border border-red-200 font-medium">
                {k.phrase} ({k.density}%)
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Underused keywords (top 8) ── */}
      {underused.length > 0 && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p className="text-xs font-bold text-amber-700 mb-1.5">Underused Keywords (0.1–0.5% density)</p>
          <div className="flex flex-wrap gap-1.5">
            {underused.slice(0, 8).map((k, i) => (
              <span key={i} className="text-[11px] px-2 py-0.5 bg-amber-100 text-amber-700 rounded border border-amber-200 font-medium">
                {k.phrase} ({k.density}%)
              </span>
            ))}
            {underused.length > 8 && (
              <span className="text-[11px] text-amber-600 self-center">+{underused.length - 8} more</span>
            )}
          </div>
        </div>
      )}

      {/* ── Smart suggestions ── */}
      {suggestions.length > 0 && (
        <>
          <SectionLabel icon={Lightbulb} label="Smart Suggestions" />
          <div className="space-y-1.5">
            {suggestions.map((s, i) => (
              <div key={i} className="flex gap-2 items-start px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                <ChevronRight className="w-3.5 h-3.5 text-blue-500 flex-shrink-0 mt-0.5" />
                <span className="text-xs text-blue-700">{s}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Keyword variations ── */}
      {variations.length > 0 && (
        <>
          <SectionLabel icon={Sparkles} label="Keyword Variations & Related Phrases" />
          <div className="flex flex-wrap gap-1.5">
            {variations.map((v, i) => (
              <span key={i} className="text-xs px-2.5 py-1 bg-purple-50 text-purple-700 rounded-full border border-purple-200 font-medium">
                {v}
              </span>
            ))}
          </div>
        </>
      )}

      {/* ── Single keywords table ── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
            <span className="text-[10px] font-bold text-text-primary uppercase tracking-widest">Single Keywords</span>
            <div className="h-px bg-slate-200 w-6" />
          </div>
          <button
            onClick={() => setExcludeStop(v => !v)}
            className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border font-medium transition-colors flex-shrink-0 ${
              excludeStop
                ? 'bg-blue-50 border-blue-200 text-blue-700'
                : 'bg-slate-100 border-slate-200 text-slate-600'
            }`}
          >
            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${excludeStop ? 'bg-blue-500' : 'bg-slate-400'}`} />
            {excludeStop ? 'Stopwords Off' : 'Stopwords On'}
          </button>
        </div>
        {displayKw.length > 0 && (
          <div className="border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 border-b border-border">
                <tr>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-text-muted">Keyword</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-text-muted">Count</th>
                  <th className="px-3 py-2 text-xs font-semibold text-text-muted">Density</th>
                </tr>
              </thead>
              <tbody>
                {displayKw.slice(0, 20).map((item, i) => (
                  <KwRow key={i} item={item} maxDensity={maxDensity} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Bigrams + Trigrams ── */}
      <PhraseTable items={bigrams}  label="Bigrams (2-word phrases)" />
      <PhraseTable items={trigrams} label="Trigrams (3-word phrases)" />

    </div>
  );
}

function ResultRenderer({ result }) {
  if (!result) return null;

  // ── PWA Checker (has manifest field) ────────────────────────
  if (result.score !== undefined && result.manifest !== undefined) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-4 p-4 bg-surface-2 border border-border rounded-xl">
          <ScoreRing score={result.score} />
          <div>
            <p className="font-semibold text-text-primary">
              {result.score >= 80 ? 'PWA Ready' : result.score >= 50 ? 'Partially Compatible' : 'Not PWA Compatible'}
            </p>
            <p className="text-xs text-text-muted">PWA Compatibility Score</p>
          </div>
        </div>
        {result.checks && <ChecksGrid checks={result.checks} />}
        {result.recommendations?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Recommendations</p>
            <ul className="space-y-1.5">
              {result.recommendations.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm text-text-secondary">
                  <ChevronRight className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // ── SEO Analyzer (score + checks + page metadata) ────────────
  if (result.checks && result.score !== undefined) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-4 p-4 bg-surface-2 border border-border rounded-xl">
          <ScoreRing score={result.score} />
          <div className="space-y-1 flex-1 min-w-0">
            {result.title && (
              <p className="text-sm"><span className="font-semibold text-text-muted">Title:</span> {result.title}</p>
            )}
            {result.h1 && (
              <p className="text-sm"><span className="font-semibold text-text-muted">H1:</span> {result.h1}</p>
            )}
            {result.metaDescription && (
              <p className="text-sm text-text-secondary line-clamp-2">
                <span className="font-semibold text-text-muted">Meta:</span> {result.metaDescription}
              </p>
            )}
            <div className="flex flex-wrap gap-3 text-xs text-text-muted pt-1">
              {result.h2Count !== undefined && <span>{result.h2Count} H2 tags</span>}
              {result.imagesWithoutAlt !== undefined && <span>{result.imagesWithoutAlt} imgs missing alt</span>}
              {result.linksCount !== undefined && <span>{result.linksCount} links</span>}
              {result.loadTime && <span>Load: {result.loadTime}</span>}
            </div>
          </div>
        </div>
        {result.checks && <ChecksGrid checks={result.checks} />}
        {result.recommendations?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Recommendations</p>
            <ul className="space-y-1.5">
              {result.recommendations.map((r, i) => (
                <li key={i} className="flex gap-2 text-sm text-text-secondary">
                  <ChevronRight className="w-4 h-4 text-accent flex-shrink-0 mt-0.5" />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // ── Redirect checker ─────────────────────────────────────────
  if (result.chain) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="bg-surface-2 border border-border rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-primary">{result.totalRedirects}</p>
            <p className="text-xs text-text-muted">Redirects</p>
          </div>
          <div className="bg-surface-2 border border-border rounded-xl px-4 py-3 flex-1 min-w-0">
            <p className="text-xs font-medium text-text-primary truncate">{result.finalUrl}</p>
            <p className="text-xs text-text-muted mt-0.5">Final URL</p>
          </div>
        </div>
        <div className="space-y-2">
          {result.chain.map((step, i) => (
            <div key={i} className="flex items-start gap-3 p-3 bg-surface-2 border border-border rounded-xl">
              <div className={`text-xs font-bold px-2 py-0.5 rounded-md mt-0.5 flex-shrink-0 ${
                step.statusCode < 300 ? 'bg-green-100 text-green-700'
                : step.statusCode < 400 ? 'bg-yellow-100 text-yellow-700'
                : 'bg-red-100 text-red-600'
              }`}>
                {step.statusCode}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-text-muted">{step.statusText}</p>
                <p className="text-xs text-text-primary font-mono break-all">{step.url}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Enhanced keyword density analyzer (has seoScore) ────────────
  if (result.keywords && result.seoScore !== undefined) {
    return <EnhancedKeywordResult result={result} />;
  }

  // ── Keyword density / cloud ───────────────────────────────────
  if (result.keywords || result.words) {
    return (
      <div className="space-y-4">
        <div className="bg-surface-2 border border-border rounded-xl px-4 py-3 inline-block">
          <p className="text-xl font-bold text-primary">{result.totalWords?.toLocaleString()}</p>
          <p className="text-xs text-text-muted">Total Words</p>
        </div>
        {result.words && (
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Word Cloud</p>
            <div className="flex flex-wrap gap-2 p-4 bg-surface-2 border border-border rounded-xl">
              {result.words.slice(0, 50).map((w, i) => (
                <span
                  key={i}
                  className="px-2.5 py-1 rounded-lg bg-accent/10 text-accent font-medium border border-accent/20"
                  style={{ fontSize: `${Math.max(10, Math.min(20, 10 + (w.value || 1) / 5))}px` }}
                >
                  {w.text}
                </span>
              ))}
            </div>
          </div>
        )}
        <KwTable title="Single Keywords" items={result.keywords}
          cols={[{ key: 'word', label: 'Keyword' }, { key: 'count', label: 'Count', muted: true }, { key: 'density', label: 'Density', muted: true }]} />
        <KwTable title="Bigrams (2-word phrases)" items={result.bigrams}
          cols={[{ key: 'phrase', label: 'Phrase' }, { key: 'count', label: 'Count', muted: true }, { key: 'density', label: 'Density', muted: true }]} />
        <KwTable title="Trigrams (3-word phrases)" items={result.trigrams}
          cols={[{ key: 'phrase', label: 'Phrase' }, { key: 'count', label: 'Count', muted: true }, { key: 'density', label: 'Density', muted: true }]} />
      </div>
    );
  }

  // ── Full SEO Analyzer (seo-analyzer slug — has technical + headings) ─────────
  if (result.technical !== undefined && result.headings !== undefined) {
    return <FullSeoResult result={result} />;
  }

  // ── Social meta analytics ─────────────────────────────────────
  if (result.openGraph || result.twitter) {
    const sections = [
      { label: 'Open Graph', data: result.openGraph },
      { label: 'Twitter Card', data: result.twitter },
      { label: 'General', data: result.general },
    ].filter(s => s.data && Object.keys(s.data).length > 0);
    return (
      <div className="space-y-4">
        {sections.map(({ label, data }) => (
          <div key={label}>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">{label}</p>
            <div className="border border-border rounded-xl overflow-hidden">
              {Object.entries(data).map(([key, val]) => (
                <div key={key} className="flex gap-3 px-3 py-2 border-b border-border last:border-0 hover:bg-surface-2/50">
                  <span className="text-xs font-medium text-text-muted w-28 flex-shrink-0">{key}</span>
                  <span className="text-xs text-text-primary break-all">{String(val)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  // ── JSON-LD validator ─────────────────────────────────────────
  if (result.isValid !== undefined && result.formatted !== undefined) {
    return (
      <div className="space-y-4">
        <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${
          result.isValid ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'
        }`}>
          {result.isValid ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          <span className="font-semibold">{result.isValid ? 'Valid JSON-LD' : 'Invalid JSON-LD'}</span>
          {result.itemCount > 0 && (
            <span className="text-xs opacity-75 ml-auto">{result.itemCount} · {result.types?.join(', ')}</span>
          )}
        </div>
        {result.errors?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1.5">Errors</p>
            <ul className="space-y-1">
              {result.errors.map((e, i) => (
                <li key={i} className="text-sm text-red-600 flex gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{e}
                </li>
              ))}
            </ul>
          </div>
        )}
        {result.warnings?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-yellow-600 uppercase tracking-wide mb-1.5">Warnings</p>
            <ul className="space-y-1">
              {result.warnings.map((w, i) => <li key={i} className="text-sm text-yellow-700">{w}</li>)}
            </ul>
          </div>
        )}
        {result.formatted && (
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">Formatted JSON-LD</p>
            <pre className="bg-surface-2 border border-border rounded-xl p-4 text-xs font-mono text-text-primary overflow-auto max-h-72 whitespace-pre-wrap">
              {result.formatted}
            </pre>
          </div>
        )}
      </div>
    );
  }

  // ── AMP validator ─────────────────────────────────────────────
  if (result.isAmp !== undefined) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-xl border ${
            result.isAmp ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-surface-2 border-border text-text-secondary'
          }`}>
            {result.isAmp ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
            <span className="text-sm font-semibold">{result.isAmp ? 'AMP Page' : 'Not AMP'}</span>
          </div>
          {result.isAmp && (
            <div className={`flex-1 flex items-center gap-2 px-4 py-3 rounded-xl border ${
              result.isValid ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'
            }`}>
              {result.isValid ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
              <span className="text-sm font-semibold">{result.isValid ? 'Valid AMP' : 'AMP Errors'}</span>
            </div>
          )}
        </div>
        {result.score !== undefined && (
          <div className="bg-surface-2 border border-border rounded-xl px-4 py-3 text-center inline-block">
            <p className="text-2xl font-bold text-primary">{result.score}</p>
            <p className="text-xs text-text-muted">AMP Score</p>
          </div>
        )}
        {result.errors?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wide mb-1.5">Errors</p>
            <ul className="space-y-1">
              {result.errors.map((e, i) => (
                <li key={i} className="text-sm text-red-600 flex gap-2">
                  <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />{e}
                </li>
              ))}
            </ul>
          </div>
        )}
        {result.warnings?.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-yellow-600 uppercase tracking-wide mb-1.5">Warnings</p>
            <ul className="space-y-1">
              {result.warnings.map((w, i) => <li key={i} className="text-sm text-yellow-700">{w}</li>)}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // ── Schema entity graph ───────────────────────────────────────
  if (result.nodes) {
    return (
      <div className="space-y-4">
        <div className="bg-surface-2 border border-border rounded-xl px-4 py-3 inline-block">
          <p className="text-2xl font-bold text-primary">{result.schemaCount}</p>
          <p className="text-xs text-text-muted">Schema Objects Found</p>
        </div>
        {result.nodes.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Schema Types</p>
            <div className="flex flex-wrap gap-2">
              {result.nodes.map((n, i) => (
                <span key={i} className="px-2.5 py-1 bg-accent/10 text-accent text-xs font-medium rounded-lg border border-accent/20">
                  {n.type}
                </span>
              ))}
            </div>
          </div>
        )}
        {result.edges.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Relationships</p>
            <div className="space-y-1.5">
              {result.edges.map((e, i) => (
                <div key={i} className="flex items-center gap-2 text-sm bg-surface-2 border border-border rounded-lg px-3 py-2">
                  <span className="text-text-primary font-medium">{e.from}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                  <span className="text-text-muted text-xs">{e.relation}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-accent flex-shrink-0" />
                  <span className="text-text-primary font-medium">{e.to}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Site crawler ──────────────────────────────────────────────
  if (result.pages) {
    return (
      <div className="space-y-4">
        <div className="bg-surface-2 border border-border rounded-xl px-4 py-3 inline-block">
          <p className="text-2xl font-bold text-primary">{result.totalPages}</p>
          <p className="text-xs text-text-muted">Pages Crawled</p>
        </div>
        <div className="border border-border rounded-xl overflow-hidden max-h-80 overflow-y-auto">
          {result.pages.map((page, i) => (
            <div key={i} className="px-4 py-3 border-b border-border last:border-0 hover:bg-surface-2/50">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-xs font-bold px-1.5 rounded flex-shrink-0 ${
                  page.statusCode === 200 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>{page.statusCode}</span>
                <a href={page.url} target="_blank" rel="noreferrer"
                  className="text-xs text-primary hover:underline truncate flex-1 font-mono">{page.url}</a>
              </div>
              {page.title && <p className="text-xs text-text-muted pl-1">{page.title}</p>}
              <div className="flex gap-3 text-xs text-text-muted mt-0.5 pl-1">
                <span>{page.links} links</span>
                {page.imagesWithoutAlt > 0 && (
                  <span className="text-orange-500">{page.imagesWithoutAlt} imgs no alt</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Sitemap visualizer ────────────────────────────────────────
  if (result.urls) {
    return (
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="bg-surface-2 border border-border rounded-xl px-4 py-3 text-center flex-1">
            <p className="text-2xl font-bold text-primary">{result.urls.length}</p>
            <p className="text-xs text-text-muted">URLs Found</p>
          </div>
          {result.isSitemapIndex !== undefined && (
            <div className="bg-surface-2 border border-border rounded-xl px-4 py-3 text-center flex-1">
              <p className="text-sm font-bold text-primary">{result.isSitemapIndex ? 'Sitemap Index' : 'Sitemap'}</p>
              <p className="text-xs text-text-muted">Type</p>
            </div>
          )}
        </div>
        <div className="border border-border rounded-xl overflow-hidden max-h-80 overflow-y-auto">
          {result.urls.slice(0, 100).map((u, i) => {
            const loc = u.loc || u;
            const mod = u.lastmod || null;
            return (
              <div key={i} className="flex items-center gap-2 px-4 py-2 border-b border-border last:border-0 hover:bg-surface-2/50">
                <a href={loc} target="_blank" rel="noreferrer"
                  className="text-xs text-primary hover:underline font-mono flex-1 truncate">{loc}</a>
                {mod && <span className="text-xs text-text-muted flex-shrink-0">{mod}</span>}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ── Fallback: raw JSON ────────────────────────────────────────
  return (
    <pre className="bg-surface-2 border border-border rounded-xl p-4 text-xs font-mono text-text-primary overflow-auto max-h-96 whitespace-pre-wrap">
      {JSON.stringify(result, null, 2)}
    </pre>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function SeoAnalyzeTool({ tool }) {
  const { analyze, result, loading, error } = useSeoAnalyze(tool.slug);
  const [url, setUrl]   = useState('');
  const [text, setText] = useState('');
  const showText = NEEDS_TEXT.has(tool.slug);

  const handleAnalyze = () => {
    if (!url.trim()) return;
    const body = { url };
    if (text.trim()) body.text = text;
    analyze(body);
  };

  return (
    <div className="panel-card shadow-lg">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-semibold text-text-primary">{tool.title || 'SEO Analyzer'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">

        {/* LEFT: inputs */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">
              Website URL
            </label>
            <input
              className="tool-input"
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={e => setUrl(e.target.value)}
              disabled={loading}
              onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
            />
          </div>

          {showText && (
            <div>
              <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">
                Page Content{' '}
                <span className="font-normal text-text-muted">(optional — leave blank to fetch from URL)</span>
              </label>
              <textarea
                className="tool-textarea"
                style={{ minHeight: '120px' }}
                placeholder="Paste page HTML or text to avoid fetching…"
                value={text}
                onChange={e => setText(e.target.value)}
                disabled={loading}
              />
            </div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={loading || !url.trim()}
            className="btn-primary w-full h-12 text-[15px]"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" />Analyzing…</>
              : <><Search className="w-4 h-4" />Analyze</>
            }
          </button>
        </div>

        {/* RIGHT: result */}
        <div className="p-5 overflow-auto" style={{ minHeight: '320px' }}>
          {!result && !loading && !error && (
            <div className="h-full flex flex-col items-center justify-center text-center py-16">
              <Globe className="w-10 h-10 text-text-muted/30 mb-3" />
              <p className="text-sm font-semibold text-text-secondary">Enter a URL and click Analyze</p>
              <p className="text-xs text-text-muted mt-1">Results will appear here</p>
            </div>
          )}

          {loading && (
            <div className="h-full flex flex-col items-center justify-center py-16">
              <Loader2 className="w-8 h-8 animate-spin text-accent mb-3" />
              <p className="text-sm text-text-muted">Analyzing website…</p>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {result && !loading && <ResultRenderer result={result} />}
        </div>
      </div>
    </div>
  );
}
