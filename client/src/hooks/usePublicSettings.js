import { useState, useEffect } from 'react';
import api from '@/services/api';

let _cache = null;
let _promise = null;

function fetchSettings() {
  if (_cache) return Promise.resolve(_cache);
  if (_promise) return _promise;
  _promise = api.get('/settings/public')
    .then(data => { _cache = data; _promise = null; return data; })
    .catch(() => { _promise = null; return {}; });
  return _promise;
}

export default function usePublicSettings() {
  const [settings, setSettings] = useState(_cache || null);

  useEffect(() => {
    if (_cache) { setSettings(_cache); return; }
    fetchSettings().then(setSettings);
  }, []);

  return settings;
}
