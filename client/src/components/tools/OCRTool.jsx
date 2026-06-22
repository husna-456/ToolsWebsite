import { useState, useRef, useCallback } from 'react';
import { Upload, FileText, Copy, Check, Download, X, Loader2, AlertCircle } from 'lucide-react';
import { useClipboard } from '@/hooks/useClipboard';

const ACCEPTED = '.jpg,.jpeg,.png,.gif,.bmp,.tiff,.webp';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'https://globaltechtools.thefiveriverz.com';

async function runOCR(file, onProgress) {
  onProgress(20);
  const formData = new FormData();
  formData.append('image', file);
  onProgress(40);
  const token = localStorage.getItem('it_token');
  const res = await fetch(`${API_BASE_URL}/api/ocr/run`, {
    method: 'POST',
    body: formData,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  onProgress(80);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'OCR failed');
  }
  const data = await res.json();
  onProgress(100);
  return data.result;
}

export default function OCRTool() {
  const [file, setFile]         = useState(null);
  const [preview, setPreview]   = useState('');
  const [result, setResult]     = useState('');
  const [loading, setLoading]   = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError]       = useState('');
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef(null);
  const { copied, copy } = useClipboard();

  function handleFile(f) {
    if (!f || !f.type.startsWith('image/')) {
      setError('Please upload a valid image file (JPG, PNG, GIF, BMP, TIFF).');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10 MB.');
      return;
    }
    setError('');
    setResult('');
    setProgress(0);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, []);

  async function handleExtract() {
    if (!file) return;
    setLoading(true);
    setError('');
    setResult('');
    setProgress(0);
    try {
      const text = await runOCR(file, setProgress);
      if (!text) setError('No text detected in the image. Try a clearer image with higher contrast.');
      else setResult(text);
    } catch {
      setError('OCR processing failed. Please try again with a different image.');
    } finally {
      setLoading(false);
      setProgress(0);
    }
  }

  function handleDownload() {
    if (!result) return;
    const blob = new Blob([result], { type: 'text/plain' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `extracted-text-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearAll() {
    setFile(null);
    setPreview('');
    setResult('');
    setError('');
    setProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const wordCount = result.trim().split(/\s+/).filter(Boolean).length;

  return (
    <div className="panel-card shadow-lg">
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">

        {/* ── LEFT: Upload ──────────────────────────────────── */}
        <div className="flex flex-col">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-text-muted" />
              <span className="text-sm font-semibold text-text-primary">Upload Image</span>
            </div>
            {file && (
              <button onClick={clearAll} className="btn-ghost">
                <X className="w-3.5 h-3.5" />Clear
              </button>
            )}
          </div>

          <div className="flex-1 p-4 flex flex-col gap-4">
            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => !file && fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-xl transition-all duration-150 cursor-pointer flex flex-col items-center justify-center text-center p-6 ${
                dragging
                  ? 'border-accent bg-accent-subtle'
                  : file
                    ? 'border-accent/40 bg-accent-subtle/30 cursor-default'
                    : 'border-border hover:border-accent/50 hover:bg-surface-2'
              }`}
              style={{ minHeight: '180px' }}
            >
              {preview ? (
                <img src={preview} alt="Preview" className="max-h-40 max-w-full object-contain rounded-lg" />
              ) : (
                <>
                  <div className="w-12 h-12 bg-surface-2 rounded-xl flex items-center justify-center mb-3 border border-border">
                    <Upload className="w-5 h-5 text-text-muted" />
                  </div>
                  <p className="text-sm font-semibold text-text-secondary">Drop image here or click to upload</p>
                  <p className="text-xs text-text-muted mt-1">JPG, PNG, GIF, BMP, TIFF · Max 10 MB</p>
                </>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={e => handleFile(e.target.files[0])}
            />

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {/* Progress */}
            {loading && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-text-muted">
                  <span>Processing image…</span>
                  <span>{progress}%</span>
                </div>
                <div className="h-2 bg-surface-2 rounded-full overflow-hidden border border-border">
                  <div
                    className="h-full bg-accent rounded-full transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="px-4 pb-4 border-t border-border pt-4">
            <button
              onClick={handleExtract}
              disabled={!file || loading}
              className="btn-primary w-full h-12 text-[15px]"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" />Extracting Text…</>
                : <><FileText className="w-4 h-4" />Extract Text</>
              }
            </button>
          </div>
        </div>

        {/* ── RIGHT: Result ─────────────────────────────────── */}
        <div className="flex flex-col">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-text-muted" />
              <span className="text-sm font-semibold text-text-primary">Extracted Text</span>
              {result && (
                <span className="text-xs text-text-muted bg-surface-2 border border-border px-2 py-0.5 rounded-full">
                  {wordCount} words
                </span>
              )}
            </div>
            {result && (
              <div className="flex items-center gap-1">
                <button onClick={() => copy(result)} className="btn-ghost">
                  {copied ? <><Check className="w-3.5 h-3.5 text-violet-600" />Copied!</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
                </button>
                <button onClick={handleDownload} className="btn-ghost">
                  <Download className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 p-4" style={{ minHeight: '300px' }}>
            {!result && !loading && (
              <div className="h-full flex flex-col items-center justify-center text-center py-8">
                <div className="w-14 h-14 bg-surface-2 rounded-2xl flex items-center justify-center mb-3 border border-border">
                  <FileText className="w-6 h-6 text-text-light" />
                </div>
                <p className="text-sm font-semibold text-text-secondary">Extracted text appears here</p>
                <p className="text-xs text-text-muted mt-1">Upload an image and click Extract Text</p>
              </div>
            )}

            {loading && (
              <div className="h-full flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <p className="text-sm text-text-secondary font-medium">Reading text from image…</p>
                <p className="text-xs text-text-muted">This may take a few seconds</p>
              </div>
            )}

            {result && (
              <textarea
                readOnly
                value={result}
                className="tool-textarea bg-accent-subtle/25 border-accent/20 h-full animate-fadeUp"
                style={{ minHeight: '260px' }}
                aria-live="polite"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
