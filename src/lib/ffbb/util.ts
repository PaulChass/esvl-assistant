/** Small pure helpers shared across the FFBB layer. No network, no side effects. */

/** FFBB stores numerics as strings (or number, or null). Coerce safely. */
export function num(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

/** Remove accents and lowercase, for fuzzy French matching. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // strip combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Division tier, lower = higher level (Nationale > Pré-nationale > Régionale > Pré-régionale >
 * Départementale). Works on a competition label or a user query. "pré …" is checked first
 * because "pré régionale" also contains "région".
 */
export function levelTier(text: string): number {
  const l = normalize(text);
  if (/\bpre ?nationa/.test(l)) return 2;
  if (/\bnationa/.test(l)) return 1;
  if (/\bpre ?region/.test(l)) return 4;
  if (/\bregion/.test(l)) return 3;
  if (/\bdepartement/.test(l)) return 5;
  return 6;
}

/** Division number within a tier ("… - Division 3", "Nationale masculine 2", "U13 - 3"); 0 if unnumbered. */
export function divisionNumber(label: string): number {
  const l = normalize(label);
  const m = l.match(/\bdivision (\d)\b/) ?? l.match(/ (\d)$/);
  return m ? Number(m[1]) : 0;
}

/** Loisir (leisure) championships are non-competitive. */
export function isLoisir(label: string): boolean {
  return /\bloisirs?\b/.test(normalize(label));
}

/**
 * Division level rank, lower = higher level: tier first, then division number (Division 2 above
 * Division 3), and loisir below every competitive division. Derived from the competition label
 * so it self-updates on promotion/relegation — never hardcode which team is "équipe 1".
 */
export function levelRank(label: string): number {
  return (isLoisir(label) ? 100 : 0) + levelTier(label) * 10 + divisionNumber(label);
}

const WEEKDAYS = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];
const MONTHS = [
  "janv.", "févr.", "mars", "avr.", "mai", "juin",
  "juill.", "août", "sept.", "oct.", "nov.", "déc.",
];

/**
 * Format a naive FFBB datetime string to a French date label, timezone-stable
 * (we never let the server's UTC clock shift the calendar day).
 */
export function formatFrDate(dateISO: string | null): string | null {
  if (!dateISO) return null;
  const m = dateISO.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const weekday = WEEKDAYS[new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
  return `${weekday} ${d} ${MONTHS[mo - 1]} ${y}`;
}

/** Extract "HH:MM" from a datetime string, or from an HHMM "horaire" string. Null if unset. */
export function formatTime(dateISO: string | null, horaire: string | null): string | null {
  const fromIso = dateISO?.match(/T(\d{2}):(\d{2})/);
  if (fromIso && !(fromIso[1] === "00" && fromIso[2] === "00")) return `${fromIso[1]}:${fromIso[2]}`;
  if (horaire && /^\d{3,4}$/.test(horaire) && horaire !== "0000") {
    const padded = horaire.padStart(4, "0");
    const hh = padded.slice(0, 2);
    const mm = padded.slice(2);
    if (!(hh === "00" && mm === "00")) return `${hh}:${mm}`;
  }
  return null;
}
