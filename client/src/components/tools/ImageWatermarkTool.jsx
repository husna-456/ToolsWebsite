import { useState, useRef, useEffect, useCallback } from 'react';
import { Upload, X, Download, RefreshCw, AlertCircle, Undo2, Redo2 } from 'lucide-react';

// ── Constants ───────────────────────────────────────────────────────────────
const FONTS = ['Arial', 'Helvetica', 'Times New Roman', 'Georgia', 'Verdana', 'Poppins', 'Roboto'];
const WEB_FONTS = ['Poppins', 'Roboto'];
const POSITION_PRESETS = [
  { id: 'bottomRight', label: 'Bottom Right' },
  { id: 'bottomLeft',  label: 'Bottom Left' },
  { id: 'center',      label: 'Center' },
  { id: 'topRight',    label: 'Top Right' },
  { id: 'topLeft',     label: 'Top Left' },
  { id: 'custom',      label: 'Custom X/Y' },
];

const DEFAULT = {
  text: '© My Brand',
  fontSize: 48,
  fontFamily: 'Arial',
  fontWeight: 'bold',
  fontStyle: 'normal',
  textColor: '#ffffff',
  textOpacity: 80,
  textRotation: 0,
  positionPreset: 'bottomRight',
  textX: 85,
  textY: 90,
  textMargin: 24,
  shadow: true,
  outline: false,
  outlineColor: '#000000',
  bgBox: false,
  bgBoxColor: '#000000',
  bgBoxAlpha: 45,
  bgBoxRounded: true,
  gradientText: false,
  gradientColor1: '#ff6b6b',
  gradientColor2: '#4ecdc4',
  logoSize: 15,
  logoOpacity: 80,
  logoRotation: 0,
  logoPosPreset: 'bottomRight',
  logoX: 85,
  logoY: 85,
  mode: 'single',
  contentType: 'text',
  repeatPattern: 'diagonal',
  gap: 150,
  repeatRotation: -30,
  outputFormat: 'image/png',
  quality: 0.92,
};

const STORAGE_KEY = 'wm_pro_v2';
const MAX_FILE_MB = 20;
const ACCEPT = 'image/jpeg,image/png,image/webp';

// ── Small UI helpers ────────────────────────────────────────────────────────
function Label({ children }) {
  return <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1">{children}</p>;
}

function Pill({ active, onClick, children }) {
  return (
    <button
      type="button" onClick={onClick}
      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
        active ? 'bg-accent border-accent text-white' : 'bg-white border-border text-text-secondary hover:border-accent/50'
      }`}
    >
      {children}
    </button>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${checked ? 'bg-accent' : 'bg-gray-200'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </button>
      <span className="text-sm text-text-secondary">{label}</span>
    </label>
  );
}

function Range({ label, value, min, max, step = 1, onChange, unit = '' }) {
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <Label>{label}</Label>
        <span className="text-xs font-medium text-accent">{value}{unit}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-accent cursor-pointer"
        style={{ width: '100%' }}
      />
    </div>
  );
}

function SectionHeader({ title }) {
  return (
    <div className="flex items-center gap-2 mt-4 mb-3">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[11px] font-bold text-text-muted uppercase tracking-widest">{title}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

// ── Canvas drawing ──────────────────────────────────────────────────────────
function roundedRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha / 100})`;
}

function getAnchor(preset) {
  switch (preset) {
    case 'bottomRight': return { hAlign: 'right',  vAlign: 'bottom' };
    case 'bottomLeft':  return { hAlign: 'left',   vAlign: 'bottom' };
    case 'topRight':    return { hAlign: 'right',  vAlign: 'top' };
    case 'topLeft':     return { hAlign: 'left',   vAlign: 'top' };
    case 'center':      return { hAlign: 'center', vAlign: 'middle' };
    default:            return { hAlign: 'center', vAlign: 'middle' };
  }
}

function getAnchorPos(preset, customX, customY, margin, W, H) {
  switch (preset) {
    case 'bottomRight': return { x: W - margin, y: H - margin };
    case 'bottomLeft':  return { x: margin,     y: H - margin };
    case 'topRight':    return { x: W - margin, y: margin };
    case 'topLeft':     return { x: margin,     y: margin };
    case 'center':      return { x: W / 2,      y: H / 2 };
    default:            return { x: (customX / 100) * W, y: (customY / 100) * H };
  }
}

function drawTextLayer(ctx, W, H, s, scale) {
  if (!s.text) return;
  const fontSize = s.fontSize * scale;
  const margin   = s.textMargin * scale;

  ctx.save();
  const { x, y } = getAnchorPos(s.positionPreset, s.textX, s.textY, margin, W, H);
  const { hAlign, vAlign } = getAnchor(s.positionPreset);

  ctx.translate(x, y);
  ctx.rotate((s.textRotation * Math.PI) / 180);
  ctx.font         = `${s.fontStyle} ${s.fontWeight} ${fontSize}px "${s.fontFamily}"`;
  ctx.textAlign    = hAlign;
  ctx.textBaseline = vAlign;
  ctx.globalAlpha  = s.textOpacity / 100;

  // Measure text for box
  const m    = ctx.measureText(s.text);
  const tw   = m.width;
  const asc  = m.actualBoundingBoxAscent  ?? fontSize * 0.75;
  const desc = m.actualBoundingBoxDescent ?? fontSize * 0.2;
  const th   = asc + desc;

  // Box x offset
  const pad = fontSize * 0.3;
  let bx = hAlign === 'right' ? -tw - pad : hAlign === 'center' ? -tw / 2 - pad : -pad;
  let by = vAlign === 'bottom' ? -asc - pad : vAlign === 'middle' ? -asc - pad + (asc - th / 2) : -pad;
  if (vAlign === 'bottom') by = -th - pad;
  else if (vAlign === 'middle') by = -th / 2 - pad;
  else by = -pad;

  // Background box (no shadow on box)
  if (s.bgBox) {
    const bw = tw + pad * 2;
    const bh = th + pad * 2;
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    ctx.fillStyle = hexToRgba(s.bgBoxColor, s.bgBoxAlpha);
    if (s.bgBoxRounded) { roundedRect(ctx, bx, by, bw, bh, Math.min(10 * scale, bw / 3, bh / 3)); ctx.fill(); }
    else ctx.fillRect(bx, by, bw, bh);
  }

  // Shadow for text
  if (s.shadow) {
    ctx.shadowColor    = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur     = Math.max(4, fontSize * 0.14);
    ctx.shadowOffsetX  = Math.max(1, fontSize * 0.05);
    ctx.shadowOffsetY  = Math.max(1, fontSize * 0.05);
  } else {
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
  }

  // Fill style
  if (s.gradientText) {
    const gx0 = hAlign === 'right' ? -tw : hAlign === 'center' ? -tw / 2 : 0;
    const grad = ctx.createLinearGradient(gx0, 0, gx0 + tw, 0);
    grad.addColorStop(0, s.gradientColor1);
    grad.addColorStop(1, s.gradientColor2);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = s.textColor;
  }

  // Outline
  if (s.outline) {
    ctx.strokeStyle = s.outlineColor;
    ctx.lineWidth   = Math.max(1.5, fontSize * 0.07);
    ctx.strokeText(s.text, 0, 0);
  }

  ctx.fillText(s.text, 0, 0);
  ctx.restore();
}

function drawLogoLayer(ctx, W, H, s, logoEl, scale) {
  if (!logoEl) return;
  const logoW  = (s.logoSize / 100) * Math.min(W, H);
  const logoH  = logoW * (logoEl.naturalHeight / logoEl.naturalWidth);
  const margin = s.textMargin * scale;

  let cx, cy;
  switch (s.logoPosPreset) {
    case 'bottomRight': cx = W - margin - logoW / 2; cy = H - margin - logoH / 2; break;
    case 'bottomLeft':  cx = margin + logoW / 2;     cy = H - margin - logoH / 2; break;
    case 'topRight':    cx = W - margin - logoW / 2; cy = margin + logoH / 2;     break;
    case 'topLeft':     cx = margin + logoW / 2;     cy = margin + logoH / 2;     break;
    case 'center':      cx = W / 2;                  cy = H / 2;                  break;
    default:            cx = (s.logoX / 100) * W;   cy = (s.logoY / 100) * H;   break;
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((s.logoRotation * Math.PI) / 180);
  ctx.globalAlpha = s.logoOpacity / 100;
  ctx.drawImage(logoEl, -logoW / 2, -logoH / 2, logoW, logoH);
  ctx.restore();
}

function drawRepeatUnit(ctx, s, logoEl, fontSize, logoW, logoH, doText, doLogo) {
  if (doText && s.text) {
    ctx.font = `${s.fontStyle} ${s.fontWeight} ${fontSize}px "${s.fontFamily}"`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.globalAlpha = s.textOpacity / 100;
    if (s.shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur  = Math.max(3, fontSize * 0.12);
    } else {
      ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    }
    if (s.gradientText) {
      const m = ctx.measureText(s.text);
      const grad = ctx.createLinearGradient(-m.width / 2, 0, m.width / 2, 0);
      grad.addColorStop(0, s.gradientColor1);
      grad.addColorStop(1, s.gradientColor2);
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = s.textColor;
    }
    ctx.fillText(s.text, 0, 0);
  }
  if (doLogo && logoEl) {
    ctx.globalAlpha = s.logoOpacity / 100;
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    ctx.drawImage(logoEl, -logoW / 2, -logoH / 2, logoW, logoH);
  }
}

function drawRepeatLayer(ctx, W, H, s, logoEl, scale) {
  const fontSize = s.fontSize * scale;
  const gap      = s.gap * scale;
  const logoW    = (s.logoSize / 100) * Math.min(W, H);
  const logoH    = logoEl ? logoW * (logoEl.naturalHeight / logoEl.naturalWidth) : logoW;
  const doText   = s.contentType !== 'logo';
  const doLogo   = s.contentType !== 'text' && !!logoEl;

  ctx.font = `${s.fontStyle} ${s.fontWeight} ${fontSize}px "${s.fontFamily}"`;
  const textW  = s.text ? ctx.measureText(s.text).width : 0;
  const elemW  = Math.max(doText ? textW : 0, doLogo ? logoW : 0);
  const elemH  = Math.max(doText ? fontSize : 0, doLogo ? logoH : 0);
  const stepX  = Math.max(elemW + gap, 10);
  const stepY  = Math.max(elemH + gap, 10);

  ctx.save();

  if (s.repeatPattern === 'diagonal') {
    ctx.translate(W / 2, H / 2);
    ctx.rotate((s.repeatRotation * Math.PI) / 180);
    const maxD = Math.ceil(Math.sqrt(W * W + H * H) / 2) + Math.max(stepX, stepY);
    for (let row = -Math.ceil(maxD / stepY); row <= Math.ceil(maxD / stepY); row++) {
      for (let col = -Math.ceil(maxD / stepX); col <= Math.ceil(maxD / stepX); col++) {
        ctx.save();
        ctx.translate(col * stepX, row * stepY);
        drawRepeatUnit(ctx, s, logoEl, fontSize, logoW, logoH, doText, doLogo);
        ctx.restore();
      }
    }
  } else if (s.repeatPattern === 'horizontal') {
    const rows = Math.max(1, Math.floor(H / stepY));
    for (let r = 0; r < rows; r++) {
      const y = ((r + 0.5) / rows) * H;
      for (let x = stepX / 2; x < W + stepX; x += stepX) {
        ctx.save(); ctx.translate(x, y);
        drawRepeatUnit(ctx, s, logoEl, fontSize, logoW, logoH, doText, doLogo);
        ctx.restore();
      }
    }
  } else {
    const cols = Math.max(1, Math.floor(W / stepX));
    for (let c = 0; c < cols; c++) {
      const x = ((c + 0.5) / cols) * W;
      for (let y = stepY / 2; y < H + stepY; y += stepY) {
        ctx.save(); ctx.translate(x, y);
        drawRepeatUnit(ctx, s, logoEl, fontSize, logoW, logoH, doText, doLogo);
        ctx.restore();
      }
    }
  }

  ctx.restore();
}

function renderWatermarks(canvas, imageEl, logoEl, s, scale) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(imageEl, 0, 0, canvas.width, canvas.height);

  const doText = s.contentType !== 'logo';
  const doLogo = s.contentType !== 'text' && !!logoEl;

  if (s.mode === 'single') {
    if (doText) drawTextLayer(ctx, canvas.width, canvas.height, s, scale);
    if (doLogo) drawLogoLayer(ctx, canvas.width, canvas.height, s, logoEl, scale);
  } else {
    drawRepeatLayer(ctx, canvas.width, canvas.height, s, logoEl, scale);
  }
}

// ── Main Component ──────────────────────────────────────────────────────────
export default function ImageWatermarkTool() {
  const [settings,  setSettings]  = useState(() => {
    try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') }; }
    catch { return { ...DEFAULT }; }
  });
  const [imageSrc,  setImageSrc]  = useState(null);
  const [logoSrc,   setLogoSrc]   = useState(null);
  const [imageEl,   setImageEl]   = useState(null);
  const [logoEl,    setLogoEl]    = useState(null);
  const [fileError, setFileError] = useState('');
  const [logoError, setLogoError] = useState('');
  const [isDrawing, setIsDrawing] = useState(false);

  // Undo/redo via refs to avoid re-render overhead
  const historyRef  = useRef([{ ...DEFAULT }]);
  const histIdxRef  = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const previewCanvasRef   = useRef(null);
  const previewContainerRef = useRef(null);
  const imageInputRef       = useRef(null);
  const logoInputRef        = useRef(null);
  const drawTimerRef        = useRef(null);
  const settingsSaveTimer   = useRef(null);

  // ── Load Google Fonts ─────────────────────────────────────────
  useEffect(() => {
    if (document.getElementById('gfonts-wm')) return;
    const link = document.createElement('link');
    link.id   = 'gfonts-wm';
    link.rel  = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Poppins:ital,wght@0,400;0,700;1,400;1,700&family=Roboto:ital,wght@0,400;0,700;1,400;1,700&display=swap';
    document.head.appendChild(link);
  }, []);

  // ── Load image element ────────────────────────────────────────
  useEffect(() => {
    if (!imageSrc) { setImageEl(null); return; }
    const img = new Image();
    img.onload  = () => setImageEl(img);
    img.onerror = () => setFileError('Failed to load image.');
    img.src = imageSrc;
  }, [imageSrc]);

  // ── Load logo element ─────────────────────────────────────────
  useEffect(() => {
    if (!logoSrc) { setLogoEl(null); return; }
    const img = new Image();
    img.onload  = () => setLogoEl(img);
    img.onerror = () => setLogoError('Failed to load logo.');
    img.src = logoSrc;
  }, [logoSrc]);

  // ── Draw preview (debounced) ──────────────────────────────────
  const drawPreview = useCallback(async (s) => {
    const canvas    = previewCanvasRef.current;
    const container = previewContainerRef.current;
    if (!canvas || !container || !imageEl) return;

    const w   = container.clientWidth || 500;
    const h   = Math.round(w * (imageEl.naturalHeight / imageEl.naturalWidth));
    canvas.width  = w;
    canvas.height = h;

    const scale = w / imageEl.naturalWidth;

    // Pre-load web font if needed
    if (WEB_FONTS.includes(s.fontFamily)) {
      try { await document.fonts.load(`${s.fontWeight} ${s.fontSize * scale}px ${s.fontFamily}`); } catch { /* ok */ }
    }

    setIsDrawing(true);
    renderWatermarks(canvas, imageEl, logoEl, s, scale);
    setIsDrawing(false);
  }, [imageEl, logoEl]);

  useEffect(() => {
    clearTimeout(drawTimerRef.current);
    drawTimerRef.current = setTimeout(() => drawPreview(settings), 60);
  }, [settings, imageEl, logoEl, drawPreview]);

  // ── Save settings (debounced) ─────────────────────────────────
  useEffect(() => {
    clearTimeout(settingsSaveTimer.current);
    settingsSaveTimer.current = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(settings)); } catch { /* ignore */ }
    }, 500);
  }, [settings]);

  // ── History helpers ───────────────────────────────────────────
  function pushHistory(newSettings) {
    const h = historyRef.current.slice(0, histIdxRef.current + 1);
    h.push({ ...newSettings });
    if (h.length > 30) h.shift();
    historyRef.current = h;
    histIdxRef.current = h.length - 1;
    setCanUndo(histIdxRef.current > 0);
    setCanRedo(false);
  }

  function undo() {
    if (histIdxRef.current <= 0) return;
    histIdxRef.current--;
    const s = historyRef.current[histIdxRef.current];
    setSettings(s);
    setCanUndo(histIdxRef.current > 0);
    setCanRedo(true);
  }

  function redo() {
    if (histIdxRef.current >= historyRef.current.length - 1) return;
    histIdxRef.current++;
    const s = historyRef.current[histIdxRef.current];
    setSettings(s);
    setCanUndo(true);
    setCanRedo(histIdxRef.current < historyRef.current.length - 1);
  }

  // ── Setting updaters ──────────────────────────────────────────
  const update = useCallback((key, value) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      return next;
    });
  }, []);

  // Push history on discrete changes (not while dragging sliders)
  const commit = useCallback((key, value) => {
    setSettings(prev => {
      const next = { ...prev, [key]: value };
      pushHistory(next);
      return next;
    });
  }, []);

  // ── File handlers ─────────────────────────────────────────────
  function handleImageFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setFileError('Please upload a JPG, PNG, or WEBP image.'); return; }
    if (file.size > MAX_FILE_MB * 1024 * 1024) { setFileError(`Image must be under ${MAX_FILE_MB} MB.`); return; }
    setFileError('');
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    setImageSrc(URL.createObjectURL(file));
  }

  function handleLogoFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) { setLogoError('Please upload a PNG or JPG logo.'); return; }
    if (file.size > 5 * 1024 * 1024) { setLogoError('Logo must be under 5 MB.'); return; }
    setLogoError('');
    if (logoSrc) URL.revokeObjectURL(logoSrc);
    setLogoSrc(URL.createObjectURL(file));
  }

  // ── Download ──────────────────────────────────────────────────
  async function handleDownload() {
    if (!imageEl) return;
    const canvas = document.createElement('canvas');
    canvas.width  = imageEl.naturalWidth;
    canvas.height = imageEl.naturalHeight;

    if (WEB_FONTS.includes(settings.fontFamily)) {
      try { await document.fonts.load(`${settings.fontWeight} ${settings.fontSize}px ${settings.fontFamily}`); } catch { /* ok */ }
    }

    renderWatermarks(canvas, imageEl, logoEl, settings, 1);

    const ext = settings.outputFormat === 'image/png' ? 'png'
              : settings.outputFormat === 'image/webp' ? 'webp' : 'jpg';
    canvas.toBlob(blob => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `watermarked.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }, settings.outputFormat, settings.quality);
  }

  // ── Reset ─────────────────────────────────────────────────────
  function handleResetSettings() {
    setSettings({ ...DEFAULT });
    pushHistory({ ...DEFAULT });
  }

  function handleClearAll() {
    if (imageSrc) URL.revokeObjectURL(imageSrc);
    if (logoSrc) URL.revokeObjectURL(logoSrc);
    setImageSrc(null); setLogoSrc(null);
    setImageEl(null); setLogoEl(null);
    setFileError(''); setLogoError('');
    setSettings({ ...DEFAULT });
    historyRef.current = [{ ...DEFAULT }];
    histIdxRef.current = 0;
    setCanUndo(false); setCanRedo(false);
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (logoInputRef.current) logoInputRef.current.value = '';
    const canvas = previewCanvasRef.current;
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  }

  const s = settings;

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="panel-card shadow-lg">
      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] divide-y lg:divide-y-0 lg:divide-x divide-border min-h-[600px]">

        {/* ── LEFT PANEL: Controls ─────────────────────────── */}
        <div className="flex flex-col overflow-y-auto" style={{ maxHeight: '85vh' }}>
          <div className="panel-header">
            <span className="text-sm font-semibold text-text-primary">Watermark Settings</span>
            <div className="flex items-center gap-1.5">
              <button onClick={undo} disabled={!canUndo} title="Undo" className="btn-ghost p-1.5 disabled:opacity-30"><Undo2 className="w-3.5 h-3.5" /></button>
              <button onClick={redo} disabled={!canRedo} title="Redo" className="btn-ghost p-1.5 disabled:opacity-30"><Redo2 className="w-3.5 h-3.5" /></button>
              <button onClick={handleResetSettings} title="Reset settings" className="btn-ghost text-[11px] gap-1">
                <RefreshCw className="w-3 h-3" />Reset
              </button>
            </div>
          </div>

          <div className="flex-1 p-4 space-y-3">

            {/* ── Image Upload ─────────────────────── */}
            <div>
              <Label>Image</Label>
              {!imageSrc ? (
                <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border hover:border-accent/60 cursor-pointer py-6 transition-all">
                  <Upload className="w-6 h-6 text-text-muted" />
                  <span className="text-sm text-text-secondary">Drop image or click to browse</span>
                  <span className="text-xs text-text-muted">JPG, PNG, WEBP · max {MAX_FILE_MB} MB</span>
                  <input ref={imageInputRef} type="file" accept={ACCEPT} className="sr-only"
                    onChange={e => handleImageFile(e.target.files?.[0])} />
                </label>
              ) : (
                <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-surface-2/50">
                  <img src={imageSrc} alt="" className="w-10 h-10 object-cover rounded" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-text-primary truncate">
                      {imageEl ? `${imageEl.naturalWidth} × ${imageEl.naturalHeight} px` : 'Loading…'}
                    </p>
                  </div>
                  <button onClick={handleClearAll} className="text-text-muted hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              {fileError && <p className="flex items-center gap-1.5 text-xs text-red-600 mt-1.5"><AlertCircle className="w-3.5 h-3.5" />{fileError}</p>}
            </div>

            {/* ── Mode & Content Type ──────────────── */}
            <div className="space-y-2">
              <div>
                <Label>Mode</Label>
                <div className="flex gap-2">
                  {[['single','Single'],['repeat','Repeat Pattern']].map(([v,l]) => (
                    <Pill key={v} active={s.mode===v} onClick={() => commit('mode', v)}>{l}</Pill>
                  ))}
                </div>
              </div>
              <div>
                <Label>Content</Label>
                <div className="flex gap-2">
                  {[['text','Text'],['logo','Logo'],['both','Text + Logo']].map(([v,l]) => (
                    <Pill key={v} active={s.contentType===v} onClick={() => commit('contentType', v)}>{l}</Pill>
                  ))}
                </div>
              </div>
            </div>

            {/* ── TEXT CONTROLS ────────────────────── */}
            {s.contentType !== 'logo' && (
              <>
                <SectionHeader title="Text Watermark" />

                <div>
                  <Label>Text</Label>
                  <input
                    type="text" value={s.text}
                    onChange={e => update('text', e.target.value)}
                    onBlur={() => commit('text', s.text)}
                    placeholder="e.g. © My Brand"
                    className="input-field"
                    maxLength={120}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label>Font Family</Label>
                    <select value={s.fontFamily} onChange={e => commit('fontFamily', e.target.value)} className="input-field text-sm">
                      {FONTS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div>
                    <Label>Weight</Label>
                    <div className="flex gap-1.5 pt-0.5">
                      {[['normal','Normal'],['bold','Bold']].map(([v,l]) => (
                        <Pill key={v} active={s.fontWeight===v} onClick={() => commit('fontWeight', v)}>{l}</Pill>
                      ))}
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Style</Label>
                  <div className="flex gap-2">
                    {[['normal','Normal'],['italic','Italic']].map(([v,l]) => (
                      <Pill key={v} active={s.fontStyle===v} onClick={() => commit('fontStyle', v)}>{l}</Pill>
                    ))}
                  </div>
                </div>

                <Range label="Font Size" value={s.fontSize} min={10} max={150} onChange={v => update('fontSize', v)} unit="px" />

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Text Color</Label>
                    <input type="color" value={s.textColor} onChange={e => update('textColor', e.target.value)} onBlur={() => commit('textColor', s.textColor)}
                      className="w-full h-9 rounded-lg border border-border cursor-pointer" />
                  </div>
                  <Range label="Opacity" value={s.textOpacity} min={0} max={100} onChange={v => update('textOpacity', v)} unit="%" />
                </div>

                <div>
                  <Label>Rotation</Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {[0, 15, 30, 45, 60, 90].map(r => (
                      <Pill key={r} active={s.textRotation===r} onClick={() => commit('textRotation', r)}>{r}°</Pill>
                    ))}
                  </div>
                </div>

                {/* Position */}
                {s.mode === 'single' && (
                  <div className="space-y-2">
                    <div>
                      <Label>Position Preset</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {POSITION_PRESETS.map(({ id, label }) => (
                          <Pill key={id} active={s.positionPreset===id} onClick={() => commit('positionPreset', id)}>{label}</Pill>
                        ))}
                      </div>
                    </div>
                    {s.positionPreset === 'custom' ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>X (%)</Label>
                          <input type="number" min={0} max={100} value={s.textX} onChange={e => update('textX', Number(e.target.value))} onBlur={() => commit('textX', s.textX)} className="input-field" />
                        </div>
                        <div>
                          <Label>Y (%)</Label>
                          <input type="number" min={0} max={100} value={s.textY} onChange={e => update('textY', Number(e.target.value))} onBlur={() => commit('textY', s.textY)} className="input-field" />
                        </div>
                      </div>
                    ) : (
                      <Range label="Edge Margin" value={s.textMargin} min={4} max={120} onChange={v => update('textMargin', v)} unit="px" />
                    )}
                  </div>
                )}

                {/* Effects */}
                <SectionHeader title="Text Effects" />
                <div className="space-y-2.5">
                  <Toggle label="Drop Shadow" checked={s.shadow} onChange={v => commit('shadow', v)} />
                  <Toggle label="Outline" checked={s.outline} onChange={v => commit('outline', v)} />
                  {s.outline && (
                    <div className="ml-8">
                      <Label>Outline Color</Label>
                      <input type="color" value={s.outlineColor} onChange={e => commit('outlineColor', e.target.value)} className="w-20 h-8 rounded border border-border cursor-pointer" />
                    </div>
                  )}
                  <Toggle label="Background Box" checked={s.bgBox} onChange={v => commit('bgBox', v)} />
                  {s.bgBox && (
                    <div className="ml-8 space-y-2">
                      <div className="flex gap-3 items-center">
                        <div>
                          <Label>Box Color</Label>
                          <input type="color" value={s.bgBoxColor} onChange={e => commit('bgBoxColor', e.target.value)} className="w-14 h-8 rounded border border-border cursor-pointer" />
                        </div>
                        <div className="flex-1">
                          <Range label="Box Opacity" value={s.bgBoxAlpha} min={0} max={100} onChange={v => update('bgBoxAlpha', v)} unit="%" />
                        </div>
                      </div>
                      <Toggle label="Rounded Corners" checked={s.bgBoxRounded} onChange={v => commit('bgBoxRounded', v)} />
                    </div>
                  )}
                  <Toggle label="Gradient Text" checked={s.gradientText} onChange={v => commit('gradientText', v)} />
                  {s.gradientText && (
                    <div className="ml-8 flex gap-3">
                      <div>
                        <Label>Color 1</Label>
                        <input type="color" value={s.gradientColor1} onChange={e => commit('gradientColor1', e.target.value)} className="w-14 h-8 rounded border border-border cursor-pointer" />
                      </div>
                      <div>
                        <Label>Color 2</Label>
                        <input type="color" value={s.gradientColor2} onChange={e => commit('gradientColor2', e.target.value)} className="w-14 h-8 rounded border border-border cursor-pointer" />
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* ── LOGO CONTROLS ────────────────────── */}
            {s.contentType !== 'text' && (
              <>
                <SectionHeader title="Logo Watermark" />

                {!logoSrc ? (
                  <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border hover:border-accent/60 cursor-pointer py-4 transition-all">
                    <Upload className="w-5 h-5 text-text-muted" />
                    <span className="text-xs text-text-secondary">Upload PNG or JPG logo</span>
                    <span className="text-[11px] text-text-muted">Transparent PNG recommended</span>
                    <input ref={logoInputRef} type="file" accept="image/png,image/jpeg,image/webp" className="sr-only"
                      onChange={e => handleLogoFile(e.target.files?.[0])} />
                  </label>
                ) : (
                  <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-surface-2/50">
                    <img src={logoSrc} alt="Logo" className="w-10 h-10 object-contain rounded" />
                    <span className="flex-1 text-xs text-text-secondary">Logo loaded</span>
                    <button onClick={() => { URL.revokeObjectURL(logoSrc); setLogoSrc(null); setLogoEl(null); if (logoInputRef.current) logoInputRef.current.value = ''; }} className="text-text-muted hover:text-red-500">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {logoError && <p className="flex items-center gap-1.5 text-xs text-red-600"><AlertCircle className="w-3.5 h-3.5" />{logoError}</p>}

                <Range label="Logo Size" value={s.logoSize} min={3} max={60} onChange={v => update('logoSize', v)} unit="% of image" />
                <Range label="Opacity" value={s.logoOpacity} min={0} max={100} onChange={v => update('logoOpacity', v)} unit="%" />

                <div>
                  <Label>Rotation</Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {[0, 15, 30, 45, 60, 90].map(r => (
                      <Pill key={r} active={s.logoRotation===r} onClick={() => commit('logoRotation', r)}>{r}°</Pill>
                    ))}
                  </div>
                </div>

                {s.mode === 'single' && (
                  <div className="space-y-2">
                    <div>
                      <Label>Logo Position</Label>
                      <div className="flex flex-wrap gap-1.5">
                        {POSITION_PRESETS.map(({ id, label }) => (
                          <Pill key={id} active={s.logoPosPreset===id} onClick={() => commit('logoPosPreset', id)}>{label}</Pill>
                        ))}
                      </div>
                    </div>
                    {s.logoPosPreset === 'custom' ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label>X (%)</Label>
                          <input type="number" min={0} max={100} value={s.logoX} onChange={e => update('logoX', Number(e.target.value))} onBlur={() => commit('logoX', s.logoX)} className="input-field" />
                        </div>
                        <div>
                          <Label>Y (%)</Label>
                          <input type="number" min={0} max={100} value={s.logoY} onChange={e => update('logoY', Number(e.target.value))} onBlur={() => commit('logoY', s.logoY)} className="input-field" />
                        </div>
                      </div>
                    ) : (
                      <Range label="Edge Margin" value={s.textMargin} min={4} max={120} onChange={v => update('textMargin', v)} unit="px" />
                    )}
                  </div>
                )}
              </>
            )}

            {/* ── REPEAT OPTIONS ───────────────────── */}
            {s.mode === 'repeat' && (
              <>
                <SectionHeader title="Repeat Pattern" />
                <div>
                  <Label>Pattern Direction</Label>
                  <div className="flex gap-2">
                    {[['horizontal','Horizontal'],['vertical','Vertical'],['diagonal','Diagonal']].map(([v,l]) => (
                      <Pill key={v} active={s.repeatPattern===v} onClick={() => commit('repeatPattern', v)}>{l}</Pill>
                    ))}
                  </div>
                </div>
                <Range label="Gap Spacing" value={s.gap} min={20} max={400} onChange={v => update('gap', v)} unit="px" />
                {s.repeatPattern === 'diagonal' && (
                  <div>
                    <Label>Diagonal Angle</Label>
                    <div className="flex gap-1.5 flex-wrap">
                      {[-45, -30, -15, 0, 15, 30, 45].map(r => (
                        <Pill key={r} active={s.repeatRotation===r} onClick={() => commit('repeatRotation', r)}>{r}°</Pill>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── OUTPUT OPTIONS ───────────────────── */}
            <SectionHeader title="Output" />
            <div>
              <Label>Format</Label>
              <div className="flex gap-2">
                {[['image/png','PNG'],['image/jpeg','JPG'],['image/webp','WEBP']].map(([v,l]) => (
                  <Pill key={v} active={s.outputFormat===v} onClick={() => commit('outputFormat', v)}>{l}</Pill>
                ))}
              </div>
            </div>
            {s.outputFormat !== 'image/png' && (
              <div>
                <Label>Quality</Label>
                <div className="flex gap-2">
                  {[[0.6,'Low'],[0.8,'Medium'],[0.95,'High']].map(([v,l]) => (
                    <Pill key={v} active={s.quality===v} onClick={() => commit('quality', v)}>{l}</Pill>
                  ))}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ── RIGHT PANEL: Preview ─────────────────────────── */}
        <div className="flex flex-col">
          <div className="panel-header">
            <span className="text-sm font-semibold text-text-primary">Live Preview</span>
            {isDrawing && <span className="text-xs text-text-muted animate-pulse">Rendering…</span>}
          </div>

          <div className="flex-1 p-4 flex flex-col gap-4">
            <div ref={previewContainerRef} className="relative rounded-xl overflow-hidden bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2216%22%20height%3D%2216%22%3E%3Crect%20width%3D%228%22%20height%3D%228%22%20fill%3D%22%23ccc%22%2F%3E%3Crect%20x%3D%228%22%20y%3D%228%22%20width%3D%228%22%20height%3D%228%22%20fill%3D%22%23ccc%22%2F%3E%3C%2Fsvg%3E') border border-border min-h-[280px] flex items-center justify-center">
              {!imageEl ? (
                <div className="flex flex-col items-center gap-2 text-center py-12 px-4">
                  <div className="w-14 h-14 bg-surface-2 rounded-2xl flex items-center justify-center border border-border">
                    <Upload className="w-6 h-6 text-text-muted" />
                  </div>
                  <p className="text-sm font-semibold text-text-secondary">Upload an image to start</p>
                  <p className="text-xs text-text-muted">Preview will appear here in real time</p>
                </div>
              ) : (
                <canvas ref={previewCanvasRef} className="w-full h-auto block" style={{ imageRendering: 'auto' }} />
              )}
            </div>

            {imageEl && (
              <div className="flex gap-2">
                <button
                  onClick={handleDownload}
                  disabled={!imageSrc}
                  className="btn-primary flex-1 h-11 text-sm gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download {s.outputFormat === 'image/png' ? 'PNG' : s.outputFormat === 'image/jpeg' ? 'JPG' : 'WEBP'}
                </button>
                <button onClick={handleClearAll} className="btn-secondary h-11 gap-2 text-sm">
                  <RefreshCw className="w-4 h-4" />
                  New Image
                </button>
              </div>
            )}

            {!imageEl && (
              <label className="btn-primary h-11 text-sm gap-2 cursor-pointer justify-center flex items-center">
                <Upload className="w-4 h-4" />
                Upload Image
                <input type="file" accept={ACCEPT} className="sr-only" onChange={e => handleImageFile(e.target.files?.[0])} />
              </label>
            )}

            <div className="text-[11px] text-text-muted bg-surface-2/60 rounded-lg p-3 space-y-0.5">
              <p>• All processing runs in your browser — nothing is uploaded to a server.</p>
              <p>• PNG preserves transparency. JPG/WEBP are smaller file sizes.</p>
              <p>• On first load, Google Fonts (Poppins/Roboto) require an internet connection.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
