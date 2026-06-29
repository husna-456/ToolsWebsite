import { useState, useCallback, useEffect, useRef } from 'react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'https://globaltechtools.thefiveriverz.com';

export function useFileUpload(slug) {
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');
  const [progress,   setProgress]   = useState(0);
  const [downloadUrl,setDownloadUrl] = useState(null);
  const [filename,   setFilename]   = useState('');
  const [jsonResult, setJsonResult] = useState(null); // for image-to-base64

  const blobUrlRef = useRef(null);

  // Auto-trigger download whenever downloadUrl + filename are set
  useEffect(() => {
    if (!downloadUrl || !filename) return;
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [downloadUrl, filename]);

  // Revoke blob URL on unmount to free memory
  useEffect(() => {
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, []);

  const upload = useCallback(async (file, options = {}) => {
    setLoading(true);
    setError('');
    setProgress(0);
    setDownloadUrl(null);
    setFilename('');
    setJsonResult(null);
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    try {
      const formData = new FormData();
      // Support array of files (e.g. image-merger) under 'files' key
      if (Array.isArray(file)) {
        file.forEach(f => formData.append('files', f));
        console.log(`[upload] slug=${slug} files=${file.length} (array)`);
      } else {
        formData.append('file', file);
        console.log(`[upload] slug=${slug} filename="${file?.name}" type="${file?.type||'(none)'}" size=${((file?.size||0)/1024/1024).toFixed(2)}MB`);
      }
      Object.entries(options).forEach(([k, v]) => {
        if (v !== undefined && v !== null) {
          if (v instanceof File) formData.append(k, v);            // subtitle / extra files
          else if (typeof v === 'object') formData.append(k, JSON.stringify(v));
          else formData.append(k, String(v));
        }
      });

      const token = localStorage.getItem('it_token');
      const apiUrl = `${API_BASE_URL}/api/tools/${slug}/process`;
      console.log(`[upload] POST ${apiUrl} outputFormat=${options.format||'(default)'} mimeType=${options.mimeType||'(not sent)'}`);
      const response = await axios.post(
        apiUrl,
        formData,
        {
          responseType: 'blob',
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          onUploadProgress: (e) => {
            if (e.total) {
              // Upload counts as first 60% of progress
              setProgress(Math.min(60, Math.round((e.loaded / e.total) * 60)));
            }
          },
        }
      );

      setProgress(85); // processing phase
      console.log(`[upload] response received — content-type: ${response.headers?.['content-type']}`);

      const contentType = response.headers?.['content-type'] || '';

      // JSON response (image-to-base64 returns { base64: '...' })
      if (contentType.includes('application/json')) {
        const text = await response.data.text();
        setJsonResult(JSON.parse(text));
        setProgress(100);
        return;
      }

      // File response — create blob URL and auto-download
      const blob = new Blob([response.data], { type: contentType });
      const url  = URL.createObjectURL(blob);
      blobUrlRef.current = url;

      // Extract filename from Content-Disposition header
      const disposition = response.headers?.['content-disposition'] || '';
      const match = disposition.match(/filename[^;=\n]*=["']?([^"';\n]+)["']?/i);
      const fname = match?.[1]?.trim() || `${slug}-output`;

      setDownloadUrl(url);
      setFilename(fname);
      setProgress(100);
    } catch (err) {
      console.error(`[upload] error: status=${err.response?.status} message="${err.message}" code="${err.code}"`);
      // Error body may be a Blob when responseType is 'blob'
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          console.error(`[upload] error response body: ${text}`);
          const json = JSON.parse(text);
          setError(json.error || json.message || 'Processing failed.');
        } catch {
          setError('Processing failed. Please try again.');
        }
      } else {
        const isNetworkErr = !err.response && (err.code === 'ERR_NETWORK' || err.message === 'Network Error');
        const msg = isNetworkErr
          ? 'Connection failed. Please check your internet and try again.'
          : (err.response?.data?.error || err.message || 'Upload failed. Please try again.');
        console.error(`[upload] error message shown to user: "${msg}"`);
        setError(msg);
      }
      setProgress(0);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  const reset = useCallback(() => {
    setLoading(false);
    setError('');
    setProgress(0);
    setDownloadUrl(null);
    setFilename('');
    setJsonResult(null);
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  return { upload, loading, error, progress, downloadUrl, filename, jsonResult, reset };
}
