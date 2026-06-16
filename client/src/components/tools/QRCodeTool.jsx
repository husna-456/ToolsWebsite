import { useState } from 'react';
import { AlertCircle, Loader2, Download, RefreshCw, QrCode } from 'lucide-react';
import api from '@/services/api';

// ── Label helper ─────────────────────────────────────────────
function Label({ children }) {
  return (
    <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">
      {children}
    </p>
  );
}

// ── Pill button ───────────────────────────────────────────────
function Pill({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150 ${
        active
          ? 'bg-accent border-accent text-white shadow-sm'
          : 'bg-white border-border text-text-secondary hover:border-accent/50'
      }`}
    >
      {children}
    </button>
  );
}

export default function QRCodeTool() {
  const [text,       setText]       = useState('');
  const [size,       setSize]       = useState(300);
  const [errorLevel, setErrorLevel] = useState('M');
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [dataUrl,    setDataUrl]    = useState('');

  async function handleGenerate() {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    setDataUrl('');
    try {
      const data = await api.post('/tools/qr-code-generator/run', {
        text: text.trim(),
        size,
        errorLevel,
      });
      if (data.success && data.dataUrl) {
        setDataUrl(data.dataUrl);
      } else {
        setError(data.error || 'Failed to generate QR code.');
      }
    } catch (err) {
      setError(err.message || 'Failed to generate QR code. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  function handleDownload() {
    if (!dataUrl) return;
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = 'qr-code.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  function handleReset() {
    setText('');
    setDataUrl('');
    setError('');
    setSize(300);
    setErrorLevel('M');
  }

  return (
    <div className="panel-card shadow-lg">
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">

        {/* ── LEFT: Options ────────────────────────────────── */}
        <div className="flex flex-col">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-text-muted" />
              <span className="text-sm font-semibold text-text-primary">QR Code Settings</span>
            </div>
          </div>

          <div className="flex-1 p-4 space-y-5">

            {/* URL / Text input */}
            <div>
              <Label>URL or Text <span className="text-red-400">*</span></Label>
              <textarea
                value={text}
                onChange={e => { setText(e.target.value); setError(''); }}
                placeholder="https://example.com or any text…"
                rows={4}
                className="tool-textarea"
                style={{ minHeight: '100px' }}
              />
              <p className="text-[11px] text-text-muted mt-1">{text.length} characters</p>
            </div>

            {/* Size slider */}
            <div>
              <Label>Size: {size}px</Label>
              <input
                type="range"
                min="100" max="1000" step="50"
                value={size}
                onChange={e => setSize(Number(e.target.value))}
                className="w-full accent-accent cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-text-muted mt-1">
                <span>100px (small)</span>
                <span>1000px (large)</span>
              </div>
            </div>

            {/* Error correction level */}
            <div>
              <Label>Error Correction</Label>
              <div className="flex gap-2 flex-wrap">
                {[['L', 'Low (7%)'], ['M', 'Medium (15%)'], ['Q', 'Quartile (25%)'], ['H', 'High (30%)']].map(([val, label]) => (
                  <Pill key={val} active={errorLevel === val} onClick={() => setErrorLevel(val)}>
                    {label}
                  </Pill>
                ))}
              </div>
              <p className="text-[11px] text-text-muted mt-1.5">
                Higher = more damage-resistant but larger QR code.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Generate button */}
          <div className="px-4 pb-4 pt-3 border-t border-border">
            <button
              onClick={handleGenerate}
              disabled={!text.trim() || loading}
              className="btn-primary w-full h-11 text-sm"
            >
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" />Generating…</>
                : <><QrCode className="w-4 h-4" />Generate QR Code</>
              }
            </button>
          </div>
        </div>

        {/* ── RIGHT: QR preview ────────────────────────────── */}
        <div className="flex flex-col">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-text-muted" />
              <span className="text-sm font-semibold text-text-primary">QR Code Preview</span>
            </div>
            {dataUrl && (
              <button onClick={handleReset} className="btn-ghost">
                <RefreshCw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-6" style={{ minHeight: '300px' }}>
            {!dataUrl && !loading && (
              <div className="text-center">
                <div className="w-14 h-14 bg-surface-2 rounded-2xl flex items-center justify-center mb-3 border border-border mx-auto">
                  <QrCode className="w-6 h-6 text-text-light" />
                </div>
                <p className="text-sm font-semibold text-text-secondary">QR code appears here</p>
                <p className="text-xs text-text-muted mt-1">Enter text or URL and click Generate</p>
              </div>
            )}

            {loading && (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <p className="text-sm text-text-secondary font-medium">Generating QR code…</p>
              </div>
            )}

            {dataUrl && !loading && (
              <div className="flex flex-col items-center gap-5 animate-fadeUp">
                <div className="p-4 bg-white rounded-2xl border border-border shadow-sm">
                  <img
                    src={dataUrl}
                    alt="Generated QR code"
                    className="block"
                    style={{ width: Math.min(size, 280), height: Math.min(size, 280) }}
                  />
                </div>
                <button
                  onClick={handleDownload}
                  className="btn-primary gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download PNG
                </button>
                <p className="text-[11px] text-text-muted">
                  Full {size}×{size}px PNG — scan test before use
                </p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
