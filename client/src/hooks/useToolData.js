import { useState, useEffect } from 'react';
import api from '@/services/api';

// Module-level cache shared across all components in the same page session.
// Prevents duplicate GET /api/tools/:slug requests when ToolPage and
// ToolPageLayout both need the same tool data on a single page load.
const _cache   = new Map(); // slug → tool object
const _pending = new Map(); // slug → in-flight Promise<tool>

export function useToolData(slug) {
  const [tool,     setTool]     = useState(() => (slug ? (_cache.get(slug) ?? null) : null));
  const [loading,  setLoading]  = useState(slug ? !_cache.has(slug) : false);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!slug) return;

    if (_cache.has(slug)) {
      setTool(_cache.get(slug));
      setLoading(false);
      return;
    }

    let cancelled = false;

    if (!_pending.has(slug)) {
      const p = api.get(`/tools/${slug}`)
        .then(d => {
          _cache.set(slug, d.tool);
          _pending.delete(slug);
          return d.tool;
        })
        .catch(err => {
          _pending.delete(slug);
          throw err;
        });
      _pending.set(slug, p);
    }

    _pending.get(slug)
      .then(t => { if (!cancelled) { setTool(t); setLoading(false); } })
      .catch(() => { if (!cancelled) { setNotFound(true); setLoading(false); } });

    return () => { cancelled = true; };
  }, [slug]);

  return { tool, loading, notFound };
}
