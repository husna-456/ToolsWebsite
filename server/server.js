require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
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
    ? [
        'https://globaltechtool.com',
        'https://www.globaltechtool.com',
        'https://tools-website-rosy-seven.vercel.app',
      ]
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
