import { useState, useRef, useCallback } from 'react';
import {
  Upload, X, AlertCircle, Loader2, Download, Film,
  Sparkles, FileText, Check, RefreshCw, Plus,
} from 'lucide-react';
import { useFileUpload } from '@/hooks/useFileUpload';

// ── Subtitle format helpers ────────────────────────────────────

function srtToVTT(srt) {
  const lines = srt.replace(/\r\n/g, '\n').split('\n');
  const out   = [];
  for (const line of lines) {
    if (/^\d+$/.test(line.trim())) continue;
    out.push(line.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2'));
  }
  return 'WEBVTT\n\n' + out.join('\n').replace(/^\n+/, '') + '\n';
}

// ── XHR upload + transcribe ────────────────────────────────────
// Returns Promise<{ srt, vtt }>. Calls onUploadPct(0-100) during upload,
// then onTranscribing() when upload is done and server is processing.
function generateSubtitles(videoFile, language, onUploadPct, onTranscribing) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', videoFile);
    formData.append('language', language);

    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/subtitles');
    xhr.timeout = 45 * 60 * 1000; // 45 min — covers first-run model download (medium = 460 MB)

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onUploadPct(Math.round((e.loaded / e.total) * 100));
    };
    xhr.upload.onload = () => onTranscribing(); // upload done → ffmpeg+whisper starts

    xhr.onload = () => {
      try {
        const body = JSON.parse(xhr.responseText);
        if (xhr.status === 200) resolve(body);
        else reject(new Error(body.error || `Server error ${xhr.status}`));
      } catch {
        reject(new Error(`Server error ${xhr.status}`));
      }
    };
    xhr.onerror   = () => reject(new Error('Connection failed. Please check your internet and try again.'));
    xhr.ontimeout = () => reject(new Error('This is taking too long. The Urdu model (~460 MB) may still be downloading — please try again in a few minutes.'));

    xhr.send(formData);
  });
}

// ── Tiny shared components ─────────────────────────────────────
const STEP_LABELS = ['Extract audio', 'Transcribe', 'Generate files'];
function StepDots({ active }) {
  return (
    <div className="flex items-center justify-center gap-3 pt-1">
      {STEP_LABELS.map((label, i) => (
        <div key={i} className="flex flex-col items-center gap-1">
          <div className={`w-2.5 h-2.5 rounded-full transition-colors ${
            i < active  ? 'bg-accent' :
            i === active ? 'bg-accent animate-pulse' :
            'bg-border'
          }`} />
          <span className={`text-[10px] ${i <= active ? 'text-accent font-medium' : 'text-text-muted'}`}>
            {label}
          </span>
        </div>
      ))}
    </div>
  );
}
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
      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-all ${
        active
          ? 'bg-accent border-accent text-white shadow-sm'
          : 'bg-white border-border text-text-secondary hover:border-accent/50'
      }`}
    >
      {children}
    </button>
  );
}

// ── Constants ──────────────────────────────────────────────────
const LANGUAGES = [
  { code: 'english', label: 'English' },
  { code: 'urdu',    label: 'Urdu (اردو)' },
];

// ── Main component ─────────────────────────────────────────────
export default function HardcodeSubtitlesTool() {
  // phase: 'upload' | 'config' | 'gen' | 'edit'
  const [phase,         setPhase]         = useState('upload');
  const [videoFile,     setVideoFile]     = useState(null);
  const [inputMode,     setInputMode]     = useState('auto');  // 'auto' | 'manual'
  const [manualSubFile, setManualSubFile] = useState(null);
  const [language,      setLanguage]      = useState('english');

  // Gen phase states
  // genStatus: '' | 'uploading' | 'extracting' | 'transcribing' | 'generating'
  const [genStatus,  setGenStatus]  = useState('');
  const [uploadPct,  setUploadPct]  = useState(0);
  const stepTimerRef = useRef(null);

  // Edit phase states
  const [srtText,  setSrtText]  = useState('');
  const [vttText,  setVttText]  = useState('');
  const [genError, setGenError] = useState('');

  // Burn phase states
  const [burnDone, setBurnDone] = useState(false);
  const [burnOpts, setBurnOpts] = useState({
    fontSize: 24, position: 'bottom', color: 'white', outlineWidth: 2,
  });

  // File drag state
  const [dragVideo,  setDragVideo]  = useState(false);
  const [fileError,  setFileError]  = useState('');

  const videoInputRef = useRef(null);
  const manualSubRef  = useRef(null);

  const {
    upload, loading: burning, error: burnError, progress: burnProgress, reset: burnReset,
  } = useFileUpload('hardcode-subtitles');

  // ── Video file selection ─────────────────────────────────────
  function handleVideoFile(f) {
    if (!f) return;
    const videoExts = /\.(mp4|webm|mov|avi|mkv|m4v)$/i;
    if (!f.type.startsWith('video/') && !videoExts.test(f.name)) {
      setFileError('Please upload a video file (MP4, WebM, MOV, AVI).');
      return;
    }
    if (f.size > 500 * 1024 * 1024) {
      setFileError('Video must be under 500 MB.');
      return;
    }
    setFileError('');
    setVideoFile(f);
    setSrtText(''); setVttText('');
    setGenError(''); setBurnDone(false);
    setManualSubFile(null);
    burnReset();
    setPhase('config');
  }

  // ── Auto-generate via server-side Whisper ───────────────────
  async function handleGenerate() {
    setGenError('');
    setGenStatus('uploading');
    setUploadPct(0);
    setPhase('gen');

    // After upload, cycle through server-side steps:
    // extracting (1/3) → transcribing (2/3) — "generating" (3/3) resolves too fast to show
    function startServerSteps() {
      setGenStatus('extracting');
      stepTimerRef.current = setTimeout(() => {
        setGenStatus('transcribing');
      }, 5000); // ffmpeg extraction usually finishes within ~5 s
    }

    try {
      const { srt, vtt } = await generateSubtitles(
        videoFile,
        language,
        setUploadPct,
        startServerSteps,
      );

      setSrtText(srt);
      setVttText(vtt || srtToVTT(srt));
      setPhase('edit');
    } catch (err) {
      setGenError(err.message || 'Something went wrong. Please try again.');
      setPhase('config');
    } finally {
      clearTimeout(stepTimerRef.current);
      setGenStatus('');
      setUploadPct(0);
    }
  }

  // ── Manual subtitle file load ────────────────────────────────
  async function handleManualSubLoad(f) {
    if (!f) return;
    setManualSubFile(f);
    const text = await f.text();
    if (text.trimStart().startsWith('WEBVTT')) {
      setVttText(text);
      const srt = text
        .replace(/^WEBVTT[^\n]*\n+/, '')
        .replace(/(\d{2}:\d{2}:\d{2})\.(\d{3})/g, '$1,$2')
        .trim();
      setSrtText(srt);
    } else {
      setSrtText(text);
      setVttText(srtToVTT(text));
    }
    setPhase('edit');
  }

  // ── Subtitle editing ─────────────────────────────────────────
  function handleSrtChange(text) {
    setSrtText(text);
    setVttText(srtToVTT(text));
  }

  // ── File downloads ───────────────────────────────────────────
  function downloadFile(content, filename, mime) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a   = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Burn subtitles into video ────────────────────────────────
  async function handleBurn() {
    setBurnDone(false);
    burnReset();
    const srtFile = new File(
      [new Blob([srtText], { type: 'text/plain' })],
      'subtitles.srt',
      { type: 'text/plain' },
    );
    await upload(videoFile, { subtitle: srtFile, ...burnOpts });
    setBurnDone(true);
  }

  const setBurnOpt = useCallback(key => val => setBurnOpts(p => ({ ...p, [key]: val })), []);

  // ── Full reset ───────────────────────────────────────────────
  function reset() {
    clearTimeout(stepTimerRef.current);
    setPhase('upload'); setVideoFile(null); setInputMode('auto');
    setManualSubFile(null); setSrtText(''); setVttText('');
    setGenError(''); setFileError(''); setGenStatus(''); setUploadPct(0);
    setBurnDone(false); burnReset();
    if (videoInputRef.current) videoInputRef.current.value = '';
    if (manualSubRef.current)  manualSubRef.current.value  = '';
  }

  const isProcessing = genStatus !== '' || burning;

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="panel-card shadow-lg">

      {/* Header */}
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-semibold text-text-primary">Hardcode Subtitles</span>
        </div>
        {phase !== 'upload' && !isProcessing && (
          <button onClick={reset} className="btn-ghost">
            <X className="w-3.5 h-3.5" /> Reset
          </button>
        )}
      </div>

      <div className="p-4 sm:p-6 space-y-5">

        {/* ── PHASE: Upload video ── */}
        {phase === 'upload' && (
          <>
            {fileError && (
              <div className="flex items-start gap-2 text-sm text-red-600">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{fileError}</span>
              </div>
            )}
            <label
              className={`flex flex-col items-center justify-center gap-3 w-full rounded-2xl border-2 border-dashed cursor-pointer transition-all py-14 px-6 ${
                dragVideo
                  ? 'border-accent bg-accent/5'
                  : 'border-border hover:border-accent/50 hover:bg-surface-2/60'
              }`}
              onDragOver={e => { e.preventDefault(); setDragVideo(true); }}
              onDragLeave={() => setDragVideo(false)}
              onDrop={e => { e.preventDefault(); setDragVideo(false); handleVideoFile(e.dataTransfer.files?.[0]); }}
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors ${
                dragVideo ? 'bg-accent/10' : 'bg-surface-2 border border-border'
              }`}>
                <Film className={`w-6 h-6 ${dragVideo ? 'text-accent' : 'text-text-muted'}`} />
              </div>
              <div className="text-center">
                <p className="font-semibold text-text-primary text-sm">
                  {dragVideo ? 'Drop video here' : 'Drop video or click to browse'}
                </p>
                <p className="text-xs text-text-muted mt-1">MP4, WebM, MOV, AVI · Max 500 MB</p>
              </div>
              <input
                ref={videoInputRef} type="file"
                accept="video/mp4,video/webm,video/quicktime,video/x-msvideo,.mkv,.m4v"
                className="sr-only"
                onChange={e => handleVideoFile(e.target.files?.[0])}
              />
            </label>
          </>
        )}

        {/* ── PHASE: Config ── */}
        {phase === 'config' && (
          <>
            {/* Video chip */}
            <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface-2/60">
              <Film className="w-4 h-4 text-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{videoFile.name}</p>
                <p className="text-xs text-text-muted">{(videoFile.size / 1024 / 1024).toFixed(2)} MB</p>
              </div>
            </div>

            {/* Source selector */}
            <div>
              <Label>Subtitle Source</Label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'auto',   icon: Sparkles, label: 'Auto Generate',  desc: 'Server-side Whisper AI' },
                  { id: 'manual', icon: FileText,  label: 'Upload File',    desc: 'Your own .srt or .vtt' },
                ].map(({ id, icon: Icon, label, desc }) => (
                  <button
                    key={id}
                    onClick={() => { setInputMode(id); setGenError(''); }}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                      inputMode === id
                        ? 'border-accent bg-accent/5 text-accent'
                        : 'border-border text-text-muted hover:border-accent/40'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-sm font-semibold">{label}</span>
                    <span className="text-[11px] font-normal text-text-muted text-center">{desc}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Auto: language selector */}
            {inputMode === 'auto' && (
              <>
                <div>
                  <Label>Spoken Language in Video</Label>
                  <div className="flex gap-2 flex-wrap">
                    {LANGUAGES.map(({ code, label }) => (
                      <Pill key={code} active={language === code} onClick={() => setLanguage(code)}>
                        {label}
                      </Pill>
                    ))}
                  </div>
                  <p className="text-xs text-text-muted mt-2">
                    {language === 'urdu'
                      ? 'Urdu uses the "medium" model for accuracy (~460 MB). First run downloads it once — subsequent runs are fast.'
                      : 'English uses the fast "base" model (~140 MB). Downloaded once and cached.'}
                  </p>
                </div>
                {genError && (
                  <div className="flex items-start gap-2 text-sm text-red-600">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{genError}</span>
                  </div>
                )}
                <button onClick={handleGenerate} className="btn-primary w-full h-11 text-sm">
                  <Sparkles className="w-4 h-4" />
                  Auto Generate Subtitles
                </button>
              </>
            )}

            {/* Manual: file upload */}
            {inputMode === 'manual' && (
              <div>
                <Label>Subtitle File (.srt or .vtt)</Label>
                {!manualSubFile ? (
                  <label className="flex items-center gap-3 w-full rounded-xl border-2 border-dashed border-border hover:border-accent/50 cursor-pointer px-4 py-3 bg-surface-2/40 transition-all">
                    <Plus className="w-4 h-4 text-text-muted" />
                    <span className="text-sm text-text-secondary">Upload .srt or .vtt subtitle file</span>
                    <input
                      ref={manualSubRef} type="file" accept=".srt,.vtt,text/plain"
                      className="sr-only"
                      onChange={e => handleManualSubLoad(e.target.files?.[0])}
                    />
                  </label>
                ) : (
                  <div className="flex items-center gap-3 p-3 rounded-xl border border-border bg-surface-2/60">
                    <FileText className="w-4 h-4 text-accent shrink-0" />
                    <span className="flex-1 text-sm truncate text-text-primary">{manualSubFile.name}</span>
                    <button
                      onClick={() => { setManualSubFile(null); if (manualSubRef.current) manualSubRef.current.value = ''; }}
                      className="text-text-muted hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ── PHASE: Generating (upload → 3 server steps) ── */}
        {phase === 'gen' && (
          <div className="flex flex-col items-center justify-center py-10 gap-5">
            <Loader2 className="w-10 h-10 text-accent animate-spin" />

            {genStatus === 'uploading' && (
              <div className="w-full space-y-2">
                <div className="flex justify-between text-sm font-medium text-text-primary">
                  <span>Uploading video…</span>
                  <span className="text-accent font-mono">{uploadPct}%</span>
                </div>
                <div className="w-full h-2 bg-surface-2 rounded-full overflow-hidden border border-border">
                  <div
                    className="h-full rounded-full bg-brand-gradient transition-all duration-300"
                    style={{ width: `${uploadPct}%` }}
                  />
                </div>
                <p className="text-xs text-text-muted text-center">Keep this tab open</p>
              </div>
            )}

            {genStatus === 'extracting' && (
              <div className="text-center space-y-2 w-full">
                <p className="font-semibold text-text-primary">Extracting audio from video… <span className="text-accent">(1/3)</span></p>
                <p className="text-sm text-text-muted">Separating audio track with FFmpeg</p>
                <StepDots active={0} />
              </div>
            )}

            {genStatus === 'transcribing' && (
              <div className="text-center space-y-2 w-full">
                <p className="font-semibold text-text-primary">Transcribing audio… <span className="text-accent">(2/3)</span></p>
                <p className="text-sm text-text-muted">
                  Whisper is processing — takes 30–120 s depending on length
                </p>
                <p className="text-xs text-text-muted">
                  {language === 'urdu'
                    ? 'Downloading Urdu model (~460 MB) on first use — only once!'
                    : 'First run downloads the ~140 MB English model — only once!'}
                </p>
                <StepDots active={1} />
              </div>
            )}
          </div>
        )}

        {/* ── PHASE: Edit + Burn (server burning progress) ── */}
        {burning && (
          <div className="flex flex-col items-center justify-center py-10 gap-4">
            <Loader2 className="w-10 h-10 text-accent animate-spin" />
            <p className="font-semibold text-text-primary">Burning subtitles into video…</p>
            <div className="w-full max-w-sm space-y-1.5">
              <div className="h-2 bg-surface-2 rounded-full overflow-hidden border border-border">
                <div
                  className="h-full rounded-full bg-brand-gradient transition-all"
                  style={{ width: `${burnProgress}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-text-muted">
                <span>{burnProgress < 65 ? 'Uploading…' : 'Processing with FFmpeg…'}</span>
                <span>{burnProgress}%</span>
              </div>
            </div>
          </div>
        )}

        {phase === 'edit' && !burning && (
          <div className="space-y-5">

            {/* Mini video chip */}
            <div className="flex items-center gap-2 p-2 rounded-lg border border-border bg-surface-2/50">
              <Film className="w-3.5 h-3.5 text-accent shrink-0" />
              <span className="text-xs text-text-secondary truncate flex-1">{videoFile?.name}</span>
              <button onClick={() => setPhase('config')} className="text-xs text-accent hover:underline shrink-0">
                Change
              </button>
            </div>

            {/* Subtitle editor */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label>Subtitles (SRT — editable)</Label>
                <div className="flex gap-3">
                  <button
                    onClick={() => downloadFile(srtText, 'subtitles.srt', 'text/plain')}
                    disabled={!srtText}
                    className="flex items-center gap-1.5 text-xs font-medium text-accent hover:underline disabled:opacity-40"
                  >
                    <Download className="w-3.5 h-3.5" /> SRT
                  </button>
                  <button
                    onClick={() => downloadFile(vttText, 'subtitles.vtt', 'text/plain')}
                    disabled={!vttText}
                    className="flex items-center gap-1.5 text-xs font-medium text-accent hover:underline disabled:opacity-40"
                  >
                    <Download className="w-3.5 h-3.5" /> VTT
                  </button>
                </div>
              </div>
              <textarea
                value={srtText}
                onChange={e => handleSrtChange(e.target.value)}
                className="tool-textarea font-mono text-xs"
                style={{ minHeight: '220px' }}
                placeholder="Subtitles appear here — edit any line before burning…"
                dir="auto"
              />
            </div>

            {/* Style options */}
            <div className="space-y-2">
              <Label>Burn-In Style</Label>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] font-medium text-text-muted mb-1">Font Size</p>
                  <input type="number" min="12" max="72" value={burnOpts.fontSize}
                    onChange={e => setBurnOpt('fontSize')(e.target.value)} className="input-field" />
                </div>
                <div>
                  <p className="text-[11px] font-medium text-text-muted mb-1">Position</p>
                  <select value={burnOpts.position} onChange={e => setBurnOpt('position')(e.target.value)} className="input-field">
                    <option value="bottom">Bottom</option>
                    <option value="center">Center</option>
                    <option value="top">Top</option>
                  </select>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-text-muted mb-1">Text Color</p>
                  <select value={burnOpts.color} onChange={e => setBurnOpt('color')(e.target.value)} className="input-field">
                    {['white','yellow','cyan','black','red','green'].map(c => (
                      <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <p className="text-[11px] font-medium text-text-muted mb-1">Outline Width</p>
                  <input type="number" min="0" max="5" value={burnOpts.outlineWidth}
                    onChange={e => setBurnOpt('outlineWidth')(e.target.value)} className="input-field" />
                </div>
              </div>
            </div>

            {burnError && (
              <div className="flex items-start gap-2 text-sm text-red-600">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{burnError}</span>
              </div>
            )}

            {burnDone && !burnError && (
              <div className="flex items-center gap-3 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-sm">
                <Check className="w-5 h-5 shrink-0" />
                <div>
                  <p className="font-semibold">Video downloaded!</p>
                  <p className="text-xs text-green-600 mt-0.5">Subtitles are permanently burned in.</p>
                </div>
              </div>
            )}

            <button
              onClick={handleBurn}
              disabled={!srtText.trim() || !videoFile || burning}
              className="btn-primary w-full h-11 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Film className="w-4 h-4" />
              Burn Subtitles into Video
            </button>

            {burnDone && !burnError && (
              <button onClick={reset} className="btn-secondary w-full gap-2 h-10 text-sm">
                <RefreshCw className="w-3.5 h-3.5" />
                Process Another Video
              </button>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
