import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import SEOHead from '@/components/seo/SEOHead';
import api from '@/services/api';

function mdToHtml(md = '') {
  return md
    .replace(/^### (.+)$/gm, '<h3 style="font-size:1.1rem;font-weight:700;margin:1.5rem 0 0.5rem;color:#111827">$1</h3>')
    .replace(/^## (.+)$/gm,  '<h2 style="font-size:1.35rem;font-weight:700;margin:2rem 0 0.75rem;color:#111827">$1</h2>')
    .replace(/^# (.+)$/gm,   '<h1 style="font-size:1.6rem;font-weight:800;margin:2rem 0 0.75rem;color:#111827">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g,     '<em>$1</em>')
    .replace(/`(.+?)`/g,       '<code style="background:#f3f4f6;padding:2px 6px;border-radius:4px;font-size:0.875em;font-family:monospace">$1</code>')
    .replace(/^> (.+)$/gm,     '<blockquote style="border-left:3px solid #7C3AED;padding:0.5rem 1rem;margin:1rem 0;color:#4B5563;background:#faf5ff;border-radius:0 8px 8px 0">$1</blockquote>')
    .replace(/^[-*] (.+)$/gm,  '<li style="margin:0.25rem 0 0.25rem 1.25rem;list-style-type:disc;color:#374151">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, '<ul style="margin:0.75rem 0">$&</ul>')
    .replace(/^\d+\. (.+)$/gm, '<li style="margin:0.25rem 0 0.25rem 1.25rem;list-style-type:decimal;color:#374151">$1</li>')
    .replace(/\n{2,}/g, '</p><p style="margin:0.75rem 0;color:#374151;line-height:1.75">')
    .replace(/^(?!<[h1-6bculip])(.+)$/gm, '<p style="margin:0.75rem 0;color:#374151;line-height:1.75">$1</p>')
    .replace(/<p[^>]*><\/p>/g, '');
}

export default function StaticPage() {
  const { slug } = useParams();
  const [page,    setPage]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound,setNotFound]= useState(false);

  useEffect(() => {
    api.get(`/pages/${slug}`)
      .then(d => setPage(d))
      .catch(e => {
        if (e.status === 404) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 text-brand-from animate-spin" />
    </div>
  );

  if (notFound || !page) return <Navigate to="/" replace />;

  return (
    <>
      <SEOHead
        customTitle={page.seoTitle || `${page.title} — InnovateTools`}
        customDesc={page.seoDescription || page.title}
      />

      {/* Hero */}
      <section className="py-14 pb-16" style={{ background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' }}>
        <div className="max-w-3xl mx-auto px-5 sm:px-8 text-center">
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-white tracking-tight">
            {page.title}
          </h1>
          {page.seoDescription && (
            <p className="text-white/70 text-base mt-3 max-w-xl mx-auto leading-relaxed">{page.seoDescription}</p>
          )}
        </div>
      </section>

      {/* Body */}
      <main className="max-w-3xl mx-auto px-5 sm:px-8 py-14 pb-20">
        <div
          className="prose-custom"
          dangerouslySetInnerHTML={{ __html: mdToHtml(page.body || '') }}
        />
      </main>
    </>
  );
}
