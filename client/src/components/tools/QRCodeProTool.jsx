import { useState, useEffect, useRef, useCallback } from 'react';
import {
  QrCode, Download, RefreshCw, Upload, X, Check,
  AlertCircle, Loader2, History, Trash2, ChevronDown,
  Wifi, Mail, Phone, MessageSquare, MapPin, Calendar,
  User, Globe, Share2, Copy, FileText, Image, Film,
} from 'lucide-react';

// ── QR type definitions ─────────────────────────────────────────
const QR_TYPES = [
  { id: 'url',       label: 'URL',        icon: Globe,        fields: ['url'] },
  { id: 'text',      label: 'Text',       icon: FileText,     fields: ['text'] },
  { id: 'email',     label: 'Email',      icon: Mail,         fields: ['email', 'subject', 'body'] },
  { id: 'phone',     label: 'Phone',      icon: Phone,        fields: ['phone'] },
  { id: 'sms',       label: 'SMS',        icon: MessageSquare,fields: ['phone', 'message'] },
  { id: 'whatsapp',  label: 'WhatsApp',   icon: MessageSquare,fields: ['phone', 'message'] },
  { id: 'wifi',      label: 'WiFi',       icon: Wifi,         fields: ['ssid', 'password', 'encryption', 'hidden'] },
  { id: 'contact',   label: 'Contact',    icon: User,         fields: ['firstName', 'lastName', 'phone', 'email', 'org', 'url'] },
  { id: 'location',  label: 'Location',   icon: MapPin,       fields: ['lat', 'lng', 'label'] },
  { id: 'event',     label: 'Event',      icon: Calendar,     fields: ['title', 'start', 'end', 'location', 'description'] },
  { id: 'social',    label: 'Social',     icon: Share2,       fields: ['url'] },
];

const DOT_STYLES = [
  { id: 'square',  label: 'Square'  },
  { id: 'rounded', label: 'Rounded' },
  { id: 'dots',    label: 'Dots'    },
  { id: 'diamond', label: 'Diamond' },
];

const FRAMES = [
  { id: 'none',       label: 'None' },
  { id: 'scan-me',    label: 'Scan Me' },
  { id: 'visit',      label: 'Visit Website' },
  { id: 'download',   label: 'Download App' },
  { id: 'follow',     label: 'Follow Us' },
  { id: 'contact',    label: 'Contact Us' },
];

const ERROR_LEVELS = [
  { id: 'L', label: 'Low',      desc: '7% restore' },
  { id: 'M', label: 'Medium',   desc: '15% restore' },
  { id: 'Q', label: 'Quartile', desc: '25% restore' },
  { id: 'H', label: 'High',     desc: '30% restore' },
];

const DOWNLOAD_FORMATS = ['PNG', 'JPG', 'WEBP', 'SVG', 'PDF'];

const LS_HISTORY_KEY = 'qr_pro_history_v1';
const MAX_HISTORY = 20;
const PREVIEW_SIZE = 280; // canvas render size for preview

// ── Build QR data string from type + form ───────────────────────
function buildQRData(type, form) {
  switch (type) {
    case 'url':
    case 'social': {
      let url = (form.url || '').trim();
      if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
      return url;
    }
    case 'text':
      return (form.text || '').trim();
    case 'email': {
      let s = `mailto:${form.email || ''}`;
      const params = [];
      if (form.subject) params.push(`subject=${encodeURIComponent(form.subject)}`);
      if (form.body)    params.push(`body=${encodeURIComponent(form.body)}`);
      if (params.length) s += '?' + params.join('&');
      return s;
    }
    case 'phone':
      return `tel:${(form.phone || '').replace(/\s/g, '')}`;
    case 'sms':
      return `smsto:${(form.phone || '').replace(/\s/g, '')}:${form.message || ''}`;
    case 'whatsapp': {
      const p = (form.phone || '').replace(/[^0-9]/g, '');
      return `https://wa.me/${p}${form.message ? '?text=' + encodeURIComponent(form.message) : ''}`;
    }
    case 'wifi': {
      const enc = form.encryption || 'WPA';
      const hidden = form.hidden ? 'true' : 'false';
      return `WIFI:T:${enc};S:${form.ssid || ''};P:${form.password || ''};H:${hidden};;`;
    }
    case 'contact': {
      const lines = [
        'BEGIN:VCARD', 'VERSION:3.0',
        `N:${form.lastName || ''};${form.firstName || ''}`,
        `FN:${[form.firstName, form.lastName].filter(Boolean).join(' ')}`,
        form.phone ? `TEL:${form.phone}` : '',
        form.email ? `EMAIL:${form.email}` : '',
        form.org   ? `ORG:${form.org}` : '',
        form.url   ? `URL:${form.url}` : '',
        'END:VCARD',
      ].filter(Boolean);
      return lines.join('\n');
    }
    case 'location': {
      if (form.lat && form.lng) return `geo:${form.lat},${form.lng}${form.label ? '?q=' + encodeURIComponent(form.label) : ''}`;
      if (form.label) return `https://maps.google.com/?q=${encodeURIComponent(form.label)}`;
      return '';
    }
    case 'event': {
      const fmt = s => s ? s.replace(/[-:]/g, '') : '';
      return [
        'BEGIN:VEVENT',
        form.title ? `SUMMARY:${form.title}` : '',
        form.start ? `DTSTART:${fmt(form.start)}` : '',
        form.end   ? `DTEND:${fmt(form.end)}` : '',
        form.location ? `LOCATION:${form.location}` : '',
        form.description ? `DESCRIPTION:${form.description}` : '',
        'END:VEVENT',
      ].filter(Boolean).join('\n');
    }
    default:
      return '';
  }
}

// ── Custom canvas QR renderer ───────────────────────────────────
function renderQRToCanvas(canvas, qrData, opts = {}) {
  const {
    fgColor   = '#000000',
    bgColor   = '#ffffff',
    dotStyle  = 'square',
    logoEl    = null,
    logoSize  = 22,
    frame     = 'none',
    frameColor = '#000000',
  } = opts;

  const FRAME_HEIGHT = frame !== 'none' ? 44 : 0;
  const QR_SIZE      = canvas.width;
  const QR_AREA      = QR_SIZE - FRAME_HEIGHT;

  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, QR_SIZE, QR_SIZE);

  // Background
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, QR_SIZE, QR_SIZE);

  const size   = qrData.modules.size;
  const data   = qrData.modules.data;
  const cell   = QR_AREA / size;
  const r      = cell * 0.45;

  ctx.fillStyle = fgColor;

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      if (!data[row * size + col]) continue;
      const x = col * cell;
      const y = row * cell;
      const cx = x + cell / 2;
      const cy = y + cell / 2;

      ctx.beginPath();
      switch (dotStyle) {
        case 'dots':
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          break;
        case 'rounded':
          roundedRect(ctx, x + 0.5, y + 0.5, cell - 1, cell - 1, cell * 0.3);
          break;
        case 'diamond': {
          const half = cell * 0.48;
          ctx.moveTo(cx,       cy - half);
          ctx.lineTo(cx + half, cy);
          ctx.lineTo(cx,       cy + half);
          ctx.lineTo(cx - half, cy);
          ctx.closePath();
          break;
        }
        default: // square
          ctx.rect(x, y, cell, cell);
      }
      ctx.fill();
    }
  }

  // Logo overlay
  if (logoEl) {
    const logoW = QR_AREA * (logoSize / 100);
    const logoH = logoW;
    const lx = (QR_AREA - logoW) / 2;
    const ly = (QR_AREA - logoH) / 2;
    const pad = logoW * 0.12;
    ctx.fillStyle = bgColor;
    ctx.fillRect(lx - pad, ly - pad, logoW + pad * 2, logoH + pad * 2);
    ctx.drawImage(logoEl, lx, ly, logoW, logoH);
  }

  // Frame
  if (frame !== 'none') {
    const FRAME_LABELS = {
      'scan-me': 'SCAN ME',
      'visit':   'VISIT WEBSITE',
      'download':'DOWNLOAD APP',
      'follow':  'FOLLOW US',
      'contact': 'CONTACT US',
    };
    const label = FRAME_LABELS[frame] || '';
    const fy = QR_AREA;
    ctx.fillStyle = frameColor;
    ctx.fillRect(0, fy, QR_SIZE, FRAME_HEIGHT);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(FRAME_HEIGHT * 0.38)}px Inter, Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, QR_SIZE / 2, fy + FRAME_HEIGHT / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
}

function roundedRect(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

// ── UI sub-components ───────────────────────────────────────────
function Label({ children }) {
  return <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">{children}</p>;
}

function Pill({ active, onClick, children, className = '' }) {
  return (
    <button
      type="button" onClick={onClick}
      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all duration-150 ${
        active
          ? 'bg-accent border-accent text-white shadow-sm'
          : 'bg-white border-border text-text-secondary hover:border-accent/50'
      } ${className}`}
    >
      {children}
    </button>
  );
}

function TabBtn({ active, onClick, children }) {
  return (
    <button
      type="button" onClick={onClick}
      className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all duration-150 ${
        active ? 'bg-accent text-white shadow-sm' : 'text-text-secondary hover:text-primary hover:bg-surface-2'
      }`}
    >
      {children}
    </button>
  );
}

function InputField({ label, value, onChange, placeholder, type = 'text', rows }) {
  return (
    <div>
      <Label>{label}</Label>
      {rows ? (
        <textarea
          value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} rows={rows}
          className="tool-textarea text-sm" style={{ minHeight: 60 }}
        />
      ) : (
        <input
          type={type} value={value} onChange={e => onChange(e.target.value)}
          placeholder={placeholder} className="input-field text-sm"
        />
      )}
    </div>
  );
}

// ── QR type form ────────────────────────────────────────────────
function TypeForm({ qrType, form, setForm }) {
  const f = (key) => form[key] || '';
  const set = (key) => (val) => setForm(prev => ({ ...prev, [key]: val }));

  switch (qrType) {
    case 'url':
    case 'social':
      return <InputField label="URL" value={f('url')} onChange={set('url')} placeholder="https://example.com" />;

    case 'text':
      return <InputField label="Text" value={f('text')} onChange={set('text')} placeholder="Enter any text…" rows={4} />;

    case 'email':
      return (
        <div className="space-y-3">
          <InputField label="Email Address" value={f('email')} onChange={set('email')} placeholder="you@example.com" type="email" />
          <InputField label="Subject (optional)" value={f('subject')} onChange={set('subject')} placeholder="Hello there" />
          <InputField label="Body (optional)" value={f('body')} onChange={set('body')} placeholder="Message body…" rows={3} />
        </div>
      );

    case 'phone':
      return <InputField label="Phone Number" value={f('phone')} onChange={set('phone')} placeholder="+1 234 567 8900" type="tel" />;

    case 'sms':
    case 'whatsapp':
      return (
        <div className="space-y-3">
          <InputField label="Phone Number" value={f('phone')} onChange={set('phone')} placeholder="+1 234 567 8900" type="tel" />
          <InputField label="Message (optional)" value={f('message')} onChange={set('message')} placeholder="Pre-filled message…" rows={3} />
        </div>
      );

    case 'wifi':
      return (
        <div className="space-y-3">
          <InputField label="Network Name (SSID)" value={f('ssid')} onChange={set('ssid')} placeholder="MyHomeWiFi" />
          <InputField label="Password" value={f('password')} onChange={set('password')} placeholder="••••••••" type="password" />
          <div>
            <Label>Security</Label>
            <div className="flex gap-2 flex-wrap">
              {['WPA', 'WEP', 'nopass'].map(enc => (
                <Pill key={enc} active={(form.encryption || 'WPA') === enc} onClick={() => set('encryption')(enc)}>
                  {enc}
                </Pill>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={!!form.hidden} onChange={e => set('hidden')(e.target.checked)}
              className="accent-accent" />
            <span className="text-sm text-text-secondary">Hidden network</span>
          </label>
        </div>
      );

    case 'contact':
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <InputField label="First Name" value={f('firstName')} onChange={set('firstName')} placeholder="John" />
            <InputField label="Last Name"  value={f('lastName')}  onChange={set('lastName')}  placeholder="Doe" />
          </div>
          <InputField label="Phone"        value={f('phone')}     onChange={set('phone')}     placeholder="+1 234 567 8900" type="tel" />
          <InputField label="Email"        value={f('email')}     onChange={set('email')}     placeholder="you@example.com" type="email" />
          <InputField label="Organization" value={f('org')}       onChange={set('org')}       placeholder="Company Inc." />
          <InputField label="Website"      value={f('url')}       onChange={set('url')}       placeholder="https://example.com" />
        </div>
      );

    case 'location':
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <InputField label="Latitude"  value={f('lat')} onChange={set('lat')} placeholder="40.7128" type="number" />
            <InputField label="Longitude" value={f('lng')} onChange={set('lng')} placeholder="-74.0060" type="number" />
          </div>
          <InputField label="Label (or just enter address)" value={f('label')} onChange={set('label')} placeholder="New York City" />
        </div>
      );

    case 'event':
      return (
        <div className="space-y-3">
          <InputField label="Event Title" value={f('title')} onChange={set('title')} placeholder="My Event" />
          <div className="grid grid-cols-2 gap-2">
            <InputField label="Start" value={f('start')} onChange={set('start')} type="datetime-local" />
            <InputField label="End"   value={f('end')}   onChange={set('end')}   type="datetime-local" />
          </div>
          <InputField label="Location (optional)"    value={f('location')}    onChange={set('location')}    placeholder="123 Main St" />
          <InputField label="Description (optional)" value={f('description')} onChange={set('description')} placeholder="Event details…" rows={2} />
        </div>
      );

    default:
      return null;
  }
}

// ── Main component ──────────────────────────────────────────────
export default function QRCodeProTool() {
  const [tab,         setTab]         = useState('type');
  const [qrType,      setQrType]      = useState('url');
  const [form,        setForm]        = useState({ url: '' });
  const [fgColor,     setFgColor]     = useState('#000000');
  const [bgColor,     setBgColor]     = useState('#ffffff');
  const [dotStyle,    setDotStyle]    = useState('square');
  const [errorLevel,  setErrorLevel]  = useState('M');
  const [size,        setSize]        = useState(512);
  const [logoDataUrl, setLogoDataUrl] = useState('');
  const [logoEl,      setLogoEl]      = useState(null);
  const [logoSize,    setLogoSize]    = useState(22);
  const [frame,       setFrame]       = useState('none');
  const [frameColor,  setFrameColor]  = useState('#1D4ED8');
  const [dlFormat,    setDlFormat]    = useState('PNG');
  const [csvText,     setCsvText]     = useState('');
  const [batchItems,  setBatchItems]  = useState([]);
  const [batchLoading,setBatchLoading]= useState(false);
  const [history,     setHistory]     = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_HISTORY_KEY) || '[]'); } catch { return []; }
  });
  const [qrObj,       setQrObj]       = useState(null);
  const [generating,  setGenerating]  = useState(false);
  const [error,       setError]       = useState('');
  const [valid,       setValid]       = useState(null); // null | true | false
  const [copied,      setCopied]      = useState(false);

  const previewRef   = useRef(null);
  const logoInputRef = useRef(null);
  const csvInputRef  = useRef(null);

  // ── Derive QR data string ──────────────────────────────────
  const qrData = buildQRData(qrType, form);
  const hasData = qrData.length > 0;

  // ── Live preview (debounced) ──────────────────────────────
  const drawPreview = useCallback(async (qrObject, logoElement) => {
    const canvas = previewRef.current;
    if (!canvas || !qrObject) return;
    const FRAME_H = frame !== 'none' ? 44 : 0;
    canvas.width  = PREVIEW_SIZE;
    canvas.height = PREVIEW_SIZE + FRAME_H;
    renderQRToCanvas(canvas, qrObject, {
      fgColor, bgColor, dotStyle, logoEl: logoElement, logoSize, frame, frameColor,
    });
  }, [fgColor, bgColor, dotStyle, logoSize, frame, frameColor]);

  useEffect(() => {
    if (!hasData) { setQrObj(null); setValid(null); return; }
    const tid = setTimeout(async () => {
      setGenerating(true);
      setError('');
      try {
        const QRCode = (await import('qrcode')).default;
        const qr = QRCode.create(qrData, { errorCorrectionLevel: errorLevel });
        setQrObj(qr);
        setValid(true);
        await drawPreview(qr, logoEl);
      } catch (e) {
        setQrObj(null);
        setValid(false);
        setError(e.message || 'Data too long for this error correction level.');
      } finally {
        setGenerating(false);
      }
    }, 350);
    return () => clearTimeout(tid);
  }, [qrData, errorLevel]);

  // Redraw when visual settings change
  useEffect(() => {
    if (qrObj) drawPreview(qrObj, logoEl);
  }, [fgColor, bgColor, dotStyle, logoEl, logoSize, frame, frameColor, qrObj, drawPreview]);

  // ── Logo handling ──────────────────────────────────────────
  function handleLogoUpload(file) {
    if (!file || !file.type.startsWith('image/')) return;
    const url = URL.createObjectURL(file);
    setLogoDataUrl(url);
    const img = new window.Image();
    img.onload = () => setLogoEl(img);
    img.src = url;
  }

  function clearLogo() {
    if (logoDataUrl) URL.revokeObjectURL(logoDataUrl);
    setLogoDataUrl('');
    setLogoEl(null);
    if (logoInputRef.current) logoInputRef.current.value = '';
  }

  // ── Download ───────────────────────────────────────────────
  async function handleDownload(fmt = dlFormat, customSize = size) {
    if (!qrObj) return;
    const QRCode = (await import('qrcode')).default;

    if (fmt === 'SVG') {
      const svg = await QRCode.toString(qrData, {
        type: 'svg', width: customSize, errorCorrectionLevel: errorLevel,
        color: { dark: fgColor, light: bgColor },
      });
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      triggerDownload(URL.createObjectURL(blob), 'qr-code.svg');
      return;
    }

    if (fmt === 'PDF') {
      const { jsPDF } = await import('jspdf');
      const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
      const canvas = buildHighResCanvas(customSize);
      const dataUrl = canvas.toDataURL('image/png');
      const pxToMm  = 0.264583;
      const imgMm   = customSize * pxToMm;
      const x = (210 - imgMm) / 2;
      const y = (297 - imgMm) / 2;
      pdf.addImage(dataUrl, 'PNG', Math.max(x, 5), Math.max(y, 5), Math.min(imgMm, 200), Math.min(imgMm, 200));
      pdf.save('qr-code.pdf');
      return;
    }

    const canvas  = buildHighResCanvas(customSize);
    const mime    = fmt === 'JPG' ? 'image/jpeg' : fmt === 'WEBP' ? 'image/webp' : 'image/png';
    const quality = fmt === 'JPG' ? 0.95 : undefined;
    canvas.toBlob(blob => {
      triggerDownload(URL.createObjectURL(blob), `qr-code.${fmt.toLowerCase()}`);
    }, mime, quality);
  }

  function buildHighResCanvas(targetSize) {
    const FRAME_H = frame !== 'none' ? Math.round(targetSize * (44 / PREVIEW_SIZE)) : 0;
    const canvas  = document.createElement('canvas');
    canvas.width  = targetSize;
    canvas.height = targetSize + FRAME_H;
    renderQRToCanvas(canvas, qrObj, {
      fgColor, bgColor, dotStyle, logoEl, logoSize, frame, frameColor,
    });
    return canvas;
  }

  function triggerDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  // ── Save to history ────────────────────────────────────────
  function saveToHistory() {
    if (!previewRef.current || !qrObj) return;
    const thumb = previewRef.current.toDataURL('image/png');
    const entry = {
      id: Date.now(), thumb, qrData, type: qrType,
      timestamp: new Date().toISOString(),
    };
    const next = [entry, ...history].slice(0, MAX_HISTORY);
    setHistory(next);
    localStorage.setItem(LS_HISTORY_KEY, JSON.stringify(next));
  }

  // ── Copy QR data string ────────────────────────────────────
  function copyData() {
    navigator.clipboard.writeText(qrData).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 1500);
    });
  }

  // ── Batch CSV generation ────────────────────────────────────
  async function handleBatchGenerate() {
    const lines = csvText.split('\n').map(l => l.trim()).filter(Boolean);
    if (!lines.length) return;
    setBatchLoading(true);
    const results = [];
    const QRCode  = (await import('qrcode')).default;
    for (const line of lines.slice(0, 100)) {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 300;
        const qr = QRCode.create(line, { errorCorrectionLevel: errorLevel });
        renderQRToCanvas(canvas, qr, { fgColor, bgColor, dotStyle, frame: 'none' });
        results.push({ data: line, dataUrl: canvas.toDataURL('image/png'), ok: true });
      } catch {
        results.push({ data: line, ok: false });
      }
    }
    setBatchItems(results);
    setBatchLoading(false);
  }

  async function handleBatchDownloadZip() {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    batchItems.filter(r => r.ok).forEach((r, i) => {
      const b64 = r.dataUrl.split(',')[1];
      zip.file(`qr_${i + 1}.png`, b64, { base64: true });
    });
    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
    triggerDownload(URL.createObjectURL(blob), 'qr-batch.zip');
  }

  // ── Clear history ──────────────────────────────────────────
  function clearHistory() {
    setHistory([]);
    localStorage.removeItem(LS_HISTORY_KEY);
  }

  // ── QR type change ─────────────────────────────────────────
  function changeType(t) {
    setQrType(t);
    setForm({});
    setError('');
    setValid(null);
  }

  // ── Render ─────────────────────────────────────────────────
  return (
    <div className="panel-card shadow-lg">
      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] divide-y lg:divide-y-0 lg:divide-x divide-border">

        {/* ── LEFT: Controls ─────────────────────────────────── */}
        <div className="flex flex-col">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-text-muted" />
              <span className="text-sm font-semibold text-text-primary">QR Studio</span>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 p-3 border-b border-border bg-surface-2/40">
            {['Type', 'Design', 'Frame', 'Batch'].map(t => (
              <TabBtn key={t} active={tab === t.toLowerCase()} onClick={() => setTab(t.toLowerCase())}>
                {t}
              </TabBtn>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-5">

            {/* ── TYPE tab ──────────────────────────────────── */}
            {tab === 'type' && (
              <>
                {/* Type selector grid */}
                <div>
                  <Label>QR Code Type</Label>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                    {QR_TYPES.map(t => {
                      const Icon = t.icon;
                      return (
                        <button
                          key={t.id} type="button" onClick={() => changeType(t.id)}
                          className={`flex flex-col items-center gap-1 py-2.5 px-1 rounded-xl border text-xs font-semibold transition-all duration-150 ${
                            qrType === t.id
                              ? 'bg-accent/10 border-accent text-accent'
                              : 'bg-white border-border text-text-secondary hover:border-accent/50'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                          {t.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Dynamic form */}
                <TypeForm qrType={qrType} form={form} setForm={setForm} />

                {/* QR data preview */}
                {qrData && (
                  <div className="bg-surface-2/60 rounded-xl border border-border p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[11px] font-semibold text-text-muted uppercase tracking-wide">QR Data</span>
                      <button onClick={copyData} className="text-[11px] text-accent hover:underline flex items-center gap-1">
                        {copied ? <><Check className="w-3 h-3" />Copied!</> : <><Copy className="w-3 h-3" />Copy</>}
                      </button>
                    </div>
                    <p className="text-xs text-text-secondary font-mono break-all line-clamp-2">{qrData}</p>
                  </div>
                )}
              </>
            )}

            {/* ── DESIGN tab ────────────────────────────────── */}
            {tab === 'design' && (
              <>
                {/* Colors */}
                <div>
                  <Label>Colors</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-[11px] text-text-muted mb-1">Foreground</p>
                      <div className="flex items-center gap-2 border border-border rounded-xl px-3 py-2 bg-white">
                        <input type="color" value={fgColor} onChange={e => setFgColor(e.target.value)}
                          className="w-7 h-7 rounded cursor-pointer border-0 p-0 bg-transparent" />
                        <span className="text-xs font-mono text-text-secondary flex-1">{fgColor.toUpperCase()}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[11px] text-text-muted mb-1">Background</p>
                      <div className="flex items-center gap-2 border border-border rounded-xl px-3 py-2 bg-white">
                        <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)}
                          className="w-7 h-7 rounded cursor-pointer border-0 p-0 bg-transparent" />
                        <span className="text-xs font-mono text-text-secondary flex-1">{bgColor.toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                  {/* Quick presets */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[
                      ['#000000','#ffffff'],['#1D4ED8','#EFF6FF'],['#059669','#ECFDF5'],
                      ['#DC2626','#FEF2F2'],['#7C3AED','#F5F3FF'],['#D97706','#FFFBEB'],
                    ].map(([fg, bg]) => (
                      <button key={fg} type="button"
                        onClick={() => { setFgColor(fg); setBgColor(bg); }}
                        className="w-6 h-6 rounded-lg border border-border overflow-hidden hover:scale-110 transition-transform"
                        title={`${fg} / ${bg}`}
                      >
                        <div className="h-1/2" style={{ background: bg }} />
                        <div className="h-1/2" style={{ background: fg }} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Dot style */}
                <div>
                  <Label>Dot Style</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {DOT_STYLES.map(s => (
                      <button
                        key={s.id} type="button" onClick={() => setDotStyle(s.id)}
                        className={`flex flex-col items-center gap-1 py-2 rounded-xl border text-xs font-medium transition-all ${
                          dotStyle === s.id
                            ? 'bg-accent/10 border-accent text-accent'
                            : 'bg-white border-border text-text-secondary hover:border-accent/50'
                        }`}
                      >
                        {/* Mini dot preview */}
                        <DotStylePreview style={s.id} color={fgColor} />
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Logo */}
                <div>
                  <Label>Logo / Icon (optional)</Label>
                  {!logoDataUrl ? (
                    <label className="flex flex-col items-center gap-2 py-5 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-accent/50 hover:bg-surface-2/40 transition-all">
                      <Image className="w-5 h-5 text-text-muted" />
                      <span className="text-xs text-text-secondary">Upload PNG, JPG, SVG</span>
                      <input ref={logoInputRef} type="file" accept="image/*" className="sr-only"
                        onChange={e => handleLogoUpload(e.target.files?.[0])} />
                    </label>
                  ) : (
                    <div className="flex items-center gap-3 p-3 border border-border rounded-xl bg-surface-2/40">
                      <img src={logoDataUrl} alt="logo" className="w-10 h-10 object-contain rounded-lg border border-border bg-white" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-text-muted">Logo size: {logoSize}%</span>
                          <button onClick={clearLogo} className="text-text-muted hover:text-red-500 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <input type="range" min={10} max={40} value={logoSize}
                          onChange={e => setLogoSize(Number(e.target.value))}
                          className="w-full accent-accent cursor-pointer h-1.5" />
                      </div>
                    </div>
                  )}
                  {logoEl && (
                    <p className="text-[11px] text-text-muted mt-1">Use High (H) error correction when adding a logo.</p>
                  )}
                </div>

                {/* Error correction */}
                <div>
                  <Label>Error Correction</Label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {ERROR_LEVELS.map(e => (
                      <button
                        key={e.id} type="button" onClick={() => setErrorLevel(e.id)}
                        className={`flex flex-col items-center gap-0.5 py-2 rounded-xl border text-center transition-all ${
                          errorLevel === e.id
                            ? 'bg-accent/10 border-accent text-accent'
                            : 'bg-white border-border text-text-secondary hover:border-accent/50'
                        }`}
                      >
                        <span className="text-sm font-bold">{e.id}</span>
                        <span className="text-[10px] leading-tight">{e.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Size */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label>Export Size</Label>
                    <span className="text-xs font-semibold text-accent">{size}×{size}px</span>
                  </div>
                  <input type="range" min={128} max={2000} step={64}
                    value={size} onChange={e => setSize(Number(e.target.value))}
                    className="w-full accent-accent cursor-pointer" />
                  <div className="flex justify-between text-[11px] text-text-muted mt-1">
                    <span>128px</span><span>1024px</span><span>2000px</span>
                  </div>
                  {/* Quick sizes */}
                  <div className="flex gap-1.5 mt-2 flex-wrap">
                    {[256, 512, 1024, 1500, 2000].map(s => (
                      <button key={s} type="button" onClick={() => setSize(s)}
                        className={`px-2 py-0.5 text-[11px] rounded-lg border transition-all ${
                          size === s ? 'bg-accent text-white border-accent' : 'bg-white border-border text-text-secondary hover:border-accent/50'
                        }`}>
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* ── FRAME tab ─────────────────────────────────── */}
            {tab === 'frame' && (
              <>
                <div>
                  <Label>Frame Template</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {FRAMES.map(f => (
                      <button
                        key={f.id} type="button" onClick={() => setFrame(f.id)}
                        className={`py-3 px-2 rounded-xl border text-xs font-semibold text-center transition-all ${
                          frame === f.id
                            ? 'bg-accent/10 border-accent text-accent'
                            : 'bg-white border-border text-text-secondary hover:border-accent/50'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {frame !== 'none' && (
                  <div>
                    <Label>Frame Color</Label>
                    <div className="flex items-center gap-2 border border-border rounded-xl px-3 py-2 bg-white">
                      <input type="color" value={frameColor} onChange={e => setFrameColor(e.target.value)}
                        className="w-7 h-7 rounded cursor-pointer border-0 p-0 bg-transparent" />
                      <span className="text-xs font-mono text-text-secondary">{frameColor.toUpperCase()}</span>
                    </div>
                    {/* Frame color presets */}
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {['#1D4ED8','#059669','#DC2626','#7C3AED','#D97706','#0F172A'].map(c => (
                        <button key={c} type="button" onClick={() => setFrameColor(c)}
                          className="w-6 h-6 rounded-lg border border-border hover:scale-110 transition-transform"
                          style={{ background: c }} />
                      ))}
                    </div>
                  </div>
                )}

                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
                  Frame text appears in a colored banner below the QR code. Use High error correction for best scanning.
                </div>
              </>
            )}

            {/* ── BATCH tab ─────────────────────────────────── */}
            {tab === 'batch' && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <Label>CSV / List (one per line)</Label>
                    <label className="text-[11px] text-accent cursor-pointer hover:underline flex items-center gap-1">
                      <Upload className="w-3 h-3" /> Upload CSV
                      <input ref={csvInputRef} type="file" accept=".csv,.txt" className="sr-only"
                        onChange={e => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          const reader = new FileReader();
                          reader.onload = ev => setCsvText(ev.target.result);
                          reader.readAsText(f);
                        }} />
                    </label>
                  </div>
                  <textarea
                    value={csvText} onChange={e => setCsvText(e.target.value)}
                    placeholder={'https://example.com\nhttps://shop.example.com\nhttps://blog.example.com'}
                    rows={6} className="tool-textarea text-xs font-mono"
                    style={{ minHeight: 120 }}
                  />
                  <p className="text-[11px] text-text-muted mt-1">
                    Max 100 items. Each line = one QR code. Design settings (color, style) apply to all.
                  </p>
                </div>

                <button
                  onClick={handleBatchGenerate}
                  disabled={!csvText.trim() || batchLoading}
                  className="btn-primary w-full h-10 text-sm"
                >
                  {batchLoading
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Generating…</>
                    : <><QrCode className="w-4 h-4" />Generate Batch</>
                  }
                </button>

                {batchItems.length > 0 && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-text-secondary">
                        {batchItems.filter(r => r.ok).length}/{batchItems.length} generated
                      </span>
                      <button onClick={handleBatchDownloadZip}
                        className="text-xs text-accent font-semibold hover:underline flex items-center gap-1">
                        <Download className="w-3 h-3" />Download ZIP
                      </button>
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto">
                      {batchItems.map((item, i) => (
                        <div key={i} className="flex items-center gap-2 p-2 bg-surface-2/60 rounded-lg border border-border text-xs">
                          {item.ok
                            ? <><img src={item.dataUrl} alt="" className="w-8 h-8 shrink-0 rounded" /><span className="truncate text-text-secondary flex-1">{item.data}</span><Check className="w-3 h-3 text-green-500 shrink-0" /></>
                            : <><AlertCircle className="w-3 h-3 text-red-500 shrink-0" /><span className="truncate text-red-500 flex-1">{item.data}</span><span className="text-red-400">Error</span></>
                          }
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Error message */}
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          {/* Generate / Save buttons */}
          <div className="px-4 pb-4 pt-3 border-t border-border space-y-2">
            <button
              onClick={saveToHistory}
              disabled={!qrObj}
              className="btn-primary w-full h-10 text-sm"
            >
              <QrCode className="w-4 h-4" />
              Save to History
            </button>
          </div>
        </div>

        {/* ── RIGHT: Preview + Download ───────────────────────── */}
        <div className="flex flex-col">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-text-muted" />
              <span className="text-sm font-semibold text-text-primary">Live Preview</span>
            </div>
            <div className="flex items-center gap-2">
              {valid === true  && <span className="text-[11px] text-green-600 font-semibold flex items-center gap-1"><Check className="w-3 h-3" />Valid</span>}
              {valid === false && <span className="text-[11px] text-red-500 font-semibold flex items-center gap-1"><AlertCircle className="w-3 h-3" />Invalid</span>}
            </div>
          </div>

          <div className="flex-1 p-4 flex flex-col gap-4 items-center">
            {/* Canvas preview */}
            <div className="flex items-center justify-center w-full">
              <div className="rounded-2xl border border-border shadow-sm overflow-hidden"
                style={{ background: bgColor === '#ffffff' ? '#f8fafc' : bgColor }}>
                {generating && (
                  <div className="w-[280px] h-[280px] flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-accent animate-spin" />
                  </div>
                )}
                {!generating && !hasData && (
                  <div className="w-[280px] h-[280px] flex flex-col items-center justify-center gap-2 text-center p-6">
                    <QrCode className="w-12 h-12 text-border-strong" strokeWidth={1} />
                    <p className="text-sm text-text-muted font-medium">Enter data to generate</p>
                  </div>
                )}
                <canvas
                  ref={previewRef}
                  className={(!generating && hasData) ? 'block max-w-full' : 'hidden'}
                  style={{ maxWidth: '100%', height: 'auto' }}
                />
              </div>
            </div>

            {/* Download section */}
            {qrObj && (
              <div className="w-full space-y-3">
                {/* Format selector */}
                <div>
                  <Label>Download Format</Label>
                  <div className="flex gap-1.5 flex-wrap">
                    {DOWNLOAD_FORMATS.map(f => (
                      <Pill key={f} active={dlFormat === f} onClick={() => setDlFormat(f)}>{f}</Pill>
                    ))}
                  </div>
                </div>

                {/* Size + Download button */}
                <div className="flex gap-2 items-stretch">
                  <div className="flex-1 bg-surface-2/60 rounded-xl border border-border px-3 py-2 flex items-center gap-2">
                    <span className="text-xs text-text-muted">Size:</span>
                    <span className="text-xs font-semibold text-text-primary">{size}×{size}px</span>
                  </div>
                  <button
                    onClick={() => handleDownload(dlFormat, size)}
                    className="flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-xl transition-all hover:opacity-90 active:scale-[0.98]"
                    style={{ background: 'linear-gradient(135deg, #2563EB, #3B82F6)' }}
                  >
                    <Download className="w-4 h-4" />
                    Download {dlFormat}
                  </button>
                </div>

                <p className="text-[11px] text-text-muted text-center">
                  Always test-scan before printing. Preview is {PREVIEW_SIZE}px; download is {size}px.
                </p>
              </div>
            )}
          </div>

          {/* History section */}
          {history.length > 0 && (
            <div className="border-t border-border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <History className="w-3.5 h-3.5 text-text-muted" />
                  <span className="text-xs font-semibold text-text-secondary uppercase tracking-wide">Recent QR Codes</span>
                </div>
                <button onClick={clearHistory} className="text-[11px] text-red-500 hover:underline flex items-center gap-1">
                  <Trash2 className="w-3 h-3" />Clear
                </button>
              </div>
              <div className="flex gap-2 flex-wrap overflow-x-auto pb-1">
                {history.slice(0, 10).map(item => (
                  <div key={item.id} className="flex flex-col items-center gap-1 group cursor-pointer"
                    title={item.qrData}
                    onClick={() => {
                      const a = document.createElement('a');
                      a.href = item.thumb; a.download = `qr-${item.id}.png`;
                      document.body.appendChild(a); a.click(); document.body.removeChild(a);
                    }}>
                    <div className="w-14 h-14 rounded-xl border border-border overflow-hidden bg-white group-hover:border-accent/60 transition-colors">
                      <img src={item.thumb} alt={item.type} className="w-full h-full object-contain" />
                    </div>
                    <span className="text-[10px] text-text-muted capitalize">{item.type}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}

// ── Dot style mini preview ──────────────────────────────────────
function DotStylePreview({ style, color }) {
  const size = 28;
  const grid = [[1,0,1],[0,1,0],[1,0,1]];
  const cell = size / 3;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block' }}>
      {grid.flatMap((row, r) => row.map((on, c) => {
        if (!on) return null;
        const x = c * cell, y = r * cell, cx = x + cell/2, cy = y + cell/2;
        const r2 = cell * 0.42;
        switch (style) {
          case 'dots':
            return <circle key={`${r}-${c}`} cx={cx} cy={cy} r={r2} fill={color} />;
          case 'rounded':
            return <rect key={`${r}-${c}`} x={x+0.5} y={y+0.5} width={cell-1} height={cell-1} rx={cell*0.3} fill={color} />;
          case 'diamond': {
            const h = cell * 0.47;
            return <polygon key={`${r}-${c}`} points={`${cx},${cy-h} ${cx+h},${cy} ${cx},${cy+h} ${cx-h},${cy}`} fill={color} />;
          }
          default:
            return <rect key={`${r}-${c}`} x={x} y={y} width={cell} height={cell} fill={color} />;
        }
      }))}
    </svg>
  );
}
