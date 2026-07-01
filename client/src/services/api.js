import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'https://globaltechtools.thefiveriverz.com';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 90000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT from localStorage on every request
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('it_token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — normalize errors
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const message =
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message ||
      'Something went wrong';
    return Promise.reject({
      message,
      status:    error.response?.status,
      // Backend-defined error code (e.g. RATE_LIMIT, AUTH_ERROR) when a response
      // was received; otherwise the client/network-level code (e.g. ECONNABORTED
      // for a timeout) so callers can distinguish "server said no" from "never reached it".
      code:      error.response?.data?.code || error.code,
      requestId: error.response?.data?.requestId,
    });
  }
);

export default api;
