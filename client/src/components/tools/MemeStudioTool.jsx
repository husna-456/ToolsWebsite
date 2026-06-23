import { useState, useRef, useCallback, useEffect } from 'react';

const API = import.meta.env.VITE_API_BASE_URL || '';
const HISTORY_KEY = 'meme_studio_history_v1';
const MAX_HISTORY = 20;

// ── Mode definitions ─────────────────────────────────────────
const MODES = [
  { id: 'text-meme',   label: 'Text Meme',      icon: '✏️' },
  { id: 'tweet',       label: 'Fake Tweet',      icon: '🐦' },
  { id: 'whatsapp',    label: 'WhatsApp Chat',   icon: '💬' },
  { id: 'instagram',   label: 'Instagram Post',  icon: '📸' },
  { id: 'linkedin',    label: 'LinkedIn Post',   icon: '💼' },
  { id: 'news',        label: 'Breaking News',   icon: '📺' },
  { id: 'code-meme',   label: 'Code Meme',       icon: '💻' },
  { id: 'motivation',  label: 'Motivational',    icon: '🌟' },
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
  { label: 'VS Code Dark',  bg: '#1e1e1e', text: '#d4d4d4', keyword: '#569cd6', string: '#ce9178', comment: '#6a9955', header: '#252526' },
  { label: 'Dracula',       bg: '#282a36', text: '#f8f8f2', keyword: '#ff79c6', string: '#f1fa8c', comment: '#6272a4', header: '#21222c' },
  { label: 'Monokai',       bg: '#272822', text: '#f8f8f2', keyword: '#f92672', string: '#e6db74', comment: '#75715e', header: '#1e1f1c' },
  { label: 'GitHub Light',  bg: '#ffffff', text: '#24292e', keyword: '#d73a49', string: '#032f62', comment: '#6a737d', header: '#f6f8fa' },
];

// ── Default state per mode ────────────────────────────────────
const defaultData = {
  'text-meme': { topText: 'WHEN YOU FINALLY FIX THE BUG', bottomText: 'AND IT CREATES 5 MORE', bg: BG_GRADIENTS[0].value, font: 'Impact', textColor: '#ffffff', fontSize: 36 },
  'tweet': { name: 'Tech Person', handle: 'techperson', avatar: '', text: 'I fixed a bug by renaming a variable to "actuallyWorksNow" and I regret nothing. 🎉', likes: '2.4K', retweets: '847', replies: '234', verified: true, date: 'Jun 20, 2026' },
  'whatsapp': { contact: 'Mom', messages: [{ from: 'them', text: 'Did you eat?' }, { from: 'me', text: 'Yes mom' }, { from: 'them', text: 'Vegetables too?' }, { from: 'me', text: 'Define vegetables' }], time: '10:42 AM' },
  'instagram': { username: 'devlife.memes', displayName: 'Dev Life', avatar: '', caption: 'My code at 9 AM vs 9 PM 😭 #coding #developer #memes', likes: '12,483', location: 'Stack Overflow', bgColor: '#f5f5f5', imageText: '🐛' },
  'linkedin': { name: 'Husna Zaheer', title: 'Software Engineer at BigCorp', avatar: '', text: 'Excited to announce that after 6 months of coding in the dark, I have successfully deployed to production and immediately got paged. This experience has taught me humility, resilience, and the value of logging. #OpenToWork #Grateful #Blessed', likes: '4,829', comments: '312', reposts: '891', time: '2h' },
  'news': { channel: 'BREAKING NEWS', headline: 'LOCAL DEVELOPER FIXES BUG IN PRODUCTION', subtext: 'Code "somehow works" - experts baffled', ticker: 'STOCKS UP • COFFEE DOWN • RUBBER DUCK DEBUGGER NAMED EMPLOYEE OF THE MONTH', bgColor: '#cc0000', accentColor: '#ffffff' },
  'code-meme': { theme: 0, topComment: '// TODO: fix this later', code: `function getWork() {\n  // "temporary" solution since 2019\n  return Math.random() > 0.5\n    ? "it works"\n    : "it works on my machine";\n}`, bottomText: 'This code is in production.' },
  'motivation': { quote: 'First, solve the problem. Then, write the code.', author: '— John Johnson', bg: BG_GRADIENTS[7].value, textColor: '#ffffff', subtext: '#coding #motivation' },
};

// ── Preview components ────────────────────────────────────────

function TextMemePreview({ d }) {
  return (
    <div style={{ background: d.bg, width: '100%', aspectRatio: '1/1', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', alignItems: 'center', padding: '24px 16px', boxSizing: 'border-box', borderRadius: 8 }}>
      {d.topText && (
        <div style={{ fontFamily: d.font || 'Impact', fontSize: `${d.fontSize || 36}px`, color: d.textColor || '#fff', textShadow: '3px 3px 0 #000, -3px 3px 0 #000, 3px -3px 0 #000, -3px -3px 0 #000', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1, lineHeight: 1.2, wordBreak: 'break-word', maxWidth: '100%' }}>
          {d.topText}
        </div>
      )}
      <div style={{ flex: 1 }} />
      {d.bottomText && (
        <div style={{ fontFamily: d.font || 'Impact', fontSize: `${d.fontSize || 36}px`, color: d.textColor || '#fff', textShadow: '3px 3px 0 #000, -3px 3px 0 #000, 3px -3px 0 #000, -3px -3px 0 #000', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 1, lineHeight: 1.2, wordBreak: 'break-word', maxWidth: '100%' }}>
          {d.bottomText}
        </div>
      )}
    </div>
  );
}

function TweetPreview({ d }) {
  return (
    <div style={{ background: '#000', color: '#e7e9ea', borderRadius: 16, padding: '16px 20px', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif', maxWidth: 500, width: '100%', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'linear-gradient(135deg,#1da1f2,#0d47a1)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>
          {d.avatar ? <img src={d.avatar} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} alt="" /> : '🐦'}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 700, fontSize: 15 }}>{d.name || 'User'}</span>
            {d.verified && <svg width="18" height="18" viewBox="0 0 24 24" fill="#1da1f2"><path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81c-.66-1.31-1.91-2.19-3.34-2.19s-2.68.88-3.34 2.19c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91C2.63 9.33 1.75 10.57 1.75 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.66 1.31 1.91 2.19 3.34 2.19s2.68-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z"/></svg>}
            <span style={{ color: '#71767b', fontSize: 14 }}>@{d.handle || 'user'}</span>
            <span style={{ color: '#71767b', fontSize: 14 }}>·</span>
            <span style={{ color: '#71767b', fontSize: 14 }}>{d.date || 'Jun 20'}</span>
          </div>
          <div style={{ marginTop: 8, fontSize: 17, lineHeight: 1.5, wordBreak: 'break-word' }}>{d.text || 'Tweet text here...'}</div>
          <div style={{ marginTop: 16, display: 'flex', gap: 24, color: '#71767b', fontSize: 14 }}>
            <span>💬 {d.replies || '0'}</span>
            <span>🔁 {d.retweets || '0'}</span>
            <span>❤️ {d.likes || '0'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function WhatsAppPreview({ d }) {
  return (
    <div style={{ background: '#e5ddd5', borderRadius: 16, overflow: 'hidden', width: '100%', maxWidth: 380, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>
      <div style={{ background: '#075e54', color: '#fff', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#25d366', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>👤</div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 16 }}>{d.contact || 'Contact'}</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>online</div>
        </div>
      </div>
      <div style={{ padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 200, backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'400\' height=\'400\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3C/svg%3E")' }}>
        {(d.messages || []).map((msg, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: msg.from === 'me' ? 'flex-end' : 'flex-start' }}>
            <div style={{ background: msg.from === 'me' ? '#dcf8c6' : '#fff', borderRadius: msg.from === 'me' ? '12px 12px 2px 12px' : '12px 12px 12px 2px', padding: '8px 12px', maxWidth: '75%', fontSize: 14, color: '#303030', boxShadow: '0 1px 1px rgba(0,0,0,0.13)' }}>
              {msg.text}
              <div style={{ textAlign: 'right', fontSize: 11, color: '#999', marginTop: 2 }}>{d.time || '10:42 AM'} {msg.from === 'me' ? '✓✓' : ''}</div>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' }}>
        <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg,#f9ce34,#ee2a7b,#6228d7)', padding: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>📸</div>
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 14, color: '#262626' }}>{d.username || 'username'}</div>
          {d.location && <div style={{ fontSize: 12, color: '#8e8e8e' }}>{d.location}</div>}
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 20, color: '#262626' }}>···</div>
      </div>
      <div style={{ width: '100%', aspectRatio: '1/1', background: d.bgColor || '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 80 }}>
        {d.imageText || '🖼️'}
      </div>
      <div style={{ padding: '10px 12px' }}>
        <div style={{ display: 'flex', gap: 14, fontSize: 22, marginBottom: 8 }}>
          <span>❤️</span><span>💬</span><span>📤</span>
          <span style={{ marginLeft: 'auto' }}>🔖</span>
        </div>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#262626', marginBottom: 4 }}>{d.likes || '0'} likes</div>
        <div style={{ fontSize: 14, color: '#262626' }}>
          <span style={{ fontWeight: 600 }}>{d.username || 'username'}</span>{' '}
          <span>{d.caption || 'Caption goes here...'}</span>
        </div>
      </div>
    </div>
  );
}

function LinkedInPreview({ d }) {
  return (
    <div style={{ background: '#fff', borderRadius: 8, overflow: 'hidden', width: '100%', maxWidth: 500, fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif', border: '1px solid #e0e0e0', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 16px' }}>
        <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg,#0077b5,#00a0dc)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0 }}>💼</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 15, color: '#000' }}>{d.name || 'Full Name'}</div>
          <div style={{ fontSize: 13, color: '#666', lineHeight: 1.3 }}>{d.title || 'Job Title at Company'}</div>
          <div style={{ fontSize: 12, color: '#999', marginTop: 2 }}>{d.time || '2h'} · 🌐</div>
        </div>
        <button style={{ background: '#fff', border: '1px solid #0077b5', color: '#0077b5', borderRadius: 20, padding: '6px 16px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>+ Follow</button>
      </div>
      <div style={{ padding: '0 16px 8px', fontSize: 14, color: '#000', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{d.text || 'Post content here...'}</div>
      <div style={{ padding: '8px 16px', borderTop: '1px solid #e0e0e0', display: 'flex', gap: 4, fontSize: 13, color: '#666' }}>
        <span>👍 ❤️ 🙌</span>
        <span style={{ marginLeft: 4 }}>{d.likes || '0'}</span>
        <span style={{ marginLeft: 'auto' }}>{d.comments || '0'} comments · {d.reposts || '0'} reposts</span>
      </div>
      <div style={{ padding: '4px 16px 12px', display: 'flex', justifyContent: 'space-around', borderTop: '1px solid #e0e0e0' }}>
        {['👍 Like', '💬 Comment', '🔁 Repost', '📤 Send'].map(a => (
          <span key={a} style={{ fontSize: 13, color: '#666', fontWeight: 600, padding: '6px 4px', cursor: 'pointer' }}>{a}</span>
        ))}
      </div>
    </div>
  );
}

function BreakingNewsPreview({ d }) {
  return (
    <div style={{ width: '100%', maxWidth: 560, fontFamily: '"Arial Black",Arial,sans-serif', borderRadius: 4, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}>
      <div style={{ background: d.bgColor || '#cc0000', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ background: '#fff', color: d.bgColor || '#cc0000', fontWeight: 900, fontSize: 12, padding: '4px 10px', borderRadius: 2, letterSpacing: 1 }}>LIVE</div>
        <div style={{ color: '#fff', fontWeight: 900, fontSize: 14, letterSpacing: 2, textTransform: 'uppercase' }}>{d.channel || 'BREAKING NEWS'}</div>
      </div>
      <div style={{ background: '#111', padding: '20px 16px' }}>
        <div style={{ color: '#fff', fontWeight: 900, fontSize: 24, lineHeight: 1.2, textTransform: 'uppercase', letterSpacing: 0.5 }}>{d.headline || 'HEADLINE HERE'}</div>
        {d.subtext && <div style={{ color: '#ccc', fontSize: 15, marginTop: 10, fontFamily: 'Arial,sans-serif', fontWeight: 400 }}>{d.subtext}</div>}
      </div>
      <div style={{ background: d.bgColor || '#cc0000', padding: '8px 0', overflow: 'hidden' }}>
        <div style={{ color: '#fff', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', animation: 'ticker 12s linear infinite', display: 'inline-block', paddingLeft: '100%' }}>
          {d.ticker || 'TICKER TEXT HERE • MORE NEWS •'}
        </div>
      </div>
      <style>{`@keyframes ticker { 0% { transform: translateX(0); } 100% { transform: translateX(-100%); } }`}</style>
    </div>
  );
}

function CodeMemePreview({ d }) {
  const theme = CODE_THEMES[d.theme ?? 0];
  return (
    <div style={{ width: '100%', maxWidth: 520, borderRadius: 10, overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', fontFamily: '"Fira Code","Cascadia Code","Consolas",monospace' }}>
      <div style={{ background: theme.header, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f57', display: 'inline-block' }} />
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#febc2e', display: 'inline-block' }} />
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#28c840', display: 'inline-block' }} />
        <span style={{ marginLeft: 8, color: theme.comment, fontSize: 12 }}>meme.js</span>
      </div>
      <div style={{ background: theme.bg, padding: '16px 20px' }}>
        {d.topComment && <div style={{ color: theme.comment, fontSize: 14, marginBottom: 12, fontStyle: 'italic' }}>{d.topComment}</div>}
        <pre style={{ margin: 0, color: theme.text, fontSize: 14, lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{d.code || '// write your code meme here'}</pre>
        {d.bottomText && <div style={{ color: theme.comment, fontSize: 14, marginTop: 16, borderTop: `1px solid ${theme.comment}44`, paddingTop: 12, fontStyle: 'italic' }}>/* {d.bottomText} */</div>}
      </div>
    </div>
  );
}

function MotivationPreview({ d }) {
  return (
    <div style={{ background: d.bg || BG_GRADIENTS[7].value, width: '100%', aspectRatio: '4/3', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: '32px 24px', boxSizing: 'border-box', borderRadius: 12, textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 16 }}>✨</div>
      <div style={{ fontFamily: 'Georgia,serif', fontSize: 24, color: d.textColor || '#fff', lineHeight: 1.5, fontStyle: 'italic', textShadow: '0 2px 8px rgba(0,0,0,0.3)', maxWidth: 400, wordBreak: 'break-word' }}>
        "{d.quote || 'Your motivational quote here'}"
      </div>
      {d.author && <div style={{ marginTop: 16, color: d.textColor || '#fff', opacity: 0.8, fontSize: 16, fontFamily: 'Georgia,serif' }}>{d.author}</div>}
      {d.subtext && <div style={{ marginTop: 12, color: d.textColor || '#fff', opacity: 0.6, fontSize: 13, letterSpacing: 1 }}>{d.subtext}</div>}
    </div>
  );
}

// ── Form panels per mode ──────────────────────────────────────

function TextMemeForm({ d, onChange }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-300">Top Text</label>
        <textarea value={d.topText} onChange={e => onChange({ ...d, topText: e.target.value })} rows={2} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-blue-500" placeholder="TOP TEXT" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-300">Bottom Text</label>
        <textarea value={d.bottomText} onChange={e => onChange({ ...d, bottomText: e.target.value })} rows={2} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-blue-500" placeholder="BOTTOM TEXT" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-300">Background</label>
        <div className="grid grid-cols-4 gap-2">
          {BG_GRADIENTS.map(g => (
            <button key={g.label} onClick={() => onChange({ ...d, bg: g.value })} title={g.label} style={{ background: g.value, height: 36, borderRadius: 8, border: d.bg === g.value ? '2px solid #3b82f6' : '2px solid transparent' }} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-300">Font</label>
          <select value={d.font} onChange={e => onChange({ ...d, font: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
            {['Impact', 'Arial Black', 'Georgia', 'Comic Sans MS', 'Helvetica'].map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-300">Size: {d.fontSize}px</label>
          <input type="range" min={18} max={64} value={d.fontSize} onChange={e => onChange({ ...d, fontSize: +e.target.value })} className="w-full accent-blue-500" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-300">Text Color</label>
        <input type="color" value={d.textColor} onChange={e => onChange({ ...d, textColor: e.target.value })} className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent" />
      </div>
    </div>
  );
}

function TweetForm({ d, onChange }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-300">Display Name</label>
          <input value={d.name} onChange={e => onChange({ ...d, name: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" placeholder="Your Name" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-300">@Handle</label>
          <input value={d.handle} onChange={e => onChange({ ...d, handle: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" placeholder="handle" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-300">Tweet Text</label>
        <textarea value={d.text} onChange={e => onChange({ ...d, text: e.target.value })} rows={4} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-blue-500" placeholder="What's happening?" maxLength={280} />
        <div className="text-right text-xs text-gray-500 mt-1">{d.text?.length || 0}/280</div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[['replies', 'Replies'], ['retweets', 'Retweets'], ['likes', 'Likes']].map(([k, label]) => (
          <div key={k}>
            <label className="block text-xs font-medium mb-1 text-gray-400">{label}</label>
            <input value={d[k]} onChange={e => onChange({ ...d, [k]: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-blue-500" placeholder="0" />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <label className="text-sm text-gray-300">Verified Badge</label>
        <button onClick={() => onChange({ ...d, verified: !d.verified })} className={`w-12 h-6 rounded-full transition-colors ${d.verified ? 'bg-blue-500' : 'bg-gray-700'}`}>
          <span className={`block w-5 h-5 bg-white rounded-full transition-transform mx-0.5 ${d.verified ? 'translate-x-6' : 'translate-x-0'}`} />
        </button>
      </div>
    </div>
  );
}

function WhatsAppForm({ d, onChange }) {
  const addMsg = (from) => {
    const msgs = [...(d.messages || [])];
    msgs.push({ from, text: '' });
    onChange({ ...d, messages: msgs });
  };
  const updateMsg = (i, text) => {
    const msgs = [...(d.messages || [])];
    msgs[i] = { ...msgs[i], text };
    onChange({ ...d, messages: msgs });
  };
  const removeMsg = (i) => {
    const msgs = (d.messages || []).filter((_, idx) => idx !== i);
    onChange({ ...d, messages: msgs });
  };
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-300">Contact Name</label>
        <input value={d.contact} onChange={e => onChange({ ...d, contact: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-300">Messages</label>
        <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
          {(d.messages || []).map((msg, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${msg.from === 'me' ? 'bg-green-800 text-green-200' : 'bg-gray-700 text-gray-300'}`}>{msg.from === 'me' ? 'You' : 'Them'}</span>
              <input value={msg.text} onChange={e => updateMsg(i, e.target.value)} className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-2 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500" placeholder="Message..." />
              <button onClick={() => removeMsg(i)} className="text-gray-500 hover:text-red-400 text-lg leading-none">×</button>
            </div>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <button onClick={() => addMsg('them')} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-sm py-1.5 rounded-lg transition-colors">+ Them</button>
          <button onClick={() => addMsg('me')} className="flex-1 bg-green-800 hover:bg-green-700 text-white text-sm py-1.5 rounded-lg transition-colors">+ You</button>
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
          <label className="block text-sm font-medium mb-1 text-gray-300">Username</label>
          <input value={d.username} onChange={e => onChange({ ...d, username: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-300">Location</label>
          <input value={d.location} onChange={e => onChange({ ...d, location: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-300">Image Emoji / Symbol</label>
        <input value={d.imageText} onChange={e => onChange({ ...d, imageText: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" placeholder="🖼️" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-300">Caption</label>
        <textarea value={d.caption} onChange={e => onChange({ ...d, caption: e.target.value })} rows={3} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-blue-500" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-300">Likes</label>
          <input value={d.likes} onChange={e => onChange({ ...d, likes: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-300">Post BG Color</label>
          <input type="color" value={d.bgColor || '#f5f5f5'} onChange={e => onChange({ ...d, bgColor: e.target.value })} className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent" />
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
          <label className="block text-sm font-medium mb-1 text-gray-300">Full Name</label>
          <input value={d.name} onChange={e => onChange({ ...d, name: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-gray-300">Time</label>
          <input value={d.time} onChange={e => onChange({ ...d, time: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" placeholder="2h" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-300">Title / Company</label>
        <input value={d.title} onChange={e => onChange({ ...d, title: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-300">Post Content</label>
        <textarea value={d.text} onChange={e => onChange({ ...d, text: e.target.value })} rows={5} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-blue-500" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[['likes', 'Reactions'], ['comments', 'Comments'], ['reposts', 'Reposts']].map(([k, label]) => (
          <div key={k}>
            <label className="block text-xs font-medium mb-1 text-gray-400">{label}</label>
            <input value={d[k]} onChange={e => onChange({ ...d, [k]: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-2 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
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
        <label className="block text-sm font-medium mb-1 text-gray-300">Channel Label</label>
        <input value={d.channel} onChange={e => onChange({ ...d, channel: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" placeholder="BREAKING NEWS" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-300">Headline</label>
        <textarea value={d.headline} onChange={e => onChange({ ...d, headline: e.target.value })} rows={2} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-300">Sub-headline</label>
        <input value={d.subtext} onChange={e => onChange({ ...d, subtext: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-300">Ticker Text</label>
        <input value={d.ticker} onChange={e => onChange({ ...d, ticker: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-300">Bar Color</label>
        <input type="color" value={d.bgColor || '#cc0000'} onChange={e => onChange({ ...d, bgColor: e.target.value })} className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent" />
      </div>
    </div>
  );
}

function CodeMemeForm({ d, onChange }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-300">Theme</label>
        <div className="grid grid-cols-2 gap-2">
          {CODE_THEMES.map((t, i) => (
            <button key={i} onClick={() => onChange({ ...d, theme: i })} style={{ background: t.bg, border: d.theme === i ? '2px solid #3b82f6' : '2px solid transparent', color: t.text }} className="text-xs py-2 px-3 rounded-lg font-mono text-left">
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-300">Top Comment</label>
        <input value={d.topComment} onChange={e => onChange({ ...d, topComment: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm font-mono focus:outline-none focus:border-blue-500" placeholder="// TODO: fix this" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-300">Code</label>
        <textarea value={d.code} onChange={e => onChange({ ...d, code: e.target.value })} rows={6} className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-green-400 text-sm font-mono resize-y focus:outline-none focus:border-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-300">Bottom Caption</label>
        <input value={d.bottomText} onChange={e => onChange({ ...d, bottomText: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
      </div>
    </div>
  );
}

function MotivationForm({ d, onChange }) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-300">Quote</label>
        <textarea value={d.quote} onChange={e => onChange({ ...d, quote: e.target.value })} rows={3} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm resize-none focus:outline-none focus:border-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-300">Author</label>
        <input value={d.author} onChange={e => onChange({ ...d, author: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-300">Hashtags</label>
        <input value={d.subtext} onChange={e => onChange({ ...d, subtext: e.target.value })} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" placeholder="#motivation #coding" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-300">Background</label>
        <div className="grid grid-cols-4 gap-2">
          {BG_GRADIENTS.map(g => (
            <button key={g.label} onClick={() => onChange({ ...d, bg: g.value })} title={g.label} style={{ background: g.value, height: 36, borderRadius: 8, border: d.bg === g.value ? '2px solid #3b82f6' : '2px solid transparent' }} />
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1 text-gray-300">Text Color</label>
        <input type="color" value={d.textColor || '#ffffff'} onChange={e => onChange({ ...d, textColor: e.target.value })} className="w-10 h-10 rounded cursor-pointer border-0 bg-transparent" />
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────
export default function MemeStudioTool() {
  const [mode, setMode] = useState('text-meme');
  const [modeData, setModeData] = useState(() => {
    const saved = {};
    MODES.forEach(m => { saved[m.id] = { ...defaultData[m.id] }; });
    return saved;
  });
  const [aiTopic, setAiTopic] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiCaption, setAiCaption] = useState('');
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState('');
  const [history, setHistory] = useState(() => {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch { return []; }
  });
  const [showHistory, setShowHistory] = useState(false);
  const previewRef = useRef(null);

  const d = modeData[mode];
  const setD = useCallback((val) => setModeData(prev => ({ ...prev, [mode]: val })), [mode]);

  // AI caption
  const generateCaption = async () => {
    if (!aiTopic.trim()) return;
    setAiLoading(true);
    setAiCaption('');
    try {
      const res = await fetch(`${API}/api/tools/meme-studio/caption`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: aiTopic, mode }),
      });
      const json = await res.json();
      if (json.success) setAiCaption(json.caption);
    } catch {
      setAiCaption('AI unavailable. Try again later.');
    }
    setAiLoading(false);
  };

  const applyCaption = () => {
    if (!aiCaption) return;
    const lines = aiCaption.split('\n').filter(Boolean);
    if (mode === 'text-meme') {
      setD({ ...d, topText: lines[0] || '', bottomText: lines[1] || '' });
    } else if (mode === 'tweet') {
      setD({ ...d, text: aiCaption });
    } else if (mode === 'motivation') {
      setD({ ...d, quote: lines[0] || aiCaption, author: lines[1] || d.author });
    } else if (mode === 'news') {
      setD({ ...d, headline: (lines[0] || aiCaption).toUpperCase() });
    } else if (mode === 'linkedin') {
      setD({ ...d, text: aiCaption });
    } else if (mode === 'instagram') {
      setD({ ...d, caption: aiCaption });
    } else if (mode === 'code-meme') {
      setD({ ...d, bottomText: lines[0] || aiCaption });
    }
  };

  // Export
  const exportImage = async (format) => {
    if (!previewRef.current) return;
    setExporting(true);
    setExportMsg('Capturing...');
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(previewRef.current, {
        useCORS: true,
        backgroundColor: format === 'png' ? null : '#ffffff',
        scale: 2,
        logging: false,
      });
      const mimeType = format === 'jpg' ? 'image/jpeg' : 'image/png';
      const url = canvas.toDataURL(mimeType, 0.95);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meme-${mode}-${Date.now()}.${format}`;
      a.click();
      setExportMsg('Downloaded!');
      // Save to history
      const entry = { id: Date.now(), mode, preview: canvas.toDataURL('image/jpeg', 0.4), data: { ...d } };
      const newHistory = [entry, ...history].slice(0, MAX_HISTORY);
      setHistory(newHistory);
      localStorage.setItem(HISTORY_KEY, JSON.stringify(newHistory));
    } catch (err) {
      setExportMsg('Export failed. Try again.');
      console.error(err);
    }
    setExporting(false);
    setTimeout(() => setExportMsg(''), 3000);
  };

  // Render form
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

  // Render preview
  const renderPreview = () => {
    switch (mode) {
      case 'text-meme':  return <TextMemePreview d={d} />;
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

  return (
    <div className="w-full bg-gray-950 text-white min-h-screen" style={{ fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif' }}>

      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🎭</span>
          <div>
            <div className="font-bold text-lg">Meme Studio</div>
            <div className="text-xs text-gray-400">8 meme types · AI captions · Export PNG/JPG</div>
          </div>
        </div>
        <button onClick={() => setShowHistory(h => !h)} className="flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition-colors">
          🕐 History {history.length > 0 && <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded-full">{history.length}</span>}
        </button>
      </div>

      {/* Mode tabs */}
      <div className="bg-gray-900 border-b border-gray-800 px-4 py-2 overflow-x-auto">
        <div className="flex gap-2 min-w-max">
          {MODES.map(m => (
            <button key={m.id} onClick={() => setMode(m.id)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${mode === m.id ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
              <span>{m.icon}</span>
              <span className="hidden sm:inline">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main workspace */}
      <div className="flex flex-col lg:flex-row gap-0 lg:gap-0 min-h-[calc(100vh-140px)]">

        {/* Left: Controls */}
        <div className="w-full lg:w-80 xl:w-96 bg-gray-900 border-b lg:border-b-0 lg:border-r border-gray-800 flex flex-col">

          {/* AI Caption */}
          <div className="p-4 border-b border-gray-800">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">🤖 AI Caption Generator</div>
            <div className="flex gap-2">
              <input value={aiTopic} onChange={e => setAiTopic(e.target.value)} onKeyDown={e => e.key === 'Enter' && generateCaption()} className="flex-1 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500" placeholder="Topic (e.g. Monday mornings)" />
              <button onClick={generateCaption} disabled={aiLoading || !aiTopic.trim()} className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-medium transition-colors whitespace-nowrap">
                {aiLoading ? '...' : 'Generate'}
              </button>
            </div>
            {aiCaption && (
              <div className="mt-2 bg-gray-800 rounded-lg p-3 text-sm text-gray-200 whitespace-pre-wrap border border-gray-700">
                {aiCaption}
                <button onClick={applyCaption} className="block mt-2 text-blue-400 hover:text-blue-300 text-xs font-medium">Apply to meme →</button>
              </div>
            )}
          </div>

          {/* Mode-specific form */}
          <div className="p-4 overflow-y-auto flex-1">
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
              {MODES.find(m => m.id === mode)?.icon} {MODES.find(m => m.id === mode)?.label} Settings
            </div>
            {renderForm()}
          </div>

          {/* Reset */}
          <div className="p-4 border-t border-gray-800">
            <button onClick={() => setD({ ...defaultData[mode] })} className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors">
              Reset to Default
            </button>
          </div>
        </div>

        {/* Right: Preview + Export */}
        <div className="flex-1 flex flex-col bg-gray-950">

          {/* Preview */}
          <div className="flex-1 p-6 flex flex-col items-center justify-start overflow-auto">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">Live Preview</div>
            <div ref={previewRef} className="w-full flex justify-center" style={{ maxWidth: 560 }}>
              {renderPreview()}
            </div>
          </div>

          {/* Export bar */}
          <div className="bg-gray-900 border-t border-gray-800 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <button onClick={() => exportImage('png')} disabled={exporting} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors">
                  {exporting ? '⏳' : '⬇️'} PNG
                </button>
                <button onClick={() => exportImage('jpg')} disabled={exporting} className="flex items-center gap-1.5 px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors">
                  {exporting ? '⏳' : '⬇️'} JPG
                </button>
              </div>
              {exportMsg && <div className="text-sm font-medium text-green-400">{exportMsg}</div>}
              <div className="text-xs text-gray-500">html2canvas · 2× resolution</div>
            </div>
          </div>
        </div>
      </div>

      {/* History drawer */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/60 z-50 flex justify-end" onClick={() => setShowHistory(false)}>
          <div className="w-full max-w-sm bg-gray-900 h-full overflow-y-auto shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <div className="font-semibold">Recent Memes</div>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-white text-xl">×</button>
            </div>
            {history.length === 0 ? (
              <div className="p-6 text-center text-gray-500 text-sm">No memes exported yet</div>
            ) : (
              <div className="p-3 grid grid-cols-2 gap-3">
                {history.map(entry => (
                  <div key={entry.id} className="bg-gray-800 rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-blue-500 transition-all" onClick={() => { setMode(entry.mode); setD(entry.data); setShowHistory(false); }}>
                    <img src={entry.preview} alt="" className="w-full object-cover aspect-square" />
                    <div className="px-2 py-1.5 text-xs text-gray-400">{MODES.find(m => m.id === entry.mode)?.label}</div>
                  </div>
                ))}
              </div>
            )}
            {history.length > 0 && (
              <div className="p-3 mt-auto border-t border-gray-800">
                <button onClick={() => { setHistory([]); localStorage.removeItem(HISTORY_KEY); }} className="w-full py-2 bg-red-900/40 hover:bg-red-900/60 text-red-400 text-sm rounded-lg transition-colors">
                  Clear History
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
