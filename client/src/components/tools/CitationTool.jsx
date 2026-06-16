import { useState } from 'react';
import { BookOpen, Copy, Check, Loader2, AlertCircle, Zap, Search, Info } from 'lucide-react';
import { useClipboard } from '@/hooks/useClipboard';
import api from '@/services/api';

const FORMATS      = ['APA', 'MLA', 'Chicago', 'Harvard'];
const SOURCE_TYPES = ['Website', 'Book', 'Journal Article', 'Newspaper', 'Magazine', 'Report', 'Thesis'];

const URL_TYPES    = new Set(['Website', 'Newspaper', 'Magazine', 'Report']);

function Field({ label, value, onChange, placeholder, required, type = 'text' }) {
  return (
    <div>
      <label className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5 block">
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field"
      />
    </div>
  );
}

function AutoFetch({ sourceType, onFill }) {
  const [input,   setInput]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const isUrl     = URL_TYPES.has(sourceType);
  const isBook    = sourceType === 'Book';
  const isJournal = sourceType === 'Journal Article';
  const isThesis  = sourceType === 'Thesis';

  if (isThesis) {
    return (
      <div className="mb-4 flex items-start gap-2.5 p-3.5 rounded-xl border border-border bg-surface-2/50">
        <Info className="w-4 h-4 text-text-muted shrink-0 mt-0.5" />
        <p className="text-xs text-text-secondary leading-relaxed">
          Thesis details must be entered manually. Use the fields below to fill in the information.
        </p>
      </div>
    );
  }

  async function handleFetch() {
    setError('');
    setLoading(true);
    try {
      const body = { sourceType };
      if (isUrl)     body.url  = input.trim();
      if (isBook)    body.isbn = input.trim();
      if (isJournal) body.doi  = input.trim();

      const data = await api.post('/tools/citation-generator/fetch-source', body);
      if (!data.success) {
        setError(data.error || 'Could not fetch details. Please enter manually.');
      } else {
        onFill(data.source);
        setInput('');
      }
    } catch {
      setError('Could not fetch details. Please enter manually.');
    } finally {
      setLoading(false);
    }
  }

  const label       = isUrl ? 'URL' : isBook ? 'ISBN' : 'DOI';
  const placeholder = isUrl
    ? 'https://example.com/article'
    : isBook
    ? '978-0-06-112008-4'
    : '10.1000/xyz123';

  return (
    <div
      className="mb-4 rounded-xl border border-accent/20 overflow-hidden"
      style={{ background: 'rgba(109,93,252,0.04)' }}
    >
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-accent/15">
        <Search className="w-3.5 h-3.5 text-accent" />
        <span className="text-xs font-bold text-accent uppercase tracking-wide">Auto-Fill from {label}</span>
      </div>
      <div className="px-4 py-3 space-y-2.5">
        <div className="flex gap-2">
          <input
            type={isUrl ? 'url' : 'text'}
            value={input}
            onChange={e => { setInput(e.target.value); setError(''); }}
            placeholder={placeholder}
            onKeyDown={e => e.key === 'Enter' && input.trim() && handleFetch()}
            className="input-field flex-1 text-sm"
          />
          <button
            onClick={handleFetch}
            disabled={!input.trim() || loading}
            className="btn-primary px-4 py-2 text-sm shrink-0 h-[42px]"
          >
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : 'Fetch'
            }
          </button>
        </div>
        {error && (
          <div className="flex items-start gap-1.5 text-xs text-orange-600">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
        <p className="text-[11px] text-text-muted">
          {isUrl    && 'Paste the full page URL to auto-fill title, author, and publisher.'}
          {isBook   && 'Enter the 10 or 13-digit ISBN to auto-fill book details.'}
          {isJournal && 'Enter the DOI (e.g. 10.1000/xyz) to auto-fill journal details.'}
        </p>
      </div>
    </div>
  );
}

export default function CitationTool() {
  const [format, setFormat]       = useState('APA');
  const [sourceType, setType]     = useState('Website');
  const [title, setTitle]         = useState('');
  const [author, setAuthor]       = useState('');
  const [year, setYear]           = useState('');
  const [publisher, setPublisher] = useState('');
  const [url, setUrl]             = useState('');
  const [doi, setDoi]             = useState('');
  const [journal, setJournal]     = useState('');
  const [volume, setVolume]       = useState('');
  const [issue, setIssue]         = useState('');
  const [pages, setPages]         = useState('');
  const [isbn, setIsbn]           = useState('');
  const [result, setResult]       = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const { copied, copy }          = useClipboard();

  const isWebsite  = sourceType === 'Website';
  const isJournal  = sourceType === 'Journal Article';
  const isBook     = sourceType === 'Book';
  const isNewspaper = sourceType === 'Newspaper';
  const isMagazine  = sourceType === 'Magazine';

  function handleFill(src) {
    if (src.title)         setTitle(src.title);
    if (src.author)        setAuthor(src.author);
    if (src.year)          setYear(src.year);
    if (src.publisher)     setPublisher(src.publisher);
    if (src.url)           setUrl(src.url);
    if (src.doi)           setDoi(src.doi);
    if (src.isbn)          setIsbn(src.isbn);
    if (src.journal)       setJournal(src.journal);
    if (src.volume)        setVolume(src.volume);
    if (src.issue)         setIssue(src.issue);
    if (src.pages)         setPages(src.pages);
  }

  function handleTypeChange(t) {
    setType(t);
    setTitle(''); setAuthor(''); setYear(''); setPublisher('');
    setUrl(''); setDoi(''); setJournal(''); setVolume(''); setIssue('');
    setPages(''); setIsbn(''); setResult(''); setError('');
  }

  async function handleGenerate() {
    if (!title.trim()) {
      setError('Title is required to generate a citation.');
      return;
    }
    setError('');
    setLoading(true);
    setResult('');

    const accessedDate = new Date().toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    });

    const parts = [
      `Citation Format: ${format}`,
      `Source Type: ${sourceType}`,
      `Title: ${title}`,
      author    && `Author: ${author}`,
      year      && `Year: ${year}`,
      publisher && `Publisher/Website: ${publisher}`,
      url       && `URL: ${url}`,
      doi       && `DOI: ${doi}`,
      isbn      && `ISBN: ${isbn}`,
      journal   && `Journal Name: ${journal}`,
      volume    && `Volume: ${volume}`,
      issue     && `Issue: ${issue}`,
      pages     && `Pages: ${pages}`,
      `Accessed: ${accessedDate}`,
    ].filter(Boolean).join('\n');

    try {
      const data = await api.post('/tools/citation-generator/run', { text: parts });
      // Replace any "no date" access date the AI may have written with today's real date
      const cleaned = (data.result || '').replace(
        /accessed?:?\s*(no\s*date|n\.?d\.?|unknown)/gi,
        `Accessed: ${accessedDate}`,
      );
      setResult(cleaned);
    } catch (err) {
      setError(err.message || 'Failed to generate citation. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function clearAll() {
    handleTypeChange(sourceType);
  }

  return (
    <div className="panel-card shadow-lg">
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">

        {/* ── LEFT: Form ────────────────────────────────────── */}
        <div className="flex flex-col">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-text-muted" />
              <span className="text-sm font-semibold text-text-primary">Citation Details</span>
            </div>
          </div>

          <div className="flex-1 p-4 space-y-4 overflow-y-auto">
            {/* Format + type selectors */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5 block">
                  Format <span className="text-red-400">*</span>
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {FORMATS.map(f => (
                    <button
                      key={f}
                      onClick={() => setFormat(f)}
                      className={`px-3 py-1.5 text-xs rounded-lg border font-semibold transition-all duration-150 ${
                        format === f
                          ? 'bg-accent border-accent text-white'
                          : 'bg-white border-border text-text-secondary hover:border-accent/50'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5 block">
                  Source Type
                </label>
                <select
                  value={sourceType}
                  onChange={e => handleTypeChange(e.target.value)}
                  className="input-field"
                >
                  {SOURCE_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>

            {/* Auto-fetch section */}
            <AutoFetch sourceType={sourceType} onFill={handleFill} />

            {/* Manual fields */}
            <Field label="Title" value={title} onChange={setTitle} placeholder="Article or book title" required />
            <Field label="Author(s)" value={author} onChange={setAuthor} placeholder="Last, First or Organization" />

            <div className="grid grid-cols-2 gap-3">
              <Field label="Year Published" value={year} onChange={setYear} placeholder="2024" type="number" />
              <Field label="Publisher / Website" value={publisher} onChange={setPublisher} placeholder="Publisher name" />
            </div>

            {(isWebsite || isNewspaper || isMagazine || sourceType === 'Report') && (
              <Field label="URL" value={url} onChange={setUrl} placeholder="https://example.com/article" type="url" />
            )}

            {isBook && (
              <Field label="ISBN" value={isbn} onChange={setIsbn} placeholder="978-0-06-112008-4" />
            )}

            {isJournal && (
              <>
                <Field label="Journal Name" value={journal} onChange={setJournal} placeholder="Nature, Science, etc." />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Volume" value={volume} onChange={setVolume} placeholder="12" />
                  <Field label="Issue" value={issue} onChange={setIssue} placeholder="3" />
                </div>
                <Field label="Pages" value={pages} onChange={setPages} placeholder="45–67" />
                <Field label="DOI" value={doi} onChange={setDoi} placeholder="10.1000/xyz123" />
              </>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="px-4 pb-4 border-t border-border pt-4 flex gap-2">
            <button onClick={clearAll} className="btn-secondary px-4 py-2.5">Clear</button>
            <button
              onClick={handleGenerate}
              disabled={!title.trim() || loading}
              className="btn-primary flex-1 h-11 text-[15px]"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" />Generating…</>
                : <><Zap className="w-4 h-4" />Generate {format} Citation</>
              }
            </button>
          </div>
        </div>

        {/* ── RIGHT: Result ─────────────────────────────────── */}
        <div className="flex flex-col">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-text-muted" />
              <span className="text-sm font-semibold text-text-primary">{format} Citation</span>
            </div>
            {result && (
              <button onClick={() => copy(result)} className="btn-ghost">
                {copied ? <><Check className="w-3.5 h-3.5 text-violet-600" />Copied!</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
              </button>
            )}
          </div>

          <div className="flex-1 p-4 flex items-start" style={{ minHeight: '300px' }}>
            {!result && !loading && (
              <div className="w-full h-full flex flex-col items-center justify-center text-center py-8">
                <div className="w-14 h-14 bg-surface-2 rounded-2xl flex items-center justify-center mb-3 border border-border">
                  <BookOpen className="w-6 h-6 text-text-light" />
                </div>
                <p className="text-sm font-semibold text-text-secondary">Citation appears here</p>
                <p className="text-xs text-text-muted mt-1">Auto-fill or enter details, then click Generate</p>
              </div>
            )}

            {loading && (
              <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <p className="text-sm text-text-secondary font-medium">Generating {format} citation…</p>
              </div>
            )}

            {result && (
              <div className="w-full animate-fadeUp space-y-4">
                <div className="bg-surface-2 rounded-xl p-5 border border-border">
                  <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-3">{format} Format</p>
                  <p className="text-[0.9375rem] text-text-primary leading-relaxed font-mono">{result}</p>
                </div>
                <p className="text-xs text-text-muted">
                  Always verify citations against official style guides before submission.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
