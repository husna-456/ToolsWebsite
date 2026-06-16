import { useState, useRef, useCallback } from 'react';
import {
  Upload, X, EyeOff, Download, Loader2, AlertCircle,
  ScanText, Scan, Square, CheckCircle2, Info,
} from 'lucide-react';

// ── CDN loaders (lazy — only loaded when actually needed) ────────────────────
const FACE_API_CDN    = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
const FACE_MODELS_URI = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@0.22.2/weights';
const TESSERACT_CDN   = 'https://cdn.jsdelivr.net/npm/tesseract.js@4.1.1/dist/tesseract.min.js';

let faceApiReady = false;
let faceApiLoading = null;

function loadFaceApi() {
  if (faceApiReady) return Promise.resolve(window.faceapi);
  if (faceApiLoading) return faceApiLoading;

  faceApiLoading = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${FACE_API_CDN}"]`);
    const onReady = async () => {
      try {
        await window.faceapi.nets.tinyFaceDetector.loadFromUri(FACE_MODELS_URI);
        faceApiReady = true;
        resolve(window.faceapi);
      } catch (e) {
        reject(new Error('Could not load face detection model. Check your internet connection.'));
      }
    };
    if (existing) { onReady(); return; }
    const script = document.createElement('script');
    script.src = FACE_API_CDN;
    script.onload = onReady;
    script.onerror = () => reject(new Error('Could not load face-api.js from CDN.'));
    document.head.appendChild(script);
  });

  return faceApiLoading;
}

let tesseractReady = false;
let tesseractLoading = null;

function loadTesseract() {
  if (tesseractReady) return Promise.resolve(window.Tesseract);
  if (tesseractLoading) return tesseractLoading;

  tesseractLoading = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${TESSERACT_CDN}"]`);
    const onReady = () => {
      tesseractReady = true;
      resolve(window.Tesseract);
    };
    if (existing) { onReady(); return; }
    const script = document.createElement('script');
    script.src = TESSERACT_CDN;
    script.onload = onReady;
    script.onerror = () => reject(new Error('Could not load Tesseract.js from CDN.'));
    document.head.appendChild(script);
  });

  return tesseractLoading;
}

// ── Intent parser ──────────────────────────────────────────────
function parseIntent(query) {
  const q = query.toLowerCase();
  if (/\b(face|faces|person|people|head|portrait|selfie|identity)\b/.test(q)) return 'face';
  if (/\b(entire|whole|everything|all|full|complete|blackout all|whole image)\b/.test(q)) return 'full';
  return 'text';
}

// ── Text pattern matcher ───────────────────────────────────────
function wordMatchesQuery(wordText, query) {
  const q = query.toLowerCase();
  const t = wordText.trim();
  if (!t || t.length < 2) return false;

  // CNIC / National ID
  if (/(cnic|national.?id|id.?number|identification|nadra)/.test(q))
    return /\d{5}-?\d{7}-?\d/.test(t) || /^\d{13}$/.test(t);

  // Phone / mobile
  if (/(phone|mobile|cell|contact.?number)/.test(q) && !/national/.test(q))
    return /^\+?[\d][\d\s\-().]{8,}$/.test(t) && t.replace(/\D/g, '').length >= 10;

  // Email
  if (/(email|e-mail|mail\s*address)/.test(q))
    return /@/.test(t) || /^[a-z0-9._%+-]+@/i.test(t);

  // Credit / debit card
  if (/(credit|debit|card.?number)/.test(q))
    return /^[\d\s\-]{13,19}$/.test(t) && /\d{4}/.test(t);

  // Passport
  if (/passport/.test(q))
    return /^[A-Z]{1,2}\d{6,9}$/.test(t);

  // License plate
  if (/(license|licence|number.?plate|plate)/.test(q))
    return /^[A-Z0-9]{2,8}[-\s]?[A-Z0-9]{2,8}$/.test(t);

  // Any number sequence
  if (/(number|digit|code|pin|otp|serial)/.test(q) && !/phone|national/.test(q))
    return /^\d{4,}$/.test(t);

  // Date
  if (/(date|dob|birth|expiry)/.test(q))
    return /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/.test(t);

  // Fallback: keyword match (user may have typed exact text to find)
  const stopWords = /^(censor|blur|hide|remove|pixelate|blackout|mask|redact|the|a|an|my|all|in|on|of|to)$/i;
  const keywords = q.split(/\s+/).filter(w => w.length >= 3 && !stopWords.test(w));
  return keywords.some(kw => t.toLowerCase().includes(kw));
}

// ── Merge nearby regions into single boxes ─────────────────────
function mergeRegions(regions, gapX = 8, gapY = 4) {
  if (!regions.length) return [];
  const sorted = [...regions].sort((a, b) => a.y - b.y || a.x - b.x);
  const out = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    const cur  = sorted[i];
    const sameRow = cur.y <= last.y + last.h + gapY;
    const close   = cur.x <= last.x + last.w + gapX;
    if (sameRow && close) {
      const x2 = Math.max(last.x + last.w, cur.x + cur.w);
      const y2 = Math.max(last.y + last.h, cur.y + cur.h);
      last.x = Math.min(last.x, cur.x);
      last.y = Math.min(last.y, cur.y);
      last.w = x2 - last.x;
      last.h = y2 - last.y;
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

// ── Canvas censor effects ──────────────────────────────────────
function applyRegionToCanvas(ctx, sourceCanvas, region, mode) {
  const { x, y, w, h } = region;
  if (w < 1 || h < 1) return;

  if (mode === 'blackout') {
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, w, h);
    return;
  }

  // Extract region into a temp canvas, apply effect, draw back
  const tmp = document.createElement('canvas');
  tmp.width  = w;
  tmp.height = h;
  const tc = tmp.getContext('2d');

  if (mode === 'blur') {
    const sigma = Math.max(6, Math.round(Math.min(w, h) / 8));
    tc.filter = `blur(${sigma}px)`;
    tc.drawImage(sourceCanvas, x, y, w, h, 0, 0, w, h);
    tc.filter = 'none';
    // Extra pass to strengthen the blur near edges
    tc.filter = `blur(${Math.round(sigma / 2)}px)`;
    tc.drawImage(tmp, 0, 0);
    tc.filter = 'none';
  } else {
    // Pixelate: downsample → upsample with nearest-neighbour
    const blockSize = Math.max(6, Math.round(Math.min(w, h) / 10));
    const tiny = document.createElement('canvas');
    tiny.width  = Math.max(1, Math.ceil(w / blockSize));
    tiny.height = Math.max(1, Math.ceil(h / blockSize));
    const sc = tiny.getContext('2d');
    sc.imageSmoothingEnabled = false;
    sc.drawImage(sourceCanvas, x, y, w, h, 0, 0, tiny.width, tiny.height);
    tc.imageSmoothingEnabled = false;
    tc.drawImage(tiny, 0, 0, w, h);
  }

  ctx.drawImage(tmp, x, y);
}

// ── Detect faces using face-api.js from CDN ────────────────────
async function detectFaceRegions(imgEl) {
  const faceapi = await loadFaceApi();
  const detections = await faceapi.detectAllFaces(
    imgEl,
    new faceapi.TinyFaceDetectorOptions({ inputSize: 416, scoreThreshold: 0.4 }),
  );
  return detections.map(d => ({
    x: Math.floor(d.box.x),
    y: Math.floor(d.box.y),
    w: Math.ceil(d.box.width),
    h: Math.ceil(d.box.height),
  }));
}

// ── OCR-based text region detection ───────────────────────────
async function detectTextRegions(imgEl, query, onProgress) {
  const Tesseract = await loadTesseract();
  const { data } = await Tesseract.recognize(imgEl, 'eng', {
    logger: m => {
      if (m.status === 'recognizing text') onProgress(Math.round(m.progress * 100));
    },
  });

  const matched = [];
  for (const word of data.words) {
    if (word.confidence < 25) continue;
    if (wordMatchesQuery(word.text, query)) {
      const { x0, y0, x1, y1 } = word.bbox;
      matched.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
    }
  }

  // If word-level found nothing, fall back to line-level match
  if (!matched.length) {
    for (const line of data.lines) {
      if (wordMatchesQuery(line.text, query)) {
        const { x0, y0, x1, y1 } = line.bbox;
        matched.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
      }
    }
  }

  return mergeRegions(matched);
}

// ── Mode pills ─────────────────────────────────────────────────
const MODES = [
  { value: 'blur',      label: 'Blur' },
  { value: 'pixelate',  label: 'Pixelate' },
  { value: 'blackout',  label: 'Blackout' },
];

// ── Examples ──────────────────────────────────────────────────
const EXAMPLES = [
  { icon: ScanText, text: 'censor CNIC number' },
  { icon: ScanText, text: 'hide phone number' },
  { icon: ScanText, text: 'blur email address' },
  { icon: Scan,     text: 'blur face' },
  { icon: Square,   text: 'blackout entire image' },
];

// ── Main component ─────────────────────────────────────────────
export default function ImageCensorTool({ tool }) {
  const [imgFile,    setImgFile]    = useState(null);
  const [imgSrc,     setImgSrc]     = useState('');
  const [query,      setQuery]      = useState('');
  const [mode,       setMode]       = useState('blur');
  const [status,     setStatus]     = useState('idle');   // idle | running | done | error
  const [progress,   setProgress]   = useState(0);
  const [statusMsg,  setStatusMsg]  = useState('');
  const [resultUrl,  setResultUrl]  = useState('');
  const [regionCount,setRegionCount]= useState(0);
  const [error,      setError]      = useState('');

  const imgRef      = useRef(null);     // HTMLImageElement
  const sourceRef   = useRef(null);     // off-screen canvas holding original pixels
  const dropRef     = useRef(null);
  const fileInputRef= useRef(null);

  // ── File handling ────────────────────────────────────────────
  const loadFile = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setImgFile(file);
    setResultUrl('');
    setError('');
    setStatus('idle');
    setProgress(0);

    const url = URL.createObjectURL(file);
    setImgSrc(url);

    // Pre-build source canvas from natural image dimensions
    const img = new Image();
    img.onload = () => {
      imgRef.current = img;
      const c = document.createElement('canvas');
      c.width  = img.naturalWidth;
      c.height = img.naturalHeight;
      c.getContext('2d').drawImage(img, 0, 0);
      sourceRef.current = c;
    };
    img.src = url;
  }, []);

  const handleFileDrop = useCallback((e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file) loadFile(file);
  }, [loadFile]);

  const handleFileInput = (e) => loadFile(e.target.files?.[0]);

  // ── Main censor action ────────────────────────────────────────
  const handleCensor = useCallback(async () => {
    if (!imgRef.current || !sourceRef.current || !query.trim()) return;

    setStatus('running');
    setError('');
    setResultUrl('');
    setProgress(0);

    try {
      const img    = imgRef.current;
      const source = sourceRef.current;
      const W = source.width;
      const H = source.height;
      const intent = parseIntent(query);

      let regions = [];

      if (intent === 'full') {
        setStatusMsg('Applying censor…');
        regions = [{ x: 0, y: 0, w: W, h: H }];

      } else if (intent === 'face') {
        setStatusMsg('Loading face detection model…');
        setProgress(10);
        regions = await detectFaceRegions(img);
        setProgress(100);

      } else {
        setStatusMsg('Running OCR to detect text…');
        regions = await detectTextRegions(img, query, (p) => {
          setProgress(p);
          setStatusMsg(`Scanning text… ${p}%`);
        });
        setProgress(100);
      }

      setRegionCount(regions.length);

      // Build output canvas
      setStatusMsg('Applying censor effect…');
      const out = document.createElement('canvas');
      out.width  = W;
      out.height = H;
      const ctx = out.getContext('2d');
      ctx.drawImage(source, 0, 0);

      for (const region of regions) {
        applyRegionToCanvas(ctx, source, region, mode);
      }

      const blob = await new Promise(r => out.toBlob(r, 'image/png'));
      setResultUrl(URL.createObjectURL(blob));
      setStatus('done');

    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
      setStatus('error');
    }
  }, [query, mode]);

  // ── Download ─────────────────────────────────────────────────
  const handleDownload = () => {
    if (!resultUrl) return;
    const a = document.createElement('a');
    a.href     = resultUrl;
    a.download = `censored-${Date.now()}.png`;
    a.click();
  };

  // ── Reset ────────────────────────────────────────────────────
  const handleReset = () => {
    setImgFile(null);
    setImgSrc('');
    setResultUrl('');
    setError('');
    setStatus('idle');
    setQuery('');
    setProgress(0);
    imgRef.current    = null;
    sourceRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isRunning = status === 'running';
  const isDone    = status === 'done';

  return (
    <div className="panel-card shadow-lg space-y-0">

      {/* ── Header ── */}
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <EyeOff className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-semibold text-text-primary">
            {tool.title || 'AI Image Censor'}
          </span>
        </div>
        {imgFile && (
          <button onClick={handleReset} className="btn-ghost text-xs">
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
      </div>

      <div className="p-5 space-y-5">

        {/* ── Upload zone ── */}
        {!imgFile ? (
          <div
            ref={dropRef}
            onDragOver={e => e.preventDefault()}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border hover:border-accent/50 rounded-2xl py-14 flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors group"
          >
            <div className="w-14 h-14 bg-accent/8 rounded-2xl flex items-center justify-center border border-accent/15 group-hover:bg-accent/12 transition-colors">
              <Upload className="w-6 h-6 text-accent" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-text-primary text-sm">Drop image here or click to upload</p>
              <p className="text-xs text-text-muted mt-1">JPG, PNG, WebP — up to 20 MB</p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
        ) : (

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* LEFT: controls */}
            <div className="space-y-4">

              {/* Image thumbnail */}
              <div className="relative rounded-xl overflow-hidden border border-border bg-surface-2">
                <img
                  src={isDone ? resultUrl : imgSrc}
                  alt="Preview"
                  className="w-full object-contain max-h-64"
                />
                {isDone && (
                  <div className="absolute top-2 right-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> Censored
                  </div>
                )}
              </div>

              {/* Query input */}
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">
                  What to censor
                </label>
                <input
                  className="tool-input"
                  placeholder="e.g. blur face, hide phone number, censor CNIC…"
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !isRunning && query.trim() && handleCensor()}
                  disabled={isRunning}
                />
                {/* Example chips */}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {EXAMPLES.map(({ icon: Icon, text }) => (
                    <button
                      key={text}
                      onClick={() => setQuery(text)}
                      className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg bg-surface-2 border border-border text-text-muted hover:text-primary hover:border-accent/40 transition-all"
                    >
                      <Icon className="w-3 h-3" />
                      {text}
                    </button>
                  ))}
                </div>
              </div>

              {/* Censor mode */}
              <div>
                <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">
                  Censor style
                </label>
                <div className="flex gap-2">
                  {MODES.map(m => (
                    <button
                      key={m.value}
                      onClick={() => setMode(m.value)}
                      disabled={isRunning}
                      className={`flex-1 py-2 text-xs font-semibold rounded-lg border transition-all ${
                        mode === m.value
                          ? 'border-accent bg-accent text-white shadow-sm'
                          : 'border-border text-text-secondary hover:border-accent/50 bg-white'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* How it works info */}
              <div className="bg-accent-subtle/50 border border-accent/15 rounded-xl p-3 space-y-1.5">
                <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
                  <Info className="w-3.5 h-3.5" /> How it works
                </p>
                {[
                  '"blur face" → face-api.js detects face bounding boxes',
                  '"hide phone number" → Tesseract OCR finds matching text regions',
                  '"blackout entire image" → covers full canvas dimensions',
                ].map(tip => (
                  <p key={tip} className="text-xs text-text-muted pl-5">{tip}</p>
                ))}
              </div>

              {/* Action button */}
              {!isDone ? (
                <button
                  onClick={handleCensor}
                  disabled={isRunning || !query.trim()}
                  className="btn-primary w-full h-12 text-[15px]"
                >
                  {isRunning
                    ? <><Loader2 className="w-4 h-4 animate-spin" />{statusMsg || 'Processing…'}</>
                    : <><EyeOff className="w-4 h-4" />Detect & Censor</>
                  }
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={handleDownload} className="btn-primary flex-1 h-12 text-[15px]">
                    <Download className="w-4 h-4" /> Download PNG
                  </button>
                  <button onClick={handleReset} className="btn-ghost px-4 h-12 border border-border rounded-xl">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* RIGHT: result / status */}
            <div className="flex flex-col gap-4">

              {/* Progress / idle state */}
              {!isDone && !error && (
                <div className="flex-1 border border-border rounded-2xl flex flex-col items-center justify-center py-12 bg-surface-2/50">
                  {isRunning ? (
                    <>
                      <Loader2 className="w-9 h-9 text-accent animate-spin mb-4" />
                      <p className="text-sm font-semibold text-text-primary">{statusMsg}</p>
                      {progress > 0 && progress < 100 && (
                        <div className="mt-4 w-48">
                          <div className="h-1.5 bg-border rounded-full overflow-hidden">
                            <div
                              className="h-full bg-accent rounded-full transition-all duration-300"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <p className="text-xs text-text-muted text-center mt-1">{progress}%</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <EyeOff className="w-9 h-9 text-text-muted/30 mb-3" />
                      <p className="text-sm font-semibold text-text-secondary">Result appears here</p>
                      <p className="text-xs text-text-muted mt-1">
                        Type what to censor and click the button
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              {/* Success result */}
              {isDone && (
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden border border-border shadow-sm">
                    <img
                      src={resultUrl}
                      alt="Censored result"
                      className="w-full object-contain max-h-72"
                    />
                  </div>
                  <div className={`rounded-xl px-4 py-3 border text-sm font-medium flex items-center gap-2 ${
                    regionCount > 0
                      ? 'bg-green-50 border-green-200 text-green-700'
                      : 'bg-orange-50 border-orange-200 text-orange-700'
                  }`}>
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    {regionCount > 0
                      ? `${regionCount} region${regionCount > 1 ? 's' : ''} censored successfully.`
                      : 'No matching regions found — try a different description or check spelling.'
                    }
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
