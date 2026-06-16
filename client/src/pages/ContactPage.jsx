import { useState } from 'react';
import { Mail, MessageSquare, User, Send, CheckCircle, Zap, AlertCircle } from 'lucide-react';
import SEOHead from '@/components/seo/SEOHead';
import api from '@/services/api';

export default function ContactPage() {
  const [form,    setForm]    = useState({ name: '', email: '', subject: '', message: '' });
  const [sent,    setSent]    = useState(false);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/contact', form);
      setSent(true);
    } catch (err) {
      setError(err.message || 'Failed to send. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SEOHead
        customTitle="Contact Us — InnovateTools"
        customDesc="Have a question, feedback, or tool request? Get in touch with the InnovateTools team."
      />

      {/* Gradient hero header */}
      <section
        className="py-16 pb-20"
        style={{ background: 'linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)' }}
      >
        <div className="max-w-3xl mx-auto px-5 sm:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-white/15 border border-white/25 text-white text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
            <Mail className="w-3.5 h-3.5" />
            Get In Touch
          </div>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl text-white tracking-tight mb-4">
            Missing something?
          </h1>
          <p className="text-white/70 text-lg max-w-md mx-auto leading-relaxed">
            Request a new tool, report a bug, or just say hello. We read every message.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="max-w-5xl mx-auto px-5 sm:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-10">

          {/* Left info */}
          <div className="md:col-span-2 space-y-5">
            <div>
              <h2 className="font-display font-bold text-xl text-text-primary mb-2">Why reach out?</h2>
              <p className="text-text-secondary text-sm leading-relaxed">
                We build tools based on user feedback. If you're missing something, we want to know.
              </p>
            </div>

            {[
              { icon: Zap,           title: 'Request a Tool',  desc: 'Tell us what you need — we consider every request.' },
              { icon: MessageSquare, title: 'Give Feedback',   desc: 'Let us know what\'s working and what could be better.' },
              { icon: Mail,          title: 'Report an Issue', desc: 'Something broken? We\'ll fix it as fast as possible.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="flex gap-4 p-4 bg-white rounded-2xl border border-border hover:shadow-card hover:border-brand-from/20 transition-all duration-200"
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'linear-gradient(135deg, var(--brand-gradient-from), var(--brand-gradient-to))' }}
                >
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <div>
                  <p className="font-semibold text-text-primary text-sm">{title}</p>
                  <p className="text-text-secondary text-xs mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Right form */}
          <div className="md:col-span-3">
            {sent ? (
              <div
                className="bg-white rounded-2xl p-10 text-center border border-border"
                style={{ boxShadow: '0 4px 20px color-mix(in srgb, var(--brand), transparent 90%)' }}
              >
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-5"
                  style={{ background: 'linear-gradient(135deg, var(--brand-gradient-from), var(--brand-gradient-to))' }}
                >
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
                <h3 className="font-display font-bold text-xl text-text-primary mb-2">Message sent!</h3>
                <p className="text-text-secondary text-sm">Thanks for reaching out. We'll get back to you within 24 hours.</p>
                <button
                  onClick={() => { setSent(false); setForm({ name: '', email: '', subject: '', message: '' }); }}
                  className="mt-6 btn-primary px-7"
                >
                  Send Another
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleSubmit}
                className="bg-white rounded-2xl p-8 border border-border space-y-5"
                style={{ boxShadow: '0 4px 20px rgba(37,99,235,0.08)' }}
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-text-primary mb-1.5">
                      <User className="w-3.5 h-3.5 inline mr-1 text-text-muted" />Name
                    </label>
                    <input
                      type="text" required value={form.name}
                      onChange={e => set('name', e.target.value)}
                      placeholder="Your name" className="input-field"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-text-primary mb-1.5">
                      <Mail className="w-3.5 h-3.5 inline mr-1 text-text-muted" />Email
                    </label>
                    <input
                      type="email" required value={form.email}
                      onChange={e => set('email', e.target.value)}
                      placeholder="your@email.com" className="input-field"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1.5">Subject</label>
                  <select
                    value={form.subject}
                    onChange={e => set('subject', e.target.value)}
                    required className="input-field"
                  >
                    <option value="">Select a topic…</option>
                    <option value="tool-request">Tool Request</option>
                    <option value="feedback">General Feedback</option>
                    <option value="bug">Bug Report</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-text-primary mb-1.5">
                    <MessageSquare className="w-3.5 h-3.5 inline mr-1 text-text-muted" />Message
                  </label>
                  <textarea
                    required rows={5} value={form.message}
                    onChange={e => set('message', e.target.value)}
                    placeholder="Tell us what you need or what's on your mind…"
                    className="input-field resize-none"
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                    <AlertCircle className="w-4 h-4 shrink-0" />{error}
                  </div>
                )}

                <button type="submit" disabled={loading} className="btn-primary w-full h-12 text-[15px]">
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      <Send className="w-4 h-4" />Send Message
                    </span>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </section>
    </>
  );
}
