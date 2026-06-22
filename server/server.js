require('dotenv').config();
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

const app = express();

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

// Health check
app.get('/api/health', (req, res) =>
  res.json({ status: 'ok', env: process.env.NODE_ENV, time: new Date() })
);

// ── Serve React Build in Production ──────────────────────────
// Frontend is deployed separately on Vercel — no static file serving needed.

// ── Error Handling ────────────────────────────────────────────
app.use(notFound);
app.use(errorHandler);

// ── Start ─────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Mode: ${process.env.NODE_ENV || 'development'}`);
});
