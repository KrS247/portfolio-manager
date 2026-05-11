import axios from 'axios';

/**
 * Axios client with dual-token auth strategy (H-10 fix):
 *
 * Primary (preferred):  HttpOnly cookie 'jwt_token' set by the backend on login.
 *   - Sent automatically with every request via withCredentials: true.
 *   - Not accessible to JavaScript, so XSS attacks cannot steal the token.
 *
 * Fallback (legacy/API clients): Authorization: Bearer header from localStorage.
 *   - Still supported for backward compatibility with non-browser clients.
 *   - Migrate away from localStorage towards cookie-only as users re-login.
 */
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
  // Required so the browser sends the HttpOnly jwt_token cookie cross-origin
  withCredentials: true,
});

// Attach Authorization header only if a localStorage token exists (backward compat).
// Once the HttpOnly cookie is set the backend will use that; the header is redundant
// but harmless and keeps existing sessions working without forcing a re-login.
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('pm_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear auth state and redirect to login
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('pm_token');
      localStorage.removeItem('pm_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default client;
