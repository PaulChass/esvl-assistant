import type { Catalog } from "@/lib/ffbb";
import { nextMatchForTeam, standingForTeam, teamFormInPoule } from "@/lib/ffbb";
import { fixtureMessage, formLine, homeAwayLabel, mapsUrl } from "./format";

export interface WeekendFixture {
  team: string;
  code: string;
  dateISO: string | null;
  homeAway: "domicile" | "extérieur";
  opponent: string;
  dateLabel: string | null;
  timeLabel: string | null;
  venue: string | null;
  venueCity: string | null;
  mapsUrl: string | null;
  clubRank: number | null;
  opponentRank: number | null;
  opponentForm: string | null;
  thisWeekend: boolean;
  /** The ready-to-share WhatsApp message for this fixture (item ①). */
  message: string;
  sourceUrl: string | null;
}

export interface Weekend {
  orgId: string;
  club: string;
  season: string;
  fixtures: WeekendFixture[];
}

function withinDays(dateISO: string | null, days: number, now: Date): boolean {
  const m = dateISO?.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return false;
  const day = Date.UTC(+m[1], +m[2] - 1, +m[3]);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const diff = (day - today) / 86_400_000;
  return diff >= -1 && diff <= days;
}

/**
 * Item ① + ①bis source data: for each team, its next fixture with both standings and a
 * short opponent-form line, plus a ready-to-paste WhatsApp message. One row per team.
 */
export async function buildWeekend(catalog: Catalog, now: Date = new Date()): Promise<Weekend> {
  const fixtures = (
    await Promise.all(
      catalog.teams.map(async (team): Promise<WeekendFixture | null> => {
        const match = await nextMatchForTeam(catalog, team);
        if (!match) return null;

        const [standing, oppForm] = await Promise.all([
          standingForTeam(catalog, team),
          teamFormInPoule(team.pouleId, match.opponentOrgId),
        ]);
        const clubRank = standing.esvlRank;
        const opponentRank = standing.rows.find((r) => r.orgId === match.opponentOrgId)?.rank ?? null;
        const opponentForm = formLine(oppForm);

        return {
          team: team.label,
          code: team.code,
          dateISO: match.dateISO,
          homeAway: homeAwayLabel(match.home),
          opponent: match.opponent,
          dateLabel: match.dateLabel,
          timeLabel: match.timeLabel,
          venue: match.venue,
          venueCity: match.venueCity,
          mapsUrl: mapsUrl(match.venue, match.venueCity),
          clubRank,
          opponentRank,
          opponentForm,
          thisWeekend: withinDays(match.dateISO, 7, now),
          message: fixtureMessage({ clubTeam: team.label, match, clubRank, opponentRank, opponentForm }),
          sourceUrl: match.sourceUrl,
        };
      }),
    )
  ).filter((f): f is WeekendFixture => f !== null);

  fixtures.sort((a, b) => (a.dateISO ?? "").localeCompare(b.dateISO ?? ""));
  return { orgId: catalog.orgId, club: catalog.clubName, season: catalog.season.label, fixtures };
}
