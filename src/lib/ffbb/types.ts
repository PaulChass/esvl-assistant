/** Domain types for the FFBB data layer. These are the ONLY shapes the agent/tools see —
 *  raw Directus objects (which include personal contact data on engagements) never leak out. */

export type Gender = "M" | "F" | "X";

export interface Season {
  id: string;
  code: string; // "26-27"
  label: string; // "Saison 2026-2027"
}

export interface Team {
  engagementId: string;
  competitionId: string;
  pouleId: string;
  /** Full FFBB competition label, e.g. "Régionale masculine U18 - Division 2". */
  label: string;
  /** FFBB competition code, e.g. "RM3", "RMU18-2", "PRM". */
  code: string;
  gender: Gender;
  /** Age category token: "SE" (seniors) or "U9".."U21". */
  category: string;
  numeroEquipe: string;
}

export interface Catalog {
  orgId: string;
  clubName: string;
  season: Season;
  teams: Team[];
  fetchedAt: number;
}

export interface Match {
  id: string;
  /** Naive local ISO ("2026-09-20T15:00:00") or null if unscheduled. */
  dateISO: string | null;
  /** French date, e.g. "sam. 20 sept. 2026". */
  dateLabel: string | null;
  /** "15:00" or null when the time is not set yet. */
  timeLabel: string | null;
  played: boolean;
  postponed: boolean;
  round: string | null;
  team: string; // which club team (competition label)
  opponent: string;
  opponentOrgId: string;
  home: boolean;
  venue: string | null;
  venueCity: string | null;
  score: { esvl: number; opponent: number } | null;
  outcome: "W" | "L" | "D" | null;
  forfeit: boolean;
  sourceUrl: string | null;
}

export interface StandingRow {
  rank: number;
  orgId: string;
  team: string;
  played: number;
  won: number;
  lost: number;
  points: number;
  diff: number;
  isEsvl: boolean;
}

export interface Standing {
  team: string; // ESVL team label
  poule: string; // "Poule B"
  rows: StandingRow[];
  esvlRank: number | null;
  sourceUrl: string | null;
}
