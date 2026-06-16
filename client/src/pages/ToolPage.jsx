import { useState, useEffect, lazy, Suspense } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import {
  FileText, Sparkles, BarChart2,
  Copy, Check, X, Loader2, Zap, AlertCircle,
} from 'lucide-react';
import { TOOLS } from '@/data/tools';
import { useToolRun } from '@/hooks/useToolRun';
import { useClipboard } from '@/hooks/useClipboard';
import { useToolData } from '@/hooks/useToolData';
import SEOHead from '@/components/seo/SEOHead';
import UsageLimitBanner from '@/components/tools/UsageLimitBanner';
import ToolPageLayout from '@/components/tools/ToolPageLayout';

// Lazy-load heavy specialized UIs
const TextToImage     = lazy(() => import('@/components/tools/TextToImage'));
const SpeechToText    = lazy(() => import('@/components/tools/SpeechToText'));
const OCRTool         = lazy(() => import('@/components/tools/OCRTool'));
const ImageTranslator = lazy(() => import('@/components/tools/ImageTranslator'));
const CitationTool    = lazy(() => import('@/components/tools/CitationTool'));
const PomodoroTool    = lazy(() => import('@/components/tools/PomodoroTool'));
const ImageToolShell       = lazy(() => import('@/components/tools/ImageToolShell'));
const MediaToolShell       = lazy(() => import('@/components/tools/MediaToolShell'));
const QRCodeTool           = lazy(() => import('@/components/tools/QRCodeTool'));
const FormatConverterShell  = lazy(() => import('@/components/tools/FormatConverterShell'));
const ScreenRecorderTool    = lazy(() => import('@/components/tools/ScreenRecorderTool'));
const HardcodeSubtitlesTool = lazy(() => import('@/components/tools/HardcodeSubtitlesTool'));
const SeoAnalyzeTool        = lazy(() => import('@/components/tools/SeoAnalyzeTool'));
const SeoGenerateTool       = lazy(() => import('@/components/tools/SeoGenerateTool'));
const SerpSimulator         = lazy(() => import('@/components/tools/SerpSimulator'));
const WheelColorPicker      = lazy(() => import('@/components/tools/WheelColorPicker'));
const ImageCensorTool       = lazy(() => import('@/components/tools/ImageCensorTool'));

// URL slug → MongoDB slug (where they differ)
const DB_SLUG = { 'pomodoro': 'pomodoro-timer' };

function ToolTypeFallback() {
  return (
    <div className="panel-card shadow-lg flex items-center justify-center h-48">
      <Loader2 className="w-6 h-6 animate-spin text-accent" />
    </div>
  );
}

function SpecializedToolUI({ tool }) {
  // Slug-based overrides take precedence over toolType routing
  if (tool.slug === 'image-censor')         return <ImageCensorTool tool={tool} />;
  if (tool.slug === 'hardcode-subtitles')   return <HardcodeSubtitlesTool tool={tool} />;

  const map = {
    'text-image':      <TextToImage tool={tool} />,
    'speech':          <SpeechToText tool={tool} />,
    'ocr':             <OCRTool tool={tool} />,
    'image-translate': <ImageTranslator tool={tool} />,
    'citation':        <CitationTool tool={tool} />,
    'pomodoro':        <PomodoroTool tool={tool} />,
    'image-file':        <ImageToolShell tool={tool} />,
    'media-file':        <MediaToolShell tool={tool} />,
    'qr-code':           <QRCodeTool tool={tool} />,
    'format-converter':  <FormatConverterShell tool={tool} />,
    'screen-recorder':   <ScreenRecorderTool tool={tool} />,
    'seo-analyze':       <SeoAnalyzeTool tool={tool} />,
    'seo-generate':      <SeoGenerateTool tool={tool} />,
    'serp-preview':      <SerpSimulator tool={tool} />,
    'color-picker':      <WheelColorPicker tool={tool} />,
  };
  return map[tool.toolType] ?? null;
}

function countWords(text) {
  if (!text.trim()) return { words: 0, chars: 0, charsNoSp: 0, sentences: 0, paragraphs: 0, readTime: 0 };
  const words      = text.trim().split(/\s+/).filter(Boolean).length;
  const chars      = text.length;
  const charsNoSp  = text.replace(/\s/g, '').length;
  const sentences  = text.split(/[.!?]+/).filter(s => s.trim()).length;
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim()).length;
  const readTime   = Math.max(1, Math.ceil(words / 200));
  return { words, chars, charsNoSp, sentences, paragraphs, readTime };
}

function EmptyState() {
  return (
    <div className="h-full flex flex-col items-center justify-center text-center py-12 px-4">
      <div className="w-14 h-14 bg-surface-2 rounded-2xl flex items-center justify-center mb-4 border border-border">
        <Sparkles className="w-6 h-6 text-text-light" />
      </div>
      <p className="font-semibold text-text-secondary text-sm">Result appears here</p>
      <p className="text-text-muted text-xs mt-1.5">Paste your text and click run</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 p-1">
      <div className="skeleton h-4 w-full" />
      <div className="skeleton h-4 w-[92%]" />
      <div className="skeleton h-4 w-[78%]" />
      <div className="skeleton h-4 w-full" />
      <div className="skeleton h-4 w-[85%]" />
      <div className="skeleton h-4 w-[65%]" />
      <div className="skeleton h-4 w-[90%]" />
      <div className="skeleton h-4 w-[70%]" />
    </div>
  );
}

function JSONResult({ parsedResult, slug }) {
  const isDetector = slug === 'ai-detector';
  const score = parsedResult.score ?? 0;
  const barColor = isDetector
    ? score > 70 ? 'bg-red-500' : score > 40 ? 'bg-orange-400' : 'bg-brand-gradient'
    : score > 70 ? 'bg-brand-gradient' : score > 40 ? 'bg-orange-400' : 'bg-red-500';

  return (
    <div className="space-y-4 animate-fadeUp">
      <div className="bg-surface-2 rounded-xl p-4 border border-border">
        <div className="flex justify-between items-center mb-3">
          <span className="text-sm font-semibold text-text-primary">
            {isDetector ? 'AI Probability' : 'Originality Score'}
          </span>
          <span className="font-display font-bold text-lg text-primary">{score}%</span>
        </div>
        <div className="h-2.5 bg-white rounded-full overflow-hidden border border-border">
          <div
            className={`h-full rounded-full transition-all duration-700 ${barColor}`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      <div className="flex items-center justify-between p-4 bg-surface-2 rounded-xl border border-border">
        <div>
          <p className="text-xs font-medium text-text-muted uppercase tracking-wide mb-0.5">Verdict</p>
          <p className="font-bold text-primary text-[0.95rem]">{parsedResult.verdict}</p>
        </div>
        {parsedResult.confidence && (
          <span className="text-xs text-text-muted bg-white border border-border px-2.5 py-1 rounded-full">
            {parsedResult.confidence} confidence
          </span>
        )}
      </div>

      {parsedResult.reasons?.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2.5">
            {isDetector ? 'Why this score' : 'Flagged phrases'}
          </p>
          <ul className="space-y-1.5">
            {parsedResult.reasons.map((r, i) => (
              <li key={i} className="text-sm text-text-secondary flex gap-2.5">
                <span className="text-accent flex-shrink-0 mt-0.5 font-bold">·</span>
                <span>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {parsedResult.summary && (
        <p className="text-sm text-text-secondary italic border-l-2 border-accent pl-3 py-1 bg-accent-subtle/40 rounded-r-lg pr-3">
          {parsedResult.summary}
        </p>
      )}
    </div>
  );
}

export default function ToolPage() {
  const { slug } = useParams();
  const localTool = TOOLS[slug];

  // DB_SLUG maps URL slugs to their DB equivalents where they differ
  const dbSlug = DB_SLUG[slug] || slug;

  // Fetch from DB for tools not in the local TOOLS constant (format converters, SEO tools, etc.).
  // useToolData shares a module-level cache with ToolPageLayout so only one request fires.
  const { tool: dbTool, loading: dbLoading, notFound: dbNotFound } = useToolData(localTool ? null : dbSlug);

  // Synthetic tool object for DB-only tools — carry full SEO data so SEOHead works
  const tool = localTool || (dbTool ? {
    slug:           dbSlug,
    toolType:       dbTool.toolType,
    title:          dbTool.title,
    shortDesc:      dbTool.shortDesc,
    seoTitle:       dbTool.seoTitle,
    seoDescription: dbTool.seoDescription,
    faqs:           dbTool.faqs,
    howToUse:       dbTool.howToUse,
  } : null);

  const { result, loading, error, usage, limitReached, run, reset } = useToolRun(slug);
  const { copied, copy } = useClipboard();
  const [input, setInput] = useState('');
  const [tone,  setTone]  = useState('');
  const [mode,  setMode]  = useState('simple');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (tool?.clientSide) setStats(countWords(input));
  }, [input, tool]);

  // Still loading DB tool data for unknown slugs — show nothing yet
  if (!localTool && dbLoading) return null;
  // DB confirmed not found or slug invalid
  if ((!localTool && dbNotFound) || !tool) return <Navigate to="/" replace />;

  const handleRun   = () => {
    if (!tool.clientSide) {
      const opts = {};
      if (tone)       opts.tone = tone;
      if (tool.modes) opts.mode = mode;
      run(input, opts);
    }
  };
  const handleClear = () => { setInput(''); reset(); };

  let parsedResult = null;
  if (tool.isJSON && result) {
    try { parsedResult = JSON.parse(result); } catch { /* raw fallback */ }
  }

  const hasResult = !!(result || parsedResult);
  const isEmpty   = !loading && !hasResult && !error;

  return (
    <ToolPageLayout slug={dbSlug}>
      <SEOHead tool={tool} />

      {/* Specialized tool UI */}
      {tool.toolType && (
        <Suspense fallback={<ToolTypeFallback />}>
          <SpecializedToolUI tool={tool} />
        </Suspense>
      )}

      {/* Default text I/O interface */}
      {!tool.toolType && (
        <div className="panel-card shadow-lg">
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">

            {/* LEFT: Input panel */}
            <div className="flex flex-col">
              <div className="panel-header">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-text-muted" />
                  <span className="text-sm font-semibold text-text-primary">Your Text</span>
                </div>
                {input && (
                  <button onClick={handleClear} className="btn-ghost">
                    <X className="w-3.5 h-3.5" />
                    Clear
                  </button>
                )}
              </div>

              {tool.tones && (
                <div className="px-4 py-3 border-b border-border bg-surface-2/40 flex items-center flex-wrap gap-2">
                  <span className="text-xs font-medium text-text-muted mr-1">Tone:</span>
                  {tool.tones.map(t => (
                    <button
                      key={t}
                      onClick={() => setTone(t)}
                      className={`px-3 py-1 text-xs rounded-lg border font-medium transition-all duration-150 ${
                        tone === t
                          ? 'border-accent bg-accent text-white shadow-sm'
                          : 'border-border text-text-secondary hover:border-accent/50 bg-white hover:text-text-primary'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              )}

              {tool.modes && (
                <div className="px-4 py-3 border-b border-border bg-surface-2/40 flex items-center gap-2">
                  <span className="text-xs font-medium text-text-muted mr-1">Mode:</span>
                  {tool.modes.map(m => (
                    <button
                      key={m.value}
                      onClick={() => setMode(m.value)}
                      className={`px-3 py-1 text-xs rounded-lg border font-medium transition-all duration-150 flex items-center gap-1.5 ${
                        mode === m.value
                          ? 'border-accent bg-accent text-white shadow-sm'
                          : 'border-border text-text-secondary hover:border-accent/50 bg-white hover:text-text-primary'
                      }`}
                    >
                      <span>{m.icon}</span>
                      {m.label}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex-1 p-4">
                <textarea
                  className="tool-textarea h-full"
                  style={{ minHeight: '240px' }}
                  placeholder={
                    tool.clientSide
                      ? 'Paste or type your text here…'
                      : `Paste your text here (max ${tool.maxChars.toLocaleString()} characters)…`
                  }
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  maxLength={tool.maxChars}
                  disabled={loading}
                />
              </div>

              {!tool.clientSide && (
                <div className="px-4 pb-4 pt-0 border-t border-border space-y-3">
                  <div className="flex items-center justify-between pt-3">
                    <span className={`text-xs font-medium ${
                      input.length > tool.maxChars * 0.9 ? 'text-orange-500' : 'text-text-muted'
                    }`}>
                      {input.length.toLocaleString()} / {tool.maxChars.toLocaleString()} chars
                    </span>
                  </div>
                  <button
                    onClick={handleRun}
                    disabled={loading || !input.trim() || (tool.tones && !tone)}
                    className="btn-primary w-full h-12 text-[15px]"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing…
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        Run {tool.title}
                      </>
                    )}
                  </button>
                </div>
              )}

              {tool.clientSide && (
                <div className="px-4 pb-3 pt-2 border-t border-border">
                  <span className="text-xs text-text-muted">
                    {input.length.toLocaleString()} chars · Updating live
                  </span>
                </div>
              )}
            </div>

            {/* RIGHT: Output panel */}
            <div className="flex flex-col">
              <div className="panel-header">
                <div className="flex items-center gap-2">
                  {tool.clientSide
                    ? <><BarChart2 className="w-4 h-4 text-text-muted" /><span className="text-sm font-semibold text-text-primary">Live Statistics</span></>
                    : <><Sparkles className="w-4 h-4 text-text-muted" /><span className="text-sm font-semibold text-text-primary">Result</span></>}
                </div>
                {result && !tool.clientSide && (
                  <button onClick={() => copy(result)} className="btn-ghost">
                    {copied
                      ? <><Check className="w-3.5 h-3.5 text-violet-600" />Copied!</>
                      : <><Copy className="w-3.5 h-3.5" />Copy</>}
                  </button>
                )}
              </div>

              <div className="flex-1 p-4" style={{ minHeight: '300px' }}>
                {tool.clientSide && stats && (
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: 'Words',      value: stats.words },
                      { label: 'Characters', value: stats.chars },
                      { label: 'No Spaces',  value: stats.charsNoSp },
                      { label: 'Sentences',  value: stats.sentences },
                      { label: 'Paragraphs', value: stats.paragraphs },
                      { label: 'Read Time',  value: `${stats.readTime} min` },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-surface-2 rounded-xl p-4 text-center border border-border">
                        <div className="font-display font-bold text-2xl text-primary">{value}</div>
                        <div className="text-xs text-text-muted mt-1">{label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {!tool.clientSide && isEmpty && <EmptyState />}
                {loading && <LoadingSkeleton />}

                {error && !limitReached && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-start gap-2.5 animate-fadeIn">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {result && !parsedResult && (
                  <div className="animate-fadeUp h-full">
                    <textarea
                      readOnly
                      value={result}
                      className="tool-textarea bg-accent-subtle/25 border-accent/20 h-full"
                      style={{ minHeight: '240px' }}
                      aria-live="polite"
                      aria-label="Tool result"
                    />
                  </div>
                )}

                {parsedResult && <JSONResult parsedResult={parsedResult} slug={tool.slug} />}
              </div>
            </div>
          </div>
        </div>
      )}

      <UsageLimitBanner usage={usage} />
    </ToolPageLayout>
  );
}
