import { ESVL, TTL } from "@/config";
import { directusGet } from "./http";
import type { Standing, StandingRow, Team } from "./types";
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

/** Standing for one team's poule, ESVL highlighted. The top-level classements collection
 *  is forbidden for the public role — standings only exist nested on the poule. */
export async function standingForTeam(team: Team): Promise<Standing> {
  const poule = await directusGet<RawPoule>(
    `/items/ffbbserver_poules/${team.pouleId}` +
      `?fields=nom,classements.position,classements.points,classements.matchJoues,` +
      `classements.gagnes,classements.perdus,classements.difference,classements.organisme,` +
      `classements.organisme_nom,classements.idEngagement&deep[classements][_limit]=100`,
    TTL.standings,
  );

  const rows: StandingRow[] = (poule.classements ?? [])
    .map((c) => ({
      rank: num(c.position) ?? 0,
      team: c.organisme_nom,
      played: num(c.matchJoues) ?? 0,
      won: num(c.gagnes) ?? 0,
      lost: num(c.perdus) ?? 0,
      points: num(c.points) ?? 0,
      diff: num(c.difference) ?? 0,
      isEsvl: c.organisme === ESVL.orgId,
    }))
    .sort((a, b) => a.rank - b.rank);

  const esvlRank = rows.find((r) => r.isEsvl)?.rank ?? null;

  return {
    team: team.label,
    poule: poule.nom,
    rows,
    esvlRank,
    sourceUrl: ESVL.clubUrl,
  };
}
