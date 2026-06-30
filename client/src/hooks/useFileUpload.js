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
      console.log(`[upload] request started at ${new Date().toISOString()}`);
      const response = await axios.post(
        apiUrl,
        formData,
        {
          responseType: 'blob',
          // 5-minute hard cap on the entire round-trip (upload + server processing).
          // Without this, a hung FFmpeg or slow mobile upload keeps the request open
          // until the nginx proxy drops the socket, giving a misleading ERR_NETWORK.
          timeout: 300000,
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          onUploadProgress: (e) => {
            if (e.total) {
              setProgress(Math.min(60, Math.round((e.loaded / e.total) * 60)));
            }
          },
        }
      );
      console.log(`[upload] response received at ${new Date().toISOString()}`);

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
      const code   = err.code   || 'unknown';
      const status = err.response?.status;
      console.error(`[upload] FAILED at ${new Date().toISOString()} — code=${code} status=${status} message="${err.message}"`);

      // When responseType:'blob', a 4xx/5xx body arrives as a Blob — parse it
      // to show the real backend error message to the user.
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          console.error(`[upload] backend error body: ${text}`);
          const json = JSON.parse(text);
          setError(json.error || json.message || `Server error ${status}.`);
        } catch {
          setError(`Server error ${status || ''}. Please try again.`);
        }
        setProgress(0);
        return;
      }

      // No response received at all — diagnose the real cause instead of
      // showing a generic "check your internet" message.
      if (!err.response) {
        let msg;
        if (code === 'ECONNABORTED' || err.message?.includes('timeout')) {
          // axios hit its 5-minute timeout — server took too long
          msg = `Request timed out (5 min). The server is taking too long — try a smaller file or a different format. (${code})`;
        } else if (code === 'ERR_NETWORK' || err.message === 'Network Error') {
          // Connection dropped — most likely nginx proxy timeout on the server
          msg = `Network error (${code}) — the server did not respond. `
              + `This usually means the server took too long (nginx timeout). `
              + `Try a smaller file or check the /api/health/media endpoint.`;
        } else {
          msg = `Request failed: ${err.message} (${code})`;
        }
        console.error(`[upload] no-response error: ${msg}`);
        setError(msg);
        setProgress(0);
        return;
      }

      // Any other error with a response
      setError(err.response?.data?.error || err.message || 'Upload failed. Please try again.');
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
