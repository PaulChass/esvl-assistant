import { ESVL, FFBB_WEB, TTL } from "@/config";
import { directusGet } from "./http";
import type { Catalog, Standing, StandingRow, Team } from "./types";
import { num } from "./util";

interface RawClassement {
  position: string | null;
  points: string | null;
  matchJoues: string | null;
  gagnes: string | null;
  perdus: string | null;
  difference: string | null;
  organisme: string;
  organisme_nom: string;
  idEngagement: string;
}

interface RawPoule {
  nom: string;
  classements: RawClassement[];
}

/** Fetch and normalize a poule's standing rows, sorted by rank. */
export async function pouleStanding(pouleId: string): Promise<{ poule: string; rows: RawClassement[] }> {
  const poule = await directusGet<RawPoule>(
    `/items/ffbbserver_poules/${pouleId}` +
      `?fields=nom,classements.position,classements.points,classements.matchJoues,` +
      `classements.gagnes,classements.perdus,classements.difference,classements.organisme,` +
      `classements.organisme_nom,classements.idEngagement&deep[classements][_limit]=100`,
    TTL.standings,
  );
  return { poule: poule.nom, rows: poule.classements ?? [] };
}

/** Standing for one team's poule, the club highlighted. */
export async function standingForTeam(catalog: Catalog, team: Team): Promise<Standing> {
  const { poule, rows: raw } = await pouleStanding(team.pouleId);

  const rows: StandingRow[] = raw
    .map((c) => ({
      rank: num(c.position) ?? 0,
      orgId: c.organisme,
      team: c.organisme_nom,
      played: num(c.matchJoues) ?? 0,
      won: num(c.gagnes) ?? 0,
      lost: num(c.perdus) ?? 0,
      points: num(c.points) ?? 0,
      diff: num(c.difference) ?? 0,
      isEsvl: c.organisme === catalog.orgId,
    }))
    .sort((a, b) => a.rank - b.rank);

  return {
    team: team.label,
    poule,
    rows,
    esvlRank: rows.find((r) => r.isEsvl)?.rank ?? null,
    sourceUrl: catalog.orgId === ESVL.orgId ? ESVL.clubUrl : FFBB_WEB,
  };
}
