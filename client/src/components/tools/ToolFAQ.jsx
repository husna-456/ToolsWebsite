import { useState } from 'react';
import { Plus, Minus } from 'lucide-react';

export default function ToolFAQ({ faqs }) {
  const [open, setOpen] = useState(null);
  if (!faqs?.length) return null;

  return (
    <section className="mt-12">
      <h2 className="section-title text-2xl mb-6">Frequently Asked Questions</h2>
      <div className="space-y-2.5">
        {faqs.map((faq, i) => (
          <div
            key={i}
            className="border border-border rounded-xl overflow-hidden bg-white transition-shadow duration-150 hover:shadow-sm"
          >
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="w-full text-left px-5 py-4 flex items-center justify-between gap-4 hover:bg-surface-2 transition-colors duration-150"
              aria-expanded={open === i}
            >
              <span className="font-semibold text-text-primary text-sm leading-snug">
                {faq.q}
              </span>
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-surface-2 border border-border flex items-center justify-center transition-colors duration-150">
                {open === i
                  ? <Minus className="w-3.5 h-3.5 text-accent" />
                  : <Plus className="w-3.5 h-3.5 text-text-muted" />}
              </span>
            </button>
            <div
              className={`grid transition-all duration-200 ease-in-out ${
                open === i ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <div className="px-5 pb-4 pt-1 text-text-secondary text-sm leading-relaxed border-t border-border bg-surface-2/50">
                  {faq.a}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
