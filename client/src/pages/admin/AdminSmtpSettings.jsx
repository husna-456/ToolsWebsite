import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, CheckCircle, Save, Mail, Eye, EyeOff, Send } from 'lucide-react';
import api from '@/services/api';

const INPUT  = 'w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-[var(--admin-brand)] focus:bg-white transition';
const SELECT = INPUT;

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-3 pt-4 pb-1">
      <div className="h-px flex-1 bg-gray-100" />
      <span className="text-[10px] font-bold tracking-[0.15em] text-[var(--admin-brand)] uppercase whitespace-nowrap">{children}</span>
      <div className="h-px flex-1 bg-gray-100" />
    </div>
  );
}

const DEFAULTS = {
  host:         '',
  port:         587,
  encryption:   'tls',
  username:     '',
  password:     '',
  fromName:     'InnovateTools',
  fromEmail:    '',
  replyToEmail: '',
};

export default function AdminSmtpSettings() {
  const [form,        setForm]        = useState(DEFAULTS);
  const [lastTestAt,  setLastTestAt]  = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState('');
  const [success,     setSuccess]     = useState(false);
  const [showPassword,setShowPassword]= useState(false);

  const [testTo,      setTestTo]      = useState('');
  const [testing,     setTesting]     = useState(false);
  const [testResult,  setTestResult]  = useState(null); // { ok: bool, message: string }

  useEffect(() => {
    api.get('/admin/settings')
      .then(d => {
        if (d.settings?.smtp) {
          const { lastTestAt: t, ...rest } = d.settings.smtp;
          setForm(prev => ({ ...prev, ...rest }));
          setLastTestAt(t || null);
        }
      })
      .catch(e => setError(e.message || 'Failed to load settings.'))
      .finally(() => setLoading(false));
  }, []);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      await api.put('/admin/settings/smtp', form);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2500);
    } catch (err) {
      setError(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTestResult(null);
    setTesting(true);
    try {
      const d = await api.post('/admin/settings/smtp/test', { to: testTo.trim() || undefined });
      setTestResult({ ok: true, message: d.message || 'Test email sent!' });
      if (d.lastTestAt) setLastTestAt(d.lastTestAt);
    } catch (err) {
      setTestResult({ ok: false, message: err.message || 'Failed to send test email.' });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-[var(--admin-brand)] animate-spin" /></div>;

  return (
    <div className="p-6 space-y-5">

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-medium text-gray-900">SMTP / Email Settings</h1>
          <p className="text-gray-500 text-sm mt-1">Configure outgoing email for contact replies and notifications.</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-[var(--admin-brand)] hover:bg-[color-mix(in_srgb,var(--admin-brand),black_15%)] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-60 shrink-0">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {error   && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3 flex items-center gap-2 text-sm"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
      {success && <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-xl px-5 py-3 flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 shrink-0" />Settings saved.</div>}

      <div className="bg-white rounded-xl border border-gray-200 px-6 py-5 space-y-4">

        <SectionLabel>Server</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="sm:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">SMTP Host</label>
            <input className={INPUT} value={form.host} onChange={e => set('host', e.target.value)} placeholder="smtp.gmail.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Port</label>
            <input
              type="number"
              className={INPUT}
              value={form.port}
              onChange={e => set('port', Number(e.target.value))}
              placeholder="587"
            />
          </div>
        </div>

        <div className="max-w-xs">
          <label className="block text-sm font-medium text-gray-700 mb-1">Encryption</label>
          <select className={SELECT} value={form.encryption} onChange={e => set('encryption', e.target.value)}>
            <option value="none">None</option>
            <option value="tls">TLS / STARTTLS (port 587)</option>
            <option value="ssl">SSL (port 465)</option>
          </select>
        </div>

        <SectionLabel>Authentication</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
            <input className={INPUT} value={form.username} onChange={e => set('username', e.target.value)} placeholder="your@gmail.com" autoComplete="off" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password / App Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                className={INPUT + ' pr-10'}
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder="••••••••••••"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>

        <SectionLabel>From Address</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Name</label>
            <input className={INPUT} value={form.fromName} onChange={e => set('fromName', e.target.value)} placeholder="InnovateTools" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Email</label>
            <input type="email" className={INPUT} value={form.fromEmail} onChange={e => set('fromEmail', e.target.value)} placeholder="no-reply@example.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reply-To Email</label>
            <input type="email" className={INPUT} value={form.replyToEmail} onChange={e => set('replyToEmail', e.target.value)} placeholder="support@example.com" />
          </div>
        </div>


      </div>

      {/* Test email card */}
      <div className="bg-white rounded-xl border border-gray-200 px-6 py-5">
        <p className="text-sm font-semibold text-gray-800 mb-1">Send Test Email</p>
        <p className="text-xs text-gray-400 mb-4">Save your settings first, then send a test email to verify the connection.</p>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="email"
            className={INPUT + ' flex-1 min-w-0'}
            placeholder={form.fromEmail || 'recipient@example.com'}
            value={testTo}
            onChange={e => { setTestTo(e.target.value); setTestResult(null); }}
          />
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--admin-brand)] hover:bg-[color-mix(in_srgb,var(--admin-brand),black_15%)] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60 shrink-0"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {testing ? 'Sending…' : 'Send Test Email'}
          </button>
        </div>
        {testResult && (
          <div className={`mt-3 flex items-start gap-2 text-sm rounded-lg px-4 py-3 ${testResult.ok ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
            {testResult.ok
              ? <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />}
            {testResult.message}
          </div>
        )}
        {lastTestAt && !testResult && (
          <p className="flex items-center gap-1.5 text-xs text-gray-400 mt-3">
            <Mail className="w-3.5 h-3.5" />
            Last test sent: {new Date(lastTestAt).toLocaleString()}
          </p>
        )}
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
