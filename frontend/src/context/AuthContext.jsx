import { createContext, useContext, useState, useCallback, useEffect } from 'react';
import client, { setCsrfToken, initCsrf } from '../api/client';
import { clearPermissionsCache } from '../hooks/usePermissions';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // Auth lives in the HttpOnly jwt_token cookie (not JS-readable). We keep only
  // the non-sensitive user object in localStorage for UI; the cookie is the
  // real credential. isAuthenticated is derived from the presence of that user.
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('pm_user');
    return stored ? JSON.parse(stored) : null;
  });

  // On bootstrap, if we think we're logged in, fetch the CSRF token for the
  // existing cookie session so mutating requests are accepted. A 401 here trips
  // the client interceptor and redirects to login.
  useEffect(() => {
    if (user) initCsrf();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (username, password) => {
    // Clear any cached permissions from a previous session before storing new
    // credentials — prevents a stale cache causing Access Denied.
    clearPermissionsCache();
    const { data } = await client.post('/auth/login', { username, password });
    // JWT is set as an HttpOnly cookie by the server; never store it in JS.
    localStorage.setItem('pm_user', JSON.stringify(data.user));
    setCsrfToken(data.csrf_token);
    setUser(data.user);
    return data.user;
  }, []);

  const logout = useCallback(async () => {
    // Must hit the server so the HttpOnly cookie is cleared + the JWT blacklisted;
    // clearing localStorage alone would NOT end a cookie session.
    try { await client.post('/auth/logout'); } catch { /* ignore */ }
    localStorage.removeItem('pm_user');
    setCsrfToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((updates) => {
    setUser(prev => {
      const updated = { ...prev, ...updates };
      localStorage.setItem('pm_user', JSON.stringify(updated));
      return updated;
    });
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, updateUser, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
