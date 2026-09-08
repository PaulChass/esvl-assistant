import { FFBB_WEB, TTL } from "@/config";
import { directusGet } from "./http";
import type { Catalog, Match, Team } from "./types";
import { formatFrDate, formatTime, num } from "./util";

interface RawRencontre {
  id: string;
  date: string | null;
  date_rencontre: string | null;
  horaire: string | null;
  joue: boolean;
  saison: string;
  numeroJournee: string | null;
  nomEquipe1: string;
  nomEquipe2: string;
  idOrganismeEquipe1: string;
  idOrganismeEquipe2: string;
  resultatEquipe1: string | number | null;
  resultatEquipe2: string | number | null;
  idPoule: string;
  remise: boolean;
  forfaitEquipe1: boolean;
  forfaitEquipe2: boolean;
  url_competition: string | null;
  salle: { libelle?: string | null; commune?: { libelle?: string | null } | null } | null;
}

const RENCONTRE_FIELDS =
  "id,date,date_rencontre,horaire,joue,saison,numeroJournee,nomEquipe1,nomEquipe2," +
  "idOrganismeEquipe1,idOrganismeEquipe2,resultatEquipe1,resultatEquipe2,idPoule,remise," +
  "forfaitEquipe1,forfaitEquipe2,url_competition,salle.libelle,salle.commune.libelle";

/** All matches for one poule (fixtures + results), cached once and split by `joue`. */
function pouleRencontres(pouleId: string): Promise<RawRencontre[]> {
  return directusGet<RawRencontre[]>(
    `/items/ffbbserver_rencontres?filter[idPoule][_eq]=${pouleId}&sort=date&fields=${RENCONTRE_FIELDS}&limit=300`,
    TTL.matches,
  );
}

/** All played matches across a whole club for the active season. */
function clubResults(orgId: string, seasonId: string): Promise<RawRencontre[]> {
  return directusGet<RawRencontre[]>(
    `/items/ffbbserver_rencontres` +
      `?filter[_or][0][idOrganismeEquipe1][_eq]=${orgId}` +
      `&filter[_or][1][idOrganismeEquipe2][_eq]=${orgId}` +
      `&filter[joue][_eq]=true&filter[saison][_eq]=${seasonId}` +
      `&sort=-date&fields=${RENCONTRE_FIELDS}&limit=50`,
    TTL.matches,
  );
}

function toMatch(r: RawRencontre, teamLabel: string, orgId: string): Match {
  const clubIsHome = r.idOrganismeEquipe1 === orgId;
  const opponent = clubIsHome ? r.nomEquipe2 : r.nomEquipe1;
  const clubRaw = clubIsHome ? r.resultatEquipe1 : r.resultatEquipe2;
  const oppRaw = clubIsHome ? r.resultatEquipe2 : r.resultatEquipe1;
  const clubScore = num(clubRaw);
  const opp = num(oppRaw);

  const played = !!r.joue;
  const score = played && clubScore !== null && opp !== null ? { esvl: clubScore, opponent: opp } : null;
  const outcome = score ? (score.esvl > score.opponent ? "W" : score.esvl < score.opponent ? "L" : "D") : null;

  const dateISO = r.date_rencontre || (r.date ? `${r.date}T00:00:00` : null);

  return {
    id: r.id,
    dateISO,
    dateLabel: formatFrDate(dateISO),
    timeLabel: formatTime(r.date_rencontre, r.horaire),
    played,
    postponed: !!r.remise,
    round: r.numeroJournee ?? null,
    team: teamLabel,
    opponent,
    opponentOrgId: clubIsHome ? r.idOrganismeEquipe2 : r.idOrganismeEquipe1,
    home: clubIsHome,
    venue: r.salle?.libelle ?? null,
    venueCity: r.salle?.commune?.libelle ?? null,
    score,
    outcome,
    forfeit: !!(r.forfaitEquipe1 || r.forfaitEquipe2),
    sourceUrl: r.url_competition ? `${FFBB_WEB}${r.url_competition}` : null,
  };
}

function involves(r: RawRencontre, orgId: string): boolean {
  return r.idOrganismeEquipe1 === orgId || r.idOrganismeEquipe2 === orgId;
}

/** FFBB occasionally stores the same fixture twice. Drop obvious duplicates. */
function dedupe(matches: Match[]): Match[] {
  const seen = new Set<string>();
  return matches.filter((m) => {
    const key = `${m.team}|${m.dateISO}|${m.opponent}|${m.home}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Upcoming matches for one team, soonest first. */
export async function nextMatchesForTeam(catalog: Catalog, team: Team, limit: number): Promise<Match[]> {
  const all = await pouleRencontres(team.pouleId);
  const matches = all
    .filter((r) => involves(r, catalog.orgId) && !r.joue)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
    .map((r) => toMatch(r, team.label, catalog.orgId));
  return dedupe(matches).slice(0, limit);
}

/** Latest results for one team, most recent first. */
export async function lastResultsForTeam(catalog: Catalog, team: Team, limit: number): Promise<Match[]> {
  const all = await pouleRencontres(team.pouleId);
  const matches = all
    .filter((r) => involves(r, catalog.orgId) && r.joue)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .map((r) => toMatch(r, team.label, catalog.orgId));
  return dedupe(matches).slice(0, limit);
}

/** Latest results across every team of the club. */
export async function clubLastResults(catalog: Catalog, limit: number): Promise<Match[]> {
  const raw = await clubResults(catalog.orgId, catalog.season.id);
  const byPoule = new Map(catalog.teams.map((t) => [t.pouleId, t.label]));
  const matches = raw.map((r) => toMatch(r, byPoule.get(r.idPoule) ?? catalog.clubName, catalog.orgId));
  return dedupe(matches).slice(0, limit);
}

/** Upcoming matches across every team of the club, soonest first. */
export async function clubNextMatches(catalog: Catalog, limit: number): Promise<Match[]> {
  const perTeam = await Promise.all(
    catalog.teams.map(async (t) => {
      const all = await pouleRencontres(t.pouleId);
      return all.filter((r) => involves(r, catalog.orgId) && !r.joue).map((r) => toMatch(r, t.label, catalog.orgId));
    }),
  );
  const matches = perTeam
    .flat()
    .sort((a, b) => (a.dateISO ?? "").localeCompare(b.dateISO ?? ""));
  return dedupe(matches).slice(0, limit);
}

/** The single next upcoming match for a team (or null). */
export async function nextMatchForTeam(catalog: Catalog, team: Team): Promise<Match | null> {
  const next = await nextMatchesForTeam(catalog, team, 1);
  return next[0] ?? null;
}

export interface TeamForm {
  played: number;
  wins: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  /** Most recent outcomes, newest first, e.g. ["W","L","W"]. */
  recent: ("W" | "L" | "D")[];
}

/** Season form of any organisme within a poule — used for opponent context in the brief. */
export async function teamFormInPoule(pouleId: string, orgId: string): Promise<TeamForm> {
  const all = await pouleRencontres(pouleId);
  const played = all
    .filter((r) => involves(r, orgId) && r.joue)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));

  const form: TeamForm = { played: 0, wins: 0, losses: 0, pointsFor: 0, pointsAgainst: 0, recent: [] };
  for (const r of played) {
    const home = r.idOrganismeEquipe1 === orgId;
    const own = num(home ? r.resultatEquipe1 : r.resultatEquipe2);
    const other = num(home ? r.resultatEquipe2 : r.resultatEquipe1);
    if (own === null || other === null) continue;
    form.played++;
    form.pointsFor += own;
    form.pointsAgainst += other;
    const o = own > other ? "W" : own < other ? "L" : "D";
    if (o === "W") form.wins++;
    else if (o === "L") form.losses++;
    if (form.recent.length < 5) form.recent.push(o);
  }
  return form;
}
