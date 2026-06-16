import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, CheckCircle, Save } from 'lucide-react';
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

const SLOT_LABELS = {
  headerBanner:          'Header Banner',
  sidebarTop:            'Sidebar Top',
  sidebarBottom:         'Sidebar Bottom',
  belowToolHeader:       'Below Tool Header',
  belowToolInterface:    'Below Tool Interface',
  betweenFaqAndRelated:  'Between FAQ & Related Tools',
  footerBanner:          'Footer Banner',
  mobileStickyBottom:    'Mobile Sticky Bottom',
};

const emptySlots = () => Object.fromEntries(
  Object.keys(SLOT_LABELS).map(k => [k, { enabled: false, code: '' }])
);

const DEFAULTS = {
  enabled:            false,
  hideForPro:         true,
  provider:           'disabled',
  adsensePublisherId: '',
  autoAds:            false,
  slots:              emptySlots(),
};

export default function AdminAdSettings() {
  const [form,    setForm]    = useState(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    api.get('/admin/settings')
      .then(d => {
        if (d.settings?.ads) {
          const { slots, ...rest } = d.settings.ads;
          setForm(prev => ({
            ...prev,
            ...rest,
            slots: { ...emptySlots(), ...(slots || {}) },
          }));
        }
      })
      .catch(e => setError(e.message || 'Failed to load settings.'))
      .finally(() => setLoading(false));
  }, []);

  const set      = (k, v)        => setForm(f => ({ ...f, [k]: v }));
  const setSlot  = (slot, k, v)  => setForm(f => ({
    ...f,
    slots: { ...f.slots, [slot]: { ...f.slots[slot], [k]: v } },
  }));

  const handleSave = async () => {
    setError('');
    setSaving(true);
    try {
      await api.put('/admin/settings/ads', form);
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
          <h1 className="text-2xl font-medium text-gray-900">Ad Settings</h1>
          <p className="text-gray-500 text-sm mt-1">Master toggle, provider config, and per-slot ad code.</p>
        </div>
        <button onClick={handleSave} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 bg-[var(--admin-brand)] hover:bg-[color-mix(in_srgb,var(--admin-brand),black_15%)] text-white text-sm font-medium rounded-xl transition-colors disabled:opacity-60 shrink-0">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {error   && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-5 py-3 flex items-center gap-2 text-sm"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
      {success && <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-xl px-5 py-3 flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 shrink-0" />Settings saved.</div>}

      <div className="bg-white rounded-xl border border-gray-200 px-6 py-5 space-y-1">

        <SectionLabel>Global Controls</SectionLabel>
        <ToggleRow label="Enable Ads" hint="Master switch — turns all ad slots on or off" checked={form.enabled} onChange={v => set('enabled', v)} />
        <ToggleRow label="Hide Ads for Pro Users" hint="Pro subscribers see no ads" checked={form.hideForPro} onChange={v => set('hideForPro', v)} />
        <ToggleRow label="Auto Ads (AdSense)" hint="Let AdSense auto-place ads across the page" checked={form.autoAds} onChange={v => set('autoAds', v)} />

        <SectionLabel>Provider</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ad Provider</label>
            <select className={SELECT} value={form.provider} onChange={e => set('provider', e.target.value)}>
              <option value="disabled">Disabled</option>
              <option value="adsense">Google AdSense</option>
              <option value="custom">Custom (paste ad code per slot)</option>
            </select>
          </div>
          {form.provider === 'adsense' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">AdSense Publisher ID</label>
              <input className={INPUT} value={form.adsensePublisherId} onChange={e => set('adsensePublisherId', e.target.value)} placeholder="pub-0000000000000000" />
            </div>
          )}
        </div>

        <SectionLabel>Ad Slots</SectionLabel>
        <p className="text-xs text-gray-400 pb-2">Toggle each slot and paste its ad code. Leave code blank if using Auto Ads.</p>
        <div className="space-y-4 divide-y divide-gray-50">
          {Object.keys(SLOT_LABELS).map(slot => (
            <div key={slot} className="pt-4 first:pt-0">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="text-sm font-medium text-gray-900">{SLOT_LABELS[slot]}</p>
                  <p className="text-[11px] text-gray-400 font-mono">{slot}</p>
                </div>
                <div className="relative shrink-0">
                  <input type="checkbox" className="sr-only" checked={form.slots[slot]?.enabled || false} onChange={e => setSlot(slot, 'enabled', e.target.checked)} />
                  <div onClick={() => setSlot(slot, 'enabled', !form.slots[slot]?.enabled)} className={`w-10 h-5 rounded-full transition-colors duration-200 cursor-pointer ${form.slots[slot]?.enabled ? 'bg-[var(--admin-brand)]' : 'bg-gray-200'}`} />
                  <div className={`pointer-events-none absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${form.slots[slot]?.enabled ? 'translate-x-5' : ''}`} />
                </div>
              </div>
              {form.slots[slot]?.enabled && (
                <textarea
                  className={`${TEXTAREA} font-mono text-xs`}
                  rows={3}
                  value={form.slots[slot]?.code || ''}
                  onChange={e => setSlot(slot, 'code', e.target.value)}
                  placeholder="<ins class=&quot;adsbygoogle&quot; …></ins><script>…</script>"
                />
              )}
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
