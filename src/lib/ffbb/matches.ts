import { ESVL, FFBB_WEB, TTL } from "@/config";
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

/** All played matches across the whole club for the active season. */
function clubResults(seasonId: string): Promise<RawRencontre[]> {
  return directusGet<RawRencontre[]>(
    `/items/ffbbserver_rencontres` +
      `?filter[_or][0][idOrganismeEquipe1][_eq]=${ESVL.orgId}` +
      `&filter[_or][1][idOrganismeEquipe2][_eq]=${ESVL.orgId}` +
      `&filter[joue][_eq]=true&filter[saison][_eq]=${seasonId}` +
      `&sort=-date&fields=${RENCONTRE_FIELDS}&limit=50`,
    TTL.matches,
  );
}

function toMatch(r: RawRencontre, teamLabel: string): Match {
  const esvlIsHome = r.idOrganismeEquipe1 === ESVL.orgId;
  const opponent = esvlIsHome ? r.nomEquipe2 : r.nomEquipe1;
  const esvlRaw = esvlIsHome ? r.resultatEquipe1 : r.resultatEquipe2;
  const oppRaw = esvlIsHome ? r.resultatEquipe2 : r.resultatEquipe1;
  const esvl = num(esvlRaw);
  const opp = num(oppRaw);

  const played = !!r.joue;
  const score = played && esvl !== null && opp !== null ? { esvl, opponent: opp } : null;
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
    home: esvlIsHome,
    venue: r.salle?.libelle ?? null,
    venueCity: r.salle?.commune?.libelle ?? null,
    score,
    outcome,
    forfeit: !!(r.forfaitEquipe1 || r.forfaitEquipe2),
    sourceUrl: r.url_competition ? `${FFBB_WEB}${r.url_competition}` : null,
  };
}

function isEsvl(r: RawRencontre): boolean {
  return r.idOrganismeEquipe1 === ESVL.orgId || r.idOrganismeEquipe2 === ESVL.orgId;
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
export async function nextMatchesForTeam(team: Team, limit: number): Promise<Match[]> {
  const all = await pouleRencontres(team.pouleId);
  const matches = all
    .filter((r) => isEsvl(r) && !r.joue)
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""))
    .map((r) => toMatch(r, team.label));
  return dedupe(matches).slice(0, limit);
}

/** Latest results for one team, most recent first. */
export async function lastResultsForTeam(team: Team, limit: number): Promise<Match[]> {
  const all = await pouleRencontres(team.pouleId);
  const matches = all
    .filter((r) => isEsvl(r) && r.joue)
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""))
    .map((r) => toMatch(r, team.label));
  return dedupe(matches).slice(0, limit);
}

/** Latest results across every ESVL team. */
export async function clubLastResults(catalog: Catalog, limit: number): Promise<Match[]> {
  const raw = await clubResults(catalog.season.id);
  const byPoule = new Map(catalog.teams.map((t) => [t.pouleId, t.label]));
  const matches = raw.map((r) => toMatch(r, byPoule.get(r.idPoule) ?? ESVL.name));
  return dedupe(matches).slice(0, limit);
}

/** Upcoming matches across every ESVL team, soonest first. */
export async function clubNextMatches(catalog: Catalog, limit: number): Promise<Match[]> {
  const perTeam = await Promise.all(
    catalog.teams.map(async (t) => {
      const all = await pouleRencontres(t.pouleId);
      return all.filter((r) => isEsvl(r) && !r.joue).map((r) => toMatch(r, t.label));
    }),
  );
  const matches = perTeam
    .flat()
    .sort((a, b) => (a.dateISO ?? "").localeCompare(b.dateISO ?? ""));
  return dedupe(matches).slice(0, limit);
}
