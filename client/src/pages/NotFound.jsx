import { Link } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import SEOHead from '@/components/seo/SEOHead';

export default function NotFound() {
  return (
    <>
      <SEOHead
        customTitle="Page Not Found — Global Tech Tools"
        customDesc="The page you're looking for doesn't exist. Browse our free AI tools instead."
      />

      <main className="min-h-[70vh] flex items-center justify-center px-5 py-20">
        <div className="text-center max-w-md">

          {/* Icon */}
          <div
            className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto mb-6"
            style={{ background: 'rgba(79,70,229,0.08)', border: '1px solid rgba(79,70,229,0.14)' }}
          >
            <Search className="w-9 h-9" style={{ color: '#4F46E5' }} strokeWidth={1.5} />
          </div>

          {/* Code */}
          <p
            className="text-7xl font-display font-extrabold tracking-tight mb-4 bg-clip-text text-transparent"
            style={{ backgroundImage: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}
          >
            404
          </p>

          <h1 className="font-display font-bold text-2xl text-[#0F172A] mb-3">
            Page not found
          </h1>
          <p className="text-[#64748B] text-sm leading-relaxed mb-8">
            The page you're looking for doesn't exist or has been moved.
            Let's get you back to the tools.
          </p>

          {/* Actions */}
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-white font-semibold text-sm px-6 py-3 rounded-xl transition-all duration-200 shadow-sm hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg, #4F46E5, #7C3AED)' }}
            >
              Browse All Tools
            </Link>
            <Link
              to="/"
              onClick={() => window.history.back()}
              className="inline-flex items-center gap-1.5 text-[#475569] hover:text-[#0F172A] font-medium text-sm px-5 py-3 rounded-xl border border-[#E2E8F0] hover:border-[#CBD5E1] bg-white transition-all duration-200"
            >
              <ArrowLeft className="w-4 h-4" /> Go Back
            </Link>
          </div>
        </div>
      </main>
    </>
  );
}
