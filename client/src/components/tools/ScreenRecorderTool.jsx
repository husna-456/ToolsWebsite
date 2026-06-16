import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Monitor, Mic, Square, Download, Trash2, AlertCircle,
  Clock, Pause, Play, Info, Wifi, WifiOff, Volume2, Radio, Loader2,
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

// Upload blob to /api/tools/<slug>/process via XHR for real upload-progress events.
// Returns the processed file as a Blob. onUploadDone fires when upload phase finishes.
function uploadRecording(blob, slug, onUploadProgress, onUploadDone) {
  return new Promise((resolve, reject) => {
    const isAudio  = slug === 'audio-recorder';
    const formData = new FormData();
    formData.append(
      'file',
      new File([blob], 'recording.webm', { type: blob.type || (isAudio ? 'audio/webm' : 'video/webm') }),
    );

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/tools/${slug}/process`);
    xhr.responseType = 'blob';
    xhr.timeout = 10 * 60 * 1000; // 10 min — allow large files + FFmpeg time

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onUploadProgress(Math.round((e.loaded / e.total) * 100));
    };

    // Upload finished → FFmpeg starts on server
    xhr.upload.onload = () => onUploadDone();

    xhr.onload = () => {
      if (xhr.status === 200) {
        resolve(xhr.response);
      } else {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const body = JSON.parse(reader.result);
            reject(new Error(body.error || `Server error ${xhr.status}`));
          } catch {
            reject(new Error(`Server error ${xhr.status}`));
          }
        };
        reader.readAsText(xhr.response);
      }
    };

    xhr.onerror   = () => reject(new Error('Upload failed. Please check your connection.'));
    xhr.ontimeout = () => reject(new Error('Upload timed out. Try a shorter recording.'));

    xhr.send(formData);
  });
}


export default function ScreenRecorderTool({ tool }) {
  const [mode,           setMode]           = useState('screen');
  const [status,         setStatus]         = useState('idle');
  const [duration,       setDuration]       = useState(0);
  const [blobUrl,        setBlobUrl]        = useState(null);
  const [filename,       setFilename]       = useState('');
  const [error,          setError]          = useState('');
  const [audioOn,        setAudioOn]        = useState(true);
  const [gainValue,      setGainValue]      = useState(2.0);
  const [mixMode,        setMixMode]        = useState('mixed');
  // Screen recording server-pipeline states
  const [uploadPct,      setUploadPct]      = useState(null);  // null = idle, 0–100 = uploading
  const [serverProc,     setServerProc]     = useState(false); // FFmpeg running on server

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

      recorder.onstop = async () => {
        clearInterval(timerRef.current);
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;

        const blob  = new Blob(chunksRef.current, { type: mimeType });
        chunksRef.current = []; // free memory early
        const fname = `screen-recording-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.mp4`;

        // ── Phase 1: Upload ───────────────────────────────────
        setUploadPct(0);
        try {
          const mp4Blob = await uploadRecording(
            blob,
            'screen-recorder',
            setUploadPct,
            () => { setUploadPct(null); setServerProc(true); },
          );

          const url = URL.createObjectURL(mp4Blob);
          blobUrlRef.current = url;
          setBlobUrl(url);
          setFilename(fname);
          setStatus('stopped');

          // Auto-download the finished MP4
          const a = document.createElement('a');
          a.href = url; a.download = fname;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
        } catch (err) {
          setError(err.message || 'Processing failed. Please try again.');
          setStatus('idle');
        } finally {
          setUploadPct(null);
          setServerProc(false);
        }
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

      recorder.onstop = async () => {
        clearInterval(timerRef.current);
        stopWaveform();
        micStream.getTracks().forEach(t => t.stop());
        sysStream?.getTracks().forEach(t => t.stop());
        streamRef.current    = null;
        sysStreamRef.current = null;

        const blob  = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || 'audio/webm' });
        chunksRef.current = [];
        const fname = `audio-recording-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.mp3`;

        setUploadPct(0);
        try {
          const mp3Blob = await uploadRecording(
            blob,
            'audio-recorder',
            setUploadPct,
            () => { setUploadPct(null); setServerProc(true); },
          );

          const url = URL.createObjectURL(mp3Blob);
          blobUrlRef.current = url;
          setBlobUrl(url);
          setFilename(fname);
          setStatus('stopped');

          const a = document.createElement('a');
          a.href = url; a.download = fname;
          document.body.appendChild(a); a.click(); document.body.removeChild(a);
        } catch (err) {
          setError(err.message || 'Processing failed. Please try again.');
          setStatus('idle');
        } finally {
          setUploadPct(null);
          setServerProc(false);
        }
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
  const isAudioMode  = mode === 'audio';
  const isRecording  = status === 'recording';
  const isPaused     = status === 'paused';
  const isActive     = isRecording || isPaused;
  const isUploading  = uploadPct !== null;
  const isProcessing = isUploading || serverProc;

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

        {/* ── Upload progress (screen recording → server) ── */}
        {isUploading && (
          <div className="flex flex-col items-center gap-4 py-6">
            <Loader2 className="w-9 h-9 text-accent animate-spin" />
            <div className="w-full space-y-2">
              <div className="flex justify-between text-sm font-medium text-text-primary">
                <span>Uploading recording…</span>
                <span className="text-accent font-mono">{uploadPct}%</span>
              </div>
              <div className="w-full bg-border rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-accent h-2.5 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${uploadPct}%` }}
                />
              </div>
              <p className="text-xs text-text-muted text-center">
                Larger recordings take longer — please keep this tab open
              </p>
            </div>
          </div>
        )}

        {/* ── Server FFmpeg processing ── */}
        {serverProc && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <Loader2 className="w-10 h-10 text-accent animate-spin" />
            <p className="font-semibold text-text-primary">
              {mode === 'audio' ? 'Processing audio…' : 'Processing video…'}
            </p>
            <p className="text-sm text-text-muted">
              {mode === 'audio' ? 'Converting to seekable MP3' : 'FFmpeg is encoding audio + fixing seekability'}
            </p>
          </div>
        )}

        {/* ── Mode selector (idle only) ── */}
        {!isProcessing && status === 'idle' && (
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
        {!isProcessing && status === 'idle' && mode === 'screen' && (
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
                  The recording is processed by our server for full audio and seek support.
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
        {!isProcessing && status === 'idle' && mode === 'audio' && (
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
        {!isProcessing && isActive && mode === 'screen' && (
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
        {!isProcessing && isActive && mode === 'audio' && (
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
        {!isProcessing && status === 'stopped' && blobUrl && (
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
        {!isProcessing && (
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
        )}

        {/* Duration summary */}
        {!isProcessing && status === 'stopped' && duration > 0 && (
          <div className="flex items-center justify-center gap-2 text-sm text-text-muted">
            <Clock className="w-4 h-4" />
            <span>Recorded {formatDuration(duration)}</span>
          </div>
        )}

      </div>
    </div>
  );
}
