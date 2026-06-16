import { useState } from 'react';
import { Search, Monitor, Smartphone } from 'lucide-react';

function truncate(str, max) {
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function parseBreadcrumb(rawUrl) {
  try {
    const url = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
    return [url.hostname, ...url.pathname.split('/').filter(Boolean)].join(' › ');
  } catch {
    return rawUrl || 'yourwebsite.com';
  }
}

export default function SerpSimulator({ tool }) {
  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [url,         setUrl]         = useState('');
  const [view,        setView]        = useState('desktop');

  const isDesktop   = view === 'desktop';
  const previewUrl  = url || 'https://yourwebsite.com/your-page';
  const breadcrumb  = parseBreadcrumb(previewUrl);
  const previewTitle = title || 'Your Page Title Goes Here';
  const previewDesc  = description || 'This is where your meta description appears. Write a compelling summary to improve click-through rates from search results pages.';

  const titleLen = title.length;
  const descLen  = description.length;

  return (
    <div className="panel-card shadow-lg">
      <div className="panel-header">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-text-muted" />
          <span className="text-sm font-semibold text-text-primary">{tool.title || 'SERP Preview Simulator'}</span>
        </div>
        {/* Desktop / Mobile toggle */}
        <div className="flex items-center gap-0.5 bg-surface-2 border border-border rounded-lg p-0.5">
          {[
            { value: 'desktop', Icon: Monitor,    label: 'Desktop' },
            { value: 'mobile',  Icon: Smartphone, label: 'Mobile'  },
          ].map(({ value, Icon, label }) => (
            <button
              key={value}
              onClick={() => setView(value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                view === value
                  ? 'bg-white shadow-sm text-primary border border-border'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-border">

        {/* LEFT: inputs */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">
              Page Title
              <span className={`ml-2 font-normal ${titleLen > 60 ? 'text-red-500' : 'text-text-muted'}`}>
                ({titleLen}/60)
              </span>
            </label>
            <input
              className="tool-input"
              placeholder="My Amazing Page Title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={80}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">
              Page URL
            </label>
            <input
              className="tool-input"
              placeholder="https://yourwebsite.com/your-page"
              value={url}
              onChange={e => setUrl(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-muted uppercase tracking-wide mb-1.5">
              Meta Description
              <span className={`ml-2 font-normal ${descLen > 160 ? 'text-red-500' : 'text-text-muted'}`}>
                ({descLen}/160)
              </span>
            </label>
            <textarea
              className="tool-textarea"
              style={{ minHeight: '100px' }}
              placeholder="Write a compelling meta description to increase click-through rates…"
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Tips */}
          <div className="bg-accent-subtle/50 border border-accent/20 rounded-xl p-4 space-y-2">
            <p className="text-xs font-semibold text-primary">SEO Tips</p>
            {[
              { label: 'Title',       ok: titleLen >= 50 && titleLen <= 60, tip: '50–60 characters is optimal' },
              { label: 'Description', ok: descLen  >= 140 && descLen  <= 160, tip: '140–160 characters is optimal' },
            ].map(({ label, ok, tip }) => (
              <div key={label} className={`flex items-center gap-2 text-xs ${ok ? 'text-green-600' : 'text-text-muted'}`}>
                <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${ok ? 'bg-green-500' : 'bg-text-muted/40'}`} />
                <span className="font-medium">{label}:</span> {tip}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT: live SERP preview */}
        <div className="p-5">
          <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-4">Live Preview</p>

          <div className={`bg-white border border-border rounded-2xl p-5 transition-all ${isDesktop ? 'max-w-full' : 'max-w-[360px]'}`}>
            {/* Mock Google search bar */}
            <div className="flex items-center gap-3 border border-[#DFE1E5] rounded-full px-4 py-2 mb-5 shadow-sm">
              <Search className="w-4 h-4 text-[#9AA0A6] flex-shrink-0" />
              <span className="text-sm text-[#9AA0A6] flex-1">Google Search</span>
            </div>

            {/* About 3 results text */}
            <p className="text-xs text-[#70757A] mb-4">About 1,250,000,000 results (0.38 seconds)</p>

            {/* The result snippet */}
            <div className="space-y-1">
              {/* URL breadcrumb */}
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#F1F3F4] flex items-center justify-center flex-shrink-0">
                  <span className="text-[10px] font-bold text-[#5F6368]">W</span>
                </div>
                <p className={`text-[#202124] ${isDesktop ? 'text-sm' : 'text-xs'}`}>
                  {truncate(previewUrl.replace(/^https?:\/\//, ''), isDesktop ? 60 : 40)}
                </p>
              </div>
              <p className="text-xs text-[#4D5156] pl-8 truncate">{breadcrumb}</p>

              {/* Title */}
              <p
                className={`font-normal text-[#1a0dab] hover:underline cursor-pointer leading-tight pl-0 ${
                  isDesktop ? 'text-xl' : 'text-base'
                }`}
              >
                {truncate(previewTitle, isDesktop ? 60 : 50)}
              </p>

              {/* Description */}
              <p className={`text-[#4D5156] leading-snug ${isDesktop ? 'text-sm' : 'text-xs'}`}>
                {truncate(previewDesc, isDesktop ? 160 : 120)}
              </p>
            </div>
          </div>

          {/* Character warnings */}
          {(titleLen > 60 || descLen > 160) && (
            <div className="mt-3 p-3 bg-orange-50 border border-orange-200 rounded-xl text-xs text-orange-700 space-y-1">
              {titleLen > 60 && <p>Title is {titleLen - 60} chars over the recommended limit — Google may truncate it.</p>}
              {descLen  > 160 && <p>Description is {descLen - 160} chars over the limit — may be cut off in results.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
