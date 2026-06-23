import { useState, useRef, useCallback } from 'react';
import Tesseract from 'tesseract.js';
import ImageCropperTool from './ImageCropperTool';
import ImageWatermarkTool from './ImageWatermarkTool';
import MetadataExifTool from './MetadataExifTool';
import QRCodeProTool from './QRCodeProTool';
import {
  Upload, X, AlertCircle, Loader2, Check, Copy,
  ImageDown, RefreshCw, Plus, Trash2,
} from 'lucide-react';
import { useFileUpload } from '@/hooks/useFileUpload';
import { useClipboard } from '@/hooks/useClipboard';

const MAX_MB     = 10;
const ACCEPT     = 'image/jpeg,image/png,image/webp,image/gif';
// Tools that return JSON text (no file download)
const TEXT_SLUGS = ['image-to-base64', 'qr-code-reader', 'image-ocr'];

// ── Helpers ───────────────────────────────────────────────────
function Label({ children }) {
  return (
    <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">
      {children}
    </p>
  );
}

function Pill({ active, onClick, children }) {
  return (
    <button
      type="button"
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

function NumInput({ label, value, onChange, placeholder, min = 0, max }) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field"
      />
    </div>
  );
}

// ── Per-tool options UI ───────────────────────────────────────
function ToolOptions({ slug, opts, set }) {
  switch (slug) {

    case 'image-compressor':
      return (
        <div>
          <Label>Quality: {opts.quality ?? 80}</Label>
          <input
            type="range" min="10" max="100"
            value={opts.quality ?? 80}
            onChange={e => set('quality')(Number(e.target.value))}
            className="w-full accent-accent cursor-pointer"
          />
          <div className="flex justify-between text-[11px] text-text-muted mt-1">
            <span>Smallest file</span>
            <span>Best quality</span>
          </div>
        </div>
      );

    case 'image-resizer':
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <NumInput label="Width (px)"  value={opts.width  ?? ''} onChange={set('width')}  placeholder="e.g. 1280" min={1} />
            <NumInput label="Height (px)" value={opts.height ?? ''} onChange={set('height')} placeholder="e.g. 720"  min={1} />
          </div>
          <div>
            <Label>Fit Mode</Label>
            <div className="flex gap-2 flex-wrap">
              {['cover', 'contain', 'fill'].map(f => (
                <Pill key={f} active={(opts.fit ?? 'cover') === f} onClick={() => set('fit')(f)}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </Pill>
              ))}
            </div>
            <p className="text-[11px] text-text-muted mt-1.5">
              Cover crops to fill · Contain fits without crop · Fill stretches to fill
            </p>
          </div>
        </div>
      );

    case 'image-converter':
      return (
        <div>
          <Label>Output Format</Label>
          <div className="flex gap-2 flex-wrap">
            {[['jpeg', 'JPEG'], ['png', 'PNG'], ['webp', 'WebP'], ['gif', 'GIF']].map(([val, label]) => (
              <Pill key={val} active={(opts.format ?? 'jpeg') === val} onClick={() => set('format')(val)}>
                {label}
              </Pill>
            ))}
          </div>
        </div>
      );

    case 'image-cropper':
      return (
        <div className="space-y-3">
          <p className="text-xs text-text-muted">Enter pixel coordinates for the crop region.</p>
          <div className="grid grid-cols-2 gap-3">
            <NumInput label="Left (px)"   value={opts.left   ?? 0}   onChange={set('left')}   placeholder="0" />
            <NumInput label="Top (px)"    value={opts.top    ?? 0}   onChange={set('top')}    placeholder="0" />
            <NumInput label="Width (px)"  value={opts.width  ?? ''}  onChange={set('width')}  placeholder="e.g. 400" min={1} />
            <NumInput label="Height (px)" value={opts.height ?? ''}  onChange={set('height')} placeholder="e.g. 300" min={1} />
          </div>
        </div>
      );

    case 'image-rotator':
      return (
        <div>
          <Label>Rotation Angle</Label>
          <div className="flex gap-2 flex-wrap">
            {[[90, '90°'], [180, '180°'], [270, '270°'], [-90, '-90°']].map(([val, label]) => (
              <Pill key={val} active={(opts.angle ?? 90) === val} onClick={() => set('angle')(val)}>
                {label}
              </Pill>
            ))}
          </div>
        </div>
      );

    case 'image-watermark':
      return (
        <div className="space-y-3">
          <div>
            <Label>Watermark Text <span className="text-red-400">*</span></Label>
            <input
              type="text"
              value={opts.text ?? ''}
              onChange={e => set('text')(e.target.value)}
              placeholder="e.g. © My Brand"
              maxLength={100}
              className="input-field"
            />
          </div>
          <div>
            <Label>Position</Label>
            <div className="flex gap-2 flex-wrap">
              {[['bottomRight', 'Bottom Right'], ['bottomLeft', 'Bottom Left'], ['center', 'Center']].map(([val, label]) => (
                <Pill key={val} active={(opts.position ?? 'bottomRight') === val} onClick={() => set('position')(val)}>
                  {label}
                </Pill>
              ))}
            </div>
          </div>
        </div>
      );

    case 'image-censor':
      return <CensorOptions opts={opts} set={set} />;

    case 'meme-generator':
      return (
        <div className="space-y-3">
          <div>
            <Label>Top Text</Label>
            <input
              type="text"
              value={opts.topText ?? ''}
              onChange={e => set('topText')(e.target.value)}
              placeholder="TOP TEXT"
              maxLength={100}
              className="input-field"
            />
          </div>
          <div>
            <Label>Bottom Text</Label>
            <input
              type="text"
              value={opts.bottomText ?? ''}
              onChange={e => set('bottomText')(e.target.value)}
              placeholder="BOTTOM TEXT"
              maxLength={100}
              className="input-field"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Font Size (px)</Label>
              <input
                type="range" min="20" max="120"
                value={opts.fontSize ?? 48}
                onChange={e => set('fontSize')(Number(e.target.value))}
                className="w-full accent-accent cursor-pointer mt-1"
              />
              <p className="text-[11px] text-text-muted mt-0.5">{opts.fontSize ?? 48}px</p>
            </div>
            <div>
              <Label>Text Color</Label>
              <input
                type="color"
                value={opts.color ?? '#FFFFFF'}
                onChange={e => set('color')(e.target.value)}
                className="w-full h-9 rounded-lg border border-border cursor-pointer mt-1"
              />
            </div>
          </div>
        </div>
      );

    case 'image-rotate':
      return (
        <div className="space-y-3">
          <div>
            <Label>Rotation Angle: {opts.angle ?? 0}°</Label>
            <input
              type="range" min="-180" max="180"
              value={opts.angle ?? 0}
              onChange={e => set('angle')(Number(e.target.value))}
              className="w-full accent-accent cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-text-muted mt-0.5">
              <span>-180°</span><span>0°</span><span>180°</span>
            </div>
          </div>
          <div>
            <Label>Flip</Label>
            <div className="flex gap-2">
              {[['none', 'None'], ['horizontal', 'Horizontal'], ['vertical', 'Vertical']].map(([val, label]) => (
                <Pill key={val} active={(opts.flip ?? 'none') === val} onClick={() => set('flip')(val)}>
                  {label}
                </Pill>
              ))}
            </div>
          </div>
        </div>
      );

    case 'image-filters':
      return (
        <div>
          <Label>Filter</Label>
          <div className="flex gap-2 flex-wrap">
            {[
              ['sepia', 'Sepia'],
              ['vintage', 'Vintage'],
              ['invert', 'Invert'],
              ['blur', 'Blur'],
              ['sharpen', 'Sharpen'],
              ['emboss', 'Emboss'],
            ].map(([val, label]) => (
              <Pill key={val} active={(opts.filter ?? 'sepia') === val} onClick={() => set('filter')(val)}>
                {label}
              </Pill>
            ))}
          </div>
        </div>
      );

    case 'image-adjustment':
      return (
        <div className="space-y-3">
          {[
            ['brightness', 'Brightness', -100, 100],
            ['contrast',   'Contrast',   -100, 100],
            ['saturation', 'Saturation', -100, 100],
            ['hue',        'Hue',        -180, 180],
          ].map(([key, label, min, max]) => (
            <div key={key}>
              <Label>{label}: {opts[key] ?? 0}</Label>
              <input
                type="range" min={min} max={max}
                value={opts[key] ?? 0}
                onChange={e => set(key)(Number(e.target.value))}
                className="w-full accent-accent cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-text-muted mt-0.5">
                <span>{min}</span><span>0</span><span>+{max}</span>
              </div>
            </div>
          ))}
        </div>
      );

    case 'image-ocr':
      return (
        <div>
          <Label>Language</Label>
          <div className="flex gap-2 flex-wrap">
            {[['eng', 'English'], ['ara', 'Arabic'], ['urd', 'Urdu'], ['fra', 'French'], ['deu', 'German']].map(([val, label]) => (
              <Pill key={val} active={(opts.language ?? 'eng') === val} onClick={() => set('language')(val)}>
                {label}
              </Pill>
            ))}
          </div>
        </div>
      );

    // No options: background-remover, image-to-grayscale, image-to-base64,
    //             metadata-exif-remover, qr-code-reader
    default:
      return null;
  }
}

// ── Censor region manager ─────────────────────────────────────
function CensorOptions({ opts, set }) {
  const regions = opts.regions ?? [];

  function addRegion() {
    set('regions')([...regions, { x: 0, y: 0, w: 100, h: 100 }]);
  }

  function updateRegion(i, field, val) {
    const next = regions.map((r, idx) => idx === i ? { ...r, [field]: Number(val) || 0 } : r);
    set('regions')(next);
  }

  function removeRegion(i) {
    set('regions')(regions.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-3">
      <div>
        <Label>Censor Mode</Label>
        <div className="flex gap-2">
          {[['blur', 'Blur'], ['pixelate', 'Pixelate'], ['blackout', 'Blackout']].map(([val, label]) => (
            <Pill key={val} active={(opts.mode ?? 'blur') === val} onClick={() => set('mode')(val)}>
              {label}
            </Pill>
          ))}
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Regions (pixels)</Label>
          <button
            type="button"
            onClick={addRegion}
            disabled={regions.length >= 10}
            className="flex items-center gap-1 text-[11px] font-semibold text-accent hover:text-accent/80 disabled:opacity-40"
          >
            <Plus className="w-3 h-3" /> Add Region
          </button>
        </div>
        {regions.length === 0 && (
          <p className="text-[11px] text-text-muted">Add at least one region to censor.</p>
        )}
        <div className="space-y-2">
          {regions.map((r, i) => (
            <div key={i} className="flex items-center gap-1.5 bg-surface-2/60 rounded-lg p-2">
              {[['x', 'X'], ['y', 'Y'], ['w', 'W'], ['h', 'H']].map(([f, lbl]) => (
                <div key={f} className="flex-1">
                  <p className="text-[10px] text-text-muted mb-0.5">{lbl}</p>
                  <input
                    type="number" min="0"
                    value={r[f]}
                    onChange={e => updateRegion(i, f, e.target.value)}
                    className="w-full text-xs border border-border rounded px-1 py-0.5 bg-white"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() => removeRegion(i)}
                className="text-text-muted hover:text-red-500 shrink-0 mt-3"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Dropzone ─────────────────────────────────────────────────
function Dropzone({ onFile, dragging, onDragOver, onDragLeave, onDrop, inputRef, multiple }) {
  return (
    <label
      className={`flex flex-col items-center justify-center gap-3 w-full rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 py-10 px-6 ${
        dragging
          ? 'border-accent bg-accent/5 scale-[1.01]'
          : 'border-border hover:border-accent/50 hover:bg-surface-2/60'
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
        dragging ? 'bg-accent/10' : 'bg-surface-2 border border-border'
      }`}>
        <Upload className={`w-6 h-6 ${dragging ? 'text-accent' : 'text-text-muted'}`} />
      </div>
      <div className="text-center">
        <p className="font-semibold text-text-primary text-sm">
          {dragging ? 'Drop image here' : multiple ? 'Drop images or click to browse' : 'Drop image or click to browse'}
        </p>
        <p className="text-xs text-text-muted mt-1">
          JPG, PNG, WebP, GIF · Max {MAX_MB} MB{multiple ? ' · Up to 10 files' : ''}
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple={!!multiple}
        className="sr-only"
        onChange={e => onFile(e.target.files)}
      />
    </label>
  );
}

function FilePill({ file, onRemove }) {
  const mb = (file.size / 1024 / 1024).toFixed(2);
  return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-surface-2/60">
      <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
        <ImageDown className="w-4 h-4 text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary truncate">{file.name}</p>
        <p className="text-xs text-text-muted">{mb} MB</p>
      </div>
      {onRemove && (
        <button onClick={onRemove} className="text-text-muted hover:text-red-500 transition-colors shrink-0">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

function ProgressBar({ value, label }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-text-muted">
        <span>{label ?? (value < 65 ? 'Uploading…' : value < 95 ? 'Processing…' : 'Finalising…')}</span>
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

// ── Main component ────────────────────────────────────────────
export default function ImageToolShell({ tool }) {
  const { slug } = tool;
  if (slug === 'image-cropper')         return <ImageCropperTool />;
  if (slug === 'image-watermark')       return <ImageWatermarkTool />;
  if (slug === 'metadata-exif-remover') return <MetadataExifTool />;
  if (slug === 'qr-code-generator')     return <QRCodeProTool />;
  const { upload, loading, error, progress, jsonResult, reset } = useFileUpload(slug);
  const { copied, copy } = useClipboard();

  const isMultiFile = slug === 'image-merger';
  const isTextResult = TEXT_SLUGS.includes(slug);
  const isOCR = slug === 'image-ocr';
  const isBgRemover = slug === 'background-remover';

  // Single-file state
  const [file,       setFile]      = useState(null);
  // Multi-file state (image-merger)
  const [files,      setFiles]     = useState([]);

  const [opts,       setOpts]      = useState({});
  const [done,       setDone]      = useState(false);
  const [fileError,  setFileError] = useState('');
  const [dragging,   setDragging]  = useState(false);
  const inputRef = useRef(null);

  // Browser-side OCR state (bypasses server when isOCR)
  const [ocrLoading,  setOcrLoading]  = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrError,    setOcrError]    = useState('');
  const [ocrResult,   setOcrResult]   = useState(null);

  // Browser-side background removal state
  const [bgLoading,  setBgLoading]  = useState(false);
  const [bgProgress, setBgProgress] = useState(0);
  const [bgError,    setBgError]    = useState('');


  const set = useCallback(key => val => setOpts(prev => ({ ...prev, [key]: val })), []);

  // ── File selection ──────────────────────────────────────────
  function selectFiles(fileList) {
    const arr = Array.from(fileList || []);
    if (arr.length === 0) return;

    if (isMultiFile) {
      const valid = arr.filter(f => {
        if (!f.type.startsWith('image/')) return false;
        if (f.size > MAX_MB * 1024 * 1024) return false;
        return true;
      });
      if (valid.length < arr.length) {
        setFileError('Some files were skipped (invalid type or exceeds 10 MB).');
      } else {
        setFileError('');
      }
      setFiles(prev => [...prev, ...valid].slice(0, 10));
      setDone(false);
      reset();
    } else {
      const f = arr[0];
      if (!f.type.startsWith('image/')) {
        setFileError('Please select a valid image file (JPG, PNG, WebP, or GIF).');
        return;
      }
      if (f.size > MAX_MB * 1024 * 1024) {
        setFileError(`File too large. Maximum size is ${MAX_MB} MB.`);
        return;
      }
      setFileError('');
      setFile(f);
      setDone(false);
      reset();
    }
  }

  function removeFile() {
    setFile(null);
    setFileError('');
    setDone(false);
    reset();
    if (inputRef.current) inputRef.current.value = '';
  }

  function removeFileAt(i) {
    setFiles(prev => prev.filter((_, idx) => idx !== i));
  }

  function handleDragOver(e)  { e.preventDefault(); setDragging(true); }
  function handleDragLeave()  { setDragging(false); }
  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    selectFiles(e.dataTransfer.files);
  }

  function resizeImageForBgRemoval(file, maxDimension = 1024) {
    return new Promise((resolve) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const maxDim = Math.max(img.naturalWidth, img.naturalHeight);
        if (maxDim <= maxDimension) { resolve(file); return; }
        const scale = maxDimension / maxDim;
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.naturalWidth  * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(blob => resolve(blob || file), 'image/jpeg', 0.85);
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }

  async function handleBrowserBgRemoval() {
    if (!file) return;
    setBgError('');
    setBgLoading(true);
    setBgProgress(5);
    setDone(false);

    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      setBgLoading(false);
      setBgError('Model download timed out. Check your internet connection and try again, or use a smaller image.');
    }, 5 * 60 * 1000);

    try {
      // Pre-resize to max 1024px to speed up inference
      setBgProgress(8);
      const processedFile = await resizeImageForBgRemoval(file, 1024);
      setBgProgress(12);

      const { removeBackground } = await import('@imgly/background-removal');
      setBgProgress(15);

      if (timedOut) return;

      const blob = await removeBackground(processedFile, {
        model: 'small',
        debug: false,
        progress: (key, current, total) => {
          if (timedOut || total <= 0) return;
          const pct = Math.round((current / total) * 100);
          if (key.includes('fetch') || key.includes('download') || key.includes('load')) {
            setBgProgress(Math.min(15 + Math.round(pct * 0.55), 70));
          } else {
            setBgProgress(Math.min(70 + Math.round(pct * 0.27), 97));
          }
        },
      });

      clearTimeout(timeoutId);
      if (timedOut) return;

      setBgProgress(100);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'background-removed.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setDone(true);
    } catch (err) {
      clearTimeout(timeoutId);
      if (timedOut) return;
      const msg = err?.message || '';
      if (msg.includes('SharedArrayBuffer')) {
        setBgError('Your browser does not support this feature. Please try Chrome or Edge with HTTPS.');
      } else {
        setBgError('This image or model is too heavy for your browser. Try a smaller image.');
      }
    } finally {
      if (!timedOut) setBgLoading(false);
    }
  }

  async function handleBrowserOCR() {
    if (!file) return;
    setOcrResult(null);
    setOcrError('');
    setOcrLoading(true);
    setOcrProgress(5);

    const lang = /^[a-z]{3}$/.test(opts.language || '') ? opts.language : 'eng';

    // v4 API: createWorker accepts only an options object.
    // Passing (lang, oem, opts) silently drops lang/oem — api stays null → SetImageFile crash.
    // Correct sequence: createWorker(opts) → loadLanguage → initialize → recognize.
    let worker;
    try {
      worker = await Tesseract.createWorker({
        logger: ({ status, progress }) => {
          if (status === 'loading tesseract core')
            setOcrProgress(5 + Math.floor(progress * 20));
          else if (status === 'loading language traineddata')
            setOcrProgress(25 + Math.floor(progress * 40));
          else if (status === 'recognizing text')
            setOcrProgress(65 + Math.floor(progress * 33));
        },
      });

      await worker.loadLanguage(lang);
      await worker.initialize(lang);

      const { data: { text } } = await worker.recognize(file);
      setOcrResult({ text: (text || '').trim() });
      setOcrProgress(100);
      setDone(true);
    } catch {
      setOcrError('OCR processing failed. Please try a clearer image.');
    } finally {
      if (worker) await worker.terminate();
      setOcrLoading(false);
    }
  }


  async function handleProcess() {
    setDone(false);
    if (isOCR) {
      await handleBrowserOCR();
      return;
    }
    if (isBgRemover) {
      await handleBrowserBgRemoval();
      return;
    }
    if (isMultiFile) {
      if (files.length < 2) return;
      await upload(files, opts);
    } else {
      if (!file) return;
      await upload(file, opts);
    }
    setDone(true);
  }

  function handleReset() {
    setFile(null);
    setFiles([]);
    setFileError('');
    setOpts({});
    setDone(false);
    setOcrResult(null);
    setOcrError('');
    setOcrProgress(0);
    setBgError('');
    setBgProgress(0);
    reset();
    if (inputRef.current) inputRef.current.value = '';
  }

  // Merge server-upload state with browser-side processing state
  const effectiveLoading  = isOCR ? ocrLoading  : isBgRemover ? bgLoading  : loading;
  const effectiveProgress = isOCR ? ocrProgress : isBgRemover ? bgProgress : progress;
  const effectiveError    = isOCR ? ocrError    : isBgRemover ? bgError    : error;
  const effectiveResult   = isOCR ? ocrResult   : jsonResult;

  // Determine result shape
  const textOutput   = effectiveResult?.text;
  const base64Output = effectiveResult?.base64;
  const showResult = done && (
    isTextResult
      ? !!(textOutput !== undefined || base64Output)
      : !effectiveError
  );

  // What text to show in the textarea
  const textareaValue = base64Output ?? textOutput ?? '';
  const textareaLabel = slug === 'image-to-base64' ? 'Base64 Data URL' :
                        slug === 'qr-code-reader'  ? 'Decoded QR Content' :
                        slug === 'image-ocr'        ? 'Extracted Text' : '';

  function canProcess() {
    if (effectiveLoading) return false;
    if (isMultiFile) return files.length >= 2;
    if (!file) return false;
    if (slug === 'image-watermark' && !opts.text?.trim()) return false;
    if (slug === 'image-cropper'   && (!opts.width || !opts.height)) return false;
    if (slug === 'image-censor'    && (!opts.regions || opts.regions.length === 0)) return false;
    return true;
  }

  const processLabel =
    slug === 'image-compressor'      ? 'Compress Image'         :
    slug === 'image-resizer'         ? 'Resize Image'           :
    slug === 'image-converter'       ? 'Convert Image'          :
    slug === 'image-cropper'         ? 'Crop Image'             :
    slug === 'background-remover'    ? 'Remove Background'      :
    slug === 'image-to-grayscale'    ? 'Convert to Grayscale'   :
    slug === 'image-rotator'         ? 'Rotate Image'           :
    slug === 'image-watermark'       ? 'Add Watermark'          :
    slug === 'image-to-base64'       ? 'Convert to Base64'      :
    slug === 'image-censor'          ? 'Apply Censoring'        :
    slug === 'metadata-exif-remover' ? 'Remove Metadata'        :
    slug === 'meme-generator'        ? 'Generate Meme'          :
    slug === 'image-merger'          ? 'Merge Images'           :
    slug === 'image-rotate'          ? 'Rotate / Flip'          :
    slug === 'image-filters'         ? 'Apply Filter'           :
    slug === 'image-adjustment'      ? 'Adjust Image'           :
    slug === 'qr-code-reader'        ? 'Decode QR Code'         :
    slug === 'image-ocr'             ? 'Extract Text (OCR)'     :
    'Process Image';

  const hasFile = isMultiFile ? files.length > 0 : !!file;

  return (
    <div className="panel-card shadow-lg">
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">

        {/* ── LEFT: Upload + Options ───────────────────────── */}
        <div className="flex flex-col">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-text-muted" />
              <span className="text-sm font-semibold text-text-primary">
                {isMultiFile ? `Upload Images (${files.length}/10)` : 'Upload Image'}
              </span>
            </div>
            {hasFile && (
              <button onClick={handleReset} className="btn-ghost">
                <X className="w-3.5 h-3.5" />
                Clear
              </button>
            )}
          </div>

          <div className="flex-1 p-4 space-y-4">
            {/* Multi-file (image-merger) */}
            {isMultiFile ? (
              <>
                <Dropzone
                  onFile={selectFiles}
                  dragging={dragging}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  inputRef={inputRef}
                  multiple
                />
                {files.length > 0 && (
                  <div className="space-y-2">
                    {files.map((f, i) => (
                      <FilePill key={i} file={f} onRemove={() => removeFileAt(i)} />
                    ))}
                  </div>
                )}
                {files.length < 2 && files.length > 0 && (
                  <p className="text-[11px] text-amber-600">Add at least 2 images to merge.</p>
                )}
              </>
            ) : (
              /* Single-file */
              !file ? (
                <Dropzone
                  onFile={selectFiles}
                  dragging={dragging}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  inputRef={inputRef}
                />
              ) : (
                <FilePill file={file} onRemove={removeFile} />
              )
            )}

            {fileError && (
              <div className="flex items-start gap-2 text-xs text-red-600">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{fileError}</span>
              </div>
            )}

            {/* Tool-specific options — show after at least one file */}
            {hasFile && (
              <ToolOptions slug={slug} opts={opts} set={set} />
            )}
          </div>

          {/* Process button */}
          <div className="px-4 pb-4 pt-3 border-t border-border">
            <button
              onClick={handleProcess}
              disabled={!canProcess()}
              className="btn-primary w-full h-11 text-sm"
            >
              {effectiveLoading
                ? <><Loader2 className="w-4 h-4 animate-spin" />Processing…</>
                : processLabel
              }
            </button>
            {slug === 'image-watermark' && !opts.text?.trim() && file && (
              <p className="text-[11px] text-text-muted text-center mt-2">Enter watermark text above to continue</p>
            )}
            {slug === 'image-cropper' && file && (!opts.width || !opts.height) && (
              <p className="text-[11px] text-text-muted text-center mt-2">Enter crop width and height to continue</p>
            )}
            {slug === 'image-censor' && hasFile && (!opts.regions || opts.regions.length === 0) && (
              <p className="text-[11px] text-text-muted text-center mt-2">Add at least one censor region above</p>
            )}
          </div>
        </div>

        {/* ── RIGHT: Status / Result ───────────────────────── */}
        <div className="flex flex-col">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <ImageDown className="w-4 h-4 text-text-muted" />
              <span className="text-sm font-semibold text-text-primary">Result</span>
            </div>
            {isTextResult && effectiveResult && (
              <button onClick={() => copy(textareaValue)} className="btn-ghost">
                {copied
                  ? <><Check className="w-3.5 h-3.5 text-green-600" />Copied!</>
                  : <><Copy className="w-3.5 h-3.5" />Copy</>}
              </button>
            )}
          </div>

          <div className="flex-1 p-4 flex flex-col" style={{ minHeight: '200px' }}>

            {/* Empty state */}
            {!effectiveLoading && !effectiveError && !showResult && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
                <div className="w-14 h-14 bg-surface-2 rounded-2xl flex items-center justify-center mb-3 border border-border">
                  <ImageDown className="w-6 h-6 text-text-light" />
                </div>
                <p className="text-sm font-semibold text-text-secondary">Output appears here</p>
                <p className="text-xs text-text-muted mt-1">
                  {isMultiFile ? 'Select images and click process' : 'Upload an image and click process'}
                </p>
              </div>
            )}

            {/* Progress */}
            {effectiveLoading && (
              <div className="flex-1 flex flex-col justify-center px-2 gap-6">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 text-accent animate-spin" />
                  <p className="text-sm font-medium text-text-secondary">
                    {isBgRemover
                      ? bgProgress < 16 ? 'Preparing image…'
                        : bgProgress < 70 ? `Downloading AI model… ${bgProgress}%`
                        : bgProgress < 98 ? 'Removing background…'
                        : 'Finalising…'
                      : 'Processing your image…'}
                  </p>
                  {isBgRemover && bgProgress >= 16 && bgProgress < 70 && (
                    <p className="text-xs text-text-muted text-center">
                      First-time download (~44 MB) — subsequent uses are instant
                    </p>
                  )}
                </div>
                <ProgressBar
                  value={effectiveProgress}
                  label={isBgRemover
                    ? effectiveProgress < 16 ? 'Preparing…'
                      : effectiveProgress < 70 ? 'Downloading model…'
                      : effectiveProgress < 98 ? 'Removing background…'
                      : 'Finalising…'
                    : undefined}
                />
              </div>
            )}

            {/* Error */}
            {effectiveError && !effectiveLoading && (
              <div className="space-y-3">
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-start gap-2.5 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{effectiveError}</span>
                </div>
                <button onClick={handleReset} className="btn-secondary w-full gap-2">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Try Again
                </button>
              </div>
            )}

            {/* Success: file download */}
            {showResult && !isTextResult && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-fadeUp">
                <div className="w-16 h-16 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-brand">
                  <Check className="w-8 h-8 text-white" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-text-primary text-base">Done!</p>
                  <p className="text-sm text-text-secondary mt-1">Your file has been downloaded automatically.</p>
                </div>
                <button onClick={handleReset} className="btn-secondary gap-2 mt-2">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Process Another Image
                </button>
              </div>
            )}

            {/* Success: text/base64 result */}
            {showResult && isTextResult && (
              <div className="flex flex-col gap-3 animate-fadeUp h-full">
                <div className="flex items-center gap-2 text-sm font-medium text-text-secondary">
                  <Check className="w-4 h-4 text-green-600" />
                  {textareaLabel} extracted successfully
                </div>
                <textarea
                  readOnly
                  value={textareaValue}
                  className="tool-textarea flex-1 font-mono text-xs bg-accent/5 border-accent/20"
                  style={{ minHeight: '200px' }}
                  aria-label={textareaLabel}
                />
                {slug === 'image-to-base64' && (
                  <p className="text-[11px] text-text-muted">
                    Paste directly into <code className="bg-surface-2 px-1 rounded">src=""</code> or CSS <code className="bg-surface-2 px-1 rounded">url()</code>
                  </p>
                )}
                <button onClick={handleReset} className="btn-secondary gap-2">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Process Another Image
                </button>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
