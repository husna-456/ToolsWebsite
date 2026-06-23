import { useState, useRef } from 'react';
import {
  Upload, X, Download, RefreshCw, AlertCircle, Check,
  Shield, ShieldAlert, ShieldCheck, MapPin, Camera,
  Clock, Code, User, FileImage, Loader2, Archive,
  ChevronDown, ChevronUp, ExternalLink, Trash2,
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────
let _exifr = null;
async function getExifr() {
  if (_exifr) return _exifr;
  const mod = await import('exifr');
  _exifr = mod.default || mod;
  return _exifr;
}

function makeEntry(file) {
  return {
    id: Math.random().toString(36).slice(2),
    file,
    name: file.name,
    sizeMB: (file.size / 1024 / 1024).toFixed(2),
    status: 'idle', // idle | reading | ready | processing | done | error
    error: null,
    meta: null,       // parsed metadata
    riskLevel: null,  // 'high' | 'medium' | 'low' | 'safe'
    badges: [],
    cleanBlob: null,
    cleanSizeMB: null,
    dimensions: null,
  };
}

function fmtDate(val) {
  if (!val) return null;
  if (val instanceof Date) return val.toLocaleString();
  if (typeof val === 'string') return val.replace('T', ' ').replace(/\.\d+Z?$/, '');
  return String(val);
}

function fmtExposure(val) {
  if (!val) return null;
  if (val < 1) return `1/${Math.round(1 / val)}s`;
  return `${val}s`;
}

async function parseFileMeta(file) {
  try {
    const exifr = await getExifr();
    const raw = await exifr.parse(file, {
      tiff: true, exif: true, gps: true, xmp: true, iptc: true,
      translateValues: true, translateKeys: true, reviveValues: true,
      ifd1: false, jfif: false, interop: false,
    });

    if (!raw) return { gps: null, camera: null, datetime: null, software: null, author: null, orientation: null, totalFields: 0 };

    const gps = {};
    if (raw.latitude  != null) gps.lat = raw.latitude;
    if (raw.longitude != null) gps.lng = raw.longitude;
    if (raw.GPSAltitude != null) gps.altitude = `${Math.round(raw.GPSAltitude)} m`;

    const camera = {};
    if (raw.Make)         camera.make = raw.Make;
    if (raw.Model)        camera.model = raw.Model;
    if (raw.LensModel)    camera.lens = raw.LensModel;
    if (raw.FocalLength)  camera.focalLength = `${raw.FocalLength} mm`;
    if (raw.FNumber)      camera.aperture = `f/${raw.FNumber}`;
    if (raw.ExposureTime) camera.shutterSpeed = fmtExposure(raw.ExposureTime);
    if (raw.ISO)          camera.iso = `ISO ${raw.ISO}`;
    if (raw.Flash != null) camera.flash = String(raw.Flash);
    if (raw.WhiteBalance) camera.whiteBalance = String(raw.WhiteBalance);

    const datetime = {};
    if (raw.DateTimeOriginal) datetime.taken    = fmtDate(raw.DateTimeOriginal);
    if (raw.CreateDate)       datetime.created  = fmtDate(raw.CreateDate);
    if (raw.ModifyDate)       datetime.modified = fmtDate(raw.ModifyDate);

    const software = {};
    if (raw.Software)           software.name = raw.Software;
    if (raw.ProcessingSoftware) software.processing = raw.ProcessingSoftware;

    const author = {};
    if (raw.Artist)    author.artist    = raw.Artist;
    if (raw.Copyright) author.copyright = raw.Copyright;
    if (raw.Creator)   author.creator   = raw.Creator;
    if (raw.XPAuthor)  author.xpAuthor  = raw.XPAuthor;

    const orientation = raw.Orientation ? String(raw.Orientation) : null;

    const totalFields = Object.keys(raw).length;

    return {
      gps:         Object.keys(gps).length > 0     ? gps     : null,
      camera:      Object.keys(camera).length > 0   ? camera   : null,
      datetime:    Object.keys(datetime).length > 0  ? datetime  : null,
      software:    Object.keys(software).length > 0  ? software  : null,
      author:      Object.keys(author).length > 0    ? author    : null,
      orientation,
      totalFields,
      exifImageWidth:  raw.ExifImageWidth  || raw.PixelXDimension || raw.ImageWidth  || null,
      exifImageHeight: raw.ExifImageHeight || raw.PixelYDimension || raw.ImageHeight || null,
    };
  } catch {
    return { gps: null, camera: null, datetime: null, software: null, author: null, orientation: null, totalFields: 0 };
  }
}

function getRisk(meta) {
  if (!meta) return { level: 'safe', badges: [] };
  const badges = [];
  if (meta.gps)      badges.push('GPS Found');
  if (meta.camera)   badges.push('Camera Info');
  if (meta.datetime) badges.push('Date Found');
  if (meta.software) badges.push('Software Info');
  if (meta.author)   badges.push('Author/Copyright');
  const level = meta.gps ? 'high'
              : (meta.camera && meta.datetime) ? 'medium'
              : badges.length > 0 ? 'low'
              : 'safe';
  return { level, badges };
}

async function stripMetadataCanvas(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width  = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const outType = file.type === 'image/png'  ? 'image/png'
                    : file.type === 'image/webp' ? 'image/webp'
                    : 'image/jpeg';
      canvas.toBlob(blob => {
        if (blob) resolve({ blob, width: img.naturalWidth, height: img.naturalHeight });
        else reject(new Error('Canvas export failed'));
      }, outType, outType === 'image/png' ? undefined : 0.97);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Image load failed')); };
    img.src = url;
  });
}

// ── Sub-components ─────────────────────────────────────────────
function RiskBadge({ level }) {
  const cfg = {
    high:   { label: 'HIGH RISK',   cls: 'bg-red-100 text-red-700 border-red-200',     icon: ShieldAlert },
    medium: { label: 'MEDIUM RISK', cls: 'bg-amber-100 text-amber-700 border-amber-200', icon: Shield },
    low:    { label: 'LOW RISK',    cls: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: Shield },
    safe:   { label: 'SAFE',        cls: 'bg-green-100 text-green-700 border-green-200', icon: ShieldCheck },
  }[level] || { label: 'UNKNOWN', cls: 'bg-gray-100 text-gray-600 border-gray-200', icon: Shield };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-bold ${cfg.cls}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function StatusBadge({ status }) {
  const cfg = {
    idle:       { label: 'Queued',      cls: 'bg-gray-100 text-gray-500' },
    reading:    { label: 'Reading…',    cls: 'bg-blue-100 text-blue-600' },
    ready:      { label: 'Ready',       cls: 'bg-purple-100 text-purple-700' },
    processing: { label: 'Processing…', cls: 'bg-amber-100 text-amber-700' },
    done:       { label: 'Clean ✓',     cls: 'bg-green-100 text-green-700' },
    error:      { label: 'Error',       cls: 'bg-red-100 text-red-600' },
  }[status] || { label: status, cls: 'bg-gray-100 text-gray-500' };
  return <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${cfg.cls}`}>{cfg.label}</span>;
}

function MetaRow({ icon: Icon, label, value, href }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 py-1.5 border-b border-border/40 last:border-0">
      <Icon className="w-3.5 h-3.5 text-text-muted mt-0.5 shrink-0" />
      <span className="text-xs text-text-muted w-28 shrink-0">{label}</span>
      <span className="text-xs font-medium text-text-primary flex-1 break-words">
        {href ? <a href={href} target="_blank" rel="noreferrer" className="text-accent hover:underline flex items-center gap-1">{value}<ExternalLink className="w-2.5 h-2.5" /></a> : value}
      </span>
    </div>
  );
}

function SectionCard({ title, icon: Icon, children, className = '' }) {
  return (
    <div className={`rounded-xl border border-border bg-white ${className}`}>
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-surface-2/40 rounded-t-xl">
        <Icon className="w-4 h-4 text-text-muted" />
        <span className="text-xs font-bold text-text-secondary uppercase tracking-wide">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────
const ACCEPT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_FILE_MB  = 20;

const REMOVAL_OPTS = [
  { key: 'gps',      label: 'GPS / Location',    icon: MapPin },
  { key: 'camera',   label: 'Camera & Device',   icon: Camera },
  { key: 'datetime', label: 'Date & Time',        icon: Clock },
  { key: 'software', label: 'Software Info',      icon: Code },
  { key: 'author',   label: 'Author / Copyright', icon: User },
];

export default function MetadataExifTool() {
  const [entries,    setEntries]    = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [removing,   setRemoving]   = useState({ gps: true, camera: true, datetime: true, software: true, author: true });
  const [processing, setProcessing] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);
  const [dragOver,   setDragOver]   = useState(false);
  const inputRef = useRef(null);

  const selected = entries.find(e => e.id === selectedId) ?? entries[0] ?? null;

  // ── File add ────────────────────────────────────────────────
  function addFiles(fileList) {
    const arr = Array.from(fileList || []);
    const valid = arr.filter(f => ACCEPT_TYPES.includes(f.type) && f.size <= MAX_FILE_MB * 1024 * 1024);
    const invalid = arr.filter(f => !ACCEPT_TYPES.includes(f.type));
    if (valid.length === 0 && invalid.length > 0) return;

    const newEntries = valid.map(makeEntry);
    setEntries(prev => {
      const next = [...prev, ...newEntries];
      return next;
    });
    setSelectedId(prev => prev || newEntries[0]?.id || null);
    newEntries.forEach(e => readMeta(e.id, e.file));
  }

  async function readMeta(id, file) {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status: 'reading' } : e));
    const meta = await parseFileMeta(file);
    const { level, badges } = getRisk(meta);
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status: 'ready', meta, riskLevel: level, badges } : e));
  }

  // ── Process ─────────────────────────────────────────────────
  async function processEntry(id) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status: 'processing', error: null } : e));
    try {
      const { blob, width, height } = await stripMetadataCanvas(entry.file);
      setEntries(prev => prev.map(e => e.id === id ? {
        ...e, status: 'done', cleanBlob: blob,
        cleanSizeMB: (blob.size / 1024 / 1024).toFixed(2),
        dimensions: { width, height },
      } : e));
    } catch (err) {
      setEntries(prev => prev.map(e => e.id === id ? { ...e, status: 'error', error: err.message } : e));
    }
  }

  async function processAll() {
    setProcessing(true);
    const toRun = entries.filter(e => e.status === 'ready' || e.status === 'idle');
    for (const entry of toRun) await processEntry(entry.id);
    setProcessing(false);
  }

  // ── Download ────────────────────────────────────────────────
  function downloadOne(entry) {
    if (!entry.cleanBlob) return;
    const ext  = entry.file.name.split('.').pop() || 'jpg';
    const name = entry.file.name.replace(/\.[^.]+$/, '') + '_clean.' + ext;
    const url  = URL.createObjectURL(entry.cleanBlob);
    const a    = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function downloadZip() {
    const done = entries.filter(e => e.cleanBlob);
    if (!done.length) return;
    setZipLoading(true);
    try {
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      done.forEach(e => {
        const ext  = e.file.name.split('.').pop() || 'jpg';
        const name = e.file.name.replace(/\.[^.]+$/, '') + '_clean.' + ext;
        zip.file(name, e.cleanBlob);
      });
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 3 } });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url; a.download = 'cleaned_images.zip';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (err) {
      console.error('ZIP error:', err);
    } finally {
      setZipLoading(false);
    }
  }

  // ── UI helpers ───────────────────────────────────────────────
  function removeEntry(id) {
    setEntries(prev => {
      const next = prev.filter(e => e.id !== id);
      if (selectedId === id) setSelectedId(next[0]?.id || null);
      return next;
    });
  }

  function clearAll() {
    setEntries([]);
    setSelectedId(null);
    if (inputRef.current) inputRef.current.value = '';
  }

  const doneCount  = entries.filter(e => e.status === 'done').length;
  const readyCount = entries.filter(e => e.status === 'ready' || e.status === 'idle').length;
  const allRemovingKeys = Object.values(removing).every(Boolean);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="panel-card shadow-lg">

      {/* ── Upload zone ─────────────────────────────────────── */}
      {entries.length === 0 ? (
        <div className="p-8">
          <label
            className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed cursor-pointer py-16 transition-all ${
              dragOver ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/60 hover:bg-surface-2/40'
            }`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
          >
            <div className="w-16 h-16 rounded-2xl bg-surface-2 border border-border flex items-center justify-center">
              <Shield className="w-7 h-7 text-text-muted" />
            </div>
            <div className="text-center">
              <p className="font-bold text-text-primary text-base">Drop images to scan & clean metadata</p>
              <p className="text-sm text-text-muted mt-1">JPG, PNG, WEBP · up to {MAX_FILE_MB} MB each · multiple files supported</p>
            </div>
            <span className="btn-primary px-6 py-2 text-sm">Browse Files</span>
            <input ref={inputRef} type="file" multiple accept={ACCEPT_TYPES.join(',')} className="sr-only"
              onChange={e => addFiles(e.target.files)} />
          </label>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] divide-y lg:divide-y-0 lg:divide-x divide-border min-h-[520px]">

          {/* ── LEFT: File list ────────────────────────────── */}
          <div className="flex flex-col">
            <div className="panel-header">
              <span className="text-sm font-semibold text-text-primary">
                Files <span className="text-text-muted font-normal">({entries.length})</span>
              </span>
              <div className="flex gap-1.5">
                <label className="btn-ghost text-xs cursor-pointer gap-1">
                  <Upload className="w-3 h-3" />Add
                  <input type="file" multiple accept={ACCEPT_TYPES.join(',')} className="sr-only"
                    onChange={e => addFiles(e.target.files)} />
                </label>
                <button onClick={clearAll} className="btn-ghost text-xs gap-1">
                  <Trash2 className="w-3 h-3" />Clear all
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2" style={{ maxHeight: '70vh' }}>
              {entries.map(entry => (
                <div
                  key={entry.id}
                  onClick={() => setSelectedId(entry.id)}
                  className={`flex items-center gap-2 p-3 rounded-xl cursor-pointer transition-all border ${
                    selectedId === entry.id
                      ? 'border-accent bg-accent/5'
                      : 'border-border hover:border-accent/40 bg-white'
                  }`}
                >
                  <FileImage className="w-4 h-4 text-text-muted shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-text-primary truncate">{entry.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <StatusBadge status={entry.status} />
                      {entry.riskLevel && <RiskBadge level={entry.riskLevel} />}
                    </div>
                  </div>
                  <button
                    onClick={ev => { ev.stopPropagation(); removeEntry(entry.id); }}
                    className="text-text-muted hover:text-red-500 shrink-0 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Batch actions */}
            <div className="p-3 border-t border-border space-y-2">
              <button
                onClick={processAll}
                disabled={processing || readyCount === 0}
                className="btn-primary w-full text-sm h-9 gap-2 disabled:opacity-50"
              >
                {processing ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Processing…</> : `Remove Metadata (${readyCount} file${readyCount !== 1 ? 's' : ''})`}
              </button>
              {doneCount > 1 && (
                <button
                  onClick={downloadZip}
                  disabled={zipLoading}
                  className="btn-secondary w-full text-sm h-9 gap-2"
                >
                  {zipLoading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Creating ZIP…</> : <><Archive className="w-3.5 h-3.5" />Download ZIP ({doneCount} files)</>}
                </button>
              )}
            </div>
          </div>

          {/* ── RIGHT: Selected file details ───────────────── */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ maxHeight: '85vh' }}>
            {!selected ? (
              <div className="flex items-center justify-center h-64 text-text-muted text-sm">Select a file to see details</div>
            ) : (
              <>
                {/* File info header */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-text-primary">{selected.name}</p>
                    <p className="text-xs text-text-muted mt-0.5">
                      {selected.sizeMB} MB
                      {selected.dimensions ? ` · ${selected.dimensions.width} × ${selected.dimensions.height} px` : ''}
                      {selected.meta?.exifImageWidth ? ` · ${selected.meta.exifImageWidth} × ${selected.meta.exifImageHeight} px (EXIF)` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={selected.status} />
                    {selected.riskLevel && <RiskBadge level={selected.riskLevel} />}
                  </div>
                </div>

                {/* Error */}
                {selected.error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {selected.error}
                  </div>
                )}

                {/* Loading state */}
                {selected.status === 'reading' && (
                  <div className="flex items-center gap-2 p-4 bg-surface-2/60 rounded-xl text-sm text-text-muted">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Reading metadata…
                  </div>
                )}

                {/* Privacy Risk Summary */}
                {selected.meta && selected.riskLevel && (
                  <SectionCard title="Privacy Risk" icon={ShieldAlert}>
                    <div className="flex items-center gap-3 mb-3">
                      <RiskBadge level={selected.riskLevel} />
                      <span className="text-xs text-text-muted">
                        {selected.riskLevel === 'high'   ? 'GPS location detected — this file can reveal where it was taken.' :
                         selected.riskLevel === 'medium' ? 'Device & timestamp info present.' :
                         selected.riskLevel === 'low'    ? 'Some non-critical metadata detected.' :
                         'No sensitive metadata found.'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selected.badges.length === 0 ? (
                        <span className="text-xs text-green-600 font-medium flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5" />No sensitive metadata detected</span>
                      ) : selected.badges.map(b => (
                        <span key={b} className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                          b === 'GPS Found' ? 'bg-red-100 text-red-700 border-red-200' :
                          b === 'Camera Info' || b === 'Date Found' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                          'bg-gray-100 text-gray-600 border-gray-200'
                        }`}>{b}</span>
                      ))}
                    </div>
                  </SectionCard>
                )}

                {/* Metadata Preview */}
                {selected.meta && selected.meta.totalFields > 0 && (
                  <SectionCard title={`Metadata Found (${selected.meta.totalFields} fields)`} icon={FileImage}>
                    <div className="space-y-3">
                      {selected.meta.gps && (
                        <div>
                          <p className="text-[10px] font-bold text-red-600 uppercase mb-1 flex items-center gap-1"><MapPin className="w-3 h-3" />GPS Location</p>
                          <MetaRow icon={MapPin} label="Coordinates"
                            value={`${selected.meta.gps.lat?.toFixed(6)}, ${selected.meta.gps.lng?.toFixed(6)}`}
                            href={`https://www.google.com/maps?q=${selected.meta.gps.lat},${selected.meta.gps.lng}`}
                          />
                          <MetaRow icon={MapPin} label="Altitude" value={selected.meta.gps.altitude} />
                        </div>
                      )}
                      {selected.meta.camera && (
                        <div>
                          <p className="text-[10px] font-bold text-amber-600 uppercase mb-1 flex items-center gap-1"><Camera className="w-3 h-3" />Camera / Device</p>
                          {Object.entries(selected.meta.camera).map(([k, v]) => (
                            <MetaRow key={k} icon={Camera} label={k.charAt(0).toUpperCase() + k.slice(1)} value={v} />
                          ))}
                        </div>
                      )}
                      {selected.meta.datetime && (
                        <div>
                          <p className="text-[10px] font-bold text-amber-600 uppercase mb-1 flex items-center gap-1"><Clock className="w-3 h-3" />Date & Time</p>
                          <MetaRow icon={Clock} label="Date Taken"  value={selected.meta.datetime.taken} />
                          <MetaRow icon={Clock} label="Created"     value={selected.meta.datetime.created} />
                          <MetaRow icon={Clock} label="Modified"    value={selected.meta.datetime.modified} />
                        </div>
                      )}
                      {selected.meta.software && (
                        <div>
                          <p className="text-[10px] font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><Code className="w-3 h-3" />Software</p>
                          {Object.entries(selected.meta.software).map(([k, v]) => (
                            <MetaRow key={k} icon={Code} label={k.charAt(0).toUpperCase() + k.slice(1)} value={v} />
                          ))}
                        </div>
                      )}
                      {selected.meta.author && (
                        <div>
                          <p className="text-[10px] font-bold text-gray-500 uppercase mb-1 flex items-center gap-1"><User className="w-3 h-3" />Author / Copyright</p>
                          {Object.entries(selected.meta.author).map(([k, v]) => (
                            <MetaRow key={k} icon={User} label={k.charAt(0).toUpperCase() + k.slice(1)} value={v} />
                          ))}
                        </div>
                      )}
                      {selected.meta.orientation && (
                        <MetaRow icon={FileImage} label="Orientation" value={selected.meta.orientation} />
                      )}
                    </div>
                  </SectionCard>
                )}

                {selected.meta && selected.meta.totalFields === 0 && (
                  <SectionCard title="Metadata Found" icon={ShieldCheck}>
                    <p className="text-sm text-green-600 flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" />
                      No sensitive metadata found in this file.
                    </p>
                  </SectionCard>
                )}

                {/* Removal options */}
                {(selected.status === 'ready' || selected.status === 'idle') && (
                  <SectionCard title="Removal Options" icon={Shield}>
                    <div className="space-y-2 mb-3">
                      {REMOVAL_OPTS.map(({ key, label, icon: Icon }) => (
                        <label key={key} className="flex items-center gap-2.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={removing[key]}
                            onChange={e => setRemoving(prev => ({ ...prev, [key]: e.target.checked }))}
                            className="accent-accent w-4 h-4 rounded"
                          />
                          <Icon className="w-3.5 h-3.5 text-text-muted" />
                          <span className="text-sm text-text-secondary">{label}</span>
                          {selected.meta?.[key] && (
                            <span className="text-[10px] font-bold text-red-600 ml-auto">FOUND</span>
                          )}
                        </label>
                      ))}
                    </div>
                    <label className="flex items-center gap-2.5 cursor-pointer pt-2 border-t border-border">
                      <input
                        type="checkbox"
                        checked={allRemovingKeys}
                        onChange={e => setRemoving({ gps: e.target.checked, camera: e.target.checked, datetime: e.target.checked, software: e.target.checked, author: e.target.checked })}
                        className="accent-accent w-4 h-4 rounded"
                      />
                      <span className="text-sm font-semibold text-text-primary">Remove all metadata</span>
                    </label>
                    <p className="text-[11px] text-text-muted mt-3 bg-surface-2/60 rounded-lg p-2.5">
                      Metadata is stripped by re-exporting through browser canvas, which removes <strong>all</strong> embedded metadata regardless of selection — ensuring maximum privacy.
                    </p>
                    <button
                      onClick={() => processEntry(selected.id)}
                      disabled={selected.status === 'processing'}
                      className="btn-primary w-full mt-3 h-10 text-sm gap-2"
                    >
                      {selected.status === 'processing'
                        ? <><Loader2 className="w-4 h-4 animate-spin" />Processing…</>
                        : <><Shield className="w-4 h-4" />Remove Metadata</>}
                    </button>
                  </SectionCard>
                )}

                {/* Result / Before-After */}
                {selected.status === 'done' && (
                  <SectionCard title="Result" icon={ShieldCheck}>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div className="text-center p-3 bg-red-50 rounded-xl border border-red-100">
                        <p className="text-xs text-red-600 font-semibold mb-1">Before</p>
                        <p className="text-xl font-bold text-red-700">{selected.meta?.totalFields ?? '—'}</p>
                        <p className="text-[11px] text-red-500">metadata fields</p>
                        <p className="text-[11px] text-red-400 mt-0.5">{selected.sizeMB} MB</p>
                      </div>
                      <div className="text-center p-3 bg-green-50 rounded-xl border border-green-100">
                        <p className="text-xs text-green-600 font-semibold mb-1">After</p>
                        <p className="text-xl font-bold text-green-700">0</p>
                        <p className="text-[11px] text-green-500">metadata fields</p>
                        <p className="text-[11px] text-green-400 mt-0.5">{selected.cleanSizeMB} MB</p>
                      </div>
                    </div>

                    {selected.badges.length > 0 ? (
                      <div className="mb-4 p-2.5 bg-green-50 border border-green-100 rounded-lg">
                        <p className="text-xs font-semibold text-green-700 mb-1.5">
                          {selected.meta?.totalFields} fields removed including:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {selected.badges.map(b => (
                            <span key={b} className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 line-through decoration-green-400">
                              {b}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-green-600 mb-4 flex items-center gap-1.5">
                        <ShieldCheck className="w-3.5 h-3.5" />
                        No sensitive metadata was present — image is already clean.
                      </p>
                    )}

                    {selected.dimensions && (
                      <p className="text-xs text-text-muted mb-3">
                        Original resolution preserved: {selected.dimensions.width} × {selected.dimensions.height} px
                      </p>
                    )}

                    <button onClick={() => downloadOne(selected)} className="btn-primary w-full h-10 text-sm gap-2">
                      <Download className="w-4 h-4" />
                      Download Clean Image
                    </button>
                    <button onClick={() => processEntry(selected.id)} className="btn-ghost w-full mt-2 text-xs gap-1.5">
                      <RefreshCw className="w-3 h-3" />
                      Re-process
                    </button>
                  </SectionCard>
                )}

              </>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
