import { useState, useEffect } from 'react';
import api from '@/services/api';

// Module-level cache so all components share one fetch per page load
let _cache = null;
let _promise = null;

export function useTools(category = null) {
  const cached = _cache ? (_cache) : [];
  const [tools,   setTools]   = useState(cached);
  const [loading, setLoading] = useState(!_cache);

  useEffect(() => {
    if (_cache) {
      setTools(_cache);
      setLoading(false);
      return;
    }
    if (!_promise) {
      _promise = api.get('/tools').then(data => {
        _cache = data.tools || [];
        return _cache;
      });
    }
    _promise.then(allTools => {
      setTools(allTools);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = category ? tools.filter(t => t.category === category) : tools;
  return { tools: filtered, loading };
}
