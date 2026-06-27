import { useState, useRef, useEffect, useCallback } from 'react';
import fixWebmDuration from 'fix-webm-duration';

// ─────────────────────────────────────────────────────────────────
// Icons (inline SVG — no extra dep)
// ─────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 18, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d={d} />
  </svg>
);
const I = {
  Monitor:   'M2 3h20v14H2zM8 21h8M12 17v4',
  Mic:       'M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3zM19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8',
  MicOff:    'M1 1l22 22M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V4a3 3 0 0 0-5.94-.6M17 16.95A7 7 0 0 1 5 12v-2m14 0v2a7 7 0 0 1-.11 1.23M12 19v4M8 23h8',
  Volume2:   'M11 5L6 9H2v6h4l5 4V5zM15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14',
  Square:    'M3 3h18v18H3z',
  Pause:     'M6 4h4v16H6zM14 4h4v16h-4z',
  Play:      'M5 3l14 9-14 9V3z',
  Download:  'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  Trash:     'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
  Check:     'M20 6L9 17l-5-5',
  AlertCirc: 'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 8v4M12 16h.01',
  Refresh:   'M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15',
  Folder:    'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
  Info:      'M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 16v-4M12 8h.01',
  Film:      'M19.82 2H4.18A2.18 2.18 0 0 0 2 4.18v15.64A2.18 2.18 0 0 0 4.18 22h15.64A2.18 2.18 0 0 0 22 19.82V4.18A2.18 2.18 0 0 0 19.82 2zM7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5',
};

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
const AUDIO_MIME = ['audio/webm;codecs=opus', 'audio/webm'];
const VIDEO_MIME_AUDIO    = ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp9,opus', 'video/webm'];
const VIDEO_MIME_NO_AUDIO = ['video/webm;codecs=vp8', 'video/webm'];

function pickMime(list) {
  return list.find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm';
}

function fmtTime(s) {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`
    : `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}
function fmtBytes(b) {
  if (!b) return '—';
  return b < 1024*1024 ? `${(b/1024).toFixed(0)} KB` : `${(b/(1024*1024)).toFixed(1)} MB`;
}

const eAPI = window.electronAPI;
const isWin = eAPI?.platform === 'win32';

// ─────────────────────────────────────────────────────────────────
export default function Recorder() {

  // ── State ────────────────────────────────────────────────────
  const [sources,      setSources]      = useState([]);
  const [selectedSrc,  setSelectedSrc]  = useState(null);
  const [audioMode,    setAudioMode]    = useState('mic+system'); // 'mic+system'|'mic'|'system'|'none'
  const [micGain,      setMicGain]      = useState(1.0);
  const [sysGain,      setSysGain]      = useState(1.0);

  const [status,       setStatus]       = useState('idle');   // idle|picking|recording|paused|stopping|done|error
  const [duration,     setDuration]     = useState(0);
  const [chunkBytes,   setChunkBytes]   = useState(0);        // live size estimate
  const [hasAudio,     setHasAudio]     = useState(false);

  const [mp4Progress,  setMp4Progress]  = useState(0);
  const [savedPath,    setSavedPath]    = useState('');
  const [errMsg,       setErrMsg]       = useState('');

  // ── Refs ─────────────────────────────────────────────────────
  const screenStreamRef = useRef(null);
  const micStreamRef    = useRef(null);
  const audioCtxRef     = useRef(null);
  const recorderRef     = useRef(null);
  const timerRef        = useRef(null);
  const startMsRef      = useRef(0);
  const waveCanvasRef   = useRef(null);
  const analyserRef     = useRef(null);
  const animRef         = useRef(null);
  const unsubMp4Ref     = useRef(null);

  // ── Mount: fetch sources ─────────────────────────────────────
  const refreshSources = useCallback(async () => {
    try {
      const list = await eAPI.getSources(['screen', 'window']);
      setSources(list);
      if (list.length > 0 && !selectedSrc) setSelectedSrc(list[0]);
    } catch (e) {
      setErrMsg('Could not list screen sources: ' + e.message);
    }
  }, [selectedSrc]);

  useEffect(() => { refreshSources(); }, []);

  // ── Cleanup on unmount ────────────────────────────────────────
  useEffect(() => () => {
    stopTracks();
    clearInterval(timerRef.current);
    cancelAnimationFrame(animRef.current);
    audioCtxRef.current?.close();
    unsubMp4Ref.current?.();
  }, []);

  function stopTracks() {
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    micStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current = null;
    micStreamRef.current    = null;
  }

  // ── Waveform visualiser ───────────────────────────────────────
  function startWaveform(analyser) {
    analyserRef.current = analyser;
    const cvs = waveCanvasRef.current;
    if (!cvs) return;
    const ctx  = cvs.getContext('2d');
    const data = new Uint8Array(analyser.frequencyBinCount);
    function draw() {
      animRef.current = requestAnimationFrame(draw);
      analyser.getByteTimeDomainData(data);
      cvs.width = cvs.offsetWidth || 500;
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      ctx.fillStyle = 'rgba(99,102,241,0.07)';
      ctx.fillRect(0, 0, cvs.width, cvs.height);
      ctx.lineWidth = 2; ctx.strokeStyle = '#6366f1';
      ctx.beginPath();
      const sw = cvs.width / data.length;
      for (let i = 0; i < data.length; i++) {
        const y = ((data[i] / 128) * cvs.height) / 2;
        i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * sw, y);
      }
      ctx.lineTo(cvs.width, cvs.height / 2);
      ctx.stroke();
    }
    draw();
  }

  function stopWaveform() {
    cancelAnimationFrame(animRef.current);
    animRef.current = null;
    analyserRef.current = null;
    const cvs = waveCanvasRef.current;
    if (cvs) cvs.getContext('2d').clearRect(0, 0, cvs.width, cvs.height);
  }

  // ── Start recording ───────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setErrMsg(''); setSavedPath(''); setMp4Progress(0);
    setDuration(0); setChunkBytes(0); setHasAudio(false);

    if (!selectedSrc) { setErrMsg('Select a screen or window first.'); return; }
    setStatus('picking');

    try {
      // ── 1. Capture screen video (+ system audio on Windows via chromeMediaSource) ──
      const captureConstraints = {
        audio: (audioMode === 'mic+system' || audioMode === 'system') ? {
          mandatory: { chromeMediaSource: 'desktop' }
        } : false,
        video: {
          mandatory: {
            chromeMediaSource:   'desktop',
            chromeMediaSourceId: selectedSrc.id,
            maxWidth:  1920,
            maxHeight: 1080,
            maxFrameRate: 30,
          }
        },
      };

      const screenStream = await navigator.mediaDevices.getUserMedia(captureConstraints);
      screenStreamRef.current = screenStream;

      const videoTracks  = screenStream.getVideoTracks();
      const sysTracks    = screenStream.getAudioTracks();
      const sysAudioGot  = sysTracks.length > 0;

      // ── 2. Capture microphone ────────────────────────────────
      let micTracks = [];
      if (audioMode === 'mic+system' || audioMode === 'mic') {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
          });
          micStreamRef.current = micStream;
          micTracks = micStream.getAudioTracks();
        } catch {
          // Mic unavailable — continue with video only
        }
      }

      // ── 3. Mix audio via AudioContext ────────────────────────
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;
      const dest = audioCtx.createMediaStreamDestination();
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 512;

      if (sysAudioGot) {
        const sysGainNode = audioCtx.createGain();
        sysGainNode.gain.value = sysGain;
        const sysSrc = audioCtx.createMediaStreamSource(new MediaStream(sysTracks));
        sysSrc.connect(sysGainNode);
        sysGainNode.connect(dest);
        sysGainNode.connect(analyser);
      }
      if (micTracks.length > 0) {
        const micGainNode = audioCtx.createGain();
        micGainNode.gain.value = micGain;
        const micSrc = audioCtx.createMediaStreamSource(new MediaStream(micTracks));
        micSrc.connect(micGainNode);
        micGainNode.connect(dest);
        micGainNode.connect(analyser);
      }

      const mixedAudioTracks = dest.stream.getAudioTracks();
      const gotAudio = mixedAudioTracks.length > 0 && (sysAudioGot || micTracks.length > 0);
      setHasAudio(gotAudio);

      // ── 4. Build final MediaStream ───────────────────────────
      const finalTracks = [
        ...videoTracks,
        ...(gotAudio ? mixedAudioTracks : []),
      ];
      const finalStream = new MediaStream(finalTracks);

      const mimeType = gotAudio ? pickMime(VIDEO_MIME_AUDIO) : pickMime(VIDEO_MIME_NO_AUDIO);

      // ── 5. Tell main process to open temp file ───────────────
      await eAPI.recordingStart();

      // ── 6. MediaRecorder ─────────────────────────────────────
      const recorder = new MediaRecorder(finalStream, {
        mimeType,
        videoBitsPerSecond: 2_500_000,
        ...(gotAudio ? { audioBitsPerSecond: 128_000 } : {}),
      });
      recorderRef.current = recorder;

      recorder.ondataavailable = async (e) => {
        if (!e.data?.size) return;
        const buf = await e.data.arrayBuffer();
        setChunkBytes(b => b + buf.byteLength);
        await eAPI.recordingChunk(new Uint8Array(buf));
      };

      recorder.onstop = () => { /* handled by user button */ };

      // If OS stops sharing (user clicks "Stop sharing" in Chrome bar)
      videoTracks[0].onended = () => {
        if (recorderRef.current?.state !== 'inactive') {
          recorderRef.current.stop();
          setStatus('stopping');
        }
      };

      startMsRef.current = Date.now();
      recorder.start(1000);
      setStatus('recording');
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);

      if (gotAudio) startWaveform(analyser);

    } catch (err) {
      setStatus('idle');
      if (err.name === 'NotAllowedError') setErrMsg('Permission denied. Allow screen capture and microphone when prompted.');
      else setErrMsg(err.message || 'Could not start recording.');
      stopTracks();
      audioCtxRef.current?.close();
      audioCtxRef.current = null;
    }
  }, [selectedSrc, audioMode, micGain, sysGain]);

  const togglePause = useCallback(() => {
    const rec = recorderRef.current;
    if (!rec) return;
    if (rec.state === 'recording') {
      rec.pause(); clearInterval(timerRef.current); setStatus('paused');
    } else if (rec.state === 'paused') {
      rec.resume(); timerRef.current = setInterval(() => setDuration(d => d + 1), 1000); setStatus('recording');
    }
  }, []);

  // ── Stop and save ─────────────────────────────────────────────
  const stopAndSave = useCallback(async (format) => {
    const rec = recorderRef.current;
    if (!rec || rec.state === 'inactive') return;

    setStatus('stopping');
    clearInterval(timerRef.current);
    stopWaveform();

    // Stop the recorder; wait for last ondataavailable to flush
    await new Promise((resolve) => {
      const orig = rec.ondataavailable;
      rec.ondataavailable = async (e) => {
        if (orig) await orig(e);
        resolve();
      };
      rec.onstop = resolve;
      if (rec.state !== 'inactive') rec.stop();
    });

    stopTracks();
    audioCtxRef.current?.close();
    audioCtxRef.current = null;

    setStatus('saving');

    let result;
    if (format === 'webm') {
      result = await eAPI.recordingStopWebm();
    } else {
      // Subscribe to MP4 conversion progress
      const unsub = eAPI.onMp4Progress((pct) => setMp4Progress(pct));
      unsubMp4Ref.current = unsub;
      result = await eAPI.recordingStopMp4();
      unsub();
      unsubMp4Ref.current = null;
    }

    if (result?.canceled) { setStatus('idle'); return; }
    if (result?.error)    { setErrMsg(result.error); setStatus('error'); return; }
    if (result?.saved)    { setSavedPath(result.path); setStatus('done'); }
  }, []);

  const discard = useCallback(async () => {
    const rec = recorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    clearInterval(timerRef.current);
    stopWaveform();
    stopTracks();
    audioCtxRef.current?.close();
    audioCtxRef.current = null;
    await eAPI.recordingDiscard();
    setStatus('idle'); setDuration(0); setChunkBytes(0);
    setSavedPath(''); setErrMsg('');
  }, []);

  const isRecording = status === 'recording';
  const isPaused    = status === 'paused';
  const isActive    = isRecording || isPaused;
  const isSaving    = status === 'saving';

  // ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-3xl mx-auto space-y-5">

      {/* Error banner */}
      {errMsg && (
        <div className="flex items-start gap-3 p-4 rounded-xl bg-red-900/20 border border-red-700/40 text-red-300 text-sm">
          <Icon d={I.AlertCirc} size={16} className="shrink-0 mt-0.5" />
          <span>{errMsg}</span>
          <button onClick={() => setErrMsg('')} className="ml-auto text-red-400 hover:text-red-200">✕</button>
        </div>
      )}

      {/* ── Source picker ── */}
      {status === 'idle' && (
        <section className="rounded-xl border border-border bg-surface2 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <span className="text-sm font-semibold text-gray-200 flex items-center gap-2">
              <Icon d={I.Monitor} size={15} /> Select source
            </span>
            <button onClick={refreshSources}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors px-2 py-1 rounded-lg hover:bg-surface3">
              <Icon d={I.Refresh} size={13} /> Refresh
            </button>
          </div>
          {sources.length === 0 ? (
            <p className="text-center py-10 text-gray-500 text-sm">No sources found. Click Refresh.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-4 max-h-64 overflow-y-auto">
              {sources.map(src => (
                <button key={src.id} onClick={() => setSelectedSrc(src)}
                  className={`group rounded-xl border-2 overflow-hidden text-left transition-all ${
                    selectedSrc?.id === src.id
                      ? 'border-indigo-500 ring-1 ring-indigo-500/40'
                      : 'border-border hover:border-indigo-500/40'
                  }`}
                >
                  <div className="relative bg-surface3" style={{ paddingBottom: '56.25%' }}>
                    <img src={src.thumbnail} alt={src.name} loading="lazy"
                      className="absolute inset-0 w-full h-full object-cover"
                      style={{ imageRendering: 'crisp-edges' }}
                    />
                    {selectedSrc?.id === src.id && (
                      <div className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center">
                        <Icon d={I.Check} size={11} className="text-white" />
                      </div>
                    )}
                  </div>
                  <div className="px-2 py-1.5 flex items-center gap-1.5">
                    {src.appIcon
                      ? <img src={src.appIcon} alt="" className="w-3.5 h-3.5 shrink-0" />
                      : <Icon d={I.Monitor} size={12} className="text-gray-500 shrink-0" />}
                    <span className="text-xs text-gray-300 truncate">{src.name}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── Audio settings ── */}
      {status === 'idle' && (
        <section className="rounded-xl border border-border bg-surface2 p-4 space-y-4">
          <span className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <Icon d={I.Volume2} size={15} /> Audio settings
          </span>

          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'mic+system', label: 'Mic + System',  note: isWin ? '' : 'Win only for system' },
              { id: 'mic',        label: 'Mic only',       note: '' },
              { id: 'system',     label: 'System only',   note: isWin ? '' : 'Win only' },
              { id: 'none',       label: 'No audio',      note: '' },
            ].map(({ id, label, note }) => (
              <button key={id} onClick={() => setAudioMode(id)}
                className={`flex flex-col items-start px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                  audioMode === id ? 'border-indigo-500 bg-indigo-500/10 text-indigo-300' : 'border-border text-gray-400 hover:border-indigo-500/40 hover:text-gray-200'
                }`}
              >
                {label}
                {note && <span className="text-[10px] text-gray-500 mt-0.5">{note}</span>}
              </button>
            ))}
          </div>

          {/* Gain sliders */}
          {(audioMode === 'mic+system' || audioMode === 'mic') && (
            <div className="flex items-center gap-3">
              <Icon d={I.Mic} size={14} className="text-indigo-400 shrink-0" />
              <span className="text-xs text-gray-400 w-20 shrink-0">Mic gain</span>
              <input type="range" min="0.1" max="4" step="0.05" value={micGain}
                onChange={e => setMicGain(parseFloat(e.target.value))} className="flex-1" />
              <span className="text-xs font-mono text-indigo-300 w-8 shrink-0">{micGain.toFixed(1)}×</span>
            </div>
          )}
          {(audioMode === 'mic+system' || audioMode === 'system') && (
            <div className="flex items-center gap-3">
              <Icon d={I.Volume2} size={14} className="text-indigo-400 shrink-0" />
              <span className="text-xs text-gray-400 w-20 shrink-0">System gain</span>
              <input type="range" min="0.1" max="4" step="0.05" value={sysGain}
                onChange={e => setSysGain(parseFloat(e.target.value))} className="flex-1" />
              <span className="text-xs font-mono text-indigo-300 w-8 shrink-0">{sysGain.toFixed(1)}×</span>
            </div>
          )}

          {/* Windows system audio note */}
          {!isWin && (audioMode === 'mic+system' || audioMode === 'system') && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-900/20 border border-amber-700/30 text-amber-300 text-xs">
              <Icon d={I.Info} size={13} className="shrink-0 mt-0.5" />
              System audio capture is only supported on Windows (WASAPI loopback).
              On macOS/Linux, install a virtual audio driver (BlackHole / PulseAudio loopback) and select it as a mic input.
            </div>
          )}
          {isWin && (audioMode === 'mic+system' || audioMode === 'system') && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-indigo-900/20 border border-indigo-700/30 text-indigo-300 text-xs">
              <Icon d={I.Info} size={13} className="shrink-0 mt-0.5" />
              Windows detected — full system audio (all apps, music, games) will be captured automatically via WASAPI loopback.
            </div>
          )}
        </section>
      )}

      {/* ── Recording in progress ── */}
      {isActive && (
        <section className="rounded-xl border border-border bg-surface2 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`relative w-3 h-3 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500'}`}>
                {!isPaused && <span className="absolute inset-0 rounded-full bg-red-500 animate-ping opacity-75" />}
              </div>
              <span className="text-sm font-semibold text-gray-200">
                {isPaused ? 'Paused' : 'Recording'}
              </span>
            </div>
            <span className="text-2xl font-mono font-bold text-gray-100">{fmtTime(duration)}</span>
          </div>

          {/* Waveform */}
          <canvas ref={waveCanvasRef} height={56}
            className="w-full rounded-lg border border-border"
            style={{ background: '#0a0a12' }}
          />

          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>Source: <span className="text-gray-300">{selectedSrc?.name}</span></span>
            <span>Audio: <span className={hasAudio ? 'text-green-400' : 'text-amber-400'}>{hasAudio ? 'Captured' : 'None'}</span></span>
            <span className="ml-auto">~{fmtBytes(chunkBytes)}</span>
          </div>
        </section>
      )}

      {/* ── Saving / converting ── */}
      {isSaving && (
        <section className="rounded-xl border border-border bg-surface2 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm font-semibold text-gray-200">
              {mp4Progress > 0 ? `Converting to MP4… ${mp4Progress}%` : 'Saving…'}
            </span>
          </div>
          {mp4Progress > 0 && (
            <div className="w-full bg-surface3 rounded-full h-2">
              <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${mp4Progress}%` }} />
            </div>
          )}
          <p className="text-xs text-gray-500">Using native ffmpeg — no browser memory limits. Do not close the app.</p>
        </section>
      )}

      {/* ── Done ── */}
      {status === 'done' && savedPath && (
        <section className="rounded-xl border border-green-700/40 bg-green-900/10 p-5 space-y-3">
          <div className="flex items-center gap-2 text-green-400 font-semibold text-sm">
            <Icon d={I.Check} size={16} /> Saved successfully
          </div>
          <p className="text-xs text-gray-400 font-mono break-all">{savedPath}</p>
          <div className="flex gap-2">
            <button onClick={() => eAPI.showInFolder(savedPath)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface3 border border-border text-sm text-gray-300 hover:text-white hover:bg-surface2 transition-colors">
              <Icon d={I.Folder} size={14} /> Show in folder
            </button>
            <button onClick={() => { setStatus('idle'); setDuration(0); setChunkBytes(0); setSavedPath(''); }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-sm text-white font-medium transition-colors">
              <Icon d={I.Film} size={14} /> New recording
            </button>
          </div>
        </section>
      )}

      {/* ── Action buttons ── */}
      <div style={{ WebkitAppRegion: 'no-drag' }}>
        {status === 'idle' && (
          <button onClick={startRecording} disabled={!selectedSrc}
            className="w-full h-12 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
            <Icon d={I.Monitor} size={16} />
            Start Recording
          </button>
        )}

        {isActive && (
          <div className="flex gap-3">
            <button onClick={togglePause}
              className="flex-1 h-12 rounded-xl border border-border bg-surface2 hover:bg-surface3 text-gray-200 font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
              <Icon d={isPaused ? I.Play : I.Pause} size={16} />
              {isPaused ? 'Resume' : 'Pause'}
            </button>

            <div className="flex gap-2">
              <button onClick={() => stopAndSave('webm')}
                className="h-12 px-4 rounded-xl bg-surface2 border border-border hover:bg-surface3 text-gray-200 font-semibold text-xs flex items-center gap-1.5 transition-colors">
                <Icon d={I.Download} size={14} /> WebM
              </button>
              <button onClick={() => stopAndSave('mp4')}
                className="h-12 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center gap-1.5 transition-colors">
                <Icon d={I.Download} size={14} /> MP4
              </button>
            </div>

            <button onClick={discard}
              className="h-12 px-4 rounded-xl border border-red-700/40 bg-red-900/10 hover:bg-red-900/20 text-red-400 flex items-center justify-center transition-colors">
              <Icon d={I.Trash} size={15} />
            </button>
          </div>
        )}
      </div>

      {/* ── Info footer ── */}
      {status === 'idle' && (
        <div className="rounded-xl border border-border bg-surface2 p-4 space-y-2 text-xs text-gray-500">
          <p className="font-semibold text-gray-400 flex items-center gap-1.5">
            <Icon d={I.Info} size={12} /> vs. Web version
          </p>
          <ul className="space-y-1 pl-4 list-disc">
            <li><span className="text-green-400">✓</span> Full system audio capture (all apps, music, games) — Windows only</li>
            <li><span className="text-green-400">✓</span> Mic + system audio mix with independent gain controls</li>
            <li><span className="text-green-400">✓</span> Native MP4 export via bundled ffmpeg — no browser memory limits</li>
            <li><span className="text-green-400">✓</span> Record any window or app, not just browser tabs</li>
            <li><span className="text-green-400">✓</span> Save directly to your Videos folder</li>
          </ul>
        </div>
      )}

    </div>
  );
}
