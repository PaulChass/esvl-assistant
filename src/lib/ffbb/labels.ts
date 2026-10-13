import type { Gender, Team } from "./types";
import { levelRank, normalize } from "./util";

interface RawCompetition {
  id: string;
  nom: string;
  code: string;
  sexe: string;
  saison: string;
  idCompetitionPere: string | null;
}

interface RawEngagement {
  id: string;
  numeroEquipe: string;
  idPoule: string;
  nom?: string | null; // club display name (same across a club's engagements)
  idCompetition: RawCompetition | null;
}

/** Derive the age category ("SE" or "U9".."U21") from the competition code/label. */
function deriveCategory(code: string, label: string): string {
  const hay = `${code} ${label}`;
  const m = hay.match(/U\s?(\d{1,2})/i);
  if (m) return `U${m[1]}`;
  return "SE"; // seniors
}

function deriveGender(sexe: string, code: string, label: string): Gender {
  const s = (sexe || "").toUpperCase();
  if (s === "M" || s === "F") return s;
  const hay = normalize(`${code} ${label}`);
  if (/\bfeminin|\bfemini|\bfilles?\b|\bdames?\b|\bf\b/.test(hay)) return "F";
  if (/\bmasculin|\bgarcons?\b|\bm\b/.test(hay)) return "M";
  return "X";
}

/** Build a clean domain Team from a raw engagement, dropping all personal fields. */
export function buildTeam(e: RawEngagement): Team | null {
  const c = e.idCompetition;
  if (!c || !e.idPoule) return null;
  return {
    engagementId: e.id,
    competitionId: c.id,
    pouleId: e.idPoule,
    label: c.nom,
    code: c.code,
    gender: deriveGender(c.sexe, c.code, c.nom),
    category: deriveCategory(c.code, c.nom),
    numeroEquipe: e.numeroEquipe ?? "",
  };
}

export type { RawEngagement };

/**
 * "Équipe N" numbering of senior (SE) teams, per gender, by division level (via levelRank):
 * engagementId → 1 (fanion), 2, … DERIVED from the live division hierarchy, never hardcoded →
 * self-updates on promotion/relegation. Shared by the catalog lines and the resolver so the
 * prompt and the tools always agree on which team is "l'équipe 3".
 */
export function seniorTeamNumbers(teams: Team[]): Map<string, number> {
  const numbers = new Map<string, number>();
  const seniorsByGender = new Map<Gender, Team[]>();
  for (const t of teams) {
    if (t.category !== "SE") continue;
    const arr = seniorsByGender.get(t.gender) ?? [];
    arr.push(t);
    seniorsByGender.set(t.gender, arr);
  }
  for (const arr of seniorsByGender.values()) {
    arr.sort((a, b) => levelRank(a.label) - levelRank(b.label));
    arr.forEach((t, i) => numbers.set(t.engagementId, i + 1));
  }
  return numbers;
}

/**
 * Compact catalog lines for the (cacheable) system-prompt head, with the derived
 * "équipe 1 (fanion) / équipe 2…" labels so the model knows which senior team is which and
 * stops guessing.
 */
export function buildCatalogLines(teams: Team[]): string[] {
  const rankByEngagement = seniorTeamNumbers(teams);

  return teams.map((t) => {
    const g = t.gender === "F" ? "féminin" : t.gender === "M" ? "masculin" : "mixte";
    const cat = t.category === "SE" ? "seniors" : t.category;
    const n = rankByEngagement.get(t.engagementId);
    const rank = n ? ` · équipe ${n}${n === 1 ? " (équipe fanion)" : ""}` : "";
    return `- ${t.label} — code ${t.code}, ${cat} ${g}${rank}`;
  });
}
