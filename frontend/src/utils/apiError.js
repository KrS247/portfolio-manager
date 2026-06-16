/**
 * Extract a human-readable message from an Axios error.
 *
 * The API returns errors in a few shapes:
 *   - { error: "Invalid credentials" }        (plain string — most endpoints)
 *   - { message: "...", errors: {...} }        (Laravel validation)
 *   - { error: { message: "..." } }            (rare nested form)
 *
 * The old code read `err.response?.data?.error?.message`, which is undefined
 * for the common string form — so every error collapsed to the fallback.
 */
export function extractApiError(err, fallback = 'Something went wrong. Please try again.') {
  const data = err?.response?.data;
  if (!data) {
    // Network error / no response
    return err?.message || fallback;
  }
  if (typeof data.error === 'string') return data.error;
  if (typeof data.error?.message === 'string') return data.error.message;
  if (typeof data.message === 'string') return data.message;
  return fallback;
}
