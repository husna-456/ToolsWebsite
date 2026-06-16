import { useState, useRef, useCallback } from 'react';
import {
  Upload, X, AlertCircle, Loader2, Check, RefreshCw, ArrowRightLeft, FileText,
} from 'lucide-react';
import axios from 'axios';
import { useFileUpload } from '@/hooks/useFileUpload';

// ── Accept type + label helpers ───────────────────────────────
function getInputInfo(slug) {
  const from = slug.split('-to-')[0];
  const map = {
    jpg:    { accept: 'image/jpeg,.jpg,.jpeg',             label: 'JPG / JPEG' },
    jfif:   { accept: 'image/jpeg,.jfif',                  label: 'JFIF' },
    png:    { accept: 'image/png,.png',                    label: 'PNG' },
    webp:   { accept: 'image/webp,.webp',                  label: 'WebP' },
    svg:    { accept: 'image/svg+xml,.svg',                label: 'SVG' },
    ico:    { accept: 'image/x-icon,image/vnd.microsoft.icon,.ico', label: 'ICO' },
    heic:   { accept: 'image/heic,image/heif,.heic,.heif', label: 'HEIC / HEIF' },
    tiff:   { accept: 'image/tiff,.tiff,.tif',             label: 'TIFF / TIF' },
    base64: { accept: null,                                label: 'Base64 String' },
  };
  return map[from] || { accept: 'image/*', label: 'Image' };
}

function getOutputLabel(slug) {
  const to = slug.split('-to-')[1];
  const map = { png: 'PNG', jpg: 'JPG', webp: 'WebP', ico: 'ICO' };
  return map[to] || to?.toUpperCase() || 'File';
}

const MAX_MB = 20;

// ── Progress bar ─────────────────────────────────────────────
function ProgressBar({ value }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-text-muted">
        <span>{value < 65 ? 'Uploading…' : value < 95 ? 'Converting…' : 'Finalising…'}</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 bg-surface-2 rounded-full overflow-hidden border border-border">
        <div
          className="h-full rounded-full bg-brand-gradient transition-all duration-300"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

// ── File-upload converter (23 tools) ─────────────────────────
function FileConverter({ slug }) {
  const { upload, loading, error, progress, reset } = useFileUpload(slug);
  const { accept, label: inputLabel } = getInputInfo(slug);
  const outputLabel = getOutputLabel(slug);

  const [file,      setFile]      = useState(null);
  const [done,      setDone]      = useState(false);
  const [fileError, setFileError] = useState('');
  const [dragging,  setDragging]  = useState(false);
  const inputRef = useRef(null);

  function selectFile(f) {
    if (!f) return;
    if (f.size > MAX_MB * 1024 * 1024) {
      setFileError(`File too large. Maximum ${MAX_MB} MB.`);
      return;
    }
    setFileError('');
    setFile(f);
    setDone(false);
    reset();
  }

  function removeFile() {
    setFile(null);
    setFileError('');
    setDone(false);
    reset();
    if (inputRef.current) inputRef.current.value = '';
  }

  function handleDragOver(e)  { e.preventDefault(); setDragging(true); }
  function handleDragLeave()  { setDragging(false); }
  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    selectFile(e.dataTransfer.files?.[0]);
  }

  async function handleConvert() {
    if (!file || loading) return;
    setDone(false);
    await upload(file, {});
    setDone(true);
  }

  function handleReset() {
    removeFile();
    setDone(false);
  }

  return (
    <div className="panel-card shadow-lg">
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">

        {/* LEFT */}
        <div className="flex flex-col">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-text-muted" />
              <span className="text-sm font-semibold text-text-primary">
                Upload {inputLabel} File
              </span>
            </div>
            {file && (
              <button onClick={handleReset} className="btn-ghost">
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>

          <div className="flex-1 p-4 space-y-4">
            {!file ? (
              <label
                className={`flex flex-col items-center justify-center gap-3 w-full rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 py-10 px-6 ${
                  dragging ? 'border-accent bg-accent/5 scale-[1.01]' : 'border-border hover:border-accent/50 hover:bg-surface-2/60'
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${dragging ? 'bg-accent/10' : 'bg-surface-2 border border-border'}`}>
                  <Upload className={`w-6 h-6 ${dragging ? 'text-accent' : 'text-text-muted'}`} />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-text-primary text-sm">
                    {dragging ? 'Drop file here' : `Drop ${inputLabel} or click to browse`}
                  </p>
                  <p className="text-xs text-text-muted mt-1">Max {MAX_MB} MB</p>
                </div>
                <input ref={inputRef} type="file" accept={accept} className="sr-only"
                  onChange={e => selectFile(e.target.files?.[0])} />
              </label>
            ) : (
              <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-surface-2/60">
                <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                  <ArrowRightLeft className="w-4 h-4 text-accent" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary truncate">{file.name}</p>
                  <p className="text-xs text-text-muted">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
                <button onClick={removeFile} className="text-text-muted hover:text-red-500 shrink-0">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {fileError && (
              <div className="flex items-start gap-2 text-xs text-red-600">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{fileError}</span>
              </div>
            )}

            {/* Format badge */}
            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
              <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">{inputLabel}</span>
              <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">{outputLabel}</span>
            </div>
          </div>

          <div className="px-4 pb-4 pt-3 border-t border-border">
            <button
              onClick={handleConvert}
              disabled={!file || loading}
              className="btn-primary w-full h-11 text-sm"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" />Converting…</>
                : `Convert to ${outputLabel}`}
            </button>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex flex-col">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-text-muted" />
              <span className="text-sm font-semibold text-text-primary">Result</span>
            </div>
          </div>

          <div className="flex-1 p-4 flex flex-col" style={{ minHeight: '300px' }}>
            {!loading && !error && !done && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
                <div className="w-14 h-14 bg-surface-2 rounded-2xl flex items-center justify-center mb-3 border border-border">
                  <ArrowRightLeft className="w-6 h-6 text-text-light" />
                </div>
                <p className="text-sm font-semibold text-text-secondary">Converted file appears here</p>
                <p className="text-xs text-text-muted mt-1">Upload a file and click convert</p>
              </div>
            )}

            {loading && (
              <div className="flex-1 flex flex-col justify-center px-2 gap-6">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 text-accent animate-spin" />
                  <p className="text-sm font-medium text-text-secondary">Converting your file…</p>
                </div>
                <ProgressBar value={progress} />
              </div>
            )}

            {error && !loading && (
              <div className="space-y-3">
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
                <button onClick={handleReset} className="btn-secondary w-full gap-2">
                  <RefreshCw className="w-3.5 h-3.5" /> Try Again
                </button>
              </div>
            )}

            {done && !error && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-fadeUp">
                <div className="w-16 h-16 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-brand">
                  <Check className="w-8 h-8 text-white" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-text-primary text-base">Converted!</p>
                  <p className="text-sm text-text-secondary mt-1">
                    Your {outputLabel} file has been downloaded automatically.
                  </p>
                </div>
                <button onClick={handleReset} className="btn-secondary gap-2 mt-2">
                  <RefreshCw className="w-3.5 h-3.5" /> Convert Another File
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Base64 text-input converter (base64-to-png, base64-to-jpg) ─
function Base64Converter({ slug }) {
  const outputLabel = getOutputLabel(slug);
  const [base64,    setBase64]   = useState('');
  const [loading,   setLoading]  = useState(false);
  const [error,     setError]    = useState('');
  const [done,      setDone]     = useState(false);
  const [txtFile,   setTxtFile]  = useState(null);
  const [txtError,  setTxtError] = useState('');
  const [draggingTxt, setDraggingTxt] = useState(false);
  const txtRef = useRef(null);

  function readTxtFile(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.txt')) {
      setTxtError('Only .txt files are accepted.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setTxtError('File too large. Maximum 5 MB.');
      return;
    }
    setTxtError('');
    setTxtFile(file);
    const reader = new FileReader();
    reader.onload  = (e) => { setBase64((e.target.result || '').trim()); setDone(false); setError(''); };
    reader.onerror = ()  => setTxtError('Could not read file.');
    reader.readAsText(file);
  }

  function clearTxtFile() {
    setTxtFile(null);
    setTxtError('');
    if (txtRef.current) txtRef.current.value = '';
  }

  function handleTxtDrop(e) {
    e.preventDefault();
    setDraggingTxt(false);
    readTxtFile(e.dataTransfer.files?.[0]);
  }

  async function handleConvert() {
    if (!base64.trim() || loading) return;
    setLoading(true);
    setError('');
    setDone(false);

    // Strip data-URL prefix if present (handles both raw and data:image/...;base64, formats)
    const raw = base64.trim().replace(/^data:[^;,]+;base64,/i, '').trim();

    try {
      const token = localStorage.getItem('it_token');
      const response = await axios.post(
        `/api/tools/${slug}/run`,
        { base64: raw },
        {
          responseType: 'blob',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }
      );

      const contentType = response.headers?.['content-type'] || '';
      const blob = new Blob([response.data], { type: contentType });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `converted.${outputLabel.toLowerCase()}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDone(true);
    } catch (err) {
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          setError(json.error || 'Conversion failed.');
        } catch {
          setError('Conversion failed. Please check your base64 string.');
        }
      } else {
        setError(err.response?.data?.error || err.message || 'Conversion failed.');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setBase64('');
    setError('');
    setDone(false);
    clearTxtFile();
  }

  return (
    <div className="panel-card shadow-lg">
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">

        {/* LEFT */}
        <div className="flex flex-col">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-text-muted" />
              <span className="text-sm font-semibold text-text-primary">Base64 Input</span>
            </div>
            {(base64 || txtFile) && (
              <button onClick={handleReset} className="btn-ghost">
                <X className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>

          <div className="flex-1 p-4 space-y-4">

            {/* Option A — Upload .txt file */}
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
                Option A — Upload .txt file
              </p>
              {!txtFile ? (
                <label
                  className={`flex items-center gap-3 w-full rounded-xl border-2 border-dashed cursor-pointer px-4 py-3 transition-all duration-150 ${
                    draggingTxt
                      ? 'border-accent bg-accent/5'
                      : 'border-border hover:border-accent/50 hover:bg-surface-2/60'
                  }`}
                  onDragOver={e  => { e.preventDefault(); setDraggingTxt(true); }}
                  onDragLeave={() => setDraggingTxt(false)}
                  onDrop={handleTxtDrop}
                >
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-colors ${draggingTxt ? 'bg-accent/10' : 'bg-surface-2 border border-border'}`}>
                    <FileText className={`w-4 h-4 ${draggingTxt ? 'text-accent' : 'text-text-muted'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">
                      {draggingTxt ? 'Drop .txt file here' : 'Drop or click to upload .txt'}
                    </p>
                    <p className="text-xs text-text-muted">File containing a Base64 string · Max 5 MB</p>
                  </div>
                  <input
                    ref={txtRef}
                    type="file"
                    accept=".txt,text/plain"
                    className="sr-only"
                    onChange={e => readTxtFile(e.target.files?.[0])}
                  />
                </label>
              ) : (
                <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface-2/60">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <FileText className="w-4 h-4 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">{txtFile.name}</p>
                    <p className="text-xs text-text-muted">Loaded · content filled below</p>
                  </div>
                  <button onClick={clearTxtFile} className="text-text-muted hover:text-red-500 shrink-0">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              {txtError && (
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-red-600">
                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                  <span>{txtError}</span>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs font-medium text-text-muted">or</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Option B — Paste */}
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">
                Option B — Paste Base64 string
              </p>
              <p className="text-xs text-text-muted mb-2">
                Accepts raw Base64 or the full <code className="bg-surface-2 px-1 rounded">data:image/…;base64,</code> data URL.
              </p>
              <textarea
                value={base64}
                onChange={e => { setBase64(e.target.value); setDone(false); setError(''); }}
                placeholder="iVBORw0KGgoAAAANSUh…  or  data:image/png;base64,iVBOR…"
                className="tool-textarea font-mono text-xs"
                style={{ minHeight: '140px' }}
              />
            </div>

            <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
              <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">Base64</span>
              <ArrowRightLeft className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">{outputLabel}</span>
            </div>
          </div>

          <div className="px-4 pb-4 pt-3 border-t border-border">
            <button
              onClick={handleConvert}
              disabled={!base64.trim() || loading}
              className="btn-primary w-full h-11 text-sm"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" />Converting…</>
                : `Convert to ${outputLabel}`}
            </button>
          </div>
        </div>

        {/* RIGHT */}
        <div className="flex flex-col">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-text-muted" />
              <span className="text-sm font-semibold text-text-primary">Result</span>
            </div>
          </div>

          <div className="flex-1 p-4 flex flex-col" style={{ minHeight: '300px' }}>
            {!loading && !error && !done && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
                <div className="w-14 h-14 bg-surface-2 rounded-2xl flex items-center justify-center mb-3 border border-border">
                  <ArrowRightLeft className="w-6 h-6 text-text-light" />
                </div>
                <p className="text-sm font-semibold text-text-secondary">Image file appears here</p>
                <p className="text-xs text-text-muted mt-1">Upload a .txt file or paste Base64, then convert</p>
              </div>
            )}

            {loading && (
              <div className="flex-1 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <p className="text-sm font-medium text-text-secondary">Converting…</p>
              </div>
            )}

            {error && !loading && (
              <div className="space-y-3">
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
                <button onClick={handleReset} className="btn-secondary w-full gap-2">
                  <RefreshCw className="w-3.5 h-3.5" /> Try Again
                </button>
              </div>
            )}

            {done && !error && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-fadeUp">
                <div className="w-16 h-16 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-brand">
                  <Check className="w-8 h-8 text-white" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-text-primary text-base">Converted!</p>
                  <p className="text-sm text-text-secondary mt-1">
                    Your {outputLabel} image has been downloaded.
                  </p>
                </div>
                <button onClick={handleReset} className="btn-secondary gap-2 mt-2">
                  <RefreshCw className="w-3.5 h-3.5" /> Convert Another
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main export — dispatches to correct sub-component ─────────
export default function FormatConverterShell({ tool }) {
  const { slug } = tool;
  if (slug === 'base64-to-png' || slug === 'base64-to-jpg') {
    return <Base64Converter slug={slug} />;
  }
  return <FileConverter slug={slug} />;
}
