import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { TOOLS } from '@/data/tools';

export default function RelatedTools({ slugs }) {
  if (!slugs?.length) return null;
  const tools = slugs.map(s => TOOLS[s]).filter(Boolean);
  if (!tools.length) return null;

  return (
    <section className="mt-12">
      <h2 className="section-title text-2xl mb-6">Related Tools</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {tools.map(tool => (
          <Link
            key={tool.slug}
            to={`/tools/${tool.slug}`}
            className="card p-4 flex items-center gap-3.5 group hover:border-accent/30"
          >
            <div className="w-10 h-10 bg-accent-subtle rounded-xl flex items-center justify-center flex-shrink-0 border border-accent/15">
              {typeof tool.icon !== 'string'
                ? (() => { const Icon = tool.icon; return <Icon className="w-4 h-4 text-accent" strokeWidth={1.75} />; })()
                : <span className="text-xl">{tool.icon}</span>
              }
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm text-primary group-hover:text-accent transition-colors duration-150 truncate">
                {tool.title}
              </div>
              <div className="text-xs text-text-muted mt-0.5 truncate">{tool.shortDesc}</div>
            </div>
            <ArrowRight className="w-4 h-4 text-text-muted flex-shrink-0 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-accent" />
          </Link>
        ))}
      </div>
    </section>
  );
}
