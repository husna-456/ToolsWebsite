import { useState, useRef, useEffect, useCallback } from 'react';
import { Pipette, Copy, Check } from 'lucide-react';

// ── Color math helpers ───────────────────────────────────────────────────────

function hslToRgb(h, s, l) {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = n => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  return { r: Math.round(f(0) * 255), g: Math.round(f(8) * 255), b: Math.round(f(4) * 255) };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}

function hslToHex(h, s, l) {
  const { r, g, b } = hslToRgb(h, s, l);
  return rgbToHex(r, g, b);
}

function hexToRgb(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

// ── Swatches ──────────────────────────────────────────────────────────────────
const SWATCHES = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308',
  '#22C55E', '#10B981', '#06B6D4', '#0EA5E9',
  '#2563EB', '#6366F1', '#8B5CF6', '#EC4899',
  '#1E293B', '#64748B', '#CBD5E1', '#FFFFFF',
];

// ── Main component ────────────────────────────────────────────────────────────

export default function WheelColorPicker({ tool }) {
  const canvasRef  = useRef(null);
  const dragging   = useRef(false);

  const [hue,        setHue]        = useState(220);
  const [saturation, setSaturation] = useState(70);
  const [lightness,  setLightness]  = useState(50);
  const [copiedKey,  setCopiedKey]  = useState('');

  const hex = hslToHex(hue, saturation, lightness);
  const { r, g, b } = hslToRgb(hue, saturation, lightness);

  // Draw color wheel whenever hue/saturation/lightness changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx  = canvas.getContext('2d');
    const size = canvas.width;
    const cx   = size / 2;
    const cy   = size / 2;
    const rad  = size / 2 - 2;

    const img = ctx.createImageData(size, size);
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx   = x - cx;
        const dy   = y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist <= rad) {
          const angle = ((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360;
          const sat   = Math.min((dist / rad) * 100, 100);
          const { r: pr, g: pg, b: pb } = hslToRgb(angle, sat, lightness);
          const i = (y * size + x) * 4;
          img.data[i]     = pr;
          img.data[i + 1] = pg;
          img.data[i + 2] = pb;
          img.data[i + 3] = 255;
        }
      }
    }
    ctx.putImageData(img, 0, 0);

    // Indicator dot
    const angle = (hue * Math.PI) / 180;
    const dist  = (saturation / 100) * rad;
    const px    = cx + dist * Math.cos(angle);
    const py    = cy + dist * Math.sin(angle);

    ctx.beginPath();
    ctx.arc(px, py, 9, 0, 2 * Math.PI);
    ctx.strokeStyle = lightness > 55 ? '#00000080' : '#ffffff90';
    ctx.lineWidth   = 2.5;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(px, py, 6, 0, 2 * Math.PI);
    ctx.fillStyle = hex;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth   = 1.5;
    ctx.stroke();
  }, [hue, saturation, lightness, hex]);

  const pickFromCanvas = useCallback((e) => {
    const canvas = canvasRef.current;
    const rect   = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x  = (clientX - rect.left)  * (canvas.width  / rect.width);
    const y  = (clientY - rect.top)   * (canvas.height / rect.height);
    const cx = canvas.width  / 2;
    const cy = canvas.height / 2;
    const dx = x - cx, dy = y - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const rad  = canvas.width / 2 - 2;
    if (dist <= rad) {
      setHue(Math.round(((Math.atan2(dy, dx) * 180 / Math.PI) + 360) % 360));
      setSaturation(Math.round(Math.min((dist / rad) * 100, 100)));
    }
  }, []);

  const copyValue = (value, key) => {
    navigator.clipboard.writeText(value).catch(() => {});
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(''), 2000);
  };

  const pickSwatch = (sw) => {
    const { r: sr, g: sg, b: sb } = hexToRgb(sw);
    const { h, s, l } = rgbToHsl(sr, sg, sb);
    setHue(h); setSaturation(s); setLightness(l);
  };

  const colorValues = [
    { key: 'hex', label: 'HEX', value: hex.toUpperCase() },
    { key: 'rgb', label: 'RGB', value: `rgb(${r}, ${g}, ${b})` },
    { key: 'hsl', label: 'HSL', value: `hsl(${hue}, ${saturation}%, ${lightness}%)` },
  ];

  return (
    <div className="panel-card shadow-lg">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <Pipette className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-semibold text-text-primary">{tool.title || 'Wheel Color Picker'}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">

        {/* LEFT: color wheel + lightness */}
        <div className="p-6 flex flex-col items-center gap-5">
          <canvas
            ref={canvasRef}
            width={240}
            height={240}
            className="rounded-full cursor-crosshair touch-none select-none"
            style={{ width: 240, height: 240 }}
            onMouseDown={(e) => { dragging.current = true; pickFromCanvas(e); }}
            onMouseMove={(e) => { if (dragging.current) pickFromCanvas(e); }}
            onMouseUp={() => { dragging.current = false; }}
            onMouseLeave={() => { dragging.current = false; }}
            onTouchStart={(e) => { e.preventDefault(); pickFromCanvas(e); }}
            onTouchMove={(e) => { e.preventDefault(); pickFromCanvas(e); }}
          />

          {/* Lightness slider */}
          <div className="w-full space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wide">Lightness</span>
              <span className="text-xs text-text-secondary font-medium">{lightness}%</span>
            </div>
            <div
              className="relative h-4 rounded-full"
              style={{ background: `linear-gradient(to right, #000, hsl(${hue},${saturation}%,50%), #fff)` }}
            >
              <input
                type="range" min="0" max="100"
                value={lightness}
                onChange={e => setLightness(Number(e.target.value))}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              {/* thumb indicator */}
              <div
                className="absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full border-2 border-white shadow-md pointer-events-none ring-1 ring-black/10"
                style={{
                  left: `calc(${lightness}% - 10px)`,
                  background: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
                }}
              />
            </div>
          </div>
        </div>

        {/* RIGHT: color display + swatches */}
        <div className="p-6 space-y-5">
          {/* Color preview swatch */}
          <div
            className="w-full h-20 rounded-2xl border border-border shadow-inner transition-colors duration-100"
            style={{ background: hex }}
          />

          {/* Color values */}
          <div className="space-y-2">
            {colorValues.map(({ key, label, value }) => (
              <div
                key={key}
                className="flex items-center justify-between bg-surface-2 border border-border rounded-xl px-4 py-2.5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-xs font-bold text-text-muted uppercase tracking-wide w-8 flex-shrink-0">{label}</span>
                  <span className="text-sm font-mono text-text-primary truncate">{value}</span>
                </div>
                <button onClick={() => copyValue(value, key)} className="btn-ghost text-xs flex-shrink-0 ml-2">
                  {copiedKey === key
                    ? <><Check className="w-3.5 h-3.5 text-green-600" />Copied!</>
                    : <><Copy className="w-3.5 h-3.5" />Copy</>
                  }
                </button>
              </div>
            ))}
          </div>

          {/* Quick swatches */}
          <div>
            <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2.5">Quick Swatches</p>
            <div className="grid grid-cols-8 gap-2">
              {SWATCHES.map(sw => (
                <button
                  key={sw}
                  onClick={() => pickSwatch(sw)}
                  title={sw}
                  className="aspect-square rounded-lg border-2 border-border hover:scale-110 hover:border-accent/60 transition-transform shadow-sm"
                  style={{ background: sw }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
