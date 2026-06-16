import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Download, Upload, Bold, Italic, RefreshCw,
  AlignLeft, AlignCenter, AlignRight, X, Clock,
} from 'lucide-react';

// ─── Canvas size presets ─────────────────────────────────────
const RATIOS = {
  '1:1':   { label: '1:1',  detail: '1080×1080', w: 1080, h: 1080 },
  '16:9':  { label: '16:9', detail: '1920×1080', w: 1920, h: 1080 },
  '9:16':  { label: '9:16', detail: '1080×1920', w: 1080, h: 1920 },
  '4:3':   { label: '4:3',  detail: '1440×1080', w: 1440, h: 1080 },
};

// ─── Style presets ───────────────────────────────────────────
const STYLES = [
  { key: 'clean',    label: 'Clean',    bg: '#ffffff', color: '#111827' },
  { key: 'dark',     label: 'Dark',     bg: '#111827', color: '#f9fafb' },
  { key: 'ocean',    label: 'Ocean',    bg: '#1e3a8a', color: '#ffffff' },
  { key: 'sunset',   label: 'Sunset',   bg: '#7c2d12', color: '#fed7aa' },
  { key: 'forest',   label: 'Forest',   bg: '#14532d', color: '#bbf7d0' },
  { key: 'purple',   label: 'Purple',   bg: '#4c1d95', color: '#ede9fe' },
  { key: 'rose',     label: 'Rose',     bg: '#881337', color: '#fce7f3' },
  { key: 'slate',    label: 'Slate',    bg: '#334155', color: '#e2e8f0' },
];

// ─── Font options ─────────────────────────────────────────────
const FONTS = [
  { label: 'Sans Serif',         value: 'Arial, sans-serif' },
  { label: 'Serif',              value: 'Georgia, serif' },
  { label: 'Monospace',          value: '"Courier New", monospace' },
  { label: 'Impact',             value: 'Impact, sans-serif' },
  { label: 'Trebuchet',          value: '"Trebuchet MS", sans-serif' },
  { label: 'Verdana',            value: 'Verdana, sans-serif' },
  { label: 'Noto Nastaliq Urdu', value: '"Noto Nastaliq Urdu", serif' },
];

const PREV_MAX = 460;

function calcPreview(ratio) {
  const { w, h } = RATIOS[ratio];
  const s = Math.min(PREV_MAX / w, PREV_MAX / h);
  return { pw: Math.round(w * s), ph: Math.round(h * s) };
}

function wrapLines(ctx, text, maxW) {
  const out = [];
  for (const para of text.split('\n')) {
    if (!para.trim()) { out.push(''); continue; }
    let line = '';
    for (const word of para.split(' ')) {
      const test = line ? `${line} ${word}` : word;
      if (line && ctx.measureText(test).width > maxW) { out.push(line); line = word; }
      else line = test;
    }
    if (line) out.push(line);
  }
  return out.length ? out : [''];
}

function paint(canvas, o) {
  const { w, h, bgColor, bgImg, text, font, sz, color, bold, italic, align, pos, shadow } = o;
  const ctx = canvas.getContext('2d');
  canvas.width = w; canvas.height = h;
  ctx.clearRect(0, 0, w, h);

  if (bgImg) {
    const ir = bgImg.width / bgImg.height, cr = w / h;
    let sx, sy, sw, sh;
    if (ir > cr) { sh = bgImg.height; sw = sh * cr; sx = (bgImg.width - sw) / 2; sy = 0; }
    else { sw = bgImg.width; sh = sw / cr; sx = 0; sy = (bgImg.height - sh) / 2; }
    ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, w, h);
  } else {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, w, h);
  }

  if (!text.trim()) return;

  const scaledSz = Math.round(sz * (w / 1080));
  const isRTL = font.includes('Noto Nastaliq Urdu');

  ctx.font         = `${italic ? 'italic ' : ''}${bold ? 'bold ' : ''}${scaledSz}px ${font}`;
  ctx.fillStyle    = color;
  ctx.direction    = isRTL ? 'rtl' : 'ltr';
  ctx.textAlign    = align === 'Left' ? 'left' : align === 'Right' ? 'right' : 'center';
  ctx.textBaseline = 'top';

  const pad = Math.round(w * 0.06), lh = scaledSz * 1.42;
  const lines = wrapLines(ctx, text, w - pad * 2);
  const blockH = lines.length * lh;

  const x =
    align === 'Left'  ? (isRTL ? w - pad : pad) :
    align === 'Right' ? (isRTL ? pad : w - pad) :
    w / 2;

  const startY =
    pos === 'Top'    ? pad :
    pos === 'Bottom' ? h - blockH - pad :
    (h - blockH) / 2;

  if (shadow) {
    ctx.shadowColor = 'rgba(0,0,0,0.85)'; ctx.shadowBlur = scaledSz * 0.35;
    ctx.shadowOffsetX = scaledSz * 0.04; ctx.shadowOffsetY = scaledSz * 0.04;
  } else {
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0;
  }

  lines.forEach((line, i) => ctx.fillText(line, x, startY + i * lh));
}

// ─── Tiny UI helpers ─────────────────────────────────────────
function Tog({ on, onClick, title, wide, children }) {
  return (
    <button
      onClick={onClick} title={title}
      className={`flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border text-xs font-medium transition-all duration-150 ${wide ? 'flex-1' : ''} ${
        on ? 'bg-accent border-accent text-white shadow-sm'
           : 'bg-white border-border text-text-secondary hover:border-accent/40 hover:text-text-primary'
      }`}
    >
      {children}
    </button>
  );
}

function SLabel({ children }) {
  return <p className="text-[10px] font-bold uppercase tracking-widest text-text-muted mb-2">{children}</p>;
}

// ─── Main component ───────────────────────────────────────────
export default function TextToImage() {
  const [ratio,   setRatio]   = useState('1:1');
  const [style,   setStyle]   = useState('clean');
  const [bgColor, setBgColor] = useState('#ffffff');
  const [bgImg,   setBgImg]   = useState(null);
  const [bgName,  setBgName]  = useState('');
  const [text,    setText]    = useState('');
  const [font,    setFont]    = useState('Arial, sans-serif');
  const [sz,      setSz]      = useState(80);
  const [color,   setColor]   = useState('#111827');
  const [bold,    setBold]    = useState(false);
  const [italic,  setItalic]  = useState(false);
  const [align,   setAlign]   = useState('Center');
  const [pos,     setPos]     = useState('Center');
  const [shadow,  setShadow]  = useState(false);
  const [fmt,     setFmt]     = useState('png');
  const [history, setHistory] = useState([]);

  const cvRef  = useRef(null);
  const urlRef = useRef(null);

  const { w, h }   = RATIOS[ratio];
  const { pw, ph } = calcPreview(ratio);

  // Load Urdu font once
  useEffect(() => {
    if (document.getElementById('noto-nastaliq-font')) return;
    const link = Object.assign(document.createElement('link'), {
      id: 'noto-nastaliq-font', rel: 'stylesheet',
      href: 'https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&display=swap',
    });
    document.head.appendChild(link);
  }, []);

  useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

  // Redraw on state changes
  useEffect(() => {
    if (!cvRef.current) return;
    const opts = { w: pw, h: ph, bgColor, bgImg, text, font, sz, color, bold, italic, align, pos, shadow };
    if (font.includes('Noto Nastaliq Urdu')) {
      document.fonts.load(`bold 16px "Noto Nastaliq Urdu"`).then(() => {
        if (cvRef.current) paint(cvRef.current, opts);
      });
    } else {
      paint(cvRef.current, opts);
    }
  }, [pw, ph, bgColor, bgImg, text, font, sz, color, bold, italic, align, pos, shadow]);

  // Apply style preset (sets bg + text color, clears bg image)
  function applyStyle(key) {
    const s = STYLES.find(x => x.key === key);
    if (!s) return;
    setStyle(key);
    setBgColor(s.bg);
    setColor(s.color);
    if (bgImg) removeImg();
  }

  function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    const url = URL.createObjectURL(file);
    urlRef.current = url;
    setBgName(file.name);
    const img = new Image();
    img.onload = () => setBgImg(img);
    img.src = url;
    e.target.value = '';
  }

  function removeImg() {
    if (urlRef.current) { URL.revokeObjectURL(urlRef.current); urlRef.current = null; }
    setBgImg(null); setBgName('');
  }

  const generate = useCallback(() => {
    const opts = { w, h, bgColor, bgImg, text, font, sz, color, bold, italic, align, pos, shadow };
    const execute = () => {
      const off = document.createElement('canvas');
      paint(off, opts);
      const dataUrl = off.toDataURL(fmt === 'jpg' ? 'image/jpeg' : 'image/png', 0.95);
      // Prepend to history (max 5 entries)
      setHistory(prev => [{ dataUrl, label: text.slice(0, 24) || 'Image', ratio, fmt }, ...prev].slice(0, 5));
      const a = document.createElement('a');
      a.href = dataUrl; a.download = `image.${fmt}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    };
    if (font.includes('Noto Nastaliq Urdu')) {
      document.fonts.load(`bold ${sz}px "Noto Nastaliq Urdu"`).then(execute);
    } else {
      execute();
    }
  }, [w, h, bgColor, bgImg, text, font, sz, color, bold, italic, align, pos, shadow, fmt, ratio]);

  function regenerate() {
    if (cvRef.current) {
      paint(cvRef.current, { w: pw, h: ph, bgColor, bgImg, text, font, sz, color, bold, italic, align, pos, shadow });
    }
  }

  return (
    <div className="panel-card shadow-lg overflow-hidden">

      {/* ── Top: Prompt + Style + Ratio ─────────────────────────── */}
      <div className="p-5 border-b border-border space-y-4">

        {/* Text prompt */}
        <div>
          <SLabel>Your Text</SLabel>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Type the text you want on your image…"
            dir="auto"
            rows={3}
            className="w-full rounded-xl border border-border bg-white text-base text-text-primary placeholder:text-text-muted px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/50 transition leading-relaxed"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Style presets */}
          <div>
            <SLabel>Style Preset</SLabel>
            <div className="flex flex-wrap gap-1.5">
              {STYLES.map(s => (
                <button
                  key={s.key}
                  onClick={() => applyStyle(s.key)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150 ${
                    style === s.key && !bgImg
                      ? 'ring-2 ring-offset-1 ring-accent border-accent text-white'
                      : 'border-border text-text-secondary hover:border-accent/40'
                  }`}
                  style={
                    style === s.key && !bgImg
                      ? { background: s.bg, color: s.color }
                      : { background: s.bg, color: s.color, opacity: 0.75 }
                  }
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Aspect ratio + Format */}
          <div className="space-y-3">
            <div>
              <SLabel>Aspect Ratio</SLabel>
              <div className="flex gap-1.5">
                {Object.entries(RATIOS).map(([k, r]) => (
                  <button
                    key={k}
                    onClick={() => setRatio(k)}
                    className={`flex-1 py-2 rounded-lg border text-center transition-all ${
                      ratio === k
                        ? 'bg-accent border-accent text-white shadow-sm'
                        : 'bg-white border-border text-text-secondary hover:border-accent/40'
                    }`}
                  >
                    <div className="text-[11px] font-bold">{r.label}</div>
                    <div className="text-[9px] opacity-60 mt-0.5 hidden sm:block">{r.detail}</div>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <SLabel>Format</SLabel>
              <div className="flex gap-2">
                {['png', 'jpg'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFmt(f)}
                    className={`px-4 py-1.5 text-xs font-bold uppercase rounded-lg border transition-all ${
                      fmt === f ? 'bg-accent border-accent text-white' : 'bg-white border-border text-text-secondary hover:border-accent/50'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main: Controls + Preview ─────────────────────────────── */}
      <div className="flex flex-col lg:flex-row" style={{ minHeight: '500px' }}>

        {/* Controls sidebar */}
        <div className="lg:w-[300px] xl:w-[320px] shrink-0 border-b lg:border-b-0 lg:border-r border-border">
          <div className="p-5 space-y-5 overflow-y-auto" style={{ maxHeight: 'min(80vh, 9999px)' }}>

            {/* Font & Style */}
            <div>
              <SLabel>Font & Style</SLabel>
              <select value={font} onChange={e => setFont(e.target.value)} className="input-field text-sm mb-3">
                {FONTS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </select>

              <div className="flex items-center gap-3 mb-3">
                <span className="text-xs text-text-muted shrink-0 w-[72px]">Size: {sz}px</span>
                <input type="range" min="10" max="200" value={sz}
                  onChange={e => setSz(Number(e.target.value))}
                  className="flex-1 accent-accent cursor-pointer"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">Color</span>
                  <input type="color" value={color} onChange={e => setColor(e.target.value)}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-border p-0.5 bg-transparent"
                  />
                </div>
                <div className="flex gap-1.5 ml-auto">
                  <Tog on={bold}   onClick={() => setBold(b => !b)}   title="Bold">
                    <Bold className="w-3.5 h-3.5" />
                  </Tog>
                  <Tog on={italic} onClick={() => setItalic(i => !i)} title="Italic">
                    <Italic className="w-3.5 h-3.5" />
                  </Tog>
                </div>
              </div>
            </div>

            {/* Layout */}
            <div>
              <SLabel>Layout</SLabel>
              <div className="space-y-3">
                <div>
                  <span className="text-xs text-text-muted block mb-1.5">Alignment</span>
                  <div className="flex gap-1.5">
                    <Tog on={align === 'Left'}   onClick={() => setAlign('Left')}   title="Left"   wide><AlignLeft className="w-3.5 h-3.5" /><span>Left</span></Tog>
                    <Tog on={align === 'Center'} onClick={() => setAlign('Center')} title="Center" wide><AlignCenter className="w-3.5 h-3.5" /><span>Center</span></Tog>
                    <Tog on={align === 'Right'}  onClick={() => setAlign('Right')}  title="Right"  wide><AlignRight className="w-3.5 h-3.5" /><span>Right</span></Tog>
                  </div>
                </div>
                <div>
                  <span className="text-xs text-text-muted block mb-1.5">Position</span>
                  <div className="flex gap-1.5">
                    {['Top', 'Center', 'Bottom'].map(p => (
                      <Tog key={p} on={pos === p} onClick={() => setPos(p)} title={p} wide>{p}</Tog>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-0.5">
                  <span className="text-xs text-text-muted">Text Shadow</span>
                  <button
                    onClick={() => setShadow(s => !s)}
                    aria-pressed={shadow}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${shadow ? 'bg-accent' : 'bg-slate-200'}`}
                  >
                    <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${shadow ? 'translate-x-4' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Background image upload */}
            <div>
              <SLabel>Background Image</SLabel>
              {bgImg ? (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50">
                  <span className="text-xs text-indigo-700 font-medium truncate flex-1">{bgName}</span>
                  <button onClick={removeImg} className="text-red-400 hover:text-red-500 transition-colors shrink-0">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-dashed border-accent/50 text-accent text-xs font-medium cursor-pointer hover:bg-accent/5 transition-all">
                  <Upload className="w-3.5 h-3.5" />
                  Upload Background
                  <input type="file" accept="image/*" className="sr-only" onChange={handleUpload} />
                </label>
              )}
              {bgImg && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-text-muted">BG Color</span>
                  <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} disabled={!!bgImg}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-border p-0.5 bg-transparent disabled:opacity-30"
                  />
                </div>
              )}
              {!bgImg && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-text-muted">BG Color</span>
                  <input type="color" value={bgColor} onChange={e => { setBgColor(e.target.value); setStyle(''); }}
                    className="w-8 h-8 rounded-lg cursor-pointer border border-border p-0.5 bg-transparent"
                  />
                </div>
              )}
            </div>

          </div>
        </div>

        {/* Canvas Preview */}
        <div className="flex-1 flex flex-col items-center justify-between p-6 bg-[#F8FAFC] min-h-[400px]">
          <div className="flex-1 flex flex-col items-center justify-center w-full">
            <p className="text-xs text-text-muted font-medium mb-4 tracking-wide">
              {RATIOS[ratio].label} · {RATIOS[ratio].detail} · Live Preview
            </p>
            <div className="rounded shadow-2xl overflow-hidden" style={{ lineHeight: 0, outline: '1px solid rgba(0,0,0,0.10)' }}>
              <canvas ref={cvRef} width={pw} height={ph} style={{ display: 'block' }} />
            </div>
            <p className="text-[11px] text-text-muted mt-4 opacity-70">Final download is full resolution · No watermarks</p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 mt-6 w-full max-w-sm">
            <button
              onClick={regenerate}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-white text-sm font-medium text-text-secondary hover:border-border-strong transition-all"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={generate}
              className="flex-1 btn-primary h-11 text-sm flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download {fmt.toUpperCase()}
            </button>
          </div>
        </div>
      </div>

      {/* ── History strip ───────────────────────────────────────── */}
      {history.length > 0 && (
        <div className="border-t border-border px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-xs font-bold text-text-muted uppercase tracking-wide">Recent Downloads</span>
          </div>
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            {history.map((item, i) => (
              <div key={i} className="shrink-0 group relative cursor-pointer" title={item.label}>
                <img
                  src={item.dataUrl}
                  alt={item.label}
                  className="w-16 h-16 object-cover rounded-xl border border-border group-hover:border-accent/40 transition-all shadow-xs"
                />
                <a
                  href={item.dataUrl}
                  download={`image.${item.fmt}`}
                  className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Download className="w-4 h-4 text-white" />
                </a>
                <p className="text-[10px] text-text-muted mt-1 truncate max-w-[64px]">{item.label || 'Image'}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
