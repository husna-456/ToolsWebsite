import { useState, useRef, useCallback } from 'react';
import { Upload, Languages, Copy, Check, X, Loader2, AlertCircle, ArrowRight, FileText } from 'lucide-react';
import { useClipboard } from '@/hooks/useClipboard';
import api from '@/services/api';

const LANGUAGES = [
  'Spanish', 'French', 'German', 'Italian', 'Portuguese',
  'Arabic', 'Urdu', 'Hindi', 'Chinese (Simplified)', 'Chinese (Traditional)',
  'Japanese', 'Korean', 'Russian', 'Turkish', 'Dutch',
  'Polish', 'Swedish', 'Norwegian', 'Danish', 'Greek',
  'Hebrew', 'Persian', 'Thai', 'Vietnamese', 'Indonesian',
  'Malay', 'Bengali', 'Tamil', 'Telugu', 'Punjabi',
  'English',
];

async function runOCR(file, onProgress) {
  const Tesseract = (await import('tesseract.js')).default;
  const worker = await Tesseract.createWorker({
    logger: (m) => {
      if (m.status === 'recognizing text') onProgress(Math.round(m.progress * 100));
    },
  });
  await worker.loadLanguage('eng');
  await worker.initialize('eng');
  const { data: { text } } = await worker.recognize(file);
  await worker.terminate();
  return text.trim();
}

const STEPS = { idle: 'idle', ocr: 'ocr', translating: 'translating', done: 'done' };

export default function ImageTranslator() {
  const [file, setFile]           = useState(null);
  const [preview, setPreview]     = useState('');
  const [targetLang, setTargetLang] = useState('Spanish');
  const [extracted, setExtracted] = useState('');
  const [translated, setTranslated] = useState('');
  const [step, setStep]           = useState(STEPS.idle);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [error, setError]         = useState('');
  const [dragging, setDragging]   = useState(false);
  const fileInputRef = useRef(null);
  const { copied, copy } = useClipboard();

  function handleFile(f) {
    if (!f || !f.type.startsWith('image/')) {
      setError('Please upload a valid image file.');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('File too large. Maximum size is 10 MB.');
      return;
    }
    setError('');
    setExtracted('');
    setTranslated('');
    setStep(STEPS.idle);
    setOcrProgress(0);
    setFile(f);
    setPreview(URL.createObjectURL(f));
  }

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, []);

  async function handleTranslate() {
    if (!file) return;
    setError('');
    setExtracted('');
    setTranslated('');
    setOcrProgress(0);

    // Step 1: OCR
    setStep(STEPS.ocr);
    let text = '';
    try {
      text = await runOCR(file, setOcrProgress);
      if (!text) {
        setError('No text found in image. Try a clearer image.');
        setStep(STEPS.idle);
        return;
      }
      setExtracted(text);
    } catch {
      setError('OCR failed. Please try a different image.');
      setStep(STEPS.idle);
      return;
    }

    // Step 2: Translate via server
    setStep(STEPS.translating);
    try {
      const data = await api.post('/tools/image-translator/run', {
        text,
        language: targetLang,
      });
      setTranslated(data.result);
      setStep(STEPS.done);
    } catch (err) {
      setError(err.message || 'Translation failed. Please try again.');
      setStep(STEPS.idle);
    }
  }

  function clearAll() {
    setFile(null);
    setPreview('');
    setExtracted('');
    setTranslated('');
    setError('');
    setStep(STEPS.idle);
    setOcrProgress(0);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const isProcessing = step === STEPS.ocr || step === STEPS.translating;

  return (
    <div className="panel-card shadow-lg">
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">

        {/* ── LEFT: Upload + Controls ───────────────────────── */}
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
              className={`border-2 border-dashed rounded-xl transition-all duration-150 flex flex-col items-center justify-center text-center p-6 ${
                dragging
                  ? 'border-accent bg-accent-subtle cursor-copy'
                  : file
                    ? 'border-accent/40 bg-accent-subtle/30'
                    : 'border-border hover:border-accent/50 hover:bg-surface-2 cursor-pointer'
              }`}
              style={{ minHeight: '160px' }}
            >
              {preview ? (
                <img src={preview} alt="Preview" className="max-h-36 max-w-full object-contain rounded-lg" />
              ) : (
                <>
                  <Upload className="w-8 h-8 text-text-muted mb-2" />
                  <p className="text-sm font-semibold text-text-secondary">Drop image or click to upload</p>
                  <p className="text-xs text-text-muted mt-1">JPG, PNG, GIF · Max 10 MB</p>
                </>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".jpg,.jpeg,.png,.gif,.bmp,.tiff,.webp"
              className="hidden"
              onChange={e => handleFile(e.target.files[0])}
            />

            {/* Target language */}
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2 block">
                Translate to
              </label>
              <select
                value={targetLang}
                onChange={e => setTargetLang(e.target.value)}
                disabled={isProcessing}
                className="input-field"
              >
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>

            {/* Step progress */}
            {step === STEPS.ocr && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-text-muted">
                  <span>Extracting text from image…</span>
                  <span>{ocrProgress}%</span>
                </div>
                <div className="h-1.5 bg-surface-2 rounded-full overflow-hidden">
                  <div className="h-full bg-accent rounded-full transition-all duration-300" style={{ width: `${ocrProgress}%` }} />
                </div>
              </div>
            )}

            {step === STEPS.translating && (
              <div className="flex items-center gap-2 text-xs text-accent">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Translating with AI…
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="px-4 pb-4 border-t border-border pt-4">
            <button
              onClick={handleTranslate}
              disabled={!file || isProcessing}
              className="btn-primary w-full h-12 text-[15px]"
            >
              {isProcessing
                ? <><Loader2 className="w-4 h-4 animate-spin" />{step === STEPS.ocr ? 'Extracting…' : 'Translating…'}</>
                : <><Languages className="w-4 h-4" />Extract & Translate</>
              }
            </button>
          </div>
        </div>

        {/* ── RIGHT: Result ─────────────────────────────────── */}
        <div className="flex flex-col">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <Languages className="w-4 h-4 text-text-muted" />
              <span className="text-sm font-semibold text-text-primary">Translation</span>
            </div>
            {translated && (
              <button onClick={() => copy(translated)} className="btn-ghost">
                {copied ? <><Check className="w-3.5 h-3.5 text-violet-600" />Copied!</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
              </button>
            )}
          </div>

          <div className="flex-1 p-4 space-y-4" style={{ minHeight: '300px' }}>
            {!translated && !isProcessing && (
              <div className="h-full flex flex-col items-center justify-center text-center py-8">
                <div className="w-14 h-14 bg-surface-2 rounded-2xl flex items-center justify-center mb-3 border border-border">
                  <Languages className="w-6 h-6 text-text-light" />
                </div>
                <p className="text-sm font-semibold text-text-secondary">Translation appears here</p>
                <p className="text-xs text-text-muted mt-1">Upload an image and select target language</p>
              </div>
            )}

            {isProcessing && (
              <div className="h-full flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                <p className="text-sm text-text-secondary font-medium">
                  {step === STEPS.ocr ? 'Reading text from image…' : `Translating to ${targetLang}…`}
                </p>
              </div>
            )}

            {step === STEPS.done && (
              <>
                {extracted && (
                  <div className="bg-surface-2 rounded-xl p-4 border border-border">
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5" />
                      Extracted text
                    </p>
                    <p className="text-sm text-text-secondary leading-relaxed line-clamp-4">{extracted}</p>
                  </div>
                )}
                {translated && (
                  <div className="animate-fadeUp">
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <ArrowRight className="w-3.5 h-3.5 text-accent" />
                      Translated to {targetLang}
                    </p>
                    <textarea
                      readOnly
                      value={translated}
                      className="tool-textarea bg-accent-subtle/25 border-accent/20 w-full"
                      style={{ minHeight: '180px' }}
                    />
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
