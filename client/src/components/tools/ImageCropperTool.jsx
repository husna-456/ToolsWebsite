import { useState, useRef, useCallback, useEffect } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import {
  Upload, X, RotateCcw, RotateCw, ZoomIn, ZoomOut,
  Crop, RefreshCw, Check, ImageDown, AlertCircle,
} from 'lucide-react';

// ── Constants ──────────────────────────────────────────────────
const ASPECTS = [
  { label: 'Free',  value: undefined },
  { label: '1:1',   value: 1 },
  { label: '4:3',   value: 4 / 3 },
  { label: '16:9',  value: 16 / 9 },
  { label: '9:16',  value: 9 / 16 },
  { label: '3:2',   value: 3 / 2 },
];
const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const PREVIEW_W = 220;

// ── Helpers ────────────────────────────────────────────────────
function Pill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-all duration-150 ${
        active
          ? 'bg-accent border-accent text-white shadow-sm'
          : 'bg-white border-border text-text-secondary hover:border-accent/50'
      }`}
    >
      {children}
    </button>
  );
}

function IconBtn({ onClick, disabled, title, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-white text-text-secondary hover:text-accent hover:border-accent/50 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
    >
      {children}
    </button>
  );
}

// Rotate image by any angle using canvas
async function rotateImageSrc(src, angleDeg) {
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
  const rad = (angleDeg * Math.PI) / 180;
  const absCos = Math.abs(Math.cos(rad));
  const absSin = Math.abs(Math.sin(rad));
  const cw = Math.round(img.naturalWidth * absCos + img.naturalHeight * absSin);
  const ch = Math.round(img.naturalWidth * absSin + img.naturalHeight * absCos);
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  ctx.translate(cw / 2, ch / 2);
  ctx.rotate(rad);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  return canvas.toDataURL('image/png');
}

// Crop image to blob
async function cropToBlob(src, pctCrop, naturalW, naturalH) {
  const img = await new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = src;
  });
  const x = (pctCrop.x / 100) * naturalW;
  const y = (pctCrop.y / 100) * naturalH;
  const w = (pctCrop.width / 100) * naturalW;
  const h = (pctCrop.height / 100) * naturalH;
  const canvas = document.createElement('canvas');
  canvas.width  = Math.round(w);
  canvas.height = Math.round(h);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, Math.round(x), Math.round(y), Math.round(w), Math.round(h), 0, 0, canvas.width, canvas.height);
  return new Promise(resolve => canvas.toBlob(blob => resolve(blob), 'image/png'));
}

// ── Main component ─────────────────────────────────────────────
export default function ImageCropperTool() {
  const [imageSrc,        setImageSrc]        = useState(null);
  const [originalSrc,     setOriginalSrc]     = useState(null);
  const [fileName,        setFileName]        = useState('image');
  const [naturalDims,     setNaturalDims]     = useState({ w: 0, h: 0 });
  const [crop,            setCrop]            = useState(undefined);
  const [completedPct,    setCompletedPct]    = useState(null);
  const [pxInputs,        setPxInputs]        = useState({ x: '', y: '', w: '', h: '' });
  const [aspect,          setAspect]          = useState(undefined);
  const [zoom,            setZoom]            = useState(1);
  const [rotation,        setRotation]        = useState(0);
  const [dragging,        setDragging]        = useState(false);
  const [loading,         setLoading]         = useState(false);
  const [error,           setError]           = useState('');
  const [done,            setDone]            = useState(false);

  const imgRef        = useRef(null);
  const canvasRef     = useRef(null);
  const fileInputRef  = useRef(null);

  // ── Update preview canvas ──────────────────────────────────
  const updatePreview = useCallback((pct, dims) => {
    const canvas = canvasRef.current;
    const img    = imgRef.current;
    if (!canvas || !img || !pct?.width || !pct?.height) return;
    const ratio  = pct.height / pct.width;
    const pH     = Math.round(PREVIEW_W * ratio);
    canvas.width  = PREVIEW_W;
    canvas.height = pH;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, PREVIEW_W, pH);
    const nw = dims?.w || img.naturalWidth;
    const nh = dims?.h || img.naturalHeight;
    ctx.drawImage(
      img,
      (pct.x / 100) * nw, (pct.y / 100) * nh,
      (pct.width / 100) * nw, (pct.height / 100) * nh,
      0, 0, PREVIEW_W, pH,
    );
  }, []);

  // ── Crop complete callback ─────────────────────────────────
  const onCropComplete = useCallback((_, pct) => {
    setCompletedPct(pct);
    setDone(false);
    if (!pct?.width || !naturalDims.w) return;
    setPxInputs({
      x: String(Math.round((pct.x / 100) * naturalDims.w)),
      y: String(Math.round((pct.y / 100) * naturalDims.h)),
      w: String(Math.round((pct.width / 100) * naturalDims.w)),
      h: String(Math.round((pct.height / 100) * naturalDims.h)),
    });
    updatePreview(pct, naturalDims);
  }, [naturalDims, updatePreview]);

  // Refresh preview when zoom changes (canvas needs redraw)
  useEffect(() => {
    if (completedPct) updatePreview(completedPct, naturalDims);
  }, [zoom, completedPct, naturalDims, updatePreview]);

  // ── Image load ─────────────────────────────────────────────
  function onImageLoad(e) {
    const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
    setNaturalDims({ w, h });
    const centered = centerCrop(
      makeAspectCrop({ unit: '%', width: 80 }, aspect || w / h, w, h),
      w, h,
    );
    setCrop(centered);
  }

  // ── File handling ──────────────────────────────────────────
  function loadFile(f) {
    if (!f) return;
    if (!f.type.startsWith('image/')) { setError('Please upload an image file (JPG, PNG, WebP, GIF).'); return; }
    if (f.size > 10 * 1024 * 1024)   { setError('File too large. Maximum size is 10 MB.');               return; }
    setError('');
    setFileName(f.name.replace(/\.[^.]+$/, '') || 'image');
    const reader = new FileReader();
    reader.onload = e2 => {
      const src = e2.target.result;
      setOriginalSrc(src);
      setImageSrc(src);
      setCrop(undefined);
      setCompletedPct(null);
      setNaturalDims({ w: 0, h: 0 });
      setPxInputs({ x: '', y: '', w: '', h: '' });
      setZoom(1);
      setRotation(0);
      setDone(false);
    };
    reader.readAsDataURL(f);
  }

  function onDrop(e) { e.preventDefault(); setDragging(false); loadFile(e.dataTransfer.files[0]); }

  // ── Manual pixel input → update crop % ────────────────────
  function handlePxChange(field, val) {
    const next = { ...pxInputs, [field]: val };
    setPxInputs(next);
    const { w: nw, h: nh } = naturalDims;
    if (!nw || !nh) return;
    const x = Math.max(0, Number(next.x) || 0);
    const y = Math.max(0, Number(next.y) || 0);
    let   w = Math.max(1, Number(next.w) || 0);
    let   h = Math.max(1, Number(next.h) || 0);
    w = Math.min(w, nw - x);
    h = Math.min(h, nh - y);
    if (w <= 0 || h <= 0) return;
    const pct = {
      unit:   '%',
      x:      (x / nw) * 100,
      y:      (y / nh) * 100,
      width:  (w / nw) * 100,
      height: (h / nh) * 100,
    };
    setCrop(pct);
    setCompletedPct(pct);
    updatePreview(pct, naturalDims);
  }

  // ── Aspect ratio change ───────────────────────────────────
  function changeAspect(val) {
    setAspect(val);
    const { w, h } = naturalDims;
    if (!w || !h) return;
    const base = makeAspectCrop({ unit: '%', width: 80 }, val || w / h, w, h);
    const centered = centerCrop(base, w, h);
    setCrop(centered);
  }

  // ── Rotate ────────────────────────────────────────────────
  async function handleRotate(dir) {
    if (!imageSrc) return;
    const angle = dir === 'left' ? -90 : 90;
    const newTotal = (rotation + angle + 360) % 360;
    setRotation(newTotal);
    const rotated = await rotateImageSrc(imageSrc, angle);
    setImageSrc(rotated);
    setCrop(undefined);
    setCompletedPct(null);
    setPxInputs({ x: '', y: '', w: '', h: '' });
    setDone(false);
    const canvas = canvasRef.current;
    if (canvas) { const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }

  // ── Zoom ──────────────────────────────────────────────────
  function changeZoom(dir) {
    const idx = ZOOM_STEPS.indexOf(zoom);
    if (dir === 'in'  && idx < ZOOM_STEPS.length - 1) setZoom(ZOOM_STEPS[idx + 1]);
    if (dir === 'out' && idx > 0)                       setZoom(ZOOM_STEPS[idx - 1]);
  }

  // ── Reset ─────────────────────────────────────────────────
  function handleReset() {
    if (!originalSrc) return;
    setImageSrc(originalSrc);
    setRotation(0);
    setZoom(1);
    setAspect(undefined);
    setCrop(undefined);
    setCompletedPct(null);
    setPxInputs({ x: '', y: '', w: '', h: '' });
    setDone(false);
    setError('');
    const canvas = canvasRef.current;
    if (canvas) { const ctx = canvas.getContext('2d'); ctx.clearRect(0, 0, canvas.width, canvas.height); }
  }

  function handleClear() {
    handleReset();
    setImageSrc(null);
    setOriginalSrc(null);
    setNaturalDims({ w: 0, h: 0 });
    setFileName('image');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // ── Crop & download ───────────────────────────────────────
  async function handleCrop() {
    if (!completedPct?.width || !completedPct?.height || !imageSrc) return;
    setLoading(true);
    setError('');
    try {
      const blob = await cropToBlob(imageSrc, completedPct, naturalDims.w, naturalDims.h);
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${fileName}-cropped.png`;
      a.click();
      URL.revokeObjectURL(url);
      setDone(true);
    } catch {
      setError('Crop failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const canCrop  = !!imageSrc && !!completedPct?.width && !!completedPct?.height && !loading;
  const hasImage = !!imageSrc;

  // Pixel dimensions of current crop selection
  const selW = Math.round((completedPct?.width  || 0) / 100 * naturalDims.w);
  const selH = Math.round((completedPct?.height || 0) / 100 * naturalDims.h);

  return (
    <div className="panel-card shadow-lg">
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">

        {/* ── LEFT: Upload / Crop canvas ──────────────────── */}
        <div className="flex flex-col">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <Crop className="w-4 h-4 text-text-muted" />
              <span className="text-sm font-semibold text-text-primary">
                {hasImage ? 'Drag to select crop area' : 'Upload Image'}
              </span>
            </div>
            {hasImage && (
              <div className="flex items-center gap-1">
                <button onClick={handleReset} className="btn-ghost text-xs">
                  <RefreshCw className="w-3 h-3" /> Reset
                </button>
                <button onClick={handleClear} className="btn-ghost text-xs">
                  <X className="w-3 h-3" /> Clear
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 p-4 flex flex-col gap-3">
            {!hasImage ? (
              /* ── Dropzone ── */
              <label
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed cursor-pointer transition-all py-12 px-6 ${
                  dragging ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/50 hover:bg-surface-2/60'
                }`}
              >
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-surface-2 border border-border">
                  <Upload className={`w-6 h-6 ${dragging ? 'text-accent' : 'text-text-muted'}`} />
                </div>
                <div className="text-center">
                  <p className="font-semibold text-text-primary text-sm">Drop image or click to browse</p>
                  <p className="text-xs text-text-muted mt-1">JPG, PNG, WebP, GIF · Max 10 MB</p>
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" className="sr-only" onChange={e => loadFile(e.target.files[0])} />
              </label>
            ) : (
              /* ── Interactive crop ── */
              <div
                className="rounded-xl border border-border bg-surface-2/30 overflow-auto"
                style={{ maxHeight: '380px' }}
              >
                <ReactCrop
                  crop={crop}
                  onChange={setCrop}
                  onComplete={onCropComplete}
                  aspect={aspect}
                  style={{ display: 'block' }}
                >
                  <img
                    ref={imgRef}
                    src={imageSrc}
                    alt="crop preview"
                    onLoad={onImageLoad}
                    style={{ display: 'block', width: `${zoom * 100}%`, maxWidth: 'none' }}
                    draggable={false}
                  />
                </ReactCrop>
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-3">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                {error}
              </div>
            )}

            {/* ── Zoom + Rotate controls ── */}
            {hasImage && (
              <div className="flex items-center justify-between gap-3 flex-wrap">
                {/* Zoom */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-text-muted font-medium mr-1">Zoom</span>
                  <IconBtn onClick={() => changeZoom('out')} disabled={zoom === ZOOM_STEPS[0]}            title="Zoom out"><ZoomOut className="w-3.5 h-3.5" /></IconBtn>
                  <span className="text-xs font-semibold text-text-primary w-10 text-center">{Math.round(zoom * 100)}%</span>
                  <IconBtn onClick={() => changeZoom('in')}  disabled={zoom === ZOOM_STEPS[ZOOM_STEPS.length-1]} title="Zoom in" ><ZoomIn  className="w-3.5 h-3.5" /></IconBtn>
                </div>
                {/* Rotate */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-text-muted font-medium mr-1">Rotate</span>
                  <IconBtn onClick={() => handleRotate('left')}  title="Rotate left"><RotateCcw className="w-3.5 h-3.5" /></IconBtn>
                  <span className="text-xs font-semibold text-text-primary w-8 text-center">{rotation}°</span>
                  <IconBtn onClick={() => handleRotate('right')} title="Rotate right"><RotateCw className="w-3.5 h-3.5" /></IconBtn>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT: Settings + Preview ────────────────────── */}
        <div className="flex flex-col">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <ImageDown className="w-4 h-4 text-text-muted" />
              <span className="text-sm font-semibold text-text-primary">Crop Settings</span>
            </div>
            {naturalDims.w > 0 && (
              <span className="text-xs text-text-muted bg-surface-2 border border-border px-2 py-0.5 rounded-full">
                {naturalDims.w} × {naturalDims.h} px
              </span>
            )}
          </div>

          <div className="flex-1 p-4 flex flex-col gap-4">

            {/* Aspect ratio */}
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Aspect Ratio</p>
              <div className="flex gap-1.5 flex-wrap">
                {ASPECTS.map(a => (
                  <Pill key={a.label} active={aspect === a.value} onClick={() => changeAspect(a.value)}>
                    {a.label}
                  </Pill>
                ))}
              </div>
            </div>

            {/* Pixel inputs */}
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Crop Area (pixels)</p>
              <div className="grid grid-cols-2 gap-2">
                {[['x', 'Left (X)'], ['y', 'Top (Y)'], ['w', 'Width'], ['h', 'Height']].map(([key, label]) => (
                  <div key={key}>
                    <p className="text-[11px] text-text-muted mb-1">{label}</p>
                    <input
                      type="number" min="0"
                      value={pxInputs[key]}
                      onChange={e => handlePxChange(key, e.target.value)}
                      placeholder="—"
                      className="input-field text-sm py-1.5"
                      disabled={!hasImage}
                    />
                  </div>
                ))}
              </div>
              {selW > 0 && selH > 0 && (
                <p className="text-[11px] text-text-muted mt-1.5">
                  Selection: <span className="font-semibold text-text-secondary">{selW} × {selH} px</span>
                </p>
              )}
            </div>

            {/* Live preview */}
            <div>
              <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">Live Preview</p>
              <div className="rounded-xl border border-border bg-surface-2/30 overflow-hidden flex items-center justify-center" style={{ minHeight: 100 }}>
                {completedPct?.width ? (
                  <canvas
                    ref={canvasRef}
                    style={{ display: 'block', maxWidth: '100%', maxHeight: 160 }}
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 py-6">
                    <canvas ref={canvasRef} style={{ display: 'none' }} />
                    <ImageDown className="w-6 h-6 text-text-light" />
                    <p className="text-xs text-text-muted">Select a crop area to preview</p>
                  </div>
                )}
              </div>
            </div>

          </div>

          {/* ── Crop button ── */}
          <div className="px-4 pb-4 pt-3 border-t border-border flex flex-col gap-2">
            {done && (
              <div className="flex items-center gap-2 text-xs text-green-600 font-semibold">
                <Check className="w-4 h-4" /> Cropped image downloaded!
              </div>
            )}
            <button
              onClick={handleCrop}
              disabled={!canCrop}
              className="btn-primary w-full h-11 text-sm"
            >
              {loading
                ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin inline-block" /> Cropping…</>
                : <><Crop className="w-4 h-4" /> Crop &amp; Download</>
              }
            </button>
            {!hasImage && (
              <p className="text-[11px] text-text-muted text-center">Upload an image to get started</p>
            )}
            {hasImage && !completedPct?.width && (
              <p className="text-[11px] text-text-muted text-center">Draw a crop selection on the image</p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
