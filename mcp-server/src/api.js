/**
 * Portfolio Manager API client.
 * Authenticates via x-api-key header (MCP API key).
 * Each request carries the key so the backend resolves the user identity.
 */
import axios from 'axios';

const PM_API_URL = (process.env.PM_API_URL || 'http://localhost:8080/api').replace(/\/$/, '');

export function createApiClient(apiKey) {
  return axios.create({
    baseURL: PM_API_URL,
    headers: {
      'Content-Type': 'application/json',
      'Accept':       'application/json',
      'x-api-key':    apiKey,
    },
    timeout: 15000,
  });
}

/** Convenience: unwrap the data from an axios response, format errors nicely */
export async function call(apiKey, method, path, data = null) {
  const client = createApiClient(apiKey);
  try {
    const res = method === 'get'
      ? await client.get(path, { params: data })
      : await client[method](path, data);
    return res.data;
  } catch (err) {
    const status  = err.response?.status;
    const message = err.response?.data?.message || err.response?.data?.error || err.message;
    throw new Error(`API ${method.toUpperCase()} ${path} → ${status ?? 'network error'}: ${message}`);
  }
}
