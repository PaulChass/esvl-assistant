import { ESVL, TTL } from "@/config";
import { directusGet } from "./http";
import { buildTeam, type RawEngagement } from "./labels";
import type { Catalog, Season, Team } from "./types";

interface RawSeason {
  id: string;
  code: string;
  libelle: string;
}

/** The active FFBB season (e.g. "26-27"). Changes ~once a year. */
export async function getActiveSeason(): Promise<Season> {
  const rows = await directusGet<RawSeason[]>(
    `/items/ffbbserver_saisons?filter[actif][_eq]=true&fields=id,code,libelle&limit=1`,
    TTL.season,
  );
  const s = rows?.[0];
  if (!s) throw new Error("No active FFBB season found");
  return { id: s.id, code: s.code, label: s.libelle };
}

/**
 * The ESVL team catalog for the active season: every engagement joined to its competition,
 * kept warm so team resolution is a token-free local lookup. Personal fields on the
 * engagement (correspondent email/phone/address) are never requested.
 */
export async function getCatalog(): Promise<Catalog> {
  const season = await getActiveSeason();

  const raw = await directusGet<RawEngagement[]>(
    `/items/ffbbserver_engagements` +
      `?filter[idOrganisme][_eq]=${ESVL.orgId}` +
      `&filter[idCompetition][saison][_eq]=${season.id}` +
      `&fields=id,numeroEquipe,idPoule,idCompetition.id,idCompetition.nom,idCompetition.code,` +
      `idCompetition.sexe,idCompetition.saison,idCompetition.idCompetitionPere` +
      `&limit=200`,
    TTL.catalog,
  );

  const teams: Team[] = (raw ?? [])
    .map(buildTeam)
    .filter((t): t is Team => t !== null)
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));

  return { season, teams, fetchedAt: Date.now() };
}
