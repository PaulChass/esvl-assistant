/**
 * Static configuration for the ESVL assistant.
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
 * ES Villeneuve-Loubet Basket — the club this assistant serves.
 * `orgId` is resolved once from the code SUD0006003 and pinned here (FFBB org ids are stable).
 */
export const ESVL = {
  orgId: "10135",
  code: "SUD0006003",
  name: "ES Villeneuve-Loubet Basket",
  ligue: "sud",
  comite: "0006",
  clubUrl: `${FFBB_WEB}/ligues/sud/comites/0006/clubs/sud0006003`,
} as const;

/** LLM provider selection (see src/lib/llm). Keys come from the environment. */
export const MODEL_DEFAULTS = {
  vendor: (process.env.ESVL_VENDOR as "anthropic" | "google" | undefined) ?? "anthropic",
  anthropic: process.env.ESVL_MODEL_ANTHROPIC ?? "claude-haiku-4-5",
  google: process.env.ESVL_MODEL_GOOGLE ?? "gemini-3.6-flash",
} as const;

/** Cache TTLs (ms). FFBB public data changes on the order of minutes-to-days. */
export const TTL = {
  season: 24 * 60 * 60 * 1000, // active season: ~yearly
  catalog: 6 * 60 * 60 * 1000, // team catalog (engagements): a few hours
  matches: 30 * 60 * 1000, // fixtures + results: 30 min (one fetch serves both)
  standings: 30 * 60 * 1000, // standings
} as const;
