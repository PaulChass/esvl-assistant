/**
 * Tiny metrics counter backed by Upstash Redis (REST) — the "Share" click is the project's
 * #1 adoption signal. It reads UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN and NO-OPS
 * cleanly when they're absent, so the app runs fine without a store; wire the two env vars
 * (from the Upstash console → REST API) to start counting.
 */
const URL = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

export function metricsEnabled(): boolean {
  return !!(URL && TOKEN);
}

async function call(path: string): Promise<unknown> {
  if (!URL || !TOKEN) return null;
  try {
    const res = await fetch(`${URL}/${path}`, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { result?: unknown };
    return json.result ?? null;
  } catch {
    return null; // metrics must never break the app
  }
}

/** Increment a counter. Silent no-op if the store isn't configured. */
export async function incr(key: string): Promise<void> {
  await call(`incr/${encodeURIComponent(key)}`);
}

/** Read a counter (0 when unset or store disabled). */
export async function count(key: string): Promise<number> {
  const r = await call(`get/${encodeURIComponent(key)}`);
  return Number(r ?? 0) || 0;
}
