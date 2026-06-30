import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Clock, BookOpen, Loader2, AlertCircle } from 'lucide-react';
import SEOHead from '@/components/seo/SEOHead';
import api from '@/services/api';

const CAT_STYLES = {
  'ai-writing':   { background: 'rgba(109,93,252,0.10)', color: '#6D5DFC', border: '1px solid rgba(109,93,252,0.20)' },
  'text-tools':   { background: 'rgba(59,130,246,0.10)',  color: '#3B82F6', border: '1px solid rgba(59,130,246,0.20)' },
  'image-tools':  { background: 'rgba(79,70,229,0.10)',   color: '#4F46E5', border: '1px solid rgba(79,70,229,0.20)' },
  'media-tools':  { background: 'rgba(16,185,129,0.10)',  color: '#10B981', border: '1px solid rgba(16,185,129,0.20)' },
  'productivity': { background: 'rgba(236,72,153,0.10)',  color: '#EC4899', border: '1px solid rgba(236,72,153,0.20)' },
  'seo-tools':    { background: 'rgba(245,158,11,0.10)',  color: '#F59E0B', border: '1px solid rgba(245,158,11,0.20)' },
};
const DEFAULT_STYLE = { background: 'rgba(107,114,128,0.10)', color: '#6B7280', border: '1px solid rgba(107,114,128,0.20)' };

function PostCard({ post }) {
  const tagStyle = CAT_STYLES[post.category] || DEFAULT_STYLE;
  const date = new Date(post.publishDate || post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const tag  = (post.category || '').replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <article
      className="bg-white rounded-2xl overflow-hidden border border-border hover:-translate-y-1 transition-all duration-200 group flex flex-col"
      style={{ boxShadow: '0 2px 8px rgba(15,23,42,0.06)' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 12px 30px rgba(37,99,235,0.12)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(15,23,42,0.06)'; }}
    >
      {/* Gradient band */}
      <div className="h-1.5" style={{ background: 'linear-gradient(90deg, var(--brand-gradient-from), var(--brand-gradient-to))' }} />

      {post.coverImage && (
        <img src={post.coverImage} alt={post.title} className="w-full h-44 object-cover" />
      )}

      <div className="p-6 flex flex-col flex-1">
        <div className="flex items-center justify-between mb-4">
          <span className="text-[11px] font-bold px-2.5 py-1 rounded-full capitalize" style={tagStyle}>
            {tag}
          </span>
          <span className="flex items-center gap-1 text-xs text-text-muted">
            <Clock className="w-3 h-3" />
            {post.readTime ? `${post.readTime} min read` : date}
          </span>
        </div>

        <h2 className="font-display font-bold text-text-primary text-[0.95rem] leading-snug mb-3 group-hover:text-brand-from transition-colors duration-150">
          {post.title}
        </h2>

        <p className="text-text-secondary text-sm leading-relaxed line-clamp-3 flex-1">
          {post.excerpt}
        </p>

        <div className="flex items-center justify-between mt-5 pt-4 border-t border-border">
          <span className="text-xs text-text-muted">{date}</span>
          <Link
            to={`/blog/${post.slug}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-brand-from group-hover:gap-1.5 transition-all duration-150"
          >
            Read more <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </article>
  );
}

export default function BlogPage() {
  const [posts,   setPosts]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [page,    setPage]    = useState(1);
  const [pages,   setPages]   = useState(1);

  useEffect(() => {
    setLoading(true);
    api.get(`/posts?page=${page}&limit=12`)
      .then(d => {
        setPosts(d.posts || []);
        setPages(d.pages || 1);
      })
      .catch(e => setError(e.message || 'Failed to load posts.'))
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <>
      <SEOHead
        customTitle="Blog — Global Tech Tools"
        customDesc="Tips, guides, and updates about AI writing, text tools, image tools, and more from the Global Tech Tools team."
      />

      {/* Gradient hero header */}
      <section className="py-16 pb-20" style={{ background: 'linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)' }}>
        <div className="max-w-5xl mx-auto px-5 sm:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-white/15 border border-white/25 text-white text-xs font-semibold px-4 py-1.5 rounded-full mb-6">
            <BookOpen className="w-3.5 h-3.5" />
            Our Blog
          </div>
          <h1 className="font-display font-extrabold text-4xl sm:text-5xl text-white tracking-tight mb-4">
            Tips, Guides & Updates
          </h1>
          <p className="text-white/70 text-lg max-w-xl mx-auto leading-relaxed">
            Learn how to get the most out of AI tools, writing techniques, and productivity tips.
          </p>
        </div>
      </section>

      {/* Posts grid */}
      <section className="max-w-6xl mx-auto px-5 sm:px-8 py-14">
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-brand-from animate-spin" />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 text-red-600 bg-red-50 border border-red-200 rounded-xl px-5 py-4 text-sm max-w-lg mx-auto">
            <AlertCircle className="w-4 h-4 shrink-0" />{error}
          </div>
        )}

        {!loading && !error && posts.length === 0 && (
          <div className="text-center py-20">
            <BookOpen className="w-10 h-10 text-text-muted mx-auto mb-4" strokeWidth={1.5} />
            <p className="text-text-secondary font-medium">No posts published yet.</p>
            <p className="text-text-muted text-sm mt-1">Check back soon!</p>
          </div>
        )}

        {!loading && posts.length > 0 && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {posts.map(post => <PostCard key={post.slug} post={post} />)}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-12">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-text-secondary hover:border-brand-from/40 hover:text-brand-from transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <span className="text-sm text-text-muted px-2">Page {page} of {pages}</span>
                <button
                  onClick={() => setPage(p => Math.min(pages, p + 1))}
                  disabled={page === pages}
                  className="px-4 py-2 rounded-lg border border-border text-sm font-medium text-text-secondary hover:border-brand-from/40 hover:text-brand-from transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}
