import { Link } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import ToolIcon from '@/components/ui/ToolIcon';

export default function ToolCard({ tool }) {
  return (
    <Link
      to={`/tools/${tool.slug}`}
      className="group bg-white rounded-2xl p-5 border border-[#E2E8F0] hover:border-[#BFDBFE] transition-all duration-200 hover:-translate-y-1 flex flex-col gap-4"
      style={{ boxShadow: '0 1px 4px rgba(15,23,42,0.06)' }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 10px 28px color-mix(in srgb, var(--brand), transparent 88%)'; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = '0 1px 4px rgba(15,23,42,0.06)'; }}
    >
      {/* Icon tile */}
      <div
        className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
        style={{ background: 'linear-gradient(135deg, var(--brand-gradient-from) 0%, var(--brand-gradient-to) 100%)' }}
      >
        <ToolIcon name={tool.icon} size="base" className="text-white" />
      </div>

      {/* Content */}
      <div className="flex-1">
        <h3 className="font-display font-bold text-[#0F172A] text-[1.125rem] mb-1.5 group-hover:text-[var(--brand)] transition-colors duration-150 leading-snug">
          {tool.title}
        </h3>
        <p className="text-[#7c93b3] text-xs leading-relaxed line-clamp-2">
          {tool.shortDesc}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-[#F1F5F9]">
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ color: 'var(--brand)', background: 'color-mix(in srgb, var(--brand), transparent 92%)' }}>
          Free
        </span>
        <ArrowUpRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[var(--brand)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-150" />
      </div>
    </Link>
  );
}
