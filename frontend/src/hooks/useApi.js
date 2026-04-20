import { useState, useEffect, useCallback } from 'react';
import client from '../api/client';

export function useApi(url, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = useCallback(() => {
    if (!url) return;
    setLoading(true);
    setError(null);
    client.get(url)
      .then(({ data }) => setData(data))
      .catch((err) => setError(err.response?.data?.error?.message || 'Failed to load data'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, ...deps]);

  useEffect(() => { fetchData(); }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
