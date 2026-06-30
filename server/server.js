require('dotenv').config();
const http       = require('http');
const express    = require('express');
const cors       = require('cors');
const rateLimit  = require('express-rate-limit');
const connectDB  = require('./config/db');
const { errorHandler, notFound } = require('./middleware/errorHandler');

// ── Process-level error guards ────────────────────────────────
// Prevent a single failed request (e.g. Puppeteer crash) from taking the
// entire Node.js process down and causing Hostinger's proxy to return 503.
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught Exception — server kept alive:', err.message, err.stack);
});
process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled Rejection — server kept alive:', reason);
});

const app        = express();
const httpServer = http.createServer(app);

// ── Database ─────────────────────────────────────────────────
connectDB();

// ── Background jobs ───────────────────────────────────────────
require('./jobs/cleanup');

// ── CORS ──────────────────────────────────────────────────────
// Function-based origin check works regardless of NODE_ENV value.
// Array-based cors({ origin: [...] }) silently rejects if NODE_ENV
// is unset or wrong, causing Hostinger to return 503 with no CORS headers.
const allowedOrigins = [
  process.env.CLIENT_URL,
  'https://globaltechtool.com',
  'https://www.globaltechtool.com',
  'https://tools-website-rosy-seven.vercel.app',
  // keep dev origins so local testing still works
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
].filter(Boolean);

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, curl, same-origin)
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    console.warn('[CORS] Blocked origin:', origin);
    return callback(new Error('Not allowed by CORS: ' + origin));
  },
  credentials: true,
  // Without exposedHeaders, browser JS cannot read Content-Disposition from a
  // cross-origin response (CORS only exposes a small set of "simple" headers by
  // default). Missing this causes filename extraction to fail and the OS assigns
  // an extension from the MIME type (audio/mpeg → .mpeg instead of .mp3).
  exposedHeaders: ['Content-Disposition'],
};

// ── Security & Parsing ────────────────────────────────────────
app.set('trust proxy', 1);

// Handle OPTIONS preflight explicitly BEFORE all other middleware so
// browsers always get CORS headers even when downstream routes crash.
app.options('*', cors(corsOptions));
app.use(cors(corsOptions));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ── Rate Limits ───────────────────────────────────────────────
// GET /api/tools/* requests are lightweight metadata reads — allow more
const isToolMetadataGet = (req) =>
  req.method === 'GET' && req.path.startsWith('/tools');

app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      600,            // 600/15 min for metadata GETs
  skip:     (req) => !isToolMetadataGet(req),
  message:  { error: 'Too many requests. Please slow down.' },
}));

app.use('/api/', rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      150,            // 150/15 min for AI runs, file processing, etc.
  skip:     isToolMetadataGet,
  message:  { error: 'Too many requests. Please slow down.' },
}));

// ── API Routes ────────────────────────────────────────────────
app.use('/api/auth',  require('./routes/auth'));
app.use('/api/tools', require('./routes/tools'));
app.use('/api/admin', require('./routes/admin'));
app.use('/api',       require('./routes/public'));
app.use('/',          require('./routes/seo'));
app.use('/api/ocr',       require('./routes/ocr'));
app.use('/api/subtitles', require('./routes/subtitles'));

// Basic health check
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', env: process.env.NODE_ENV, time: new Date() })
);

// Media tools health check — shows ffmpeg/ffprobe paths found at startup
// and does a live executable test so we can diagnose production issues.
app.get('/api/health/media', (req, res) => {
  const { spawnSync } = require('child_process');
  const fsH = require('fs');

  function liveCheck(binPath) {
    if (!binPath) return { exists: false, executable: false };
    let exists = false;
    try { exists = fsH.existsSync(binPath); } catch {}
    let executable = false;
    try {
      const r = spawnSync(binPath, ['-version'], { timeout: 3000 });
      executable = !r.error && r.status === 0;
    } catch {}
    return { exists, executable };
  }

  // Paths detected at startup (cached in fileProcessor module)
  let ffmpegPath  = null;
  let ffprobePath = null;
  try {
    const fp  = require('./services/fileProcessor');
    ffmpegPath  = fp.FFMPEG_PATH  || null;
    ffprobePath = fp.FFPROBE_PATH || null;
  } catch {}

  // Also report what the npm static packages say
  let ffmpegStaticPath  = null;
  let ffprobeStaticPath = null;
  try { ffmpegStaticPath = require('ffmpeg-static') || null; } catch {}
  try {
    const pkg = require('ffprobe-static');
    ffprobeStaticPath = pkg?.path || (typeof pkg === 'string' ? pkg : null);
  } catch {}

  const ffmpegCheck  = liveCheck(ffmpegPath);
  const ffprobeCheck = liveCheck(ffprobePath);

  res.json({
    buildVersion:       'v3',
    nodeVersion:        process.version,
    nodeEnv:            process.env.NODE_ENV || 'unset',
    time:               new Date().toISOString(),
    ffmpegPath,
    ffprobePath,
    ffmpegExists:       ffmpegCheck.exists,
    ffmpegExecutable:   ffmpegCheck.executable,
    ffprobeExists:      ffprobeCheck.exists,
    ffprobeExecutable:  ffprobeCheck.executable,
    ffmpegStaticPath,
    ffprobeStaticPath,
  });
});

// ── Serve React Build in Production ──────────────────────────
// Frontend is deployed separately on Vercel — no static file serving needed.

// ── Error Handling ────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Live Share — Socket.IO signaling ─────────────────────────
const { Server: SocketIO } = require('socket.io');
const io = new SocketIO(httpServer, {
  cors: corsOptions,
  path: '/socket.io',
});

// sessionId → { hostId, viewers: Set<socketId> }
const liveSessions = new Map();

io.on('connection', (socket) => {

  // Host creates a session
  socket.on('share:create', ({ sessionId }) => {
    socket.join(sessionId);
    liveSessions.set(sessionId, { hostId: socket.id, viewers: new Set() });
  });

  // Viewer joins
  socket.on('share:join', ({ sessionId }) => {
    const s = liveSessions.get(sessionId);
    if (!s) { socket.emit('share:not-found'); return; }
    socket.join(sessionId);
    s.viewers.add(socket.id);
    io.to(s.hostId).emit('share:viewer-joined', { viewerId: socket.id });
    io.to(s.hostId).emit('share:viewer-count',  { count: s.viewers.size });
    socket.emit('share:joined', { sessionId });
  });

  // WebRTC signaling relay (host ↔ viewer)
  socket.on('share:offer',         ({ targetId, offer })     => io.to(targetId).emit('share:offer',         { fromId: socket.id, offer }));
  socket.on('share:answer',        ({ targetId, answer })    => io.to(targetId).emit('share:answer',        { fromId: socket.id, answer }));
  socket.on('share:ice-candidate', ({ targetId, candidate }) => io.to(targetId).emit('share:ice-candidate', { fromId: socket.id, candidate }));

  // Send current annotation state to a specific newly-joined viewer
  socket.on('share:sync-to-viewer', ({ targetId, event }) => io.to(targetId).emit('share:annotation', event));

  // Annotation event broadcast — host → all viewers in room
  socket.on('share:annotation', ({ sessionId, event }) => socket.to(sessionId).emit('share:annotation', event));

  // Pause / Resume signals to viewers
  socket.on('share:pause',  ({ sessionId }) => socket.to(sessionId).emit('share:paused'));
  socket.on('share:resume', ({ sessionId }) => socket.to(sessionId).emit('share:resumed'));

  // Host stops
  socket.on('share:stop', ({ sessionId }) => {
    const s = liveSessions.get(sessionId);
    if (s?.hostId === socket.id) {
      io.to(sessionId).emit('share:ended');
      liveSessions.delete(sessionId);
    }
  });

  // Viewer explicitly leaves
  socket.on('share:leave', ({ sessionId }) => {
    const s = liveSessions.get(sessionId);
    if (s) {
      s.viewers.delete(socket.id);
      io.to(s.hostId).emit('share:viewer-left',  { viewerId: socket.id });
      io.to(s.hostId).emit('share:viewer-count', { count: s.viewers.size });
    }
  });

  socket.on('disconnect', () => {
    for (const [sessionId, s] of liveSessions.entries()) {
      if (s.hostId === socket.id) {
        io.to(sessionId).emit('share:ended');
        liveSessions.delete(sessionId);
        break;
      }
      if (s.viewers.has(socket.id)) {
        s.viewers.delete(socket.id);
        io.to(s.hostId).emit('share:viewer-left',  { viewerId: socket.id });
        io.to(s.hostId).emit('share:viewer-count', { count: s.viewers.size });
        break;
      }
    }
  });
});

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Mode: ${process.env.NODE_ENV || 'development'}`);
});
