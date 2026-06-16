import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, CheckCircle, Save, Eye, EyeOff } from 'lucide-react';
import api from '@/services/api';

const INPUT    = 'w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-[var(--admin-brand)] focus:bg-white transition';
const SELECT   = INPUT;
const TEXTAREA = INPUT + ' resize-none';

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

function SecretInput({ value, onChange, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        className={INPUT + ' pr-10'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete="new-password"
      />
      <button type="button" onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

const DEFAULTS = {
  enabled: false,
  pricing: { proMonthly: 4.99, proYearly: 49.99, teamMonthly: 14.99, teamYearly: 149.99, trialDays: 0 },
  stripe:  { publicKey: '', secretKey: '', webhookSecret: '', testMode: true },
  paypal:  { clientId: '', secret: '', mode: 'sandbox' },
  planFeatures: { free: [], pro: [], team: [] },
};

export default function AdminSaasSettings() {
  const [form,    setForm]    = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);

  // Plan features as editable text (newline-separated)
  const [freeFeat,  setFreeFeat]  = useState('');
  const [proFeat,   setProFeat]   = useState('');
  const [teamFeat,  setTeamFeat]  = useState('');

  useEffect(() => {
    api.get('/admin/settings')
      .then(d => {
        if (d.settings?.saas) {
          setForm(prev => ({ ...prev, ...d.settings.saas }));
          const pf = d.settings.saas.planFeatures || {};
          setFreeFeat((pf.free  || []).join('\n'));
          setProFeat( (pf.pro   || []).join('\n'));
          setTeamFeat((pf.team  || []).join('\n'));
        }
      })
      .catch(e => setError(e.message || 'Failed to load settings.'))
      .finally(() => setLoading(false));
  }, []);

  const setNested  = (section, k, v) => setForm(f => ({ ...f, [section]: { ...f[section], [k]: v } }));
  const setPricing = (k, v) => setNested('pricing', k, Number(v) || 0);
  const setStripe  = (k, v) => setNested('stripe',  k, v);
  const setPaypal  = (k, v) => setNested('paypal',  k, v);

  const handleSave = async () => {
    setError('');
    setSaving(true);
    const toArr = s => s.split('\n').map(l => l.trim()).filter(Boolean);
    try {
      await api.put('/admin/settings/saas', {
        ...form,
        planFeatures: { free: toArr(freeFeat), pro: toArr(proFeat), team: toArr(teamFeat) },
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
          <h1 className="text-2xl font-medium text-gray-900">SaaS / Subscriptions</h1>
          <p className="text-gray-500 text-sm mt-1">Pricing, payment gateways, and plan feature lists.</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-[var(--admin-brand)] hover:bg-[color-mix(in_srgb,var(--admin-brand),black_15%)] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-60 shrink-0">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {error   && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3 flex items-center gap-2 text-sm"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
      {success && <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-xl px-5 py-3 flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 shrink-0" />Settings saved.</div>}

      <div className="bg-white rounded-xl border border-gray-200 px-6 py-5 space-y-1">

        <SectionLabel>Global</SectionLabel>
        <ToggleRow label="Enable SaaS Mode" hint="Shows pricing pages, gating, and subscription flows" checked={form.enabled} onChange={v => setForm(f => ({ ...f, enabled: v }))} />

        <SectionLabel>Pricing</SectionLabel>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-2">
          {[
            { key: 'proMonthly',  label: 'Pro / Month ($)' },
            { key: 'proYearly',   label: 'Pro / Year ($)' },
            { key: 'teamMonthly', label: 'Team / Month ($)' },
            { key: 'teamYearly',  label: 'Team / Year ($)' },
            { key: 'trialDays',   label: 'Trial Days' },
          ].map(({ key, label }) => (
            <div key={key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <input
                type="number"
                min={0}
                step={key === 'trialDays' ? 1 : 0.01}
                className={INPUT}
                value={form.pricing[key]}
                onChange={e => setPricing(key, e.target.value)}
              />
            </div>
          ))}
        </div>

        <SectionLabel>Stripe</SectionLabel>
        <ToggleRow label="Test Mode" hint="Use Stripe test keys — no real charges" checked={form.stripe.testMode} onChange={v => setStripe('testMode', v)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Publishable Key</label>
            <input className={INPUT} value={form.stripe.publicKey} onChange={e => setStripe('publicKey', e.target.value)} placeholder="pk_test_…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Secret Key</label>
            <SecretInput value={form.stripe.secretKey} onChange={e => setStripe('secretKey', e.target.value)} placeholder="sk_test_…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Webhook Secret</label>
            <SecretInput value={form.stripe.webhookSecret} onChange={e => setStripe('webhookSecret', e.target.value)} placeholder="whsec_…" />
          </div>
        </div>

        <SectionLabel>PayPal</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 py-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client ID</label>
            <input className={INPUT} value={form.paypal.clientId} onChange={e => setPaypal('clientId', e.target.value)} placeholder="AX…" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Secret</label>
            <SecretInput value={form.paypal.secret} onChange={e => setPaypal('secret', e.target.value)} placeholder="••••••••" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mode</label>
            <select className={SELECT} value={form.paypal.mode} onChange={e => setPaypal('mode', e.target.value)}>
              <option value="sandbox">Sandbox</option>
              <option value="live">Live</option>
            </select>
          </div>
        </div>

        <SectionLabel>Plan Features</SectionLabel>
        <p className="text-xs text-gray-400 pb-2">One feature per line — shown on the pricing page.</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Free Plan', value: freeFeat, set: setFreeFeat, placeholder: '10 uses/day\nBasic tools\nNo account needed' },
            { label: 'Pro Plan',  value: proFeat,  set: setProFeat,  placeholder: 'Unlimited uses\nAll tools\nPriority support' },
            { label: 'Team Plan', value: teamFeat, set: setTeamFeat, placeholder: '5 seats\nAdmin dashboard\nCustom branding' },
          ].map(({ label, value, set: setter, placeholder }) => (
            <div key={label}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
              <textarea className={TEXTAREA} rows={6} value={value} onChange={e => setter(e.target.value)} placeholder={placeholder} />
            </div>
          ))}
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
