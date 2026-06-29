import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Upload, X, AlertCircle, Loader2, Check,
  RefreshCw, Music, Film, Plus,
} from 'lucide-react';
import { useFileUpload } from '@/hooks/useFileUpload';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'https://globaltechtools.thefiveriverz.com';

const AUDIO_ONLY_SLUGS = ['audio-converter', 'audio-compressor', 'audio-trimmer'];
const AUDIO_IN_SLUGS   = [...AUDIO_ONLY_SLUGS, 'audio-merger'];
const MULTI_SLUGS      = ['audio-merger', 'video-merger'];
const DUAL_SLUGS       = ['hardcode-subtitles'];
const VOLUME_SLUG      = 'audio-volume-booster';
const TRIMMER_SLUGS    = ['video-trimmer', 'audio-trimmer', 'video-to-gif', 'video-to-webp', 'video-to-apng'];

// Parses "MM:SS", "M:SS", or plain seconds string → float seconds (NaN if invalid)
function parseTimeInput(val) {
  const s = String(val ?? '').trim();
  if (s === '') return NaN;
  if (/^\d+(\.\d+)?$/.test(s)) return parseFloat(s);
  const m = s.match(/^(\d+):([0-5]?\d)(\.\d+)?$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10) + parseFloat(m[3] || 0);
  return NaN;
}

function fmtTime(totalSec) {
  if (totalSec == null || isNaN(totalSec)) return '';
  const s = Math.floor(totalSec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const AUDIO_MAX_MB = 500;
const VIDEO_MAX_MB = 500;

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

function TrimTimeInput({ label, value, onChange, placeholder, maxSeconds }) {
  const [raw, setRaw] = useState(() => {
    const n = parseFloat(value);
    return (!isNaN(n) && n > 0) ? String(n) : '';
  });

  function handleChange(e) {
    const text = e.target.value;
    setRaw(text);
    const parsed = parseTimeInput(text);
    onChange(isNaN(parsed) ? '' : parsed);
  }

  const parsed   = parseTimeInput(raw);
  const hasColon = raw.includes(':');
  const isInvalid  = raw !== '' && isNaN(parsed);
  const exceedsMax = maxSeconds != null && !isNaN(parsed) && parsed > maxSeconds;

  return (
    <div>
      <Label>{label}</Label>
      <input
        type="text"
        value={raw}
        onChange={handleChange}
        placeholder={placeholder || 'MM:SS or seconds'}
        className={`input-field ${isInvalid || exceedsMax ? 'border-red-400 focus:border-red-400' : ''}`}
      />
      {hasColon && !isNaN(parsed) && (
        <p className="text-[11px] text-text-muted mt-1">= {parsed}s</p>
      )}
      {isInvalid && (
        <p className="text-[11px] text-red-400 mt-1">Use MM:SS or plain seconds</p>
      )}
      {exceedsMax && !isInvalid && (
        <p className="text-[11px] text-red-400 mt-1">Exceeds video duration</p>
      )}
    </div>
  );
}

function ToolOptions({ slug, opts, set, extra = {} }) {
  switch (slug) {

    case 'audio-converter':
      return (
        <div>
          <Label>Output Format</Label>
          <div className="flex gap-2 flex-wrap">
            {[['mp3','MP3'],['wav','WAV'],['ogg','OGG'],['m4a','M4A']].map(([val, label]) => (
              <Pill key={val} active={(opts.format ?? 'mp3') === val} onClick={() => set('format')(val)}>
                {label}
              </Pill>
            ))}
          </div>
        </div>
      );

    case 'audio-compressor':
      return (
        <div>
          <Label>Bitrate</Label>
          <div className="flex gap-2 flex-wrap">
            {[['64k','64 kbps'],['96k','96 kbps'],['128k','128 kbps'],['192k','192 kbps'],['256k','256 kbps'],['320k','320 kbps']].map(([val, label]) => (
              <Pill key={val} active={(opts.bitrate ?? '128k') === val} onClick={() => set('bitrate')(val)}>
                {label}
              </Pill>
            ))}
          </div>
          <p className="text-[11px] text-text-muted mt-1.5">Lower bitrate = smaller file · Higher = better quality</p>
        </div>
      );

    case 'audio-trimmer':
    case 'video-trimmer': {
      const dur      = extra.mediaDuration;
      const startSec = parseTimeInput(String(opts.start ?? 0)) || 0;
      const endSec   = parseTimeInput(String(opts.end ?? ''));
      const orderErr = !isNaN(endSec) && opts.end !== '' && endSec <= startSec;
      return (
        <div className="space-y-2.5">
          {dur != null && (
            <div className="flex items-center gap-1.5 text-[11px] bg-surface-2 border border-border rounded-lg px-3 py-2">
              <span className="text-text-muted">Duration:</span>
              <span className="font-semibold text-text-primary">{fmtTime(dur)}</span>
              <span className="text-text-muted">({Math.round(dur)}s)</span>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <TrimTimeInput
              key={`start-${extra.fileKey}`}
              label="Start Time"
              value={opts.start ?? 0}
              onChange={set('start')}
              placeholder="0 or MM:SS"
              maxSeconds={dur}
            />
            <TrimTimeInput
              key={`end-${extra.fileKey}`}
              label="End Time"
              value={opts.end ?? ''}
              onChange={set('end')}
              placeholder="MM:SS or seconds"
              maxSeconds={dur}
            />
          </div>
          {orderErr && (
            <p className="text-[11px] text-red-400">End time must be after start time</p>
          )}
        </div>
      );
    }

    case 'video-converter':
      return (
        <div>
          <Label>Output Format</Label>
          <div className="flex gap-2 flex-wrap">
            {[['mp4','MP4'],['webm','WebM'],['mov','MOV'],['avi','AVI']].map(([val, label]) => (
              <Pill key={val} active={(opts.format ?? 'mp4') === val} onClick={() => set('format')(val)}>
                {label}
              </Pill>
            ))}
          </div>
        </div>
      );

    case 'video-compressor':
      return (
        <div>
          <Label>Quality</Label>
          <div className="flex gap-2 flex-wrap">
            {[['low','Low (smallest)'],['medium','Medium'],['high','High (best)']].map(([val, label]) => (
              <Pill key={val} active={(opts.quality ?? 'medium') === val} onClick={() => set('quality')(val)}>
                {label}
              </Pill>
            ))}
          </div>
        </div>
      );

    case 'video-to-gif':
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <TrimTimeInput key={`start-${extra.fileKey}`} label="Start Time" value={opts.start ?? 0}  onChange={set('start')} placeholder="0 or MM:SS" maxSeconds={extra.mediaDuration} />
            <TrimTimeInput key={`end-${extra.fileKey}`}   label="End Time"   value={opts.end   ?? ''} onChange={set('end')}   placeholder="MM:SS or seconds" maxSeconds={extra.mediaDuration} />
          </div>
          <div>
            <Label>Frame Rate</Label>
            <div className="flex gap-2 flex-wrap">
              {[[5,'5 fps'],[10,'10 fps'],[15,'15 fps'],[20,'20 fps']].map(([val, label]) => (
                <Pill key={val} active={(opts.fps ?? 10) === val} onClick={() => set('fps')(val)}>
                  {label}
                </Pill>
              ))}
            </div>
          </div>
          <div>
            <Label>Width (px)</Label>
            <input type="number" min="100" max="1000" step="10" value={opts.width ?? 480}
              onChange={e => set('width')(Number(e.target.value))} placeholder="480" className="input-field" />
          </div>
        </div>
      );

    case 'change-video-speed':
      return (
        <div>
          <Label>Speed</Label>
          <div className="flex gap-2 flex-wrap">
            {[[0.25,'0.25×'],[0.5,'0.5×'],[0.75,'0.75×'],[1.25,'1.25×'],[1.5,'1.5×'],[2,'2×']].map(([val, label]) => (
              <Pill key={val} active={(opts.speed ?? 1.5) === val} onClick={() => set('speed')(val)}>
                {label}
              </Pill>
            ))}
          </div>
        </div>
      );

    case 'audio-extractor':
      return (
        <div>
          <Label>Output Format</Label>
          <div className="flex gap-2 flex-wrap">
            {[['mp3', 'MP3'], ['wav', 'WAV']].map(([val, label]) => (
              <Pill key={val} active={(opts.format ?? 'mp3') === val} onClick={() => set('format')(val)}>
                {label}
              </Pill>
            ))}
          </div>
          <p className="text-[11px] text-text-muted mt-1.5">MP3 for sharing · WAV for lossless editing</p>
        </div>
      );

    case 'video-to-webp':
    case 'video-to-apng':
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <TrimTimeInput key={`start-${extra.fileKey}`} label="Start Time" value={opts.start ?? 0}  onChange={set('start')} placeholder="0 or MM:SS" maxSeconds={extra.mediaDuration} />
            <TrimTimeInput key={`end-${extra.fileKey}`}   label="End Time"   value={opts.end   ?? ''} onChange={set('end')}   placeholder="MM:SS or seconds" maxSeconds={extra.mediaDuration} />
          </div>
          <div>
            <Label>Frame Rate</Label>
            <div className="flex gap-2 flex-wrap">
              {[[5,'5 fps'],[10,'10 fps'],[15,'15 fps'],[20,'20 fps']].map(([val, label]) => (
                <Pill key={val} active={(opts.fps ?? 10) === val} onClick={() => set('fps')(val)}>
                  {label}
                </Pill>
              ))}
            </div>
          </div>
          <div>
            <Label>Width (px)</Label>
            <input type="number" min="100" max="800" step="10" value={opts.width ?? 480}
              onChange={e => set('width')(Number(e.target.value))} placeholder="480" className="input-field" />
          </div>
        </div>
      );

    case 'video-rotate-flip':
      return (
        <div className="space-y-3">
          <div>
            <Label>Rotation</Label>
            <div className="flex gap-2 flex-wrap">
              {[['0','None'],['90','90° CW'],['180','180°'],['270','270° CW']].map(([val, label]) => (
                <Pill key={val} active={(opts.rotate ?? '0') === val} onClick={() => set('rotate')(val)}>
                  {label}
                </Pill>
              ))}
            </div>
          </div>
          <div>
            <Label>Flip</Label>
            <div className="flex gap-2 flex-wrap">
              {[['none','None'],['horizontal','Horizontal'],['vertical','Vertical']].map(([val, label]) => (
                <Pill key={val} active={(opts.flip ?? 'none') === val} onClick={() => set('flip')(val)}>
                  {label}
                </Pill>
              ))}
            </div>
          </div>
        </div>
      );

    case 'audio-merger':
      return (
        <div>
          <Label>Merge Mode</Label>
          <div className="flex gap-2 flex-wrap">
            <Pill active={(opts.mode ?? 'sequential') === 'sequential'} onClick={() => set('mode')('sequential')}>
              Sequential (one after another)
            </Pill>
            <Pill active={(opts.mode ?? 'sequential') === 'overlay'} onClick={() => set('mode')('overlay')}>
              Overlay (mix together)
            </Pill>
          </div>
          <div className="mt-3">
            <Label>Output Format</Label>
            <div className="flex gap-2">
              {[['mp3','MP3'],['wav','WAV']].map(([val, label]) => (
                <Pill key={val} active={(opts.outputFormat ?? 'mp3') === val} onClick={() => set('outputFormat')(val)}>
                  {label}
                </Pill>
              ))}
            </div>
          </div>
        </div>
      );

    case 'video-merger':
      return (
        <p className="text-xs text-text-muted">Videos will be merged sequentially. All clips are normalized to 1280×720 before merging.</p>
      );

    case 'video-watermarker':
      return (
        <div className="space-y-3">
          <div>
            <Label>Watermark Text</Label>
            <input type="text" value={opts.text ?? ''} onChange={e => set('text')(e.target.value)}
              placeholder="Your watermark text" className="input-field" maxLength={60} />
          </div>
          <div>
            <Label>Position</Label>
            <div className="flex gap-2 flex-wrap">
              {[['topLeft','Top Left'],['topRight','Top Right'],['center','Center'],['bottomLeft','Bottom Left'],['bottomRight','Bottom Right']].map(([val, label]) => (
                <Pill key={val} active={(opts.position ?? 'bottomRight') === val} onClick={() => set('position')(val)}>
                  {label}
                </Pill>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Font Size</Label>
              <input type="number" min="12" max="72" value={opts.fontSize ?? 24}
                onChange={e => set('fontSize')(e.target.value)} className="input-field" />
            </div>
            <div>
              <Label>Opacity (%)</Label>
              <input type="number" min="10" max="100" value={opts.opacity ?? 70}
                onChange={e => set('opacity')(e.target.value)} className="input-field" />
            </div>
          </div>
        </div>
      );

    case 'audio-volume-booster':
      return (
        <div>
          <Label>Volume Boost</Label>
          <div className="flex gap-2 flex-wrap">
            {[[3,'3 dB'],[5,'5 dB'],[8,'8 dB'],[10,'10 dB'],[15,'15 dB'],[20,'20 dB']].map(([val, label]) => (
              <Pill key={val} active={(opts.boostDb ?? 5) === val} onClick={() => set('boostDb')(val)}>
                {label}
              </Pill>
            ))}
          </div>
          <p className="text-[11px] text-text-muted mt-1.5">Works on both audio and video files</p>
        </div>
      );

    // mute-video, hardcode-subtitles: no inline options panel (handled separately)
    default:
      return null;
  }
}

function ProgressBar({ value, processingLabel = 'Processing…' }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-text-muted">
        <span>{value < 65 ? 'Uploading…' : value < 95 ? processingLabel : 'Finalising…'}</span>
        <span>{value}%</span>
      </div>
      <div className="h-2 bg-surface-2 rounded-full overflow-hidden border border-border">
        <div className="h-full rounded-full bg-brand-gradient transition-all duration-300"
          style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function FileChip({ file, onRemove }) {
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border bg-surface-2/60 text-sm">
      <Film className="w-3.5 h-3.5 text-accent shrink-0" />
      <span className="flex-1 truncate text-text-primary text-xs">{file.name}</span>
      <span className="text-text-muted text-[11px] shrink-0">{(file.size/1024/1024).toFixed(1)} MB</span>
      <button onClick={onRemove} className="text-text-muted hover:text-red-500 transition-colors shrink-0">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function MediaToolShell({ tool }) {
  const { slug } = tool;

  const isMultiUpload   = MULTI_SLUGS.includes(slug);
  const isDualUpload    = DUAL_SLUGS.includes(slug);
  const isAudioIn       = AUDIO_IN_SLUGS.includes(slug);
  const isVolumeBooster = slug === VOLUME_SLUG;

  const acceptsAudio = isAudioIn && !isVolumeBooster;
  const maxMb        = acceptsAudio ? AUDIO_MAX_MB : VIDEO_MAX_MB;
  const accept       = isVolumeBooster
    ? 'audio/*,video/mp4,video/webm,video/quicktime,.mp3,.wav,.ogg,.m4a,.mp4,.mov,.webm'
    : acceptsAudio
    ? 'audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac,.aiff,.aif,.wma,.amr,.opus,.webm,.mpeg,.mpg'
    : 'video/*,video/mp4,video/webm,video/quicktime,video/x-msvideo,.mp4,.webm,.mov,.avi';
  const fileTypeLabel = acceptsAudio ? 'audio' : 'video';
  const FileIcon      = acceptsAudio ? Music : Film;

  const { upload, loading, error, progress, reset } = useFileUpload(slug);

  // Single-file state
  const [file,        setFile]        = useState(null);
  // Multi-file state (audio-merger, video-merger)
  const [files,       setFiles]       = useState([]);
  // Dual-file state (hardcode-subtitles)
  const [subtitleFile, setSubtitleFile] = useState(null);

  const [opts,          setOpts]          = useState({});
  const [done,          setDone]          = useState(false);
  const [fileError,     setFileError]     = useState('');
  const [dragging,      setDragging]      = useState(false);
  const [mediaDuration, setMediaDuration] = useState(null);
  // Key-based input remounting — lets the user reselect the same file without clearing value mid-click
  const [fileInputKey, setFileInputKey] = useState(0);
  const [subInputKey,  setSubInputKey]  = useState(0);

  const isTrimmerSlug = TRIMMER_SLUGS.includes(slug);

  // Detect media duration from browser after file is selected (for trimmer tools)
  useEffect(() => {
    if (!isTrimmerSlug || !file) { setMediaDuration(null); return; }
    const url = URL.createObjectURL(file);
    const el  = file.type.startsWith('audio/') ? new Audio() : document.createElement('video');
    el.preload = 'metadata';
    el.onloadedmetadata = () => { setMediaDuration(el.duration); URL.revokeObjectURL(url); };
    el.onerror = () => { setMediaDuration(null); URL.revokeObjectURL(url); };
    el.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file, isTrimmerSlug]);

  const inputRef    = useRef(null);
  const multiRef    = useRef(null);
  const subtitleRef = useRef(null);

  // Unique IDs for label→input association (htmlFor) — required for mobile file picker
  const fileInputId  = `media-file-${slug}`;
  const multiInputId = `media-multi-${slug}`;
  const subInputId   = `media-sub-${slug}`;
  // Visually hidden: keeps input in layout so htmlFor works on all mobile browsers
  const hiddenInput  = { position: 'absolute', width: 0, height: 0, opacity: 0, overflow: 'hidden', pointerEvents: 'none' };

  const set = useCallback(key => val => setOpts(prev => ({ ...prev, [key]: val })), []);

  // ── Audio-converter: real FFmpeg progress via SSE ──────────
  const isAudioConverter = slug === 'audio-converter';
  const [ssePercent, setSsePercent] = useState(0);
  const [etaSeconds, setEtaSeconds] = useState(null);
  const sseRef    = useRef(null);
  const jobIdRef  = useRef(null);

  // Clean up SSE on unmount
  useEffect(() => () => { if (sseRef.current) sseRef.current.close(); }, []);

  function openAudioSSE(jobId) {
    if (sseRef.current) sseRef.current.close();
    setSsePercent(0);
    setEtaSeconds(null);
    const es = new EventSource(`${API_BASE_URL}/api/tools/audio-converter/progress/${jobId}`);
    sseRef.current = es;
    es.onmessage = (e) => {
      try {
        const { percent, eta } = JSON.parse(e.data);
        setSsePercent(percent ?? 0);
        setEtaSeconds(eta ?? null);
        if (percent >= 100) { es.close(); sseRef.current = null; }
      } catch {}
    };
    es.onerror = () => { es.close(); sseRef.current = null; };
  }

  // Blend upload progress (0-60%) with SSE conversion progress (60-99%)
  const displayProgress = isAudioConverter && loading
    ? ssePercent > 0
      ? Math.round(60 + (ssePercent / 100) * 38)
      : progress
    : progress;

  // ── File validation ────────────────────────────────────────
  // Extension is checked first — Android and Google Drive often return wrong or empty MIME types.
  const AUDIO_ALLOWED_EXTS = new Set([
    'mp3','wav','ogg','m4a','aac','flac','aiff','aif','wma','amr','opus','webm','mpeg','mpg',
  ]);
  const AUDIO_ALLOWED_MIMES = new Set([
    'audio/mpeg','audio/mp3','audio/wav','audio/x-wav','audio/wave',
    'audio/ogg','audio/x-ogg','audio/aac','audio/x-aac','audio/mp4','audio/x-m4a',
    'audio/flac','audio/x-flac','audio/opus','audio/webm',
    'application/ogg',
    'application/octet-stream', // Google Drive sometimes returns this for valid audio files
  ]);
  const VIDEO_ALLOWED_EXTS = new Set(['mp4','webm','mov','avi','mkv']);

  function isValidAudio(f) {
    if (!f) return false;
    const name = f.name || '';
    const ext  = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
    if (AUDIO_ALLOWED_EXTS.has(ext)) return true;           // extension match → accept regardless of MIME
    const type = (f.type || '').toLowerCase();
    if (!type) return false;                                 // no ext, no MIME → reject
    if (type.startsWith('audio/')) return true;             // any audio/* MIME → accept
    if (AUDIO_ALLOWED_MIMES.has(type)) return true;         // known audio MIME or octet-stream → accept
    return false;
  }

  function validateFile(f, forAudio = acceptsAudio) {
    if (!f) return null;
    const name = f.name || '';
    const ext  = name.includes('.') ? name.split('.').pop().toLowerCase() : '';
    const type = (f.type || '').toLowerCase();
    let valid;
    if (forAudio) {
      valid = isValidAudio(f);
    } else if (isVolumeBooster) {
      valid = isValidAudio(f) || type.startsWith('video/') || VIDEO_ALLOWED_EXTS.has(ext);
    } else {
      valid = type.startsWith('video/') || VIDEO_ALLOWED_EXTS.has(ext);
    }
    if (!valid) return `Please select a valid ${forAudio ? 'audio' : isVolumeBooster ? 'audio or video' : 'video'} file.`;
    if (f.size > maxMb * 1024 * 1024) return `File too large. Maximum size is ${maxMb} MB.`;
    return null;
  }

  function selectFile(f) {
    const err = validateFile(f);
    if (err) { setFileError(err); return; }
    setFileError('');
    setFile(f);
    setDone(false);
    reset();
  }

  function addFiles(newFiles) {
    const arr = Array.from(newFiles);
    const valid = arr.filter(f => {
      const err = validateFile(f, slug === 'audio-merger');
      return !err;
    });
    if (valid.length < arr.length) setFileError('Some files were skipped (invalid format or too large).');
    else setFileError('');
    setFiles(prev => {
      const combined = [...prev, ...valid];
      const limit = slug === 'video-merger' ? 5 : 10;
      return combined.slice(0, limit);
    });
    setDone(false);
    reset();
  }

  function removeFile() {
    setFile(null); setFileError(''); setDone(false); reset();
    setFileInputKey(k => k + 1);
  }

  function removeMultiFile(idx) {
    setFiles(prev => prev.filter((_, i) => i !== idx));
  }

  function clearAll() {
    setFile(null); setFiles([]); setSubtitleFile(null);
    setFileError(''); setDone(false); setOpts({}); setMediaDuration(null); reset();
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
    setSsePercent(0); setEtaSeconds(null);
    setFileInputKey(k => k + 1);
    setSubInputKey(k => k + 1);
  }

  function handleDragOver(e) { e.preventDefault(); setDragging(true); }
  function handleDragLeave() { setDragging(false); }
  function handleDrop(e) {
    e.preventDefault(); setDragging(false);
    if (isMultiUpload) addFiles(e.dataTransfer.files);
    else selectFile(e.dataTransfer.files?.[0]);
  }

  // ── Process ────────────────────────────────────────────────
  async function handleProcess() {
    setDone(false);
    if (isMultiUpload) {
      await upload(files, opts);
    } else if (isDualUpload) {
      await upload(file, { ...opts, subtitle: subtitleFile });
    } else if (isAudioConverter) {
      // Open SSE progress stream first, then upload (the file upload itself takes
      // time, so the SSE connection will be established before FFmpeg starts).
      const jobId = self.crypto.randomUUID();
      jobIdRef.current = jobId;
      openAudioSSE(jobId);
      await upload(file, { ...opts, jobId });
    } else {
      await upload(file, opts);
    }
    setDone(true);
  }

  function canProcess() {
    if (loading) return false;
    if (isMultiUpload) return files.length >= 2;
    if (isDualUpload)  return !!(file && subtitleFile);
    if (!file) return false;
    if (needsEndTime) {
      const startSec = parseTimeInput(String(opts.start ?? 0)) || 0;
      const endSec   = parseTimeInput(String(opts.end ?? ''));
      if (!opts.end || isNaN(endSec)) return false;
      if (endSec <= startSec) return false;
      if (mediaDuration != null && endSec > mediaDuration) return false;
    }
    if (slug === 'video-watermarker' && !opts.text?.trim()) return false;
    return true;
  }

  const processLabel =
    slug === 'audio-converter'     ? 'Convert Audio'      :
    slug === 'audio-compressor'    ? 'Compress Audio'     :
    slug === 'audio-trimmer'       ? 'Trim Audio'         :
    slug === 'audio-extractor'     ? 'Extract Audio'      :
    slug === 'audio-merger'        ? 'Merge Audio'        :
    slug === 'audio-volume-booster'? 'Boost Volume'       :
    slug === 'video-converter'     ? 'Convert Video'      :
    slug === 'video-compressor'    ? 'Compress Video'     :
    slug === 'video-trimmer'       ? 'Trim Video'         :
    slug === 'video-to-gif'        ? 'Convert to GIF'     :
    slug === 'video-to-webp'       ? 'Convert to WebP'    :
    slug === 'video-to-apng'       ? 'Convert to APNG'    :
    slug === 'video-rotate-flip'   ? 'Rotate / Flip'      :
    slug === 'video-merger'        ? 'Merge Videos'       :
    slug === 'video-watermarker'   ? 'Add Watermark'      :
    slug === 'mute-video'          ? 'Mute Video'         :
    slug === 'change-video-speed'  ? 'Change Speed'       :
    slug === 'hardcode-subtitles'  ? 'Burn Subtitles'     :
    'Process File';

  const needsEndTime = ['audio-trimmer','video-trimmer','video-to-gif','video-to-webp','video-to-apng'].includes(slug);
  const showResult   = done && !error;

  // ── Upload zone (reused for single + multi primary) ────────
  // Uses label htmlFor — the most reliable mobile pattern; no programmatic .click() needed.
  const uploadZone = (onSelect, labelText, acceptStr, refObj, inputId) => (
    <>
      <input
        key={fileInputKey}
        id={inputId}
        ref={refObj}
        type="file"
        accept={acceptStr}
        multiple={isMultiUpload}
        style={hiddenInput}
        onChange={e => {
          setFileInputKey(k => k + 1);
          if (isMultiUpload) addFiles(e.target.files);
          else if (onSelect) onSelect(e.target.files?.[0]);
        }}
      />
      <label
        htmlFor={inputId}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-center gap-3 w-full rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 py-8 px-6 ${
          dragging ? 'border-accent bg-accent/5 scale-[1.01]' : 'border-border hover:border-accent/50 hover:bg-surface-2/60'
        }`}
      >
        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors ${dragging ? 'bg-accent/10' : 'bg-surface-2 border border-border'}`}>
          <Upload className={`w-5 h-5 ${dragging ? 'text-accent' : 'text-text-muted'}`} />
        </div>
        <div className="text-center">
          <p className="font-semibold text-text-primary text-sm">{labelText}</p>
          <p className="text-xs text-text-muted mt-1">Max {maxMb} MB</p>
        </div>
      </label>
    </>
  );

  return (
    <div className="panel-card shadow-lg">
      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">

        {/* ── LEFT: Upload + Options ─────────────────────────── */}
        <div className="flex flex-col">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <Upload className="w-4 h-4 text-text-muted" />
              <span className="text-sm font-semibold text-text-primary">
                {isMultiUpload ? 'Upload Files' : isDualUpload ? 'Upload Video & Subtitles' : `Upload ${fileTypeLabel.charAt(0).toUpperCase() + fileTypeLabel.slice(1)}`}
              </span>
            </div>
            {(file || files.length > 0 || subtitleFile) && (
              <button onClick={clearAll} className="btn-ghost"><X className="w-3.5 h-3.5" />Clear</button>
            )}
          </div>

          <div className="flex-1 p-4 space-y-4">

            {/* ── MULTI-FILE UPLOAD (audio-merger, video-merger) ── */}
            {isMultiUpload && (
              <>
                {uploadZone(null, `Drop ${slug === 'audio-merger' ? 'audio' : 'video'} files or click to browse`, accept, multiRef, multiInputId)}
                {files.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wide">
                      {files.length} file{files.length > 1 ? 's' : ''} selected
                    </p>
                    {files.map((f, i) => (
                      <FileChip key={i} file={f} onRemove={() => removeMultiFile(i)} />
                    ))}
                  </div>
                )}
                {files.length >= 2 && <ToolOptions slug={slug} opts={opts} set={set} extra={{ mediaDuration, fileKey: file?.name ?? '' }} />}
              </>
            )}

            {/* ── DUAL-FILE UPLOAD (hardcode-subtitles) ── */}
            {isDualUpload && (
              <div className="space-y-4">
                <div>
                  <Label>Video File</Label>
                  {!file
                    ? uploadZone(selectFile, 'Drop video or click to browse', 'video/mp4,video/webm,video/quicktime', inputRef, fileInputId)
                    : (
                      <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface-2/60">
                        <Film className="w-4 h-4 text-accent shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{file.name}</p>
                          <p className="text-xs text-text-muted">{(file.size/1024/1024).toFixed(2)} MB</p>
                        </div>
                        <button onClick={removeFile} className="text-text-muted hover:text-red-500 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  }
                </div>
                <div>
                  <Label>Subtitle File (.srt or .vtt)</Label>
                  {!subtitleFile
                    ? (
                      <>
                        <input
                          key={subInputKey}
                          id={subInputId}
                          ref={subtitleRef}
                          type="file"
                          accept=".srt,.vtt,text/plain"
                          style={hiddenInput}
                          onChange={e => { setSubInputKey(k => k + 1); setSubtitleFile(e.target.files?.[0] || null); }}
                        />
                        <label
                          htmlFor={subInputId}
                          className="flex items-center gap-3 w-full rounded-xl border-2 border-dashed border-border hover:border-accent/50 cursor-pointer px-4 py-3 bg-surface-2/40 transition-all"
                        >
                          <Plus className="w-4 h-4 text-text-muted" />
                          <span className="text-sm text-text-secondary">Upload .srt or .vtt subtitle file</span>
                        </label>
                      </>
                    ) : (
                      <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface-2/60">
                        <Film className="w-4 h-4 text-accent shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-text-primary truncate">{subtitleFile.name}</p>
                        </div>
                        <button onClick={() => { setSubtitleFile(null); setSubInputKey(k => k + 1); }}
                          className="text-text-muted hover:text-red-500 transition-colors">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    )
                  }
                </div>
                {file && subtitleFile && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Font Size</Label>
                        <input type="number" min="12" max="72" value={opts.fontSize ?? 24}
                          onChange={e => set('fontSize')(e.target.value)} className="input-field" />
                      </div>
                      <div>
                        <Label>Position</Label>
                        <select value={opts.position ?? 'bottom'} onChange={e => set('position')(e.target.value)} className="input-field">
                          <option value="bottom">Bottom</option>
                          <option value="center">Center</option>
                          <option value="top">Top</option>
                        </select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Text Color</Label>
                        <select value={opts.color ?? 'white'} onChange={e => set('color')(e.target.value)} className="input-field">
                          {['white','yellow','cyan','black','red','green'].map(c => (
                            <option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <Label>Outline Width</Label>
                        <input type="number" min="0" max="5" value={opts.outlineWidth ?? 2}
                          onChange={e => set('outlineWidth')(e.target.value)} className="input-field" />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── SINGLE-FILE UPLOAD ── */}
            {!isMultiUpload && !isDualUpload && (
              <>
                {!file ? (
                  <>
                    <input
                      key={fileInputKey}
                      id={fileInputId}
                      ref={inputRef}
                      type="file"
                      accept={accept}
                      style={hiddenInput}
                      onChange={e => { setFileInputKey(k => k + 1); selectFile(e.target.files?.[0]); }}
                    />
                    <label
                      htmlFor={fileInputId}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`flex flex-col items-center justify-center gap-3 w-full rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200 py-10 px-6 ${
                        dragging ? 'border-accent bg-accent/5 scale-[1.01]' : 'border-border hover:border-accent/50 hover:bg-surface-2/60'
                      }`}
                    >
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${dragging ? 'bg-accent/10' : 'bg-surface-2 border border-border'}`}>
                        <Upload className={`w-6 h-6 ${dragging ? 'text-accent' : 'text-text-muted'}`} />
                      </div>
                      <div className="text-center">
                        <p className="font-semibold text-text-primary text-sm">
                          {dragging ? `Drop ${fileTypeLabel} here` : `Drop ${fileTypeLabel} or click to browse`}
                        </p>
                        <p className="text-xs text-text-muted mt-1">
                          {isVolumeBooster ? 'MP3, WAV, MP4, MOV' : acceptsAudio ? 'MP3, WAV, FLAC, OGG, M4A, WMA, OPUS + more' : 'MP4, WebM, MOV, AVI'} · Max {maxMb} MB
                        </p>
                      </div>
                    </label>
                  </>
                ) : (
                  <div className="flex items-center gap-3 p-3.5 rounded-xl border border-border bg-surface-2/60">
                    <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                      <FileIcon className="w-4 h-4 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{file.name}</p>
                      <p className="text-xs text-text-muted">{(file.size/1024/1024).toFixed(2)} MB</p>
                    </div>
                    <button onClick={removeFile} className="text-text-muted hover:text-red-500 transition-colors shrink-0">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                {file && <ToolOptions slug={slug} opts={opts} set={set} extra={{ mediaDuration, fileKey: file?.name ?? '' }} />}
              </>
            )}

            {fileError && (
              <div className="flex items-start gap-2 text-xs text-red-600">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{fileError}</span>
              </div>
            )}
          </div>

          <div className="px-4 pb-4 pt-3 border-t border-border space-y-2">
            <button onClick={handleProcess} disabled={!canProcess()} className="btn-primary w-full h-11 text-sm">
              {loading
                ? <><Loader2 className="w-4 h-4 animate-spin" />Processing…</>
                : processLabel
              }
            </button>
            {needsEndTime && (file || files.length > 0) && !opts.end && (
              <p className="text-[11px] text-text-muted text-center">Enter end time above to continue</p>
            )}
            {isMultiUpload && files.length < 2 && (
              <p className="text-[11px] text-text-muted text-center">
                Upload at least 2 {slug === 'audio-merger' ? 'audio' : 'video'} files to merge
              </p>
            )}
          </div>
        </div>

        {/* ── RIGHT: Status / Result ─────────────────────────── */}
        <div className="flex flex-col">
          <div className="panel-header">
            <div className="flex items-center gap-2">
              <FileIcon className="w-4 h-4 text-text-muted" />
              <span className="text-sm font-semibold text-text-primary">Result</span>
            </div>
          </div>

          <div className="flex-1 p-4 flex flex-col" style={{ minHeight: '300px' }}>

            {!loading && !error && !showResult && (
              <div className="flex-1 flex flex-col items-center justify-center text-center py-10">
                <div className="w-14 h-14 bg-surface-2 rounded-2xl flex items-center justify-center mb-3 border border-border">
                  <FileIcon className="w-6 h-6 text-text-light" />
                </div>
                <p className="text-sm font-semibold text-text-secondary">Output appears here</p>
                <p className="text-xs text-text-muted mt-1">Upload and click {processLabel.toLowerCase()}</p>
              </div>
            )}

            {loading && (
              <div className="flex-1 flex flex-col justify-center px-2 gap-4">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 text-accent animate-spin" />
                  <p className="text-sm font-medium text-text-secondary">
                    {isAudioConverter
                      ? ssePercent > 0 ? 'Converting audio…' : 'Uploading…'
                      : 'Processing your file…'}
                  </p>
                </div>
                <ProgressBar
                  value={Math.round(displayProgress)}
                  processingLabel={isAudioConverter ? 'Converting…' : 'Processing…'}
                />
                {isAudioConverter && etaSeconds !== null && etaSeconds > 0 && (
                  <p className="text-xs text-text-muted text-center">
                    {'~'}{etaSeconds < 60
                      ? `${etaSeconds}s remaining`
                      : `${Math.floor(etaSeconds / 60)}m ${etaSeconds % 60}s remaining`}
                  </p>
                )}
              </div>
            )}

            {error && !loading && (
              <div className="space-y-3">
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm flex items-start gap-2.5 animate-fadeIn">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
                <button onClick={clearAll} className="btn-secondary w-full gap-2">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Try Again
                </button>
              </div>
            )}

            {showResult && (
              <div className="flex-1 flex flex-col items-center justify-center gap-4 animate-fadeUp">
                <div className="w-16 h-16 rounded-2xl bg-brand-gradient flex items-center justify-center shadow-brand">
                  <Check className="w-8 h-8 text-white" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-text-primary text-base">Done!</p>
                  <p className="text-sm text-text-secondary mt-1">Your file has been downloaded automatically.</p>
                </div>
                <button onClick={clearAll} className="btn-secondary gap-2 mt-2">
                  <RefreshCw className="w-3.5 h-3.5" />
                  Process Another File
                </button>
              </div>
            )}

          </div>
        </div>

      </div>
    </div>
  );
}
