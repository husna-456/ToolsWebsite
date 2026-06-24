import { useState, useRef, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import {
  Monitor, Mic, MicOff, Square, Download, Trash2, AlertCircle,
  Clock, Pause, Play, Info, Wifi, WifiOff, Volume2, Radio,
  Share2, Pen, Highlighter, ArrowUpRight, Type, X, Layers,
  Circle, Eraser, Undo2, Redo2, Users, Link, Copy, Check, EyeOff,
} from 'lucide-react';

const SOCKET_URL  = import.meta.env.VITE_API_BASE_URL || 'https://globaltechtools.thefiveriverz.com';
const SHARE_BASE  = import.meta.env.VITE_APP_URL       || 'https://globaltechtool.com';
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];
const CANVAS_W = 1280;
const CANVAS_H = 720;

function formatDuration(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const VIDEO_MIME_CANDIDATES = [
  'video/mp4',
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];

const ANNOT_TOOLS = [
  { id: 'pen',       label: 'Pen',        Icon: Pen },
  { id: 'highlight', label: 'Highlight',  Icon: Highlighter },
  { id: 'arrow',     label: 'Arrow',      Icon: ArrowUpRight },
  { id: 'rect',      label: 'Rectangle',  Icon: Square },
  { id: 'circle',    label: 'Circle',     Icon: Circle },
  { id: 'text',      label: 'Text',       Icon: Type },
  { id: 'eraser',    label: 'Eraser',     Icon: Eraser },
];

const ANNOT_COLORS = ['#ef4444','#f97316','#eab308','#22c55e','#3b82f6','#8b5cf6','#ffffff','#111111'];

function getCanvasPos(e, canvas) {
  const rect  = canvas.getBoundingClientRect();
  const touch = e.touches?.[0] || e;
  return {
    x: (touch.clientX - rect.left) * (canvas.width  / rect.width),
    y: (touch.clientY - rect.top)  * (canvas.height / rect.height),
  };
}

function AnnotationToolbar({
  annotTool, setAnnotTool, annotColor, setAnnotColor,
  annotSize, setAnnotSize, onClear, onUndo, onRedo,
  canUndo, canRedo, showAnnot, setShowAnnot,
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 p-2.5 rounded-xl border border-gray-700" style={{ background: '#0d0d14' }}>
      {/* Show/hide toggle */}
      <button
        onClick={() => setShowAnnot(v => !v)}
        title={showAnnot ? 'Hide annotations' : 'Show annotations'}
        className={`p-2 rounded-lg transition-colors ${showAnnot ? 'bg-accent text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}
      >
        <EyeOff className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-gray-700" />

      {/* Tools */}
      <div className="flex items-center gap-0.5">
        {ANNOT_TOOLS.map(({ id, label, Icon }) => (
          <button
            key={id}
            title={label}
            onClick={() => setAnnotTool(id)}
            className={`p-1.5 rounded-lg transition-colors ${
              annotTool === id ? 'bg-accent text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'
            }`}
          >
            <Icon className="w-4 h-4" />
          </button>
        ))}
      </div>

      <div className="w-px h-6 bg-gray-700" />

      {/* Colors */}
      <div className="flex items-center gap-1">
        {ANNOT_COLORS.map(c => (
          <button
            key={c}
            onClick={() => setAnnotColor(c)}
            style={{
              width: 18, height: 18, borderRadius: '50%', background: c, flexShrink: 0,
              border: annotColor === c ? '2px solid white' : '2px solid #444',
              outline: annotColor === c ? '1px solid #888' : 'none',
            }}
          />
        ))}
      </div>

      <div className="w-px h-6 bg-gray-700" />

      {/* Size */}
      <input
        type="range" min="1" max="12" step="1"
        value={annotSize}
        onChange={e => setAnnotSize(Number(e.target.value))}
        className="w-20 accent-accent"
        title="Stroke size"
      />

      <div className="w-px h-6 bg-gray-700" />

      {/* Undo / Redo */}
      <button onClick={onUndo} disabled={!canUndo} title="Undo"
        className="p-1.5 rounded-lg transition-colors text-gray-400 hover:bg-gray-800 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed">
        <Undo2 className="w-4 h-4" />
      </button>
      <button onClick={onRedo} disabled={!canRedo} title="Redo"
        className="p-1.5 rounded-lg transition-colors text-gray-400 hover:bg-gray-800 hover:text-gray-200 disabled:opacity-30 disabled:cursor-not-allowed">
        <Redo2 className="w-4 h-4" />
      </button>

      <div className="w-px h-6 bg-gray-700" />

      {/* Clear */}
      <button onClick={onClear}
        className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-gray-400 hover:bg-gray-800 hover:text-red-400 transition-colors">
        <Trash2 className="w-3.5 h-3.5" />
        Clear
      </button>
    </div>
  );
}

export default function ScreenRecorderTool({ tool }) {

  // ── EXISTING state (unchanged) ───────────────────────────────
  const [mode,      setMode]      = useState('screen');
  const [status,    setStatus]    = useState('idle');
  const [duration,  setDuration]  = useState(0);
  const [blobUrl,   setBlobUrl]   = useState(null);
  const [filename,  setFilename]  = useState('');
  const [error,     setError]     = useState('');
  const [audioOn,   setAudioOn]   = useState(true);
  const [gainValue, setGainValue] = useState(2.0);
  const [mixMode,   setMixMode]   = useState('mixed');

  // ── Tab ────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState('record');  // 'record' | 'live' | 'annotate'

  // ── Share Live state ──────────────────────────────────────────
  const [sharePhase,   setSharePhase]   = useState('idle');  // idle | active | paused
  const [sessionId,    setSessionId]    = useState('');
  const [viewerCount,  setViewerCount]  = useState(0);
  const [shareMic,     setShareMic]     = useState(false);
  const [shareError,   setShareError]   = useState('');
  const [linkCopied,   setLinkCopied]   = useState(false);
  const [showAnnot,    setShowAnnot]    = useState(true);

  // ── Annotation state ──────────────────────────────────────────
  const [annotTool,   setAnnotTool]   = useState('pen');
  const [annotColor,  setAnnotColor]  = useState('#ef4444');
  const [annotSize,   setAnnotSize]   = useState(3);
  const [textState,   setTextState]   = useState(null);  // { x, y, pctX, pctY, value }

  // ── EXISTING refs (unchanged) ─────────────────────────────────
  const mediaRecorderRef = useRef(null);
  const chunksRef        = useRef([]);
  const streamRef        = useRef(null);
  const sysStreamRef     = useRef(null);
  const timerRef         = useRef(null);
  const blobUrlRef       = useRef(null);
  const canvasRef        = useRef(null);    // audio waveform
  const analyserRef      = useRef(null);
  const audioCtxRef      = useRef(null);
  const animFrameRef     = useRef(null);

  // ── New refs ──────────────────────────────────────────────────
  const shareVideoRef  = useRef(null);
  const shareStreamRef = useRef(null);
  const socketRef      = useRef(null);
  const peersRef       = useRef(new Map());    // viewerId → RTCPeerConnection
  const overlayRef     = useRef(null);         // annotation canvas on share preview
  const whiteboardRef  = useRef(null);         // standalone whiteboard

  // Annotation draw state refs (avoid re-creating callbacks)
  const isDrawingRef   = useRef(false);
  const startPtRef     = useRef(null);
  const savedImgRef    = useRef(null);
  // Undo / redo stacks (array of ImageData)
  const undoStackRef   = useRef([]);
  const redoStackRef   = useRef([]);
  const [undoLen, setUndoLen] = useState(0);  // mirror lengths for button enable/disable
  const [redoLen, setRedoLen] = useState(0);

  // ── stopWaveform (unchanged) ──────────────────────────────────
  function stopWaveform() {
    if (animFrameRef.current) { cancelAnimationFrame(animFrameRef.current); animFrameRef.current = null; }
    if (audioCtxRef.current)  { audioCtxRef.current.close();                audioCtxRef.current  = null; }
    analyserRef.current = null;
  }

  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
      clearInterval(timerRef.current);
      stopWaveform();
      streamRef.current?.getTracks().forEach(t => t.stop());
      sysStreamRef.current?.getTracks().forEach(t => t.stop());
      shareStreamRef.current?.getTracks().forEach(t => t.stop());
      socketRef.current?.disconnect();
      peersRef.current.forEach(pc => pc.close());
    };
  }, []);

  // Size whiteboard canvas when tab activates
  useEffect(() => {
    const cvs = whiteboardRef.current;
    if (activeTab === 'annotate' && cvs && !cvs._init) {
      cvs.width  = cvs.offsetWidth  || 800;
      cvs.height = cvs.offsetHeight || 360;
      cvs._init  = true;
    }
  }, [activeTab]);

  const screenSupported = !!(navigator.mediaDevices?.getDisplayMedia);

  function prepareNew() {
    setError('');
    if (blobUrlRef.current) { URL.revokeObjectURL(blobUrlRef.current); blobUrlRef.current = null; }
    setBlobUrl(null); setFilename(''); setDuration(0);
    chunksRef.current = [];
  }

  // ── Existing Screen recording (unchanged) ─────────────────────
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
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000, audioBitsPerSecond: 128_000 });
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
        setBlobUrl(url); setFilename(fname); setStatus('stopped');
        const a = document.createElement('a');
        a.href = url; a.download = fname;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
      };
      stream.getVideoTracks()[0].onended = () => { if (recorder.state !== 'inactive') recorder.stop(); };
      recorder.start(2000);
      setStatus('recording');
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
    } catch (err) {
      if (err.name === 'NotAllowedError')       setError('Permission denied. Please allow screen sharing when prompted.');
      else if (err.name === 'NotSupportedError') setError('Screen recording is not supported in this browser. Try Audio Only mode instead.');
      else                                       setError(err.message || 'Could not start recording. Please try again.');
    }
  }, [audioOn]);

  // ── Existing Audio-only recording (unchanged) ─────────────────
  const startAudioRecording = useCallback(async () => {
    prepareNew();
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true, sampleRate: 44100 },
      });
      streamRef.current = micStream;
      let sysStream = null;
      if (mixMode === 'mixed') {
        const sysAudio = { autoGainControl: true, echoCancellation: false, noiseSuppression: false };
        let sysErr = null;
        try { sysStream = await navigator.mediaDevices.getDisplayMedia({ video: false, audio: sysAudio }); }
        catch (e) { sysErr = e; }
        if (!sysStream && sysErr && sysErr.name !== 'NotAllowedError') {
          try { sysStream = await navigator.mediaDevices.getDisplayMedia({ video: { width: 1, height: 1, frameRate: 1 }, audio: sysAudio }); }
          catch (e) { sysErr = e; }
        }
        if (sysStream) {
          sysStream.getVideoTracks().forEach(t => t.stop());
          if (!sysStream.getAudioTracks().length) {
            sysStream.getTracks().forEach(t => t.stop()); sysStream = null;
            setError('Selected tab has no audio — recording microphone only.');
          } else { sysStreamRef.current = sysStream; }
        } else {
          setError(sysErr?.name === 'NotAllowedError'
            ? 'Class audio cancelled — recording microphone only.'
            : 'Could not capture class audio — recording microphone only.');
        }
      }
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
        sysGain = audioCtx.createGain(); sysGain.gain.value = gainValue;
        sysSource.connect(sysGain); sysGain.connect(destination);
      }
      audioCtxRef.current = audioCtx;
      const mimeTypes = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm', 'audio/mp4'];
      const mimeType  = mimeTypes.find(m => MediaRecorder.isTypeSupported(m)) || '';
      const recorder  = new MediaRecorder(destination.stream, mimeType ? { mimeType } : {});
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (e) => { if (e.data?.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        clearInterval(timerRef.current); stopWaveform();
        micStream.getTracks().forEach(t => t.stop());
        sysStream?.getTracks().forEach(t => t.stop());
        streamRef.current = null; sysStreamRef.current = null;
        const finalMime = recorder.mimeType || mimeType || 'audio/webm';
        const blob      = new Blob(chunksRef.current, { type: finalMime });
        chunksRef.current = [];
        const ext   = finalMime.includes('mp4') ? 'm4a' : finalMime.includes('ogg') ? 'ogg' : 'webm';
        const fname = `audio-recording-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.${ext}`;
        const url   = URL.createObjectURL(blob);
        blobUrlRef.current = url;
        setBlobUrl(url); setFilename(fname); setStatus('stopped');
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
            canvasCtx.lineWidth = 2.5; canvasCtx.strokeStyle = '#6366f1';
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
      if (err.name === 'NotAllowedError') setError('Microphone permission denied. Please allow microphone access when prompted.');
      else                                setError(err.message || 'Could not access microphone. Please try again.');
    }
  }, [gainValue, mixMode]);

  // ── Existing Stop / Pause / Resume (unchanged) ────────────────
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

  // ════════════════════════════════════════════════════════════
  // ── Share Live: WebRTC helpers ────────────────────────────────
  // ════════════════════════════════════════════════════════════

  const emitAnnot = useCallback((event) => {
    if (socketRef.current && sessionId) {
      socketRef.current.emit('share:annotation', { sessionId, event });
    }
  }, [sessionId]);

  const createPeer = useCallback((viewerId, stream) => {
    const socket = socketRef.current;
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    pc.onicecandidate = (e) => {
      if (e.candidate && socket) socket.emit('share:ice-candidate', { targetId: viewerId, candidate: e.candidate });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        peersRef.current.delete(viewerId);
        pc.close();
      }
    };
    return pc;
  }, []);

  const stopLiveShare = useCallback(() => {
    const socket = socketRef.current;
    const sid    = sessionId;
    if (socket && sid) socket.emit('share:stop', { sessionId: sid });
    socket?.disconnect();
    socketRef.current = null;

    shareStreamRef.current?.getTracks().forEach(t => t.stop());
    shareStreamRef.current = null;
    if (shareVideoRef.current) shareVideoRef.current.srcObject = null;

    peersRef.current.forEach(pc => pc.close());
    peersRef.current.clear();

    setSharePhase('idle');
    setSessionId('');
    setViewerCount(0);

    const ov = overlayRef.current;
    if (ov) ov.getContext('2d').clearRect(0, 0, ov.width, ov.height);
    undoStackRef.current = []; redoStackRef.current = [];
    setUndoLen(0); setRedoLen(0);
  }, [sessionId]);

  const startLiveShare = useCallback(async () => {
    setShareError('');
    if (!screenSupported) return;

    const newSid = Array.from(crypto.getRandomValues(new Uint8Array(5)))
      .map(b => b.toString(36)).join('').slice(0, 8);

    // Connect socket
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('share:viewer-joined', async ({ viewerId }) => {
      const stream = shareStreamRef.current;
      if (!stream) return;
      const pc    = createPeer(viewerId, stream);
      peersRef.current.set(viewerId, pc);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('share:offer', { targetId: viewerId, offer, sessionId: newSid });

      // Sync current annotations to this new viewer
      const ov = overlayRef.current;
      if (ov) {
        const dataUrl = ov.toDataURL('image/png', 0.8);
        socket.emit('share:sync-to-viewer', { targetId: viewerId, event: { type: 'sync', dataUrl } });
      }
    });

    socket.on('share:answer', async ({ fromId, answer }) => {
      await peersRef.current.get(fromId)?.setRemoteDescription(answer);
    });

    socket.on('share:ice-candidate', ({ fromId, candidate }) => {
      peersRef.current.get(fromId)?.addIceCandidate(candidate).catch(() => {});
    });

    socket.on('share:viewer-left', ({ viewerId }) => {
      peersRef.current.get(viewerId)?.close();
      peersRef.current.delete(viewerId);
    });

    socket.on('share:viewer-count', ({ count }) => setViewerCount(count));

    socket.on('connect', () => socket.emit('share:create', { sessionId: newSid }));
    socket.on('connect_error', () => setShareError('Could not connect to signaling server. Check your connection.'));

    // Get screen media
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 30, max: 60 } },
        audio: shareMic,
        selfBrowserSurface: 'exclude',
      });
      shareStreamRef.current = stream;
      if (shareVideoRef.current) shareVideoRef.current.srcObject = stream;

      stream.getVideoTracks()[0].onended = () => stopLiveShare();

      setSessionId(newSid);
      setSharePhase('active');
    } catch (err) {
      if (err.name !== 'NotAllowedError')
        setShareError(err.message || 'Could not start screen share.');
      socket.disconnect();
      socketRef.current = null;
    }
  }, [screenSupported, shareMic, createPeer, stopLiveShare]);

  const toggleSharePause = useCallback(() => {
    const stream = shareStreamRef.current;
    if (!stream) return;
    const vid = stream.getVideoTracks()[0];
    if (!vid) return;
    if (sharePhase === 'active') {
      vid.enabled = false;
      socketRef.current?.emit('share:pause', { sessionId });
      setSharePhase('paused');
    } else {
      vid.enabled = true;
      socketRef.current?.emit('share:resume', { sessionId });
      setSharePhase('active');
    }
  }, [sharePhase, sessionId]);

  const copyShareLink = useCallback(() => {
    if (!sessionId) return;
    navigator.clipboard.writeText(`${SHARE_BASE}/share/${sessionId}`).then(() => {
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }, [sessionId]);

  // ── Annotation: canvas snapshot helpers ──────────────────────
  const pushUndo = useCallback((canvas) => {
    const ctx  = canvas.getContext('2d');
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    undoStackRef.current.push(snap);
    if (undoStackRef.current.length > 40) undoStackRef.current.shift();
    redoStackRef.current = [];
    setUndoLen(undoStackRef.current.length);
    setRedoLen(0);
  }, []);

  const doUndo = useCallback((canvas) => {
    if (!canvas || undoStackRef.current.length === 0) return;
    const ctx  = canvas.getContext('2d');
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    redoStackRef.current.push(snap);
    const prev = undoStackRef.current.pop();
    ctx.putImageData(prev, 0, 0);
    setUndoLen(undoStackRef.current.length);
    setRedoLen(redoStackRef.current.length);
    // Sync to viewers
    emitAnnot({ type: 'sync', dataUrl: canvas.toDataURL('image/png', 0.8) });
  }, [emitAnnot]);

  const doRedo = useCallback((canvas) => {
    if (!canvas || redoStackRef.current.length === 0) return;
    const ctx  = canvas.getContext('2d');
    const snap = ctx.getImageData(0, 0, canvas.width, canvas.height);
    undoStackRef.current.push(snap);
    const next = redoStackRef.current.pop();
    ctx.putImageData(next, 0, 0);
    setUndoLen(undoStackRef.current.length);
    setRedoLen(redoStackRef.current.length);
    emitAnnot({ type: 'sync', dataUrl: canvas.toDataURL('image/png', 0.8) });
  }, [emitAnnot]);

  const clearAnnotCanvas = useCallback((canvas) => {
    if (!canvas) return;
    pushUndo(canvas);
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    emitAnnot({ type: 'clear' });
  }, [pushUndo, emitAnnot]);

  // ── Annotation drawing ─────────────────────────────────────────
  const startDraw = useCallback((e, canvas) => {
    if (!canvas || annotTool === 'text') return;
    pushUndo(canvas);
    const pos = getCanvasPos(e, canvas);
    isDrawingRef.current = true;
    startPtRef.current   = pos;
    const ctx = canvas.getContext('2d');

    if (annotTool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out';
      return;
    }
    ctx.globalCompositeOperation = 'source-over';

    if (annotTool === 'pen' || annotTool === 'highlight') {
      ctx.beginPath();
      ctx.strokeStyle = annotColor;
      ctx.lineWidth   = annotTool === 'highlight' ? annotSize * 6 : annotSize;
      ctx.lineCap     = 'round'; ctx.lineJoin = 'round';
      if (annotTool === 'highlight') ctx.globalAlpha = 0.35;
      ctx.moveTo(pos.x, pos.y);
      const evType = annotTool === 'highlight' ? 'hl-start' : 'pen-start';
      emitAnnot({ type: evType, color: annotColor, size: annotTool === 'highlight' ? annotSize * 6 : annotSize, x: pos.x / CANVAS_W, y: pos.y / CANVAS_H });
    } else {
      savedImgRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height);
    }
  }, [annotTool, annotColor, annotSize, pushUndo, emitAnnot]);

  const moveDraw = useCallback((e, canvas) => {
    if (!isDrawingRef.current || !canvas) return;
    const pos = getCanvasPos(e, canvas);
    const ctx = canvas.getContext('2d');

    if (annotTool === 'eraser') {
      const r = annotSize * 8;
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
      ctx.fill();
      emitAnnot({ type: 'erase', x: pos.x / CANVAS_W, y: pos.y / CANVAS_H, radius: r / Math.min(CANVAS_W, CANVAS_H) });
      return;
    }

    if (annotTool === 'pen') {
      ctx.lineTo(pos.x, pos.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
      emitAnnot({ type: 'pen-move', x: pos.x / CANVAS_W, y: pos.y / CANVAS_H });
    } else if (annotTool === 'highlight') {
      ctx.lineTo(pos.x, pos.y); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pos.x, pos.y);
      emitAnnot({ type: 'hl-move', x: pos.x / CANVAS_W, y: pos.y / CANVAS_H });
    } else if (annotTool === 'arrow' || annotTool === 'rect' || annotTool === 'circle') {
      if (savedImgRef.current) ctx.putImageData(savedImgRef.current, 0, 0);
      const s = startPtRef.current;
      ctx.strokeStyle = annotColor; ctx.lineWidth = annotSize; ctx.globalAlpha = 1;
      if (annotTool === 'rect') {
        ctx.strokeRect(s.x, s.y, pos.x - s.x, pos.y - s.y);
      } else if (annotTool === 'circle') {
        const r = Math.hypot(pos.x - s.x, pos.y - s.y);
        ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, Math.PI * 2); ctx.stroke();
      } else {
        const angle = Math.atan2(pos.y - s.y, pos.x - s.x);
        const head  = Math.max(14, annotSize * 4);
        ctx.fillStyle = annotColor; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(pos.x, pos.y); ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(pos.x, pos.y);
        ctx.lineTo(pos.x - head * Math.cos(angle - Math.PI / 6), pos.y - head * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(pos.x - head * Math.cos(angle + Math.PI / 6), pos.y - head * Math.sin(angle + Math.PI / 6));
        ctx.closePath(); ctx.fill();
      }
    }
  }, [annotTool, annotColor, annotSize, emitAnnot]);

  const endDraw = useCallback((e, canvas) => {
    if (!isDrawingRef.current) return;
    isDrawingRef.current = false;
    if (!canvas) { savedImgRef.current = null; startPtRef.current = null; return; }
    const ctx = canvas.getContext('2d');
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';

    if (annotTool === 'highlight') emitAnnot({ type: 'hl-end' });

    if (annotTool === 'arrow' || annotTool === 'rect' || annotTool === 'circle') {
      const pos = getCanvasPos(e, canvas);
      const s   = startPtRef.current;
      if (annotTool === 'arrow') {
        emitAnnot({ type: 'arrow', color: annotColor, size: annotSize,
          x1: s.x / CANVAS_W, y1: s.y / CANVAS_H, x2: pos.x / CANVAS_W, y2: pos.y / CANVAS_H });
      } else if (annotTool === 'rect') {
        emitAnnot({ type: 'rect', color: annotColor, size: annotSize,
          x1: s.x / CANVAS_W, y1: s.y / CANVAS_H, x2: pos.x / CANVAS_W, y2: pos.y / CANVAS_H });
      } else {
        const r = Math.hypot(pos.x - s.x, pos.y - s.y);
        emitAnnot({ type: 'circle', color: annotColor, size: annotSize,
          cx: s.x / CANVAS_W, cy: s.y / CANVAS_H, r: r / Math.min(CANVAS_W, CANVAS_H) });
      }
    }
    savedImgRef.current = null; startPtRef.current = null;
  }, [annotTool, annotColor, annotSize, emitAnnot]);

  const handleTextClick = useCallback((e, canvas) => {
    if (annotTool !== 'text' || !canvas) return;
    const pos  = getCanvasPos(e, canvas);
    const rect = canvas.getBoundingClientRect();
    setTextState({
      x: pos.x, y: pos.y,
      pctX: (e.clientX - rect.left) / rect.width,
      pctY: (e.clientY - rect.top)  / rect.height,
      value: '', canvas,
    });
  }, [annotTool]);

  const commitText = useCallback(() => {
    if (!textState?.canvas) return;
    const canvas = textState.canvas;
    pushUndo(canvas);
    const ctx    = canvas.getContext('2d');
    const fSize  = Math.max(16, annotSize * 5);
    ctx.font         = `bold ${fSize}px sans-serif`;
    ctx.fillStyle    = annotColor;
    ctx.textBaseline = 'middle';
    ctx.fillText(textState.value || '', textState.x, textState.y);
    emitAnnot({ type: 'text', color: annotColor, size: fSize,
      x: textState.x / CANVAS_W, y: textState.y / CANVAS_H, text: textState.value || '' });
    setTextState(null);
  }, [textState, annotColor, annotSize, pushUndo, emitAnnot]);

  // ── Canvas event helpers ──────────────────────────────────────
  const annotEvents = (ref) => ({
    onMouseDown:  (e) => { startDraw(e, ref.current); handleTextClick(e, ref.current); },
    onMouseMove:  (e) => moveDraw(e, ref.current),
    onMouseUp:    (e) => endDraw(e, ref.current),
    onMouseLeave: (e) => endDraw(e, ref.current),
    onTouchStart: (e) => startDraw(e, ref.current),
    onTouchMove:  (e) => moveDraw(e, ref.current),
    onTouchEnd:   (e) => endDraw(e, ref.current),
    onClick:      (e) => handleTextClick(e, ref.current),
  });

  // ── Derived flags ─────────────────────────────────────────────
  const isAudioMode    = mode === 'audio';
  const isRecording    = status === 'recording';
  const isPaused       = status === 'paused';
  const isActive       = isRecording || isPaused;
  const isShareActive  = sharePhase === 'active' || sharePhase === 'paused';
  const isSharePaused  = sharePhase === 'paused';

  // ── Text input overlay ────────────────────────────────────────
  function TextOverlay() {
    if (!textState) return null;
    return (
      <input
        autoFocus
        value={textState.value}
        onChange={e => setTextState(s => ({ ...s, value: e.target.value }))}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') commitText(); }}
        onBlur={commitText}
        placeholder="Type and press Enter…"
        style={{
          position: 'absolute',
          left: `${textState.pctX * 100}%`, top: `${textState.pctY * 100}%`,
          transform: 'translate(-50%, -50%)',
          background: 'rgba(0,0,0,0.85)', color: annotColor,
          border: `2px solid ${annotColor}`, borderRadius: 6,
          padding: '4px 10px', fontSize: 15, outline: 'none', minWidth: 150, zIndex: 30,
        }}
      />
    );
  }

  const TABS = [
    { id: 'record',   label: 'Record',     Icon: Monitor },
    { id: 'live',     label: 'Share Live', Icon: Share2 },
    { id: 'annotate', label: 'Annotate',   Icon: Layers },
  ];

  // ═════════════════════════════════════════════════════════════
  return (
    <div className="panel-card shadow-lg">

      {/* ── Header ── */}
      <div className="panel-header">
        <div className="flex items-center gap-2">
          {activeTab === 'live' ? <Share2 className="w-4 h-4 text-text-muted" />
           : activeTab === 'annotate' ? <Layers className="w-4 h-4 text-text-muted" />
           : isAudioMode ? <Mic className="w-4 h-4 text-text-muted" /> : <Monitor className="w-4 h-4 text-text-muted" />}
          <span className="text-sm font-semibold text-text-primary">
            {activeTab === 'live' ? 'Live Screen Share'
             : activeTab === 'annotate' ? 'Annotation Canvas'
             : isAudioMode ? 'Audio Recorder' : 'Screen Recorder'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isShareActive && (
            <span className="flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">
              <span className={`w-1.5 h-1.5 rounded-full bg-green-500 ${!isSharePaused ? 'animate-pulse' : ''}`} />
              {isSharePaused ? 'Paused' : 'Live'}
            </span>
          )}
          {isShareActive && viewerCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Users className="w-3.5 h-3.5" /> {viewerCount}
            </span>
          )}
          {isActive && (
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isPaused ? 'bg-yellow-500' : 'bg-red-500 animate-pulse'}`} />
              <span className={`text-sm font-mono font-semibold ${isPaused ? 'text-yellow-500' : 'text-red-500'}`}>
                {formatDuration(duration)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="flex border-b border-border">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === id ? 'border-accent text-accent' : 'border-transparent text-text-muted hover:text-text-primary'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="p-4 sm:p-6 space-y-5">

        {/* ═══════════ RECORD TAB (unchanged) ════════════════════ */}
        {activeTab === 'record' && (
          <>
            {error && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{error}</span>
              </div>
            )}
            {status === 'idle' && (
              <div className="grid grid-cols-2 gap-3">
                {[{ id: 'screen', label: 'Record Screen', Icon: Monitor }, { id: 'audio', label: 'Audio Only', Icon: Mic }]
                  .map(({ id, label, Icon }) => (
                  <button key={id} onClick={() => { setMode(id); setError(''); }}
                    className={`flex flex-col items-center gap-2 px-3 py-4 rounded-2xl border-2 text-sm font-semibold transition-all ${
                      mode === id ? 'border-accent bg-accent/5 text-accent' : 'border-border text-text-muted hover:border-accent/40 hover:text-text-primary'
                    }`}
                  >
                    <Icon className="w-6 h-6" /><span>{label}</span>
                  </button>
                ))}
              </div>
            )}
            {status === 'idle' && mode === 'screen' && (
              <>
                {!screenSupported ? (
                  <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Screen recording not supported. Use <button className="font-semibold underline" onClick={() => setMode('audio')}>Audio Only</button> or try Chrome.</span>
                  </div>
                ) : !error && (
                  <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Choose what to share — a browser tab, window, or full screen. Saved directly in your browser.</span>
                  </div>
                )}
                {screenSupported && (
                  <div className="flex flex-wrap items-center gap-3 p-4 bg-surface-2 rounded-xl border border-border">
                    <button onClick={() => setAudioOn(a => !a)}
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
            {status === 'idle' && mode === 'audio' && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  {[{ id: 'mixed', label: 'Mic + Class Audio', Icon: Radio }, { id: 'mic', label: 'Mic Only', Icon: Mic }]
                    .map(({ id, label, Icon }) => (
                    <button key={id} onClick={() => { setMixMode(id); setError(''); }}
                      className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border-2 text-xs font-semibold transition-all ${
                        mixMode === id ? 'border-accent bg-accent/5 text-accent' : 'border-border text-text-muted hover:border-accent/40'
                      }`}
                    >
                      <Icon className="w-5 h-5" /><span>{label}</span>
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
                        <li>Select the <strong>tab</strong> to capture — tick <strong>"Share tab audio"</strong></li>
                      </ol>
                    </div>
                  </div>
                )}
                {!error && mixMode === 'mic' && (
                  <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm">
                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>Records microphone audio only.</span>
                  </div>
                )}
                <div className="flex flex-col gap-3 p-4 bg-surface-2 rounded-xl border border-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
                      <Volume2 className="w-4 h-4 text-accent" />Volume Boost
                    </div>
                    <span className="text-sm font-mono font-semibold text-accent">{gainValue.toFixed(1)}×</span>
                  </div>
                  <input type="range" min="1" max="5" step="0.1" value={gainValue}
                    onChange={e => setGainValue(parseFloat(e.target.value))} className="w-full accent-accent" />
                  <p className="text-xs text-text-muted">2× recommended for most meetings.</p>
                </div>
              </>
            )}
            {isActive && mode === 'screen' && (
              <div className="flex flex-col items-center justify-center py-8 gap-4">
                <div className="relative w-20 h-20 rounded-full border-4 border-red-200 flex items-center justify-center">
                  {!isPaused && <span className="absolute w-10 h-10 rounded-full bg-red-500/15 animate-ping" />}
                  <Square className="w-8 h-8 text-red-500 fill-red-500" />
                </div>
                <div className="text-center space-y-1">
                  <p className="font-semibold text-text-primary">{isPaused ? 'Recording paused' : 'Recording in progress'}</p>
                  <p className="text-4xl font-mono font-bold text-primary">{formatDuration(duration)}</p>
                  {!isPaused && <p className="text-sm text-text-muted">Click Stop or use the browser's "Stop sharing" button</p>}
                </div>
              </div>
            )}
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
            {status === 'stopped' && blobUrl && (
              <div className="space-y-3">
                {mode === 'screen'
                  ? <video src={blobUrl} controls className="w-full rounded-xl border border-border bg-black" style={{ maxHeight: '360px' }} />
                  : <div className="p-6 bg-surface-2 rounded-xl border border-border flex flex-col items-center gap-4">
                      <div className="w-14 h-14 bg-accent/10 rounded-full flex items-center justify-center border border-accent/20">
                        <Mic className="w-7 h-7 text-accent" />
                      </div>
                      <audio src={blobUrl} controls className="w-full" />
                    </div>}
                <p className="text-xs text-text-muted text-center break-all">{filename}</p>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              {status === 'idle' && (
                <button onClick={mode === 'screen' ? startScreenRecording : startAudioRecording}
                  disabled={mode === 'screen' && !screenSupported}
                  className="btn-primary w-full h-12 text-[15px] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {mode === 'screen' ? <Monitor className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                  {mode === 'screen' ? 'Start Screen Recording'
                    : mixMode === 'mixed' ? 'Start Recording (Mic + Class Audio)' : 'Start Recording (Mic Only)'}
                </button>
              )}
              {isActive && (
                <>
                  <button onClick={togglePause}
                    className="flex-1 h-12 text-[15px] flex items-center justify-center gap-2 rounded-xl font-semibold border border-border bg-surface-2 hover:bg-surface-3 text-text-primary transition-colors">
                    {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    {isPaused ? 'Resume' : 'Pause'}
                  </button>
                  <button onClick={stopRecording}
                    className="flex-1 h-12 text-[15px] flex items-center justify-center gap-2 rounded-xl font-semibold bg-red-500 hover:bg-red-600 text-white transition-colors shadow-sm">
                    <Square className="w-4 h-4 fill-white" />Stop Recording
                  </button>
                </>
              )}
              {status === 'stopped' && (
                <>
                  <button onClick={downloadRecording} className="btn-primary flex-1 h-12 text-[15px]">
                    <Download className="w-4 h-4" />Download Again
                  </button>
                  <button onClick={discardRecording} className="btn-ghost h-12 px-5">
                    <Trash2 className="w-4 h-4" />Discard
                  </button>
                </>
              )}
            </div>
            {status === 'stopped' && duration > 0 && (
              <div className="flex items-center justify-center gap-2 text-sm text-text-muted">
                <Clock className="w-4 h-4" /><span>Recorded {formatDuration(duration)}</span>
              </div>
            )}
          </>
        )}

        {/* ═══════════ SHARE LIVE TAB ════════════════════════════ */}
        {activeTab === 'live' && (
          <>
            {!screenSupported && (
              <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Screen sharing may not be supported on this browser. On mobile, try the <strong>Record</strong> tab instead. On desktop, use Chrome or Edge.
                </span>
              </div>
            )}

            {shareError && (
              <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" /><span>{shareError}</span>
              </div>
            )}

            {screenSupported && (
              <>
                {/* Live preview */}
                <div className="relative rounded-xl overflow-hidden border border-gray-700" style={{ background: '#050508', minHeight: 220 }}>
                  {!isShareActive && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-gray-500 pointer-events-none">
                      <Share2 className="w-10 h-10 opacity-25" />
                      <p className="text-sm font-medium">Click "Start Sharing" to go live</p>
                      <p className="text-xs opacity-50">Tab · Window · Entire screen</p>
                    </div>
                  )}

                  {/* Video always mounted so ref is available */}
                  <video ref={shareVideoRef} autoPlay muted playsInline
                    style={{ display: isShareActive ? 'block' : 'none', width: '100%', maxHeight: 440, objectFit: 'contain' }}
                  />

                  {/* Annotation overlay */}
                  {isShareActive && (
                    <canvas ref={overlayRef} width={CANVAS_W} height={CANVAS_H}
                      style={{
                        position: 'absolute', inset: 0, width: '100%', height: '100%',
                        cursor: annotTool === 'text' ? 'text' : annotTool === 'eraser' ? 'cell' : 'crosshair',
                        touchAction: 'none',
                        display: showAnnot ? 'block' : 'none',
                      }}
                      {...annotEvents(overlayRef)}
                    />
                  )}
                  {isShareActive && <TextOverlay />}

                  {/* Pause overlay message */}
                  {isSharePaused && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ background: 'rgba(0,0,0,0.55)' }}>
                      <p className="text-white text-base font-semibold">Sharing Paused</p>
                    </div>
                  )}
                </div>

                {/* Annotation toolbar — visible while sharing */}
                {isShareActive && (
                  <AnnotationToolbar
                    annotTool={annotTool}   setAnnotTool={setAnnotTool}
                    annotColor={annotColor} setAnnotColor={setAnnotColor}
                    annotSize={annotSize}   setAnnotSize={setAnnotSize}
                    onClear={() => clearAnnotCanvas(overlayRef.current)}
                    onUndo={() => doUndo(overlayRef.current)}
                    onRedo={() => doRedo(overlayRef.current)}
                    canUndo={undoLen > 0} canRedo={redoLen > 0}
                    showAnnot={showAnnot} setShowAnnot={setShowAnnot}
                  />
                )}

                {/* Share link */}
                {isShareActive && sessionId && (
                  <div className="flex items-center gap-2 p-3 rounded-xl border border-gray-700 text-sm" style={{ background: '#0d0d14' }}>
                    <Link className="w-4 h-4 text-gray-400 shrink-0" />
                    <span className="flex-1 text-gray-300 font-mono text-xs truncate">
                      {SHARE_BASE}/share/{sessionId}
                    </span>
                    <button onClick={copyShareLink}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        linkCopied ? 'bg-green-500/20 text-green-400' : 'bg-accent/15 text-accent hover:bg-accent/25'
                      }`}
                    >
                      {linkCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      {linkCopied ? 'Copied!' : 'Copy'}
                    </button>
                  </div>
                )}

                {/* Viewer count */}
                {isShareActive && (
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <Users className="w-4 h-4" />
                      <span>{viewerCount === 0 ? 'No viewers yet' : `${viewerCount} viewer${viewerCount > 1 ? 's' : ''} watching`}</span>
                    </div>
                    <button onClick={() => setShareMic(v => !v)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        shareMic ? 'border-accent text-accent bg-accent/10' : 'border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}
                    >
                      {shareMic ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                      {shareMic ? 'Mic On' : 'Mic Off'}
                    </button>
                  </div>
                )}

                {/* Controls */}
                <div className="flex gap-3">
                  {!isShareActive ? (
                    <button onClick={startLiveShare} className="btn-primary flex-1 h-12 text-[15px]">
                      <Share2 className="w-4 h-4" />Start Sharing
                    </button>
                  ) : (
                    <>
                      <button onClick={toggleSharePause}
                        className="flex-1 h-12 text-[15px] flex items-center justify-center gap-2 rounded-xl font-semibold border border-gray-700 text-gray-200 hover:bg-gray-800 transition-colors"
                        style={{ background: '#0d0d14' }}
                      >
                        {isSharePaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                        {isSharePaused ? 'Resume' : 'Pause'}
                      </button>
                      <button onClick={stopLiveShare}
                        className="flex-1 h-12 text-[15px] flex items-center justify-center gap-2 rounded-xl font-semibold bg-red-500 hover:bg-red-600 text-white transition-colors">
                        <X className="w-4 h-4" />Stop Sharing
                      </button>
                    </>
                  )}
                </div>

                {!isShareActive && (
                  <div className="flex items-start gap-3 p-4 bg-surface-2 border border-border rounded-xl text-sm">
                    <Info className="w-4 h-4 shrink-0 mt-0.5 text-text-muted" />
                    <div className="space-y-1">
                      <p className="font-medium text-text-primary">Quran / Class use case</p>
                      <p className="text-xs text-text-muted">
                        Open your Quran PDF or class material, then click "Start Sharing" and select only that tab or window.
                        Students see only your selected content — your other windows stay private. Draw annotations live on top.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ═══════════ ANNOTATE TAB (standalone whiteboard) ══════ */}
        {activeTab === 'annotate' && (
          <>
            <AnnotationToolbar
              annotTool={annotTool}   setAnnotTool={setAnnotTool}
              annotColor={annotColor} setAnnotColor={setAnnotColor}
              annotSize={annotSize}   setAnnotSize={setAnnotSize}
              onClear={() => clearAnnotCanvas(whiteboardRef.current)}
              onUndo={() => doUndo(whiteboardRef.current)}
              onRedo={() => doRedo(whiteboardRef.current)}
              canUndo={undoLen > 0} canRedo={redoLen > 0}
              showAnnot={true} setShowAnnot={() => {}}
            />

            <div className="relative rounded-xl overflow-hidden border border-gray-700" style={{ background: '#050508' }}>
              <canvas ref={whiteboardRef}
                style={{ display: 'block', width: '100%', height: 360,
                  cursor: annotTool === 'text' ? 'text' : annotTool === 'eraser' ? 'cell' : 'crosshair',
                  touchAction: 'none' }}
                {...annotEvents(whiteboardRef)}
              />
              <TextOverlay />
              <p className="absolute bottom-2 right-3 text-xs text-gray-700 pointer-events-none select-none">
                Draw freely · Use toolbar above
              </p>
            </div>

            <p className="text-xs text-text-muted text-center">
              Switch to <strong>Share Live</strong> to draw annotations on top of a live screen share visible to viewers.
            </p>
          </>
        )}

      </div>
    </div>
  );
}
