import { useEffect, useState } from 'react';
import { useParams, Link, Navigate } from 'react-router-dom';
import { ArrowLeft, Clock, Eye, Calendar, Loader2, AlertCircle } from 'lucide-react';
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

export default function BlogPostPage() {
  const { slug } = useParams();
  const [post,    setPost]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound,setNotFound]= useState(false);

  useEffect(() => {
    api.get(`/posts/${slug}`)
      .then(d => setPost(d))
      .catch(e => {
        if (e.status === 404) setNotFound(true);
        else setPost(null);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 text-brand-from animate-spin" />
    </div>
  );

  if (notFound) return <Navigate to="/blog" replace />;

  if (!post) return (
    <div className="max-w-3xl mx-auto px-5 py-20 text-center">
      <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-4" />
      <p className="text-text-secondary">Failed to load post. Please try again.</p>
      <Link to="/blog" className="btn-primary mt-6 inline-flex">Back to Blog</Link>
    </div>
  );

  const date = new Date(post.publishDate || post.createdAt).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  return (
    <>
      <SEOHead
        customTitle={`${post.title} — InnovateTools Blog`}
        customDesc={post.excerpt || post.title}
      />

      {/* Back link */}
      <div className="max-w-3xl mx-auto px-5 sm:px-8 pt-8">
        <Link
          to="/blog"
          className="inline-flex items-center gap-1.5 text-sm text-text-muted hover:text-brand-from transition-colors duration-150 font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Blog
        </Link>
      </div>

      {/* Cover image */}
      {post.coverImage && (
        <div className="max-w-3xl mx-auto px-5 sm:px-8 mt-6">
          <img src={post.coverImage} alt={post.title} className="w-full rounded-2xl object-cover max-h-72" />
        </div>
      )}

      {/* Header */}
      <header className="max-w-3xl mx-auto px-5 sm:px-8 mt-8 mb-10">
        {post.category && (
          <span className="inline-block text-xs font-bold px-3 py-1 rounded-full mb-4 capitalize"
            style={{ background: 'rgba(124,58,237,0.1)', color: '#7C3AED', border: '1px solid rgba(124,58,237,0.2)' }}>
            {post.category.replace(/-/g, ' ')}
          </span>
        )}

        <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-primary tracking-tight leading-tight mb-4">
          {post.title}
        </h1>

        {post.excerpt && (
          <p className="text-text-secondary text-lg leading-relaxed mb-6">{post.excerpt}</p>
        )}

        <div className="flex items-center gap-4 flex-wrap text-xs text-text-muted border-t border-b border-border py-3">
          {post.author?.name && (
            <span className="flex items-center gap-1.5 font-medium text-text-secondary">
              {post.author.avatar
                ? <img src={post.author.avatar} alt={post.author.name} className="w-5 h-5 rounded-full object-cover" />
                : <div className="w-5 h-5 rounded-full bg-brand-from/20 flex items-center justify-center text-brand-from font-bold text-[9px]">{post.author.name[0]}</div>
              }
              {post.author.name}
            </span>
          )}
          <span className="flex items-center gap-1"><Calendar className="w-3.5 h-3.5" />{date}</span>
          {post.readTime && <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{post.readTime} min read</span>}
          {post.views > 0 && <span className="flex items-center gap-1"><Eye className="w-3.5 h-3.5" />{post.views.toLocaleString()} views</span>}
        </div>
      </header>

      {/* Body */}
      <article className="max-w-3xl mx-auto px-5 sm:px-8 pb-20">
        <div
          className="prose-custom"
          dangerouslySetInnerHTML={{ __html: mdToHtml(post.body || '') }}
        />

        {/* Tags */}
        {post.tags?.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mt-10 pt-6 border-t border-border">
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Tags:</span>
            {post.tags.map(tag => (
              <span key={tag} className="text-xs px-2.5 py-1 rounded-full bg-surface-2 border border-border text-text-secondary">
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-10">
          <Link to="/blog" className="inline-flex items-center gap-1.5 text-sm text-brand-from font-semibold hover:gap-2.5 transition-all duration-150">
            <ArrowLeft className="w-4 h-4" /> More from the blog
          </Link>
        </div>
      </article>
    </>
  );
}
