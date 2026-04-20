import { useState, useEffect } from 'react';
import client from '../api/client';
import { useAuth } from '../context/AuthContext';

let cache = null;
// Bust the cache whenever the app version increments (new pages added)
// Increment this string any time new pages are added to the DB
const CACHE_VERSION = 'v2';

export function clearPermissionsCache() {
  cache = null;
}

export function usePermissions() {
  const { isAuthenticated, user } = useAuth();
  const [permissions, setPermissions] = useState(cache || {});
  const [loading, setLoading] = useState(!cache);

  useEffect(() => {
    if (!isAuthenticated) { setPermissions({}); setLoading(false); return; }

    // If the stored cache was built with an older version, discard it
    if (cache && cache.__version !== CACHE_VERSION) { cache = null; }

    if (cache) { setPermissions(cache); setLoading(false); return; }

    client.get('/permissions/me')
      .then(({ data }) => {
        cache = { ...data, __version: CACHE_VERSION };
        setPermissions(cache);
      })
      .catch(() => setPermissions({}))
      .finally(() => setLoading(false));
  }, [isAuthenticated]);

  // Admin users bypass all permission checks — they always have full access
  const isAdmin = !!user?.is_admin;

  const canView = (slug) => {
    if (isAdmin) return true;
    const level = permissions[slug];
    return level === 'view' || level === 'edit';
  };

  const canEdit = (slug) => {
    if (isAdmin) return true;
    return permissions[slug] === 'edit';
  };

  return { permissions, loading, canView, canEdit };
}
