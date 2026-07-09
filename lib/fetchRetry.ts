/**
 * fetch with a few retries for the flaky flight backend (intermittent 5xx /
 * Cloudflare 502s). Retries on a thrown network error OR a 5xx response, with
 * short backoff. Returns the last Response so callers keep their own `res.ok`
 * handling — a 4xx is returned immediately (not retried), and a persistent 5xx
 * is returned after the final attempt.
 */
export async function fetchRetry(
  url: string,
  init?: RequestInit,
  tries = 3
): Promise<Response> {
  const backoff = [300, 800]; // ms between attempts
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, init);
      if (res.status < 500 || i === tries - 1) return res;
    } catch (err) {
      lastErr = err;
      if (i === tries - 1) throw err;
    }
    await new Promise((r) => setTimeout(r, backoff[i] ?? 800));
  }
  // Unreachable in practice (loop returns/throws), but satisfies the type.
  throw lastErr ?? new Error("fetchRetry: exhausted");
}
