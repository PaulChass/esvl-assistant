/**
 * Public FFBB data API — the surface the agent's tools call.
 *
 * Every function returns trimmed, LLM-friendly domain objects (never raw Directus payloads),
 * and team resolution happens in code so the model spends no tokens computing it.
 */

import { getCatalog } from "./catalog";
import { clubLastResults, clubNextMatches, lastResultsForTeam, nextMatchesForTeam } from "./matches";
import { resolveTeam } from "./resolve";
import { standingForTeam } from "./standings";
import type { Catalog, Match, Standing, Team } from "./types";

export type { Catalog, Match, Standing, Team } from "./types";
export { getCatalog } from "./catalog";

export interface TeamRef {
  label: string;
  code: string;
}

export type Scoped<T> =
  | { status: "ok"; team?: string; data: T }
  | { status: "ambiguous"; message: string; candidates: TeamRef[] }
  | { status: "not_found"; message: string; availableTeams: TeamRef[] };

const ref = (t: Team): TeamRef => ({ label: t.label, code: t.code });

function resolveOrExplain<T>(
  query: string,
  catalog: Catalog,
  run: (team: Team) => Promise<T>,
): Promise<Scoped<T>> {
  const r = resolveTeam(query, catalog.teams);
  if (r.kind === "match") return run(r.team).then((data) => ({ status: "ok", team: r.team.label, data }));
  if (r.kind === "ambiguous") {
    return Promise.resolve({
      status: "ambiguous",
      message: `Plusieurs équipes correspondent à « ${query} ». Demande à l'utilisateur laquelle.`,
      candidates: r.candidates.map(ref),
    });
  }
  return Promise.resolve({
    status: "not_found",
    message: `Aucune équipe de l'ESVL ne correspond à « ${query} » pour la saison en cours.`,
    availableTeams: catalog.teams.map(ref),
  });
}

/** Warm (and return) the team catalog. Call once per request; cheap after that. */
export function warmCatalog(): Promise<Catalog> {
  return getCatalog();
}

export function listTeams(catalog: Catalog): { season: string; teams: TeamRef[] } {
  return { season: catalog.season.label, teams: catalog.teams.map(ref) };
}

/** Upcoming fixtures. `query` null → whole club. */
export function getSchedule(
  catalog: Catalog,
  query: string | null,
  limit = 3,
): Promise<Scoped<Match[]>> {
  if (!query) {
    return clubNextMatches(catalog, limit).then((data) => ({ status: "ok", data }));
  }
  return resolveOrExplain(query, catalog, (team) => nextMatchesForTeam(team, limit));
}

/** Latest results. `query` null → whole club. */
export function getResults(
  catalog: Catalog,
  query: string | null,
  limit = 5,
): Promise<Scoped<Match[]>> {
  if (!query) {
    return clubLastResults(catalog, limit).then((data) => ({ status: "ok", data }));
  }
  return resolveOrExplain(query, catalog, (team) => lastResultsForTeam(team, limit));
}

/** League standing for a team's poule. Requires a team (standings are per-poule). */
export function getStanding(catalog: Catalog, query: string): Promise<Scoped<Standing>> {
  return resolveOrExplain(query, catalog, (team) => standingForTeam(team));
}
