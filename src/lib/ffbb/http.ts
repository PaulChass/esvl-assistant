import { FFBB_HOST, FFBB_HEADERS } from "@/config";
import { cache } from "@/lib/cache";

/** Base error for anything the FFBB layer can't fulfil. Surfaces cleanly to the agent. */
export class FfbbError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "FfbbError";
  }
}

const TOKEN_TTL_MS = 25 * 60 * 1000;
let token: { value: string; expires: number } | null = null;

/**
 * Public two-token bootstrap. GET /items/configuration returns key_dh (the Directus
 * bearer). No signup, no personal key. Tokens rotate, so we never hardcode them and
 * re-bootstrap on auth failure.
 */
async function bootstrap(force = false): Promise<string> {
  const now = Date.now();
  if (!force && token && now < token.expires) return token.value;

  const res = await fetch(`${FFBB_HOST}/items/configuration`, { headers: FFBB_HEADERS });
  if (!res.ok) throw new FfbbError(`FFBB configuration bootstrap failed`, res.status);

  const json = (await res.json()) as { data?: { key_dh?: string } };
  const key = json.data?.key_dh;
  if (!key) throw new FfbbError("FFBB configuration returned no key_dh");

  token = { value: key, expires: now + TOKEN_TTL_MS };
  return key;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Uncached Directus GET, returning the `data` payload. Retries transient failures. */
async function rawGet<T>(path: string): Promise<T> {
  let bearer = await bootstrap();

  for (let attempt = 0; attempt < 4; attempt++) {
    let res: Response;
    try {
      res = await fetch(`${FFBB_HOST}${path}`, {
        headers: { ...FFBB_HEADERS, Authorization: `Bearer ${bearer}` },
      });
    } catch (e) {
      if (attempt < 3) {
        await sleep(300 * 2 ** attempt);
        continue;
      }
      throw new FfbbError(`FFBB network error: ${(e as Error).message}`);
    }

    if (res.status === 401 && attempt === 0) {
      bearer = await bootstrap(true); // token likely rotated — re-bootstrap once
      continue;
    }
    if (res.status === 429 || res.status >= 500) {
      if (attempt < 3) {
        await sleep(300 * 2 ** attempt);
        continue;
      }
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new FfbbError(`FFBB ${res.status}: ${body.slice(0, 160)}`, res.status);
    }

    const json = (await res.json()) as { data?: T };
    return json.data as T;
  }
  throw new FfbbError("FFBB request failed after retries");
}

/** Cached Directus GET. `ttlMs` sets freshness; stale responses are served for 4× that
 *  while a refresh runs in the background. */
export function directusGet<T>(path: string, ttlMs: number): Promise<T> {
  return cache.fetch<T>(`GET ${path}`, { ttlMs, staleMs: ttlMs * 4 }, () => rawGet<T>(path));
}
