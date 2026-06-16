import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, CheckCircle, Save } from 'lucide-react';
import api from '@/services/api';

const INPUT    = 'w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-[var(--admin-brand)] focus:bg-white transition';
const TEXTAREA = INPUT + ' resize-none font-mono text-xs';

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-3 pt-4 pb-1">
      <div className="h-px flex-1 bg-gray-100" />
      <span className="text-[10px] font-bold tracking-[0.15em] text-[var(--admin-brand)] uppercase whitespace-nowrap">{children}</span>
      <div className="h-px flex-1 bg-gray-100" />
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange }) {
  return (
    <label className="flex items-start justify-between gap-4 py-3 border-b border-gray-50 last:border-0 cursor-pointer">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      <div className="relative shrink-0 mt-0.5">
        <input type="checkbox" className="sr-only" checked={checked} onChange={e => onChange(e.target.checked)} />
        <div onClick={() => onChange(!checked)} className={`w-10 h-5 rounded-full transition-colors duration-200 cursor-pointer ${checked ? 'bg-[var(--admin-brand)]' : 'bg-gray-200'}`} />
        <div className={`pointer-events-none absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${checked ? 'translate-x-5' : ''}`} />
      </div>
    </label>
  );
}

function NumberInput({ label, hint, value, onChange, min = 0 }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type="number" min={min} className={INPUT} value={value} onChange={e => onChange(Number(e.target.value) || 0)} />
      {hint && <p className="text-[11px] text-gray-400 mt-0.5">{hint}</p>}
    </div>
  );
}

const DEFAULTS = {
  rateLimits: { tool: 20, auth: 5, contact: 3, fileProcess: 10 },
  uploadLimits: {
    maxImage: 10, maxVideo: 50, maxAudio: 20,
    allowedImageMimes: ['image/jpeg','image/png','image/webp','image/gif'],
    allowedMediaMimes: ['audio/*','video/*'],
  },
  recaptcha: {
    enabled: false, siteKey: '', secretKey: '',
    thresholds: { auth: 0.7, contact: 0.5, tools: 0.3, subscribe: 0.5 },
  },
  honeypot:    { enabled: true, fieldName: 'website_url' },
  botBlocking: { blockKnownBots: false, blockVpn: false, ipWhitelist: [], ipBlacklist: [] },
};

export default function AdminSecurity() {
  const [form,      setForm]      = useState(DEFAULTS);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState('');
  const [success,   setSuccess]   = useState(false);
  const [whitelist, setWhitelist] = useState('');
  const [blacklist, setBlacklist] = useState('');
  const [imgMimes,  setImgMimes]  = useState('');
  const [mediaMimes,setMediaMimes]= useState('');

  useEffect(() => {
    api.get('/admin/settings')
      .then(d => {
        if (d.settings?.security) {
          const s = d.settings.security;
          setForm(prev => ({
            ...prev,
            rateLimits:   { ...prev.rateLimits,   ...(s.rateLimits   || {}) },
            uploadLimits: { ...prev.uploadLimits,  ...(s.uploadLimits || {}) },
            recaptcha:    { ...prev.recaptcha,     ...(s.recaptcha    || {}), thresholds: { ...prev.recaptcha.thresholds, ...(s.recaptcha?.thresholds || {}) } },
            honeypot:     { ...prev.honeypot,      ...(s.honeypot     || {}) },
            botBlocking:  { ...prev.botBlocking,   ...(s.botBlocking  || {}) },
          }));
          setWhitelist( (s.botBlocking?.ipWhitelist      || []).join('\n'));
          setBlacklist( (s.botBlocking?.ipBlacklist      || []).join('\n'));
          setImgMimes(  (s.uploadLimits?.allowedImageMimes || []).join('\n'));
          setMediaMimes((s.uploadLimits?.allowedMediaMimes || []).join('\n'));
        }
      })
      .catch(e => setError(e.message || 'Failed to load settings.'))
      .finally(() => setLoading(false));
  }, []);

  const setRL  = (k, v) => setForm(f => ({ ...f, rateLimits:   { ...f.rateLimits,   [k]: v } }));
  const setUL  = (k, v) => setForm(f => ({ ...f, uploadLimits: { ...f.uploadLimits, [k]: v } }));
  const setRC  = (k, v) => setForm(f => ({ ...f, recaptcha:    { ...f.recaptcha,    [k]: v } }));
  const setRCT = (k, v) => setForm(f => ({ ...f, recaptcha:    { ...f.recaptcha, thresholds: { ...f.recaptcha.thresholds, [k]: v } } }));
  const setHP  = (k, v) => setForm(f => ({ ...f, honeypot:     { ...f.honeypot,     [k]: v } }));
  const setBB  = (k, v) => setForm(f => ({ ...f, botBlocking:  { ...f.botBlocking,  [k]: v } }));

  const handleSave = async () => {
    setError('');
    setSaving(true);
    const toArr = s => s.split('\n').map(l => l.trim()).filter(Boolean);
    try {
      await api.put('/admin/settings/security', {
        ...form,
        uploadLimits: { ...form.uploadLimits, allowedImageMimes: toArr(imgMimes), allowedMediaMimes: toArr(mediaMimes) },
        botBlocking:  { ...form.botBlocking,  ipWhitelist: toArr(whitelist), ipBlacklist: toArr(blacklist) },
      });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-[var(--admin-brand)] animate-spin" /></div>;

  return (
    <div className="p-6 space-y-5">

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">Security Settings</h1>
          <p className="text-gray-500 text-sm mt-1">Rate limits, upload constraints, reCAPTCHA, honeypot, and bot blocking.</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-[var(--admin-brand)] hover:bg-[color-mix(in_srgb,var(--admin-brand),black_15%)] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-60 shrink-0">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {error   && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3 flex items-center gap-2 text-sm"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
      {success && <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-xl px-5 py-3 flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 shrink-0" />Settings saved.</div>}

      <div className="bg-white rounded-xl border border-gray-200 px-6 py-5 space-y-1">

        <SectionLabel>Rate Limits <span className="normal-case font-normal text-gray-400">(requests / minute)</span></SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-2">
          <NumberInput label="Tool Runs"    value={form.rateLimits.tool}        onChange={v => setRL('tool', v)}        hint="per IP/min" />
          <NumberInput label="Auth (login)" value={form.rateLimits.auth}        onChange={v => setRL('auth', v)}        hint="per IP/min" />
          <NumberInput label="Contact Form" value={form.rateLimits.contact}     onChange={v => setRL('contact', v)}     hint="per IP/min" />
          <NumberInput label="File Process" value={form.rateLimits.fileProcess} onChange={v => setRL('fileProcess', v)} hint="per IP/min" />
        </div>

        <SectionLabel>Upload Limits</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-2">
          <NumberInput label="Max Image Size (MB)" value={form.uploadLimits.maxImage} onChange={v => setUL('maxImage', v)} />
          <NumberInput label="Max Video Size (MB)" value={form.uploadLimits.maxVideo} onChange={v => setUL('maxVideo', v)} />
          <NumberInput label="Max Audio Size (MB)" value={form.uploadLimits.maxAudio} onChange={v => setUL('maxAudio', v)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Allowed Image MIME Types</label>
            <textarea className={TEXTAREA} rows={4} value={imgMimes} onChange={e => setImgMimes(e.target.value)} placeholder={'image/jpeg\nimage/png\nimage/webp\nimage/gif'} />
            <p className="text-[11px] text-gray-400 mt-0.5">One MIME type per line</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Allowed Media MIME Types</label>
            <textarea className={TEXTAREA} rows={4} value={mediaMimes} onChange={e => setMediaMimes(e.target.value)} placeholder={'audio/*\nvideo/*'} />
            <p className="text-[11px] text-gray-400 mt-0.5">One MIME type per line</p>
          </div>
        </div>

        <SectionLabel>reCAPTCHA v3</SectionLabel>
        <ToggleRow label="Enable reCAPTCHA v3" hint="Validates forms against bots — requires Google reCAPTCHA setup" checked={form.recaptcha.enabled} onChange={v => setRC('enabled', v)} />
        {form.recaptcha.enabled && (
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Site Key</label>
                <input className={INPUT} value={form.recaptcha.siteKey}   onChange={e => setRC('siteKey',   e.target.value)} placeholder="6Lc…" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Secret Key</label>
                <input className={INPUT} value={form.recaptcha.secretKey} onChange={e => setRC('secretKey', e.target.value)} placeholder="6Lc…" />
              </div>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700 mb-2">Score Thresholds <span className="text-xs font-normal text-gray-400">(0 = accept all, 1 = require human)</span></p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { key: 'auth',      label: 'Auth' },
                  { key: 'contact',   label: 'Contact' },
                  { key: 'tools',     label: 'Tools' },
                  { key: 'subscribe', label: 'Subscribe' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
                    <input type="number" min={0} max={1} step={0.1} className={INPUT} value={form.recaptcha.thresholds[key]} onChange={e => setRCT(key, Number(e.target.value))} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <SectionLabel>Honeypot</SectionLabel>
        <ToggleRow label="Enable Honeypot Field" hint="Hidden form field — bots fill it in and get blocked" checked={form.honeypot.enabled} onChange={v => setHP('enabled', v)} />
        {form.honeypot.enabled && (
          <div className="max-w-xs pt-1 pb-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Field Name</label>
            <input className={INPUT} value={form.honeypot.fieldName} onChange={e => setHP('fieldName', e.target.value)} placeholder="website_url" />
          </div>
        )}

        <SectionLabel>Bot Blocking</SectionLabel>
        <ToggleRow label="Block Known Bots"  hint="Drop requests from known bot user agents"         checked={form.botBlocking.blockKnownBots} onChange={v => setBB('blockKnownBots', v)} />
        <ToggleRow label="Block VPN / Proxy" hint="Block requests from known VPN and proxy IP ranges" checked={form.botBlocking.blockVpn}       onChange={v => setBB('blockVpn', v)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IP Whitelist</label>
            <textarea className={TEXTAREA} rows={4} value={whitelist} onChange={e => setWhitelist(e.target.value)} placeholder={'192.168.1.1\n10.0.0.0/8'} />
            <p className="text-[11px] text-gray-400 mt-0.5">Always allow these IPs — one per line</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">IP Blacklist</label>
            <textarea className={TEXTAREA} rows={4} value={blacklist} onChange={e => setBlacklist(e.target.value)} placeholder={'1.2.3.4\n5.6.7.8'} />
            <p className="text-[11px] text-gray-400 mt-0.5">Always block these IPs — one per line</p>
          </div>
        </div>

      </div>

      {/* Sticky save bar */}
      <div className="sticky bottom-0 bg-white/90 backdrop-blur-sm border-t border-gray-100 -mx-6 px-6 py-3 flex items-center justify-between">
        <div className="text-sm">
          {error   && <span className="text-red-600 flex items-center gap-1.5"><AlertCircle className="w-4 h-4 shrink-0" />{error}</span>}
          {success && <span className="text-[var(--admin-brand)] flex items-center gap-1.5"><CheckCircle className="w-4 h-4 shrink-0" />Saved!</span>}
        </div>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-[var(--admin-brand)] hover:bg-[color-mix(in_srgb,var(--admin-brand),black_15%)] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}
