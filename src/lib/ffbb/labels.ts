import type { Gender, Team } from "./types";
import { normalize } from "./util";

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

/** One compact catalog line for the (cacheable) system-prompt head. */
export function teamCatalogLine(t: Team): string {
  const g = t.gender === "F" ? "féminin" : t.gender === "M" ? "masculin" : "mixte";
  const cat = t.category === "SE" ? "seniors" : t.category;
  return `- ${t.label} — code ${t.code}, ${cat} ${g}`;
}
