import { useState, useCallback } from 'react';
import api from '@/services/api';

export function useSeoAnalyze(slug) {
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const analyze = useCallback(async (body = {}) => {
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await api.post(`/tools/${slug}/analyze`, body);
      setResult(data.result);
    } catch (err) {
      setError(err.message || 'Analysis failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const reset = useCallback(() => {
    setResult(null);
    setError('');
  }, []);

  return { analyze, result, loading, error, reset };
}
