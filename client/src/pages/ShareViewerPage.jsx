import { useEffect, useRef, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Monitor, Users, AlertCircle, Loader2, WifiOff, Maximize2, Minimize2 } from 'lucide-react';

const SOCKET_URL  = import.meta.env.VITE_API_BASE_URL || 'https://globaltechtools.thefiveriverz.com';
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];
const CANVAS_W = 1280;
const CANVAS_H = 720;

function renderAnnotation(event, canvas) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = CANVAS_W;
  const H = CANVAS_H;

  switch (event.type) {
    case 'pen-start':
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      ctx.strokeStyle = event.color;
      ctx.lineWidth   = event.size;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.moveTo(event.x * W, event.y * H);
      break;
    case 'pen-move':
      ctx.lineTo(event.x * W, event.y * H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(event.x * W, event.y * H);
      break;

    case 'hl-start':
      ctx.beginPath();
      ctx.strokeStyle = event.color;
      ctx.lineWidth   = event.size;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.globalAlpha = 0.35;
      ctx.moveTo(event.x * W, event.y * H);
      break;
    case 'hl-move':
      ctx.lineTo(event.x * W, event.y * H);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(event.x * W, event.y * H);
      break;
    case 'hl-end':
      ctx.globalAlpha = 1;
      break;

    case 'arrow': {
      const { x1, y1, x2, y2, color, size } = event;
      const ax1 = x1 * W, ay1 = y1 * H, ax2 = x2 * W, ay2 = y2 * H;
      const angle = Math.atan2(ay2 - ay1, ax2 - ax1);
      const head  = Math.max(14, size * 4);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = size; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ax1, ay1); ctx.lineTo(ax2, ay2); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ax2, ay2);
      ctx.lineTo(ax2 - head * Math.cos(angle - Math.PI / 6), ay2 - head * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(ax2 - head * Math.cos(angle + Math.PI / 6), ay2 - head * Math.sin(angle + Math.PI / 6));
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'rect': {
      const { x1, y1, x2, y2, color, size } = event;
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color; ctx.lineWidth = size;
      ctx.strokeRect(x1 * W, y1 * H, (x2 - x1) * W, (y2 - y1) * H);
      break;
    }
    case 'circle': {
      const { cx, cy, r, color, size } = event;
      ctx.globalAlpha = 1;
      ctx.strokeStyle = color; ctx.lineWidth = size;
      ctx.beginPath();
      ctx.arc(cx * W, cy * H, r * Math.min(W, H), 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case 'text': {
      ctx.globalAlpha = 1;
      ctx.font         = `bold ${event.size}px sans-serif`;
      ctx.fillStyle    = event.color;
      ctx.textBaseline = 'middle';
      ctx.fillText(event.text, event.x * W, event.y * H);
      break;
    }
    case 'erase': {
      const prev = ctx.globalCompositeOperation;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(event.x * W, event.y * H, event.radius * Math.min(W, H), 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = prev;
      break;
    }
    case 'clear':
      ctx.clearRect(0, 0, W, H);
      break;
    case 'sync': {
      const img = new Image();
      img.onload = () => { ctx.clearRect(0, 0, W, H); ctx.drawImage(img, 0, 0, W, H); };
      img.src = event.dataUrl;
      break;
    }
    default: break;
  }
}

export default function ShareViewerPage() {
  const { sessionId } = useParams();
  const [phase,       setPhase]       = useState('connecting'); // connecting | waiting | watching | paused | ended | not-found
  const [fullscreen,  setFullscreen]  = useState(false);

  const videoRef   = useRef(null);
  const canvasRef  = useRef(null);
  const socketRef  = useRef(null);
  const pcRef      = useRef(null);
  const wrapRef    = useRef(null);

  const cleanupPC = useCallback(() => {
    pcRef.current?.close();
    pcRef.current = null;
  }, []);

  useEffect(() => {
    const socket = io(SOCKET_URL, { transports: ['websocket', 'polling'] });
    socketRef.current = socket;

    socket.on('connect', () => socket.emit('share:join', { sessionId }));
    socket.on('share:joined',    () => setPhase('waiting'));
    socket.on('share:not-found', () => setPhase('not-found'));
    socket.on('share:ended',     () => { setPhase('ended'); cleanupPC(); });
    socket.on('share:paused',    () => setPhase('paused'));
    socket.on('share:resumed',   () => setPhase('watching'));

    socket.on('share:offer', async ({ fromId, offer }) => {
      cleanupPC();
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      pcRef.current = pc;

      pc.ontrack = (e) => {
        if (videoRef.current) videoRef.current.srcObject = e.streams[0];
        setPhase('watching');
      };

      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit('share:ice-candidate', { targetId: fromId, candidate: e.candidate });
      };

      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('share:answer', { targetId: fromId, answer });
    });

    socket.on('share:ice-candidate', ({ candidate }) => {
      pcRef.current?.addIceCandidate(candidate).catch(() => {});
    });

    socket.on('share:annotation', (event) => renderAnnotation(event, canvasRef.current));

    return () => {
      socket.emit('share:leave', { sessionId });
      socket.disconnect();
      cleanupPC();
    };
  }, [sessionId, cleanupPC]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      wrapRef.current?.requestFullscreen?.();
      setFullscreen(true);
    } else {
      document.exitFullscreen?.();
      setFullscreen(false);
    }
  };

  useEffect(() => {
    const onFSChange = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFSChange);
    return () => document.removeEventListener('fullscreenchange', onFSChange);
  }, []);

  // ── Screens for non-watching states ───────────────────────────
  const StatusScreen = ({ icon: Icon, color, title, sub }) => (
    <div className="flex flex-col items-center gap-4 text-center px-6">
      <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: color + '18', border: `2px solid ${color}40` }}>
        <Icon className="w-8 h-8" style={{ color }} />
      </div>
      <div>
        <p className="text-lg font-semibold text-white">{title}</p>
        {sub && <p className="text-sm text-gray-400 mt-1">{sub}</p>}
      </div>
    </div>
  );

  return (
    <div
      ref={wrapRef}
      className="flex flex-col items-center justify-center min-h-screen"
      style={{ background: '#050508' }}
    >
      {/* Top bar */}
      <div className="w-full flex items-center justify-between px-4 py-3" style={{ background: '#0d0d14', borderBottom: '1px solid #1e1e2e' }}>
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-indigo-400" />
          <span className="text-sm font-semibold text-white">Screen Share — View Only</span>
        </div>
        <div className="flex items-center gap-3">
          {phase === 'watching' && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-green-400 bg-green-400/10 px-2 py-1 rounded-full border border-green-400/20">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live
            </span>
          )}
          {phase === 'paused' && (
            <span className="text-xs font-medium text-yellow-400 bg-yellow-400/10 px-2 py-1 rounded-full border border-yellow-400/20">
              Paused
            </span>
          )}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex items-center justify-center w-full">
        {phase === 'connecting' && (
          <StatusScreen icon={Loader2} color="#6366f1" title="Connecting…" sub="Please wait" />
        )}
        {phase === 'waiting' && (
          <StatusScreen icon={Monitor} color="#6366f1" title="Waiting for presenter" sub="The screen share will appear here once the host starts sharing." />
        )}
        {phase === 'not-found' && (
          <StatusScreen icon={WifiOff} color="#ef4444" title="Session not found" sub="This share link may have expired or the session has ended." />
        )}
        {phase === 'ended' && (
          <StatusScreen icon={WifiOff} color="#f97316" title="Screen share ended" sub="The presenter has stopped sharing their screen." />
        )}

        {/* Video + annotation overlay */}
        <div
          className="relative w-full"
          style={{
            maxWidth: 1200,
            display: (phase === 'watching' || phase === 'paused') ? 'block' : 'none',
          }}
        >
          <video
            ref={videoRef}
            autoPlay playsInline
            className="w-full"
            style={{ display: 'block', background: '#000' }}
          />
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            style={{
              position: 'absolute', inset: 0,
              width: '100%', height: '100%',
              pointerEvents: 'none',
            }}
          />
          {phase === 'paused' && (
            <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
              <p className="text-white text-lg font-semibold">Stream Paused</p>
            </div>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div className="w-full flex items-center justify-center px-4 py-2.5" style={{ background: '#0d0d14', borderTop: '1px solid #1e1e2e' }}>
        <p className="text-xs text-gray-500">
          View-only mode · Powered by{' '}
          <span className="text-indigo-400 font-medium">GlobalTechTools</span>
        </p>
      </div>
    </div>
  );
}
