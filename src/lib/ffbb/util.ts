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
