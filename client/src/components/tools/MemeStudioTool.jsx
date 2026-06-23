import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Type, MessageSquare, MessageCircle, Camera, Briefcase, Newspaper,
  Terminal, Quote, Clock, Download, RotateCcw, Wand2, X,
  AlertCircle, CheckCircle, Loader2, History, BadgeCheck,
} from 'lucide-react';

const API = import.meta.env.VITE_API_BASE_URL || '';
const HISTORY_KEY = 'meme_studio_history_v1';
const MAX_HISTORY = 20;

// ── Mode definitions (lucide icons — no emojis in chrome) ─────
const MODES = [
  { id: 'text-meme',  label: 'Text Meme',     Icon: Type },
  { id: 'tweet',      label: 'Fake Tweet',     Icon: MessageSquare },
  { id: 'whatsapp',   label: 'WhatsApp Chat',  Icon: MessageCircle },
  { id: 'instagram',  label: 'Instagram Post', Icon: Camera },
  { id: 'linkedin',   label: 'LinkedIn Post',  Icon: Briefcase },
  { id: 'news',       label: 'Breaking News',  Icon: Newspaper },
  { id: 'code-meme',  label: 'Code Meme',      Icon: Terminal },
  { id: 'motivation', label: 'Motivational',   Icon: Quote },
];

const BG_GRADIENTS = [
  { label: 'Midnight', value: 'linear-gradient(135deg,#0f0c29,#302b63,#24243e)' },
  { label: 'Sunset',   value: 'linear-gradient(135deg,#f093fb,#f5576c)' },
  { label: 'Ocean',    value: 'linear-gradient(135deg,#2af598,#009efd)' },
  { label: 'Fire',     value: 'linear-gradient(135deg,#f7971e,#ffd200)' },
  { label: 'Forest',   value: 'linear-gradient(135deg,#134e5e,#71b280)' },
  { label: 'Royal',    value: 'linear-gradient(135deg,#141e30,#243b55)' },
  { label: 'Rose',     value: 'linear-gradient(135deg,#ff758c,#ff7eb3)' },
  { label: 'Violet',   value: 'linear-gradient(135deg,#4776e6,#8e54e9)' },
];

const CODE_THEMES = [
  { label: 'VS Code Dark', bg: '#1e1e1e', text: '#d4d4d4', comment: '#6a9955', header: '#252526' },
  { label: 'Dracula',      bg: '#282a36', text: '#f8f8f2', comment: '#6272a4', header: '#21222c' },
  { label: 'Monokai',      bg: '#272822', text: '#f8f8f2', comment: '#75715e', header: '#1e1f1c' },
  { label: 'GitHub Light', bg: '#ffffff', text: '#24292e', comment: '#6a737d', header: '#f6f8fa' },
];

// ── Text Meme canvas-specific data ───────────────────────────
// stops[] → used by Canvas API; css → used for picker button preview
const TM_GRADIENTS = [
  { label: 'Midnight', stops: ['#0f0c29','#302b63','#24243e'] },
  { label: 'Sunset',   stops: ['#f093fb','#f5576c'] },
  { label: 'Ocean',    stops: ['#00c6ff','#0072ff'] },
  { label: 'Fire',     stops: ['#f7971e','#ffd200'] },
  { label: 'Forest',   stops: ['#134e5e','#71b280'] },
  { label: 'Royal',    stops: ['#141e30','#243b55'] },
  { label: 'Rose',     stops: ['#ff416c','#ff4b2b'] },
  { label: 'Violet',   stops: ['#4776e6','#8e54e9'] },
  { label: 'Dark',     stops: ['#1a1a2e','#16213e','#0f3460'] },
  { label: 'Lime',     stops: ['#56ab2f','#a8e063'] },
  { label: 'Cherry',   stops: ['#eb3349','#f45c43'] },
  { label: 'Ice',      stops: ['#74b9ff','#a29bfe'] },
];

const ASPECT_RATIOS = [
  { id: '1:1',  label: '1:1',   w: 1080, h: 1080, pb: '100%' },
  { id: '4:5',  label: '4:5',   w: 1080, h: 1350, pb: '125%' },
  { id: '9:16', label: '9:16',  w: 1080, h: 1920, pb: '177.78%' },
  { id: '16:9', label: '16:9',  w: 1920, h: 1080, pb: '56.25%' },
];

// ── Local fallback caption templates ─────────────────────────
const LOCAL_TEMPLATES = {
  coding: [
    { top: 'WHEN THE CODE FINALLY WORKS', bottom: "AND YOU DON'T KNOW WHY" },
    { top: 'IT WORKS ON MY MACHINE', bottom: 'SHIP THE MACHINE' },
    { top: 'TOLD MY BOSS I FIXED A BUG', bottom: 'INTRODUCED 3 MORE' },
    { top: 'ME READING MY OWN CODE', bottom: 'FROM 6 MONTHS AGO' },
    { top: '99 LITTLE BUGS IN THE CODE', bottom: 'FIX ONE DOWN, PATCH IT AROUND — 127 BUGS' },
  ],
  student: [
    { top: 'STARTS ASSIGNMENT AT 11 PM', bottom: 'DUE AT MIDNIGHT' },
    { top: 'GROUP PROJECT', bottom: 'I DID EVERYTHING MYSELF' },
    { top: 'PASSES EXAM', bottom: 'IMMEDIATELY FORGETS EVERYTHING' },
    { top: 'OPENS TEXTBOOK', bottom: 'WATCHES YOUTUBE INSTEAD' },
    { top: 'PROFESSOR: THERE WILL BE NO CURVE', bottom: 'ALSO PROFESSOR: CURVE APPLIED' },
  ],
  work: [
    { top: 'ONE MORE MEETING', bottom: 'THAT COULD HAVE BEEN AN EMAIL' },
    { top: 'URGENT TASK ASSIGNED', bottom: 'DURING LUNCH ON FRIDAY' },
    { top: "DOES EVERYONE ELSE'S WORK", bottom: 'SOMEHOW STILL BEHIND' },
    { top: 'DEADLINE IS TOMORROW', bottom: 'WHAT DEADLINE' },
    { top: 'QUICK CALL', bottom: 'ONE HOUR LATER' },
  ],
  business: [
    { top: "LET'S SYNERGIZE THE PARADIGM", bottom: 'NOBODY KNOWS WHAT THIS MEANS' },
    { top: 'CIRCLING BACK', bottom: 'MEANS NEVER HEARING FROM THEM AGAIN' },
    { top: 'MOVE FAST AND BREAK THINGS', bottom: 'WE MOVED FAST AND BROKE EVERYTHING' },
    { top: 'QUARTERLY REVIEW', bottom: 'DID NOTHING, SOMEHOW MEETS EXPECTATIONS' },
  ],
  funny: [
    { top: "ME: I'LL BE PRODUCTIVE TODAY", bottom: 'ALSO ME AT 3 AM' },
    { top: 'BRAIN: YOU SHOULD SLEEP', bottom: 'ALSO BRAIN: BUT WHAT IF...' },
    { top: 'ADULTING IS EASY THEY SAID', bottom: 'THEY LIED' },
    { top: 'PLAN A FAILS', bottom: 'WHAT IS PLAN B AGAIN' },
    { top: 'TOLD MYSELF FIVE MORE MINUTES', bottom: 'TWO HOURS LATER' },
  ],
  motivation: [
    { top: 'FIRST SOLVE THE PROBLEM', bottom: 'THEN WRITE THE CODE' },
    { top: 'DONE IS BETTER THAN PERFECT', bottom: '— SOMEONE WISE' },
    { top: 'EVERY EXPERT WAS ONCE A BEGINNER', bottom: 'KEEP GOING' },
    { top: 'THE BEST TIME TO START WAS YESTERDAY', bottom: 'THE SECOND BEST TIME IS NOW' },
  ],
};

const TEMPLATE_CATEGORIES = Object.keys(LOCAL_TEMPLATES);

// ── Default state per mode ────────────────────────────────────
const defaultData = {
  'text-meme':  { topText: 'WHEN YOU FINALLY FIX THE BUG', bottomText: 'AND IT CREATES 5 MORE', bgIdx: 0, font: 'Impact', textColor: '#ffffff', fontSize: 52, aspectRatio: '1:1', showGuides: false },
  'tweet':      { name: 'Tech Person', handle: 'techperson', text: 'I fixed a bug by renaming a variable to "actuallyWorksNow" and I regret nothing.', likes: '2.4K', retweets: '847', replies: '234', verified: true, date: 'Jun 20, 2026' },
  'whatsapp':   { contact: 'Mom', messages: [{ from: 'them', text: 'Did you eat?' }, { from: 'me', text: 'Yes mom' }, { from: 'them', text: 'Vegetables too?' }, { from: 'me', text: 'Define vegetables' }], time: '10:42 AM' },
  'instagram':  { username: 'devlife.memes', caption: 'My code at 9 AM vs 9 PM #coding #developer #memes', likes: '12,483', location: 'Stack Overflow', bgColor: '#e8f4f8', imageText: '🐛' },
  'linkedin':   { name: 'Husna Zaheer', title: 'Software Engineer at BigCorp', text: 'Excited to announce that after 6 months of coding in the dark, I successfully deployed to production and immediately got paged. This taught me humility, resilience, and the value of logging. #OpenToWork #Grateful #Blessed', likes: '4,829', comments: '312', reposts: '891', time: '2h' },
  'news':       { channel: 'BREAKING NEWS', headline: 'LOCAL DEVELOPER FIXES BUG IN PRODUCTION', subtext: 'Code "somehow works" — experts baffled', ticker: 'STOCKS UP  •  COFFEE DOWN  •  RUBBER DUCK DEBUGGER NAMED EMPLOYEE OF THE MONTH', bgColor: '#cc0000' },
  'code-meme':  { theme: 0, topComment: '// TODO: fix this later', code: 'function getWork() {\n  // "temporary" solution since 2019\n  return Math.random() > 0.5\n    ? "it works"\n    : "it works on my machine";\n}', bottomText: 'This code is in production.' },
  'motivation': { quote: 'First, solve the problem. Then, write the code.', author: '— John Johnson', bg: BG_GRADIENTS[7].value, textColor: '#ffffff', subtext: '#coding #motivation' },
};

// ── Shared input style ────────────────────────────────────────
const inputCls = 'w-full bg-[#1a1a2e] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors';
const labelCls = 'block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5';

// ── Preview components ────────────────────────────────────────

// ── Canvas-based Text Meme (pixel-perfect, export = preview) ──
function renderTextMemeCanvas(canvas, d) {
  const W   = canvas.width;
  const H   = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  // 1. Gradient background
  const gradData = TM_GRADIENTS[d.bgIdx ?? 0] || TM_GRADIENTS[0];
  const grad = ctx.createLinearGradient(0, 0, W, H);
  gradData.stops.forEach((color, i, arr) => {
    grad.addColorStop(arr.length === 1 ? 0 : i / (arr.length - 1), color);
  });
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // 2. Safe-area guide overlay
  if (d.showGuides) {
    const m = Math.round(Math.min(W, H) * 0.05);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth   = Math.max(2, Math.round(W / 360));
    ctx.setLineDash([Math.round(W / 90), Math.round(W / 135)]);
    ctx.strokeRect(m, m, W - m * 2, H - m * 2);
    // Corner L-marks
    const cm = Math.round(Math.min(W, H) * 0.04);
    ctx.setLineDash([]);
    ctx.lineWidth   = Math.max(3, Math.round(W / 270));
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    [[m, m, 1, 1],[W - m, m, -1, 1],[m, H - m, 1, -1],[W - m, H - m, -1, -1]].forEach(([cx, cy, dx, dy]) => {
      ctx.beginPath();
      ctx.moveTo(cx + dx * cm, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + dy * cm);
      ctx.stroke();
    });
    ctx.restore();
  }

  // 3. Text setup
  const fontFam = `"${d.font || 'Impact'}", Impact, "Arial Black", sans-serif`;
  const VPAD    = Math.round(H * 0.05);   // 5% from top/bottom edges
  const HPAD    = Math.round(W * 0.055);  // 5.5% from left/right
  const MAX_W   = W - HPAD * 2;
  const baseSize = Math.min(d.fontSize || 52, Math.round(W * 0.115)); // cap at 11.5% of width
  const LH_RATIO = 1.18;

  // 4. Fit text into ≤ 2 lines by reducing font size
  function fitText(raw) {
    if (!raw || !raw.trim()) return null;
    const upper = raw.toUpperCase().trim();
    let size     = baseSize;

    while (size >= 18) {
      ctx.font = `900 ${size}px ${fontFam}`;
      const words = upper.split(/\s+/);
      const lines = [];
      let cur = '';

      for (const word of words) {
        const candidate = cur ? `${cur} ${word}` : word;
        if (ctx.measureText(candidate).width > MAX_W && cur) {
          lines.push(cur);
          cur = word;
          if (lines.length >= 2) { cur = ''; break; }
        } else {
          cur = candidate;
        }
      }
      if (cur) {
        if (lines.length < 2) lines.push(cur);
      }

      const fits = lines.length <= 2 &&
        lines.every(l => ctx.measureText(l).width <= MAX_W);
      if (fits && lines.length <= 2) return { lines, size };
      size -= 2;
    }

    // Minimum size fallback — just show first line
    ctx.font = `900 18px ${fontFam}`;
    return { lines: [upper.slice(0, 40)], size: 18 };
  }

  // 5. Draw a block of lines at a given top-Y
  function drawBlock(fitted, startY) {
    if (!fitted || !fitted.lines.length) return 0;
    const { lines, size } = fitted;
    const lh  = size * LH_RATIO;
    const sw  = Math.max(3, size * 0.095); // stroke width ~9.5% of size
    const cx  = W / 2;

    ctx.font         = `900 ${size}px ${fontFam}`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.lineJoin     = 'round';
    ctx.lineCap      = 'round';

    lines.forEach((line, i) => {
      const y = startY + i * lh;
      // Drop shadow for depth
      ctx.save();
      ctx.shadowColor   = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur    = size * 0.12;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = size * 0.05;
      // Stroke
      ctx.strokeStyle = '#000000';
      ctx.lineWidth   = sw;
      ctx.strokeText(line, cx, y);
      ctx.restore();
      // Fill (no shadow on fill to keep it crisp)
      ctx.fillStyle = d.textColor || '#ffffff';
      ctx.fillText(line, cx, y);
    });

    return lines.length * lh;
  }

  // 6. Top text — anchored to top edge
  const topFit = fitText(d.topText);
  drawBlock(topFit, VPAD);

  // 7. Bottom text — anchored to bottom edge
  const botFit = fitText(d.bottomText);
  if (botFit) {
    const totalH = botFit.lines.length * botFit.size * LH_RATIO;
    const botStartY = H - VPAD - totalH;
    drawBlock(botFit, botStartY);
  }
}

function TextMemeCanvas({ d, canvasRef }) {
  const ar = ASPECT_RATIOS.find(a => a.id === (d.aspectRatio || '1:1')) || ASPECT_RATIOS[0];

  useEffect(() => {
    const canvas = canvasRef?.current;
    if (!canvas) return;
    renderTextMemeCanvas(canvas, d);
  }, [d, canvasRef]);

  return (
    <div style={{ position: 'relative', width: '100%', paddingBottom: ar.pb, borderRadius: 8, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.5)' }}>
      <canvas
        ref={canvasRef}
        width={ar.w}
        height={ar.h}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block', borderRadius: 8 }}
      />
    </div>
  );
}

function TweetPreview({ d }) {
  return (
    <div style={{ background: '#000', color: '#e7e9ea', borderRadius: 16, padding: '16px 20px', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif', width: '100%', maxWidth: 500, boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,#1da1f2,#0d47a1)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 18 }}>
          {(d.name || 'U')[0]}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{d.name || 'User'}</span>
            {d.verified && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#1da1f2"><path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.68.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91C2.63 9.33 1.75 10.57 1.75 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.66 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"/></svg>
            )}
            <span style={{ color: '#71767b', fontSize: 14 }}>@{d.handle || 'user'}</span>
            <span style={{ color: '#71767b', fontSize: 14 }}>· {d.date || 'Jun 20'}</span>
          </div>
          <div style={{ marginTop: 10, fontSize: 17, lineHeight: 1.6, wordBreak: 'break-word' }}>{d.text || 'What\'s on your mind?'}</div>
          <div style={{ marginTop: 14, display: 'flex', gap: 28, color: '#71767b', fontSize: 13 }}>
            <span>&#128172; {d.replies || '0'}</span>
            <span>&#8635; {d.retweets || '0'}</span>
            <span>&#9825; {d.likes || '0'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function WhatsAppPreview({ d }) {
  return (
    <div style={{ background: '#e5ddd5', borderRadius: 12, overflow: 'hidden', width: '100%', maxWidth: 380, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <div style={{ background: '#075e54', color: '#fff', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#128c7e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16 }}>
          {(d.contact || 'C')[0]}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15 }}>{d.contact || 'Contact'}</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>online</div>
        </div>
      </div>
      <div style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 180 }}>
        {(d.messages || []).map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.from === 'me' ? 'flex-end' : 'flex-start' }}>
            <div style={{ background: msg.from === 'me' ? '#dcf8c6' : '#fff', borderRadius: msg.from === 'me' ? '12px 2px 12px 12px' : '2px 12px 12px 12px', padding: '7px 10px 4px', maxWidth: '75%', fontSize: 14, color: '#303030', boxShadow: '0 1px 1px rgba(0,0,0,0.1)' }}>
              <div style={{ wordBreak: 'break-word' }}>{msg.text || ' '}</div>
              <div style={{ textAlign: 'right', fontSize: 11, color: '#999', marginTop: 2 }}>{d.time || '10:42 AM'}{msg.from === 'me' ? ' ✓✓' : ''}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function InstagramPreview({ d }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', width: '100%', maxWidth: 380, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', border: '1px solid #dbdbdb' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
        <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#f9ce34,#ee2a7b,#6228d7)', padding: 2, flexShrink: 0 }}>
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, color: '#333' }}>
            {(d.username || 'u')[0]}
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#262626' }}>{d.username || 'username'}</div>
          {d.location && <div style={{ fontSize: 12, color: '#8e8e8e' }}>{d.location}</div>}
        </div>
        <div style={{ color: '#262626', fontSize: 20, letterSpacing: 2 }}>···</div>
      </div>
      <div style={{ width: '100%', position: 'relative', paddingBottom: '100%', background: d.bgColor || '#e8f4f8' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 72 }}>{d.imageText || '🖼️'}</div>
      </div>
      <div style={{ padding: '10px 14px' }}>
        <div style={{ display: 'flex', gap: 14, marginBottom: 8 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#262626" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#262626" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#262626" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          <svg style={{ marginLeft: 'auto' }} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#262626" strokeWidth="2"><polygon points="19 21 12 16 5 21 5 3 19 3 19 21"/></svg>
        </div>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#262626', marginBottom: 4 }}>{d.likes || '0'} likes</div>
        <div style={{ fontSize: 14, color: '#262626', lineHeight: 1.5 }}>
          <span style={{ fontWeight: 600 }}>{d.username || 'username'} </span>
          <span>{d.caption || 'Caption here...'}</span>
        </div>
      </div>
    </div>
  );
}

function LinkedInPreview({ d }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, width: '100%', maxWidth: 500, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', border: '1px solid #e0e0e0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '14px 16px' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#0077b5,#00a0dc)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20, color: '#fff', flexShrink: 0 }}>
          {(d.name || 'U')[0]}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: '#000' }}>{d.name || 'Full Name'}</div>
          <div style={{ fontSize: 13, color: '#555', lineHeight: 1.4 }}>{d.title || 'Job Title at Company'}</div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{d.time || '2h'} · 🌐</div>
        </div>
        <div style={{ background: '#fff', border: '1px solid #0077b5', color: '#0077b5', borderRadius: 20, padding: '5px 14px', fontWeight: 600, fontSize: 14, flexShrink: 0 }}>+ Follow</div>
      </div>
      <div style={{ padding: '0 16px 12px', fontSize: 14, color: '#1a1a1a', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{d.text || 'Post content here...'}</div>
      <div style={{ padding: '8px 16px', borderTop: '1px solid #e0e0e0', fontSize: 13, color: '#666', display: 'flex', alignItems: 'center', gap: 4 }}>
        <span style={{ fontSize: 16 }}>👍 ❤️ 🙌</span>
        <span style={{ marginLeft: 4 }}>{d.likes || '0'}</span>
        <span style={{ marginLeft: 'auto' }}>{d.comments || '0'} comments · {d.reposts || '0'} reposts</span>
      </div>
      <div style={{ padding: '4px 8px 10px', display: 'flex', justifyContent: 'space-around', borderTop: '1px solid #e0e0e0' }}>
        {['👍 Like', '💬 Comment', '🔁 Repost', '📤 Send'].map(a => (
          <span key={a} style={{ fontSize: 13, color: '#666', fontWeight: 600, padding: '5px 4px', cursor: 'default' }}>{a}</span>
        ))}
      </div>
    </div>
  );
}

function BreakingNewsPreview({ d }) {
  return (
    <div style={{ width: '100%', maxWidth: 560, fontFamily: '"Arial Black",Arial,sans-serif', borderRadius: 4, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
      <div style={{ background: d.bgColor || '#cc0000', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ background: '#fff', color: d.bgColor || '#cc0000', fontWeight: 900, fontSize: 11, padding: '4px 8px', borderRadius: 2, letterSpacing: 1 }}>LIVE</div>
        <div style={{ color: '#fff', fontWeight: 900, fontSize: 14, letterSpacing: 2, textTransform: 'uppercase' }}>{d.channel || 'BREAKING NEWS'}</div>
      </div>
      <div style={{ background: '#111', padding: '20px 16px' }}>
        <div style={{ color: '#fff', fontWeight: 900, fontSize: 22, lineHeight: 1.3, textTransform: 'uppercase' }}>{d.headline || 'HEADLINE HERE'}</div>
        {d.subtext && <div style={{ color: '#ccc', fontSize: 14, marginTop: 10, fontFamily: 'Arial,sans-serif', fontWeight: 400 }}>{d.subtext}</div>}
      </div>
      <div style={{ background: d.bgColor || '#cc0000', padding: '7px 0', overflow: 'hidden', whiteSpace: 'nowrap' }}>
        <span style={{ color: '#fff', fontSize: 12, fontWeight: 700, display: 'inline-block', animation: 'ms-ticker 16s linear infinite', paddingLeft: '100%' }}>
          {d.ticker || 'TICKER TEXT HERE  •  MORE NEWS  •'}
        </span>
      </div>
      <style>{`@keyframes ms-ticker { from { transform: translateX(0); } to { transform: translateX(-100%); } }`}</style>
    </div>
  );
}

function CodeMemePreview({ d }) {
  const t = CODE_THEMES[d.theme ?? 0];
  return (
    <div style={{ width: '100%', maxWidth: 520, borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', fontFamily: '"Fira Code","Cascadia Code","Consolas",monospace' }}>
      <div style={{ background: t.header, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57', display: 'inline-block' }} />
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e', display: 'inline-block' }} />
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840', display: 'inline-block' }} />
        <span style={{ marginLeft: 8, color: t.comment, fontSize: 12 }}>meme.js</span>
      </div>
      <div style={{ background: t.bg, padding: '16px 20px' }}>
        {d.topComment && <div style={{ color: t.comment, fontSize: 14, marginBottom: 12, fontStyle: 'italic' }}>{d.topComment}</div>}
        <pre style={{ margin: 0, color: t.text, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{d.code || '// write code here'}</pre>
        {d.bottomText && <div style={{ color: t.comment, fontSize: 14, marginTop: 14, borderTop: `1px solid ${t.comment}40`, paddingTop: 12, fontStyle: 'italic' }}>{'/* '}{d.bottomText}{' */'}</div>}
      </div>
    </div>
  );
}

function MotivationPreview({ d }) {
  return (
    <div style={{ background: d.bg || BG_GRADIENTS[7].value, position: 'relative', width: '100%', paddingBottom: '75%', borderRadius: 12 }}>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '32px 28px', boxSizing: 'border-box', textAlign: 'center' }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="rgba(255,255,255,0.4)" style={{ marginBottom: 16 }}><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1zm14 0c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
        <div style={{ fontFamily: 'Georgia,serif', fontSize: 22, color: d.textColor || '#fff', lineHeight: 1.6, fontStyle: 'italic', textShadow: '0 2px 8px rgba(0,0,0,0.3)', maxWidth: 360, wordBreak: 'break-word' }}>
          "{d.quote || 'Your quote here'}"
        </div>
        {d.author && <div style={{ marginTop: 16, color: d.textColor || '#fff', opacity: 0.75, fontSize: 15, fontFamily: 'Georgia,serif' }}>{d.author}</div>}
        {d.subtext && <div style={{ marginTop: 10, color: d.textColor || '#fff', opacity: 0.5, fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase' }}>{d.subtext}</div>}
      </div>
    </div>
  );
}

// ── Form components ───────────────────────────────────────────

function GradientPicker({ value, onChange }) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {BG_GRADIENTS.map(g => (
        <button key={g.label} onClick={() => onChange(g.value)} title={g.label} style={{ background: g.value, height: 32, borderRadius: 6, border: value === g.value ? '2px solid #3b82f6' : '2px solid transparent', transition: 'border-color .15s' }} />
      ))}
    </div>
  );
}

function TextMemeForm({ d, onChange }) {
  return (
    <div className="space-y-4">

      {/* Text inputs */}
      <div>
        <label className={labelCls}>Top Text</label>
        <textarea
          value={d.topText}
          onChange={e => onChange({ ...d, topText: e.target.value })}
          rows={2}
          className={`${inputCls} resize-none tracking-wide`}
          placeholder="Top text (auto-uppercased in preview)"
        />
      </div>
      <div>
        <label className={labelCls}>Bottom Text</label>
        <textarea
          value={d.bottomText}
          onChange={e => onChange({ ...d, bottomText: e.target.value })}
          rows={2}
          className={`${inputCls} resize-none tracking-wide`}
          placeholder="Bottom text (auto-uppercased in preview)"
        />
      </div>

      {/* Aspect ratio */}
      <div>
        <label className={labelCls}>Aspect Ratio</label>
        <div className="grid grid-cols-4 gap-1.5">
          {ASPECT_RATIOS.map(ar => (
            <button
              key={ar.id}
              onClick={() => onChange({ ...d, aspectRatio: ar.id })}
              className={`py-1.5 text-xs font-semibold rounded-md border transition-colors ${
                (d.aspectRatio || '1:1') === ar.id
                  ? 'bg-blue-600 border-blue-500 text-white'
                  : 'bg-gray-800/60 border-gray-700/60 text-gray-400 hover:border-gray-500 hover:text-gray-200'
              }`}
            >{ar.label}</button>
          ))}
        </div>
      </div>

      {/* Background */}
      <div>
        <label className={labelCls}>Background</label>
        <div className="grid grid-cols-6 gap-1.5">
          {TM_GRADIENTS.map((g, i) => (
            <button
              key={i}
              onClick={() => onChange({ ...d, bgIdx: i })}
              title={g.label}
              style={{ background: `linear-gradient(135deg,${g.stops.join(',')})`, borderRadius: 6, height: 30, border: (d.bgIdx ?? 0) === i ? '2px solid #3b82f6' : '2px solid transparent', transition: 'border-color .15s' }}
            />
          ))}
        </div>
      </div>

      {/* Font + Size */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Font</label>
          <select value={d.font} onChange={e => onChange({ ...d, font: e.target.value })} className={inputCls}>
            {['Impact','Arial Black','Georgia','Helvetica','Comic Sans MS'].map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Max Size — {d.fontSize}px</label>
          <input type="range" min={20} max={120} value={d.fontSize} onChange={e => onChange({ ...d, fontSize: +e.target.value })} className="w-full accent-blue-500 mt-2" />
        </div>
      </div>

      {/* Text color + safe guides */}
      <div className="flex items-center gap-4">
        <div>
          <label className={labelCls}>Text Color</label>
          <input type="color" value={d.textColor || '#ffffff'} onChange={e => onChange({ ...d, textColor: e.target.value })} className="h-9 w-14 rounded-md cursor-pointer border border-gray-700 bg-transparent" />
        </div>
        <div className="flex-1">
          <label className={labelCls}>Safe-area guides</label>
          <button
            onClick={() => onChange({ ...d, showGuides: !d.showGuides })}
            className={`relative w-11 h-6 rounded-full transition-colors ${d.showGuides ? 'bg-blue-500' : 'bg-gray-700'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${d.showGuides ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
      </div>
    </div>
  );
}

function TweetForm({ d, onChange }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Display Name</label>
          <input value={d.name} onChange={e => onChange({ ...d, name: e.target.value })} className={inputCls} placeholder="Your Name" />
        </div>
        <div>
          <label className={labelCls}>@Handle</label>
          <input value={d.handle} onChange={e => onChange({ ...d, handle: e.target.value })} className={inputCls} placeholder="handle" />
        </div>
      </div>
      <div>
        <label className={labelCls}>Tweet</label>
        <textarea value={d.text} onChange={e => onChange({ ...d, text: e.target.value })} rows={4} className={`${inputCls} resize-none`} maxLength={280} />
        <div className="text-right text-xs text-gray-600 mt-1">{(d.text || '').length}/280</div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[['replies', 'Replies'], ['retweets', 'Retweets'], ['likes', 'Likes']].map(([k, lbl]) => (
          <div key={k}>
            <label className={labelCls}>{lbl}</label>
            <input value={d[k]} onChange={e => onChange({ ...d, [k]: e.target.value })} className={inputCls} placeholder="0" />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Verified Badge</label>
        <button onClick={() => onChange({ ...d, verified: !d.verified })} className={`relative w-11 h-6 rounded-full transition-colors ${d.verified ? 'bg-blue-500' : 'bg-gray-700'}`}>
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${d.verified ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>
    </div>
  );
}

function WhatsAppForm({ d, onChange }) {
  const addMsg = from => onChange({ ...d, messages: [...(d.messages || []), { from, text: '' }] });
  const updateMsg = (i, text) => { const msgs = [...(d.messages || [])]; msgs[i] = { ...msgs[i], text }; onChange({ ...d, messages: msgs }); };
  const removeMsg = i => onChange({ ...d, messages: (d.messages || []).filter((_, idx) => idx !== i) });
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Contact Name</label>
        <input value={d.contact} onChange={e => onChange({ ...d, contact: e.target.value })} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Messages</label>
        <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
          {(d.messages || []).map((msg, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className={`text-xs px-2 py-1 rounded-md font-medium flex-shrink-0 ${msg.from === 'me' ? 'bg-green-900/60 text-green-300' : 'bg-gray-700 text-gray-300'}`}>{msg.from === 'me' ? 'You' : 'Them'}</span>
              <input value={msg.text} onChange={e => updateMsg(i, e.target.value)} className={`${inputCls} flex-1`} placeholder="Message..." />
              <button onClick={() => removeMsg(i)} className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"><X size={14} /></button>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 mt-2">
          <button onClick={() => addMsg('them')} className="py-1.5 bg-gray-700 hover:bg-gray-600 text-white text-xs font-medium rounded-lg transition-colors">+ Their message</button>
          <button onClick={() => addMsg('me')} className="py-1.5 bg-green-900/60 hover:bg-green-900 text-green-300 text-xs font-medium rounded-lg transition-colors">+ Your message</button>
        </div>
      </div>
    </div>
  );
}

function InstagramForm({ d, onChange }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Username</label>
          <input value={d.username} onChange={e => onChange({ ...d, username: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Location</label>
          <input value={d.location} onChange={e => onChange({ ...d, location: e.target.value })} className={inputCls} />
        </div>
      </div>
      <div>
        <label className={labelCls}>Image Content (emoji/text)</label>
        <input value={d.imageText} onChange={e => onChange({ ...d, imageText: e.target.value })} className={inputCls} placeholder="🖼️" />
      </div>
      <div>
        <label className={labelCls}>Caption</label>
        <textarea value={d.caption} onChange={e => onChange({ ...d, caption: e.target.value })} rows={3} className={`${inputCls} resize-none`} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Likes</label>
          <input value={d.likes} onChange={e => onChange({ ...d, likes: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Post BG Color</label>
          <input type="color" value={d.bgColor || '#e8f4f8'} onChange={e => onChange({ ...d, bgColor: e.target.value })} className="h-9 w-14 rounded-md cursor-pointer border border-gray-700 bg-transparent" />
        </div>
      </div>
    </div>
  );
}

function LinkedInForm({ d, onChange }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Full Name</label>
          <input value={d.name} onChange={e => onChange({ ...d, name: e.target.value })} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Posted</label>
          <input value={d.time} onChange={e => onChange({ ...d, time: e.target.value })} className={inputCls} placeholder="2h" />
        </div>
      </div>
      <div>
        <label className={labelCls}>Job Title · Company</label>
        <input value={d.title} onChange={e => onChange({ ...d, title: e.target.value })} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Post Content</label>
        <textarea value={d.text} onChange={e => onChange({ ...d, text: e.target.value })} rows={5} className={`${inputCls} resize-none`} />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[['likes', 'Reactions'], ['comments', 'Comments'], ['reposts', 'Reposts']].map(([k, lbl]) => (
          <div key={k}>
            <label className={labelCls}>{lbl}</label>
            <input value={d[k]} onChange={e => onChange({ ...d, [k]: e.target.value })} className={inputCls} />
          </div>
        ))}
      </div>
    </div>
  );
}

function NewsForm({ d, onChange }) {
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Channel Label</label>
        <input value={d.channel} onChange={e => onChange({ ...d, channel: e.target.value })} className={inputCls} placeholder="BREAKING NEWS" />
      </div>
      <div>
        <label className={labelCls}>Headline</label>
        <textarea value={d.headline} onChange={e => onChange({ ...d, headline: e.target.value })} rows={2} className={`${inputCls} resize-none uppercase font-bold`} />
      </div>
      <div>
        <label className={labelCls}>Sub-headline</label>
        <input value={d.subtext} onChange={e => onChange({ ...d, subtext: e.target.value })} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Ticker</label>
        <input value={d.ticker} onChange={e => onChange({ ...d, ticker: e.target.value })} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Bar Color</label>
        <input type="color" value={d.bgColor || '#cc0000'} onChange={e => onChange({ ...d, bgColor: e.target.value })} className="h-9 w-14 rounded-md cursor-pointer border border-gray-700 bg-transparent" />
      </div>
    </div>
  );
}

function CodeMemeForm({ d, onChange }) {
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Theme</label>
        <div className="grid grid-cols-2 gap-2">
          {CODE_THEMES.map((t, i) => (
            <button key={i} onClick={() => onChange({ ...d, theme: i })} style={{ background: t.bg, border: d.theme === i ? '2px solid #3b82f6' : '2px solid transparent', color: t.text }} className="text-xs py-2 px-3 rounded-lg font-mono text-left truncate transition-all">
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className={labelCls}>Top Comment</label>
        <input value={d.topComment} onChange={e => onChange({ ...d, topComment: e.target.value })} className={`${inputCls} font-mono`} placeholder="// comment here" />
      </div>
      <div>
        <label className={labelCls}>Code</label>
        <textarea value={d.code} onChange={e => onChange({ ...d, code: e.target.value })} rows={6} className={`${inputCls} font-mono resize-y`} />
      </div>
      <div>
        <label className={labelCls}>Bottom Caption</label>
        <input value={d.bottomText} onChange={e => onChange({ ...d, bottomText: e.target.value })} className={inputCls} />
      </div>
    </div>
  );
}

function MotivationForm({ d, onChange }) {
  return (
    <div className="space-y-3">
      <div>
        <label className={labelCls}>Quote</label>
        <textarea value={d.quote} onChange={e => onChange({ ...d, quote: e.target.value })} rows={3} className={`${inputCls} resize-none`} />
      </div>
      <div>
        <label className={labelCls}>Author</label>
        <input value={d.author} onChange={e => onChange({ ...d, author: e.target.value })} className={inputCls} />
      </div>
      <div>
        <label className={labelCls}>Hashtags</label>
        <input value={d.subtext} onChange={e => onChange({ ...d, subtext: e.target.value })} className={inputCls} placeholder="#coding #motivation" />
      </div>
      <div>
        <label className={labelCls}>Background</label>
        <GradientPicker value={d.bg} onChange={v => onChange({ ...d, bg: v })} />
      </div>
      <div>
        <label className={labelCls}>Text Color</label>
        <input type="color" value={d.textColor || '#ffffff'} onChange={e => onChange({ ...d, textColor: e.target.value })} className="h-9 w-14 rounded-md cursor-pointer border border-gray-700 bg-transparent" />
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────
export default function MemeStudioTool() {
  const [mode, setMode]       = useState('text-meme');
  const [modeData, setModeData] = useState(() => {
    const s = {};
    MODES.forEach(m => { s[m.id] = { ...defaultData[m.id] }; });
    return s;
  });

  // AI state — separated so errors never reach meme content
  const [aiTopic,    setAiTopic]    = useState('');
  const [aiCategory, setAiCategory] = useState('coding');
  const [aiCaption,  setAiCaption]  = useState('');    // only valid AI result
  const [aiError,    setAiError]    = useState('');    // only error messages
  const [aiLoading,  setAiLoading]  = useState(false);
  const [localSuggestions, setLocalSuggestions] = useState([]);

  const [exporting,  setExporting]  = useState(false);
  const [exportMsg,  setExportMsg]  = useState('');   // 'success' | 'error' | ''
  const [history,    setHistory]    = useState(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
  });
  const [showHistory, setShowHistory] = useState(false);

  const previewRef        = useRef(null);
  const textMemeCanvasRef = useRef(null);   // direct canvas access for text-meme export
  const d   = modeData[mode];
  const setD = useCallback(val => setModeData(prev => ({ ...prev, [mode]: val })), [mode]);

  // ── AI caption: try API, fall back to local templates ────────
  const generateCaption = async () => {
    if (!aiTopic.trim()) return;
    setAiLoading(true);
    setAiCaption('');
    setAiError('');
    setLocalSuggestions([]);

    let gotAiResult = false;
    try {
      const res = await fetch(`${API}/api/tools/meme-studio/caption`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: aiTopic, mode }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.caption) {
          setAiCaption(json.caption);
          gotAiResult = true;
        }
      }
    } catch {
      // Network or timeout — use local fallback
    }

    if (!gotAiResult) {
      // Local fallback: pick templates from selected category
      const templates = LOCAL_TEMPLATES[aiCategory] || LOCAL_TEMPLATES.funny;
      // Shuffle and pick 4
      const shuffled = [...templates].sort(() => Math.random() - 0.5).slice(0, 4);
      setLocalSuggestions(shuffled);
      setAiError('AI unavailable — showing local suggestions instead.');
    }

    setAiLoading(false);
  };

  // Apply AI-generated caption (from API)
  const applyAiCaption = () => {
    if (!aiCaption) return;
    applyCaptionText(aiCaption);
  };

  // Apply a local template suggestion
  const applyTemplate = (tpl) => {
    if (mode === 'text-meme') {
      setD({ ...d, topText: tpl.top || '', bottomText: tpl.bottom || '' });
    } else {
      applyCaptionText((tpl.top || '') + (tpl.bottom ? '\n' + tpl.bottom : ''));
    }
  };

  const applyCaptionText = (text) => {
    const lines = text.split('\n').filter(Boolean);
    if (mode === 'text-meme')   setD({ ...d, topText: lines[0] || '', bottomText: lines[1] || '' });
    else if (mode === 'tweet')  setD({ ...d, text });
    else if (mode === 'motivation') setD({ ...d, quote: lines[0] || text, author: lines[1] || d.author });
    else if (mode === 'news')   setD({ ...d, headline: (lines[0] || text).toUpperCase() });
    else if (mode === 'linkedin')   setD({ ...d, text });
    else if (mode === 'instagram')  setD({ ...d, caption: text });
    else if (mode === 'code-meme')  setD({ ...d, bottomText: lines[0] || text });
  };

  // ── Export ───────────────────────────────────────────────────
  const exportImage = async (format) => {
    setExporting(true);
    setExportMsg('');
    try {
      let exportCanvas;

      if (mode === 'text-meme' && textMemeCanvasRef.current) {
        // Direct canvas export — pixel-perfect match with preview
        exportCanvas = textMemeCanvasRef.current;
      } else {
        const target = previewRef.current;
        if (!target) { setExporting(false); return; }
        await document.fonts.ready;
        const h2c = (await import('html2canvas')).default;
        exportCanvas = await h2c(target, {
          useCORS: true, allowTaint: false, backgroundColor: '#ffffff',
          scale: 2, logging: false, imageTimeout: 5000,
        });
      }

      const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
      const url  = exportCanvas.toDataURL(mime, 0.95);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `meme-${mode}-${Date.now()}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setExportMsg('success');

      const thumb = exportCanvas.toDataURL('image/jpeg', 0.25);
      const entry = { id: Date.now(), mode, preview: thumb, data: { ...d } };
      const nh    = [entry, ...history].slice(0, MAX_HISTORY);
      setHistory(nh);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(nh));
    } catch (err) {
      setExportMsg('error');
      console.error('Export error:', err);
    }
    setExporting(false);
    setTimeout(() => setExportMsg(''), 3000);
  };

  const renderForm = () => {
    switch (mode) {
      case 'text-meme':  return <TextMemeForm d={d} onChange={setD} />;
      case 'tweet':      return <TweetForm d={d} onChange={setD} />;
      case 'whatsapp':   return <WhatsAppForm d={d} onChange={setD} />;
      case 'instagram':  return <InstagramForm d={d} onChange={setD} />;
      case 'linkedin':   return <LinkedInForm d={d} onChange={setD} />;
      case 'news':       return <NewsForm d={d} onChange={setD} />;
      case 'code-meme':  return <CodeMemeForm d={d} onChange={setD} />;
      case 'motivation': return <MotivationForm d={d} onChange={setD} />;
      default: return null;
    }
  };

  const renderPreview = () => {
    switch (mode) {
      case 'text-meme':  return <TextMemeCanvas d={d} canvasRef={textMemeCanvasRef} />;
      case 'tweet':      return <TweetPreview d={d} />;
      case 'whatsapp':   return <WhatsAppPreview d={d} />;
      case 'instagram':  return <InstagramPreview d={d} />;
      case 'linkedin':   return <LinkedInPreview d={d} />;
      case 'news':       return <BreakingNewsPreview d={d} />;
      case 'code-meme':  return <CodeMemePreview d={d} />;
      case 'motivation': return <MotivationPreview d={d} />;
      default: return null;
    }
  };

  const currentMode = MODES.find(m => m.id === mode);

  return (
    <div className="w-full flex flex-col bg-[#0d0d1a] text-white" style={{ minHeight: '100vh', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* ── Topbar ─────────────────────────────────────────────── */}
      <div className="bg-[#111827] border-b border-gray-800/60 px-4 py-2.5 flex items-center justify-between flex-shrink-0">
        <div>
          <span className="font-bold text-base text-white tracking-tight">Meme Studio</span>
          <span className="ml-2 text-[11px] text-gray-500 hidden sm:inline">8 modes · AI captions · Export PNG/JPG</span>
        </div>
        <button onClick={() => setShowHistory(h => !h)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors border border-gray-700/50">
          <History size={14} />
          <span>History</span>
          {history.length > 0 && <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">{history.length}</span>}
        </button>
      </div>

      {/* ── Mode tabs ──────────────────────────────────────────── */}
      <div className="bg-[#111827] border-b border-gray-800/60 px-3 py-1.5 overflow-x-auto flex-shrink-0">
        <div className="flex gap-1 min-w-max">
          {MODES.map(m => {
            const active = mode === m.id;
            return (
              <button key={m.id} onClick={() => setMode(m.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${active ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-400 hover:bg-gray-800/80 hover:text-gray-200'}`}>
                <m.Icon size={13} />
                <span className="hidden sm:inline">{m.label}</span>
                <span className="sm:hidden">{m.label.split(' ')[0]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Workspace ──────────────────────────────────────────── */}
      <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">

        {/* Left panel — controls */}
        <div className="w-full lg:w-[320px] xl:w-[360px] bg-[#111827] border-b lg:border-b-0 lg:border-r border-gray-800/60 flex flex-col flex-shrink-0 lg:h-[calc(100vh-88px)] overflow-y-auto">

          {/* AI Caption section */}
          <div className="p-4 border-b border-gray-800/60">
            <div className="flex items-center gap-1.5 mb-3">
              <Wand2 size={13} className="text-blue-400" />
              <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">AI Caption Generator</span>
            </div>
            <div className="flex gap-2 mb-2">
              <select value={aiCategory} onChange={e => setAiCategory(e.target.value)} className="bg-[#1a1a2e] border border-gray-700 rounded-lg px-2 py-2 text-gray-300 text-xs focus:outline-none focus:border-blue-500 flex-shrink-0">
                {TEMPLATE_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
              </select>
              <input
                value={aiTopic}
                onChange={e => setAiTopic(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && generateCaption()}
                className="flex-1 bg-[#1a1a2e] border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="Topic or keyword..."
              />
              <button onClick={generateCaption} disabled={aiLoading || !aiTopic.trim()} className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors flex-shrink-0">
                {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
              </button>
            </div>

            {/* AI error — shown separately, never applied to meme */}
            {aiError && (
              <div className="flex items-start gap-2 bg-yellow-900/20 border border-yellow-700/40 rounded-lg px-3 py-2 text-xs text-yellow-300 mb-2">
                <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                <span>{aiError}</span>
              </div>
            )}

            {/* AI result */}
            {aiCaption && !aiError && (
              <div className="bg-[#1a1a2e] border border-gray-700/60 rounded-lg p-3 text-sm text-gray-200 whitespace-pre-wrap">
                {aiCaption}
                <button onClick={applyAiCaption} className="flex items-center gap-1 mt-2 text-blue-400 hover:text-blue-300 text-xs font-semibold transition-colors">
                  Apply to meme <BadgeCheck size={12} />
                </button>
              </div>
            )}

            {/* Local suggestion chips */}
            {localSuggestions.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[10px] text-gray-500 font-semibold uppercase tracking-wider">Suggestions — click to apply</span>
                {localSuggestions.map((tpl, i) => (
                  <button key={i} onClick={() => applyTemplate(tpl)} className="w-full text-left bg-[#1a1a2e] hover:bg-gray-800 border border-gray-700/60 hover:border-blue-600/60 rounded-lg px-3 py-2 text-xs text-gray-300 transition-all">
                    <div className="font-semibold text-gray-200 truncate">{tpl.top}</div>
                    {tpl.bottom && <div className="text-gray-500 truncate">{tpl.bottom}</div>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mode form */}
          <div className="p-4 flex-1">
            <div className="flex items-center gap-1.5 mb-3">
              {currentMode && <currentMode.Icon size={13} className="text-gray-400" />}
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{currentMode?.label} Settings</span>
            </div>
            {renderForm()}
          </div>

          {/* Reset */}
          <div className="p-4 border-t border-gray-800/60 flex-shrink-0">
            <button onClick={() => setD({ ...defaultData[mode] })} className="flex items-center justify-center gap-1.5 w-full py-2 bg-gray-800/60 hover:bg-gray-700/60 text-gray-400 hover:text-gray-200 text-xs font-medium rounded-lg transition-colors border border-gray-700/40">
              <RotateCcw size={12} /> Reset to default
            </button>
          </div>
        </div>

        {/* Right panel — preview + export */}
        <div className="flex-1 flex flex-col bg-[#0d0d1a] lg:h-[calc(100vh-88px)]">

          {/* Preview canvas */}
          <div className="flex-1 overflow-auto p-6 flex flex-col items-center justify-start">
            <div className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest mb-4">Live Preview</div>
            {/* previewRef on the direct parent of the meme content */}
            <div ref={previewRef} className="w-full" style={{ maxWidth: 540 }}>
              {renderPreview()}
            </div>
          </div>

          {/* Export bar */}
          <div className="bg-[#111827] border-t border-gray-800/60 px-4 py-3 flex-shrink-0">
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={() => exportImage('png')} disabled={exporting} className="flex items-center gap-1.5 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-semibold transition-colors">
                {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                PNG
              </button>
              <button onClick={() => exportImage('jpg')} disabled={exporting} className="flex items-center gap-1.5 px-5 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-semibold transition-colors">
                {exporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                JPG
              </button>
              {exportMsg === 'success' && (
                <div className="flex items-center gap-1.5 text-green-400 text-sm font-medium">
                  <CheckCircle size={14} /> Downloaded
                </div>
              )}
              {exportMsg === 'error' && (
                <div className="flex items-center gap-1.5 text-red-400 text-sm font-medium">
                  <AlertCircle size={14} /> Export failed — try again
                </div>
              )}
              <div className="ml-auto text-xs text-gray-600">2× resolution · html2canvas</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── History drawer ─────────────────────────────────────── */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/70 z-50 flex justify-end" onClick={() => setShowHistory(false)}>
          <div className="w-full max-w-xs bg-[#111827] h-full overflow-y-auto flex flex-col border-l border-gray-800" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 flex-shrink-0">
              <div className="flex items-center gap-2 font-semibold text-sm">
                <Clock size={14} className="text-gray-400" /> Export History
              </div>
              <button onClick={() => setShowHistory(false)} className="text-gray-500 hover:text-white transition-colors"><X size={18} /></button>
            </div>
            {history.length === 0 ? (
              <div className="p-8 text-center text-gray-600 text-sm">No exports yet</div>
            ) : (
              <div className="p-3 grid grid-cols-2 gap-2 flex-1 content-start">
                {history.map(entry => {
                  const m = MODES.find(m => m.id === entry.mode);
                  return (
                    <div key={entry.id} className="bg-gray-800/60 border border-gray-700/40 rounded-lg overflow-hidden cursor-pointer hover:border-blue-500/60 hover:bg-gray-800 transition-all" onClick={() => { setMode(entry.mode); setD(entry.data); setShowHistory(false); }}>
                      <img src={entry.preview} alt="" className="w-full object-cover aspect-square" />
                      <div className="px-2 py-1.5 flex items-center gap-1">
                        {m && <m.Icon size={10} className="text-gray-500 flex-shrink-0" />}
                        <span className="text-[11px] text-gray-500 truncate">{m?.label}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {history.length > 0 && (
              <div className="p-3 border-t border-gray-800 flex-shrink-0">
                <button onClick={() => { setHistory([]); localStorage.removeItem(HISTORY_KEY); }} className="w-full py-2 text-red-500 hover:bg-red-900/20 text-xs font-medium rounded-lg transition-colors border border-red-900/40">
                  Clear all history
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
