require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const rateLimit  = require('express-rate-limit');
const connectDB  = require('./config/db');
const { errorHandler, notFound } = require('./middleware/errorHandler');

const app = express();

// ── Database ─────────────────────────────────────────────────
connectDB();

// ── Background jobs ───────────────────────────────────────────
require('./jobs/cleanup');

// ── Security & Parsing ────────────────────────────────────────
app.set('trust proxy', 1);
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://tools.innovate.com.pk']
    : ['http://localhost:5174', 'http://localhost:5173'],
  credentials: true,
}));
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

// Health check
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', env: process.env.NODE_ENV, time: new Date() })
);

// ── Serve React Build in Production ──────────────────────────
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '../client/dist');
  app.use(express.static(distPath));
  app.get('/{*splat}', (req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'API route not found' });
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ── Error Handling ────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────
const { execSync } = require('child_process');
const PORT = process.env.PORT || 5000;

function killPort(port) {
  try {
    // Works on Windows (netstat + taskkill) and Unix (lsof/fuser)
    if (process.platform === 'win32') {
      const out = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8', stdio: ['pipe','pipe','pipe'] });
      const pids = [...new Set(
        out.split('\n')
          .filter(l => l.includes('LISTENING'))
          .map(l => l.trim().split(/\s+/).pop())
          .filter(Boolean)
      )];
      pids.forEach(pid => {
        try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'pipe' }); } catch {}
      });
    } else {
      try { execSync(`fuser -k ${port}/tcp`, { stdio: 'pipe' }); } catch {}
    }
  } catch {}
}

function startServer() {
  const server = app.listen(PORT, () => {
    console.log(`🚀 Server: http://localhost:${PORT}`);
    console.log(`📦 Mode:   ${process.env.NODE_ENV || 'development'}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`⚠️  Port ${PORT} in use — freeing it and retrying…`);
      server.close();
      killPort(PORT);
      setTimeout(startServer, 1000);
    } else {
      throw err;
    }
  });
}

startServer();
