import { useEffect, useState } from 'react';
import { Loader2, AlertCircle, CheckCircle, Save, Lock, Eye, EyeOff, User } from 'lucide-react';
import api from '@/services/api';

const INPUT = 'w-full px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-[var(--admin-brand)] focus:bg-white transition';

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-3 pt-4 pb-1">
      <div className="h-px flex-1 bg-gray-100" />
      <span className="text-[10px] font-bold tracking-[0.15em] text-[var(--admin-brand)] uppercase whitespace-nowrap">{children}</span>
      <div className="h-px flex-1 bg-gray-100" />
    </div>
  );
}

function PasswordInput({ value, onChange, placeholder, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        className={INPUT + ' pr-10'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
      />
      <button type="button" onClick={() => setShow(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function AdminProfile() {
  const [profile,  setProfile]  = useState({ name: '', email: '', avatar: '' });
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [profErr,  setProfErr]  = useState('');
  const [profOk,   setProfOk]   = useState(false);

  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [changingPw, setChangingPw] = useState(false);
  const [pwErr,  setPwErr]  = useState('');
  const [pwOk,   setPwOk]   = useState(false);

  useEffect(() => {
    api.get('/admin/profile')
      .then(d => {
        if (d.user) setProfile({ name: d.user.name || '', email: d.user.email || '', avatar: d.user.avatar || '' });
      })
      .catch(e => setProfErr(e.message || 'Failed to load profile.'))
      .finally(() => setLoading(false));
  }, []);

  const handleSaveProfile = async () => {
    setProfErr('');
    setSaving(true);
    try {
      const d = await api.put('/admin/profile', profile);
      if (d.user) setProfile({ name: d.user.name || '', email: d.user.email || '', avatar: d.user.avatar || '' });
      setProfOk(true);
      setTimeout(() => setProfOk(false), 2500);
    } catch (err) {
      setProfErr(err.message || 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    setPwErr('');
    if (!pw.current) { setPwErr('Enter your current password.'); return; }
    if (pw.next.length < 8) { setPwErr('New password must be at least 8 characters.'); return; }
    if (pw.next !== pw.confirm) { setPwErr('Passwords do not match.'); return; }
    setChangingPw(true);
    try {
      await api.post('/admin/profile/password', { currentPassword: pw.current, newPassword: pw.next });
      setPw({ current: '', next: '', confirm: '' });
      setPwOk(true);
      setTimeout(() => setPwOk(false), 2500);
    } catch (err) {
      setPwErr(err.message || 'Password change failed.');
    } finally {
      setChangingPw(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 text-[var(--admin-brand)] animate-spin" /></div>;

  return (
    <div className="p-6 space-y-5 max-w-2xl">

      <div>
        <h1 className="text-2xl font-medium text-gray-900">My Profile</h1>
        <p className="text-gray-500 text-sm mt-1">Update your name, email, and password.</p>
      </div>

      {/* Profile card */}
      <div className="bg-white rounded-xl border border-gray-200 px-6 py-5 space-y-4">

        <SectionLabel>Account Info</SectionLabel>

        {/* Avatar preview */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center overflow-hidden shrink-0">
            {profile.avatar
              ? <img src={profile.avatar} alt="avatar" className="w-full h-full object-cover" onError={e => { e.target.style.display = 'none'; }} />
              : <User className="w-7 h-7 text-blue-300" />
            }
          </div>
          <div className="flex-1 min-w-0">
            <label className="block text-sm font-medium text-gray-700 mb-1">Avatar URL</label>
            <input className={INPUT} value={profile.avatar} onChange={e => setProfile(p => ({ ...p, avatar: e.target.value }))} placeholder="https://example.com/avatar.jpg" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
            <input className={INPUT} value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} placeholder="Jane Smith" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input type="email" className={INPUT} value={profile.email} onChange={e => setProfile(p => ({ ...p, email: e.target.value }))} placeholder="jane@example.com" />
          </div>
        </div>

        {profErr && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm"><AlertCircle className="w-4 h-4 shrink-0" />{profErr}</div>}
        {profOk  && <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 shrink-0" />Profile updated.</div>}

        <div className="flex justify-end pt-1">
          <button onClick={handleSaveProfile} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-[var(--admin-brand)] hover:bg-[color-mix(in_srgb,var(--admin-brand),black_15%)] text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving…' : 'Save Profile'}
          </button>
        </div>
      </div>

      {/* Password card */}
      <div className="bg-white rounded-xl border border-gray-200 px-6 py-5 space-y-4">

        <SectionLabel>Change Password</SectionLabel>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Current Password</label>
            <PasswordInput value={pw.current} onChange={e => setPw(p => ({ ...p, current: e.target.value }))} placeholder="••••••••" autoComplete="current-password" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <PasswordInput value={pw.next} onChange={e => setPw(p => ({ ...p, next: e.target.value }))} placeholder="Min. 8 characters" autoComplete="new-password" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
            <PasswordInput value={pw.confirm} onChange={e => setPw(p => ({ ...p, confirm: e.target.value }))} placeholder="Repeat new password" autoComplete="new-password" />
          </div>
        </div>

        {pwErr && <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm"><AlertCircle className="w-4 h-4 shrink-0" />{pwErr}</div>}
        {pwOk  && <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-lg px-4 py-2.5 flex items-center gap-2 text-sm"><CheckCircle className="w-4 h-4 shrink-0" />Password changed successfully.</div>}

        <div className="flex justify-end pt-1">
          <button onClick={handleChangePassword} disabled={changingPw} className="flex items-center gap-2 px-5 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60">
            {changingPw ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
            {changingPw ? 'Updating…' : 'Change Password'}
          </button>
        </div>
      </div>

    </div>
  );
}
