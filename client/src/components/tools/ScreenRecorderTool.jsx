import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Monitor, Mic, Square, Download, Trash2, AlertCircle,
  Clock, Pause, Play, Info, Wifi, WifiOff, Volume2, Radio,
} from 'lucide-react';

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Ordered by preference — MP4 first, WebM variants as fallback.
const VIDEO_MIME_CANDIDATES = [
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

export default function ScreenRecorderTool({ tool }) {
  const [mode,      setMode]      = useState('screen');
  const [status,    setStatus]    = useState('idle');
  const [duration,  setDuration]  = useState(0);
  const [blobUrl,   setBlobUrl]   = useState(null);
  const [filename,  setFilename]  = useState('');
  const [error,     setError]     = useState('');
  const [audioOn,   setAudioOn]   = useState(true);
  const [gainValue, setGainValue] = useState(2.0);
  const [mixMode,   setMixMode]   = useState('mixed');

  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const streamRef        = useRef(null);
  const sysStreamRef     = useRef(null);
  const timerRef         = useRef(null);
  const blobUrlRef       = useRef(null);
  const canvasRef        = useRef(null);
  const analyserRef      = useRef(null);
  const audioCtxRef      = useRef(null);
  const animFrameRef     = useRef(null);

  function stopWaveform() {
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    if (audioCtxRef.current)  { audioCtxRef.current.close();                audioCtxRef.current  = null; }
    analyserRef.current = null;
  }

  useEffect(() => {
    return () => {
      if (blobUrlRef.current)          URL.revokeObjectURL(blobUrlRef.current);
      clearInterval(timerRef.current);
      stopWaveform();
      streamRef.current?.getTracks().forEach(t => t.stop());
      sysStreamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, []);

  const screenSupported = !!(navigator.mediaDevices?.getDisplayMedia);

  function prepareNew() {
    setError('');
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    setBlobUrl(null);
    setFilename('');
    setDuration(0);
    chunksRef.current = [];
  }

  // ── Screen recording ─────────────────────────────────────────
  const startScreenRecording = useCallback(async () => {
    prepareNew();
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 60 }, cursor: 'never', displaySurface: 'browser' },
        ...(audioOn
          ? { audio: { echoCancellation: false, noiseSuppression: false, sampleRate: 44100 } }
          : { audio: false }),
        selfBrowserSurface: 'exclude',
        preferCurrentTab: false,
        systemAudio: 'exclude',
      });
      streamRef.current = stream;

      const mimeType = VIDEO_MIME_CANDIDATES.find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm';
      const recorder = new MediaRecorder(stream, {
        mimeType,
        videoBitsPerSecond: 2_500_000,
        audioBitsPerSecond: 128_000,
      });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunksRef.current.push(e.data); };

      recorder.onstop = () => {
        clearInterval(timerRef.current);
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;

        const blob  = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = [];

        const ext   = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const fname = `screen-recording-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`;
        const url   = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobUrl(url);
        setFilename(fname);
        setStatus('stopped');

        const a = document.createElement('a');
        a.href = url; a.download = fname;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      };

      stream.getVideoTracks()[0].onended = () => {
        if (recorder.state !== 'inactive') recorder.stop();
      };

      recorder.start(2000);
      setStatus('recording');
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch (err) {
      if (err.name === 'NotAllowedError')
        setError('Permission denied. Please allow screen sharing when prompted.');
      else if (err.name === 'NotSupportedError')
        setError('Screen recording is not supported in this browser. Try Audio Only mode instead.');
      else
        setError(err.message || 'Could not start recording. Please try again.');
    }
  }, [audioOn]);

  // ── Audio-only recording ──────────────────────────────────────
  const startAudioRecording = useCallback(async () => {
    prepareNew();
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true, sampleRate: 44100 },
      });
      streamRef.current = micStream;

      // System / tab audio (optional)
      let sysStream = null;
      if (mixMode === 'mixed') {
        const sysAudio = { autoGainControl: true, echoCancellation: false, noiseSuppression: false };
        let sysErr = null;
        try {
          sysStream = await navigator.mediaDevices.getDisplayMedia({ video: false, audio: sysAudio });
        } catch (e) { sysErr = e; }

        if (!sysStream && sysErr && sysErr.name !== 'NotAllowedError') {
          try {
            sysStream = await navigator.mediaDevices.getDisplayMedia({
              video: { width: 1, height: 1, frameRate: 1 },
              audio: sysAudio,
            });
          } catch (e) { sysErr = e; }
        }

        if (sysStream) {
          sysStream.getVideoTracks().forEach(t => t.stop());
          if (!sysStream.getAudioTracks().length) {
            sysStream.getTracks().forEach(t => t.stop());
            sysStream = null;
            setError('Selected tab has no audio — recording microphone only.');
          } else {
            sysStreamRef.current = sysStream;
          }
        } else {
          setError(sysErr?.name === 'NotAllowedError'
            ? 'Class audio cancelled — recording microphone only.'
            : 'Could not capture class audio — recording microphone only.');
        }
      }

      // Web Audio mixing graph
      const audioCtx  = new AudioContext();
      const micSource = audioCtx.createMediaStreamSource(micStream);
      const micGain   = audioCtx.createGain();
      micGain.gain.value = gainValue;
      micSource.connect(micGain);
      const destination = audioCtx.createMediaStreamDestination();
      micGain.connect(destination);

      let sysGain = null;
      if (sysStream?.getAudioTracks().length) {
        const sysSource = audioCtx.createMediaStreamSource(sysStream);
        sysGain = audioCtx.createGain();
        sysGain.gain.value = gainValue;
        sysSource.connect(sysGain);
        sysGain.connect(destination);
      }
      audioCtxRef.current = audioCtx;

      const mimeTypes = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4'];
      const mimeType  = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || '';

      const recorder = new MediaRecorder(destination.stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunksRef.current.push(e.data); };

      recorder.onstop = () => {
        clearInterval(timerRef.current);
        stopWaveform();
        micStream.getTracks().forEach(t => t.stop());
        sysStream?.getTracks().forEach(t => t.stop());
        streamRef.current    = null;
        sysStreamRef.current = null;

        const finalMime = recorder.mimeType || mimeType || 'audio/webm';
        const blob      = new Blob(chunksRef.current, { type: finalMime });
        chunksRef.current = [];

        const ext   = finalMime.includes('mp4') ? 'm4a' : finalMime.includes('ogg') ? 'ogg' : 'webm';
        const fname = `audio-recording-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`;
        const url   = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobUrl(url);
        setFilename(fname);
        setStatus('stopped');

        const a = document.createElement('a');
        a.href = url; a.download = fname;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      };

      recorder.start(1000);
      setStatus('recording');
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);

      setTimeout(() => {
        if (!canvasRef.current || !audioCtxRef.current) return;
        try {
          const analyser = audioCtxRef.current.createAnalyser();
          analyser.fftSize = 512;
          micGain.connect(analyser);
          if (sysGain) sysGain.connect(analyser);
          analyserRef.current = analyser;

          const canvas    = canvasRef.current;
          const canvasCtx = canvas.getContext('2d');
          const dataArray = new Uint8Array(analyser.frequencyBinCount);

          function draw() {
            animFrameRef.current = requestAnimationFrame(draw);
            analyser.getByteTimeDomainData(dataArray);
            canvas.width = canvas.clientWidth || 300;
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            canvasCtx.fillStyle = 'rgba(99,102,241,0.06)';
            canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
            canvasCtx.lineWidth   = 2.5;
            canvasCtx.strokeStyle = '#6366f1';
            canvasCtx.beginPath();
            const sliceWidth = canvas.width / dataArray.length;
            let x = 0;
            for (let i = 0; i < dataArray.length; i++) {
              const y = ((dataArray[i] / 128.0) * canvas.height) / 2;
              i === 0 ? canvasCtx.moveTo(x, y) : canvasCtx.lineTo(x, y);
              x += sliceWidth;
            }
            canvasCtx.lineTo(canvas.width, canvas.height / 2);
            canvasCtx.stroke();
          }
          draw();
        } catch { /* AudioContext unavailable */ }
      }, 120);
    } catch (err) {
      if (err.name === 'NotAllowedError')
        setError('Microphone permission denied. Please allow microphone access when prompted.');
      else
        setError(err.message || 'Could not access microphone. Please try again.');
    }
  }, [gainValue, mixMode]);

  // ── Stop / Pause / Resume ────────────────────────────────────
  const stopRecording = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== 'inactive') rec.stop();
    clearInterval(timerRef.current);
  }, []);

  const togglePause = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (!rec) return;
    if (rec.state === 'recording') {
      rec.pause(); clearInterval(timerRef.current); setStatus('paused');
    } else if (rec.state === 'paused') {
      rec.resume(); timerRef.current = setInterval(() => setDuration(d => d + 1), 1000); setStatus('recording');
    }
  }, []);

  const downloadRecording = useCallback(() => {
    if (!blobUrl || !filename) return;
    const a = document.createElement('a');
    a.href = blobUrl; a.download = filename;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
  }, [blobUrl, filename]);

  const discardRecording = useCallback(() => {
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    setBlobUrl(null); setFilename(''); setDuration(0);
    setStatus('idle'); chunksRef.current = [];
  }, []);

  // ── Derived flags ────────────────────────────────────────────
  const isAudioMode = mode === 'audio';
  const isRecording = status === 'recording';
  const isPaused    = status === 'paused';
  const isActive    = isRecording || isPaused;

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="panel-card shadow-lg">

      {/* ── Header ── */}
      <div className="panel-header">
        <div className="flex items-center gap-2">
          {isAudioMode ? <Mic className="w-4 h-4 text-text-muted" /> : <Monitor className="w-4 h-4 text-text-muted" />}
          <span className="text-sm font-semibold text-text-primary">
            {isAudioMode ? 'Audio Recorder' : 'Screen Recorder'}
          </span>
        </div>
        {isActive && (
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
            <span className={`text-sm font-mono font-semibold ${isPaused ? 'text-yellow-500' : 'text-red-500'}`}>
              {formatDuration(duration)}
            </span>
          </div>
        )}
      </div>

      <div className="p-4 sm:p-6 space-y-5">

        {/* ── Error banner ── */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* ── Mode selector (idle only) ── */}
        {status === 'idle' && (
          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'screen', label: 'Record Screen', Icon: Monitor },
              { id: 'audio',  label: 'Audio Only',    Icon: Mic },
            ].map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => { setMode(id); setError(''); }}
                className={`flex flex-col items-center gap-2 px-3 py-4 rounded-2xl border-2 text-sm font-semibold transition-all ${
                  mode === id
                    ? 'border-accent bg-accent/5 text-accent'
                    : 'border-border text-text-muted hover:border-accent/40 hover:text-text-primary'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        )}

        {/* ── Screen mode options (idle) ── */}
        {status === 'idle' && mode === 'screen' && (
          <>
            {!screenSupported ? (
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Your browser doesn't support screen recording. Use{' '}
                  <button className="font-semibold underline" onClick={() => setMode('audio')}>Audio Only</button>{' '}
                  or try Chrome.
                </span>
              </div>
            ) : !error && (
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Choose what to share — a browser tab, a window, or full screen.
                  The recording is saved directly in your browser — no upload needed.
                </span>
              </div>
            )}

            {screenSupported && (
              <div className="flex flex-wrap items-center gap-3 p-4 bg-surface-2 rounded-xl border border-border">
                <button
                  onClick={() => setAudioOn(a => !a)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                    audioOn ? 'bg-white border-accent text-accent shadow-sm' : 'bg-white border-border text-text-muted'
                  }`}
                >
                  {audioOn ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
                  {audioOn ? 'System audio: ON' : 'System audio: OFF'}
                </button>
                <p className="text-xs text-text-muted">Captures tab and system audio alongside the screen.</p>
              </div>
            )}
          </>
        )}

        {/* ── Audio mode options (idle) ── */}
        {status === 'idle' && mode === 'audio' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'mixed', label: 'Mic + Class Audio', Icon: Radio },
                { id: 'mic',   label: 'Mic Only',          Icon: Mic },
              ].map(({ id, label, Icon }) => (
                <button
                  key={id}
                  onClick={() => { setMixMode(id); setError(''); }}
                  className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                    mixMode === id ? 'border-accent bg-accent/5 text-accent' : 'border-border text-text-muted hover:border-accent/40'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {!error && mixMode === 'mixed' && (
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Two permission prompts will appear:</p>
                  <ol className="list-decimal list-inside space-y-0.5 text-blue-600">
                    <li>Allow microphone access</li>
                    <li>Select the <strong>tab</strong> to capture (e.g. Google Meet) — tick <strong>"Share tab audio"</strong></li>
                  </ol>
                </div>
              </div>
            )}
            {!error && mixMode === 'mic' && (
              <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm">
                <Info className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Records microphone audio only. No tab selection needed.</span>
              </div>
            )}

            <div className="flex flex-col gap-3 p-4 bg-surface-2 rounded-xl border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                  <Volume2 className="w-4 h-4 text-accent" />
                  Volume Boost
                </div>
                <span className="text-sm font-mono font-semibold text-accent">{gainValue.toFixed(1)}×</span>
              </div>
              <input
                type="range" min="1" max="5" step="0.1"
                value={gainValue}
                onChange={e => setGainValue(parseFloat(e.target.value))}
                className="w-full accent-accent"
              />
              <p className="text-xs text-text-muted">2× recommended for most meetings.</p>
            </div>
          </>
        )}

        {/* ── Active: screen recording indicator ── */}
        {isActive && mode === 'screen' && (
          <div className="flex flex-col items-center justify-center py-8 gap-4">
            <div className="relative w-20 h-20 rounded-full border-4 border-red-200 flex items-center justify-center">
              {!isPaused && <span className="absolute w-10 h-10 rounded-full bg-red-500/15 animate-ping" />}
              <Square className="w-8 h-8 text-red-500 fill-red-500" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-semibold text-text-primary">
                {isPaused ? 'Recording paused' : 'Recording in progress'}
              </p>
              <p className="text-4xl font-mono font-bold text-primary">{formatDuration(duration)}</p>
              {!isPaused && (
                <p className="text-sm text-text-muted">Click Stop or use the browser's "Stop sharing" button</p>
              )}
            </div>
          </div>
        )}

        {/* ── Active: audio-only waveform ── */}
        {isActive && mode === 'audio' && (
          <div className="flex flex-col items-center gap-4 py-2">
            <canvas ref={canvasRef} height={72} className="w-full rounded-xl border border-border" />
            <div className="text-center space-y-1">
              <p className="flex items-center justify-center gap-2 font-semibold text-text-primary">
                <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
                {isPaused ? 'Recording paused' : 'Recording audio…'}
              </p>
              <p className="text-4xl font-mono font-bold text-primary">{formatDuration(duration)}</p>
            </div>
          </div>
        )}

        {/* ── Completed: preview ── */}
        {status === 'stopped' && blobUrl && (
          <div className="space-y-3">
            {mode === 'screen' ? (
              <video
                src={blobUrl} controls
                className="w-full rounded-xl border border-border bg-black"
                style={{ maxHeight: '360px' }}
              />
            ) : (
              <div className="p-6 bg-surface-2 rounded-xl border border-border flex flex-col items-center gap-4">
                <div className="w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center border border-accent/20">
                  <Mic className="w-7 h-7 text-accent" />
                </div>
                <audio src={blobUrl} controls className="w-full" />
              </div>
            )}
            <p className="text-xs text-text-muted text-center break-all">{filename}</p>
          </div>
        )}

        {/* ── Action buttons ── */}
        <div className="flex flex-col sm:flex-row gap-3">

          {status === 'idle' && (
            <button
              onClick={mode === 'screen' ? startScreenRecording : startAudioRecording}
              disabled={mode === 'screen' && !screenSupported}
              className="btn-primary w-full h-12 text-[15px] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {mode === 'screen' ? <Monitor className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              {mode === 'screen'
                ? 'Start Screen Recording'
                : mixMode === 'mixed' ? 'Start Recording (Mic + Class Audio)' : 'Start Recording (Mic Only)'}
            </button>
          )}

          {isActive && (
            <>
              <button
                onClick={togglePause}
                className="flex-1 h-12 text-[15px] flex items-center justify-center gap-2 rounded-xl font-semibold border border-border bg-surface-2 hover:bg-surface-3 text-text-primary transition-colors"
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                {isPaused ? 'Resume' : 'Pause'}
              </button>
              <button
                onClick={stopRecording}
                className="flex-1 h-12 text-[15px] flex items-center justify-center gap-2 rounded-xl font-semibold bg-red-500 hover:bg-red-600 text-white transition-colors shadow-sm"
              >
                <Square className="w-4 h-4 fill-white" />
                Stop Recording
              </button>
            </>
          )}

          {status === 'stopped' && (
            <>
              <button onClick={downloadRecording} className="btn-primary flex-1 h-12 text-[15px]">
                <Download className="w-4 h-4" />
                Download Again
              </button>
              <button onClick={discardRecording} className="btn-ghost h-12 px-5">
                <Trash2 className="w-4 h-4" />
                Discard
              </button>
            </>
          )}
        </div>

        {/* Duration summary */}
        {status === 'stopped' && duration > 0 && (
          <div className="flex items-center justify-center gap-2 text-sm text-text-muted">
            <Clock className="w-4 h-4" />
            <span>Recorded {formatDuration(duration)}</span>
          </div>
        )}

      </div>
    </div>
  );
}
