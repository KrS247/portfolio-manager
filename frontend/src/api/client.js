import axios from 'axios';

/**
 * Cookie-based auth (XSS-safe): the JWT lives only in the HttpOnly `jwt_token`
 * cookie set by the backend on login and sent automatically via
 * withCredentials. It is never stored in localStorage, so XSS cannot steal it.
 *
 * CSRF: because the SPA and API are cross-origin the cookie is SameSite=None,
 * so mutating requests carry a stateless CSRF token (HMAC of the JWT) in the
 * X-XSRF-TOKEN header. The token is held in memory only and fetched from
 * GET /auth/csrf (or returned on login).
 */
let csrfToken = null;
export function setCsrfToken(token) { csrfToken = token || null; }
export function getCsrfToken() { return csrfToken; }

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
  withCredentials: true, // send the HttpOnly jwt_token cookie cross-origin
});

const MUTATING = ['post', 'put', 'patch', 'delete'];

// Attach the CSRF token on state-changing requests.
client.interceptors.request.use((config) => {
  if (csrfToken && MUTATING.includes((config.method || 'get').toLowerCase())) {
    config.headers['X-XSRF-TOKEN'] = csrfToken;
  }
  return config;
});

// On 401, clear client auth state and redirect to login.
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('pm_user');
      csrfToken = null;
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

/**
 * Fetch the CSRF token for the current cookie session (call on app bootstrap
 * when a user is present). Safe to call when not authenticated — it just no-ops.
 */
export async function initCsrf() {
  try {
    const { data } = await client.get('/auth/csrf');
    setCsrfToken(data?.csrf_token);
  } catch {
    setCsrfToken(null);
  }
}

export default client;
