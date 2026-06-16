import { useParams, Navigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import * as LucideIcons from 'lucide-react';
import { CATEGORIES } from '@/data/tools';
import { useTools } from '@/hooks/useTools';
import ToolCard from '@/components/tools/ToolCard';
import SEOHead from '@/components/seo/SEOHead';

function CatIcon({ icon }) {
  if (!icon) return null;
  const Icon = LucideIcons[icon] || LucideIcons.Wrench;
  return <Icon className="w-7 h-7 text-white" strokeWidth={2} />;
}

export default function CategoryPage() {
  const { category } = useParams();
  const cat = CATEGORIES[category];
  const { tools, loading } = useTools(category);

  if (!cat) return <Navigate to="/" replace />;

  return (
    <>
      <SEOHead
        customTitle={`${cat.label} — Free Online Tools | InnovateTools`}
        customDesc={`Free ${cat.label.toLowerCase()} tools — fast, accurate, no signup needed.`}
      />

      {/* Hero */}
      <section
        className="py-14 pb-16"
        style={{ background: 'linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)' }}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-sm text-white/60 hover:text-white transition-colors mb-7"
          >
            <ArrowLeft className="w-4 h-4" /> Back to all tools
          </Link>
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(255,255,255,0.20)', border: '1px solid rgba(255,255,255,0.30)' }}
            >
              <CatIcon icon={cat.icon} />
            </div>
            <div>
              <h1 className="font-display font-extrabold text-3xl text-white tracking-tight">
                {cat.label}
              </h1>
              <p className="text-white/60 mt-1 text-sm">
                {loading ? '…' : `${tools.length} free tool${tools.length !== 1 ? 's' : ''}`} · No signup required
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Grid */}
      <section className="max-w-7xl mx-auto px-5 sm:px-8 py-12">
        {loading ? (
          <div className="flex items-center justify-center py-24">
            <Loader2 className="w-7 h-7 animate-spin text-[var(--brand)]" />
          </div>
        ) : tools.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {tools.map(tool => <ToolCard key={tool.slug} tool={tool} />)}
          </div>
        ) : (
          <div className="text-center py-20 border border-dashed border-border rounded-2xl bg-white">
            <p className="font-semibold text-text-secondary">No tools in this category yet.</p>
            <p className="text-sm text-text-muted mt-1">Check back soon — we ship new tools every week.</p>
          </div>
        )}
      </section>
    </>
  );
}
