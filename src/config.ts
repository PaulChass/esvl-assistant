/**
 * Configuration for the assistant.
 *
 * The FFBB backend is an undocumented Directus API used by competitions.ffbb.com.
 * Read access is public but WAF-gated: every request must send Origin + Referer of
 * competitions.ffbb.com. See docs/architecture.md.
 */

export const FFBB_HOST = "https://api.ffbb.com";
export const FFBB_WEB = "https://competitions.ffbb.com";

/** Headers required on EVERY FFBB request (incl. the token bootstrap) or the WAF returns 403. */
export const FFBB_HEADERS: Record<string, string> = {
  Origin: FFBB_WEB,
  Referer: FFBB_WEB + "/",
};

/**
 * The club this instance serves. Only the org id really matters — team names, the club
 * name, fixtures and standings are all auto-discovered from FFBB. Override via NEXT_PUBLIC_CLUB_*
 * env vars to run this for ANY FFBB club; the defaults are ES Villeneuve-Loubet (the reference
 * deployment). Find your club's org id with:  npm run find-club "<club name>"
 */
export const CLUB = {
  orgId: process.env.NEXT_PUBLIC_CLUB_ORG_ID ?? "10135",
  name: process.env.NEXT_PUBLIC_CLUB_NAME ?? "ES Villeneuve-Loubet Basket",
  short: process.env.NEXT_PUBLIC_CLUB_SHORT ?? "ESVL",
  // ligue / comité / code are only used to build the FFBB source link.
  ligue: process.env.NEXT_PUBLIC_CLUB_LIGUE ?? "sud",
  comite: process.env.NEXT_PUBLIC_CLUB_COMITE ?? "0006",
  code: process.env.NEXT_PUBLIC_CLUB_CODE ?? "sud0006003",
} as const;

/** The club's public page on competitions.ffbb.com, used as a source link (null if unknown). */
export const clubUrl: string | null =
  CLUB.ligue && CLUB.comite && CLUB.code
    ? `${FFBB_WEB}/ligues/${CLUB.ligue}/comites/${CLUB.comite}/clubs/${CLUB.code}`
    : null;

/** LLM provider selection (see src/lib/llm). API keys come from the environment. */
export const MODEL_DEFAULTS = {
  vendor: (process.env.LLM_VENDOR as "anthropic" | "google" | undefined) ?? "anthropic",
  anthropic: process.env.LLM_MODEL_ANTHROPIC ?? "claude-haiku-4-5",
  google: process.env.LLM_MODEL_GOOGLE ?? "gemini-3.6-flash",
} as const;

/** Cache TTLs (ms). FFBB public data changes on the order of minutes-to-days. */
export const TTL = {
  season: 24 * 60 * 60 * 1000, // active season: ~yearly
  catalog: 6 * 60 * 60 * 1000, // team catalog (engagements): a few hours
  matches: 30 * 60 * 1000, // fixtures + results: 30 min (one fetch serves both)
  standings: 30 * 60 * 1000, // standings
} as const;
