/**
 * A tiny in-memory TTL cache with stale-while-revalidate and in-flight de-duplication.
 *
 * Why this exists: in a chat agent the dominant cost is LLM tokens, and every FFBB
 * round-trip the agent triggers ends up as tokens re-fed into context. FFBB data is
 * highly cacheable (schedules/standings move on the order of minutes-to-days), so caching
 * hard both cuts network calls and keeps tool payloads small and stable.
 *
 * This is per-instance (per serverless invocation). For a shared cache across cold starts,
 * swap the Map for Vercel KV / Upstash behind the same interface — see docs/architecture.md.
 */

type Entry<T> = { value: T; freshUntil: number; staleUntil: number };

export class TtlCache {
  private store = new Map<string, Entry<unknown>>();
  private inflight = new Map<string, Promise<unknown>>();

  async fetch<T>(
    key: string,
    opts: { ttlMs: number; staleMs?: number },
    loader: () => Promise<T>,
  ): Promise<T> {
    const now = Date.now();
    const entry = this.store.get(key) as Entry<T> | undefined;

    if (entry && now < entry.freshUntil) return entry.value; // fresh hit

    if (entry && now < entry.staleUntil) {
      // stale-while-revalidate: serve stale immediately, refresh in the background
      void this.load(key, opts, loader).catch(() => {
        /* keep serving stale on refresh failure */
      });
      return entry.value;
    }

    return this.load(key, opts, loader); // miss or expired → await a fresh load
  }

  private load<T>(
    key: string,
    opts: { ttlMs: number; staleMs?: number },
    loader: () => Promise<T>,
  ): Promise<T> {
    const existing = this.inflight.get(key) as Promise<T> | undefined;
    if (existing) return existing; // de-dupe concurrent loads of the same key

    const promise = (async () => {
      try {
        const value = await loader();
        const now = Date.now();
        this.store.set(key, {
          value,
          freshUntil: now + opts.ttlMs,
          staleUntil: now + (opts.staleMs ?? opts.ttlMs),
        });
        return value;
      } finally {
        this.inflight.delete(key);
      }
    })();

    this.inflight.set(key, promise);
    return promise;
  }

  clear(): void {
    this.store.clear();
    this.inflight.clear();
  }
}

/** Shared cache instance for FFBB reads. */
export const cache = new TtlCache();
