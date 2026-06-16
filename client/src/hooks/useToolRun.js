import { useState, useCallback } from 'react';
import api from '@/services/api';

export function useToolRun(slug) {
  const [result,  setResult]  = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [usage,   setUsage]   = useState(null);
  const [limitReached, setLimitReached] = useState(false);

  const run = useCallback(async (text, options = {}) => {
    if (!text?.trim()) return;
    setLoading(true);
    setError('');
    setResult('');
    setLimitReached(false);

    try {
      const data = await api.post(`/tools/${slug}/run`, { text, ...options });
      setResult(data.result);
      if (data.usage) setUsage(data.usage);
    } catch (err) {
      if (err.status === 429) {
        setLimitReached(true);
        setError(err.message);
      } else {
        setError(err.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const reset = useCallback(() => {
    setResult(''); setError(''); setLimitReached(false);
  }, []);

  return { result, loading, error, usage, limitReached, run, reset };
}
