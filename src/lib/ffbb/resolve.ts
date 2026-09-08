import type { Gender, Team } from "./types";
import { normalize } from "./util";

export type ResolveResult =
  | { kind: "match"; team: Team }
  | { kind: "ambiguous"; candidates: Team[] }
  | { kind: "none" };

interface Intent {
  gender?: Gender;
  category?: string; // "SE" | "U9".."U21"
  codes: string[];
  levelWords: string[];
  teamNumber?: number;
}

const CATEGORY_NICKNAMES: Record<string, string> = {
  poussins: "U11",
  benjamins: "U13",
  benjamines: "U13",
  minimes: "U15",
  cadets: "U17",
  cadettes: "U17",
  juniors: "U20",
  espoirs: "U21",
};

/** Parse a fuzzy French team query into a matching intent. */
function parseIntent(query: string, teams: Team[]): Intent {
  const q = normalize(query);
  const intent: Intent = { codes: [], levelWords: [] };

  // explicit competition codes present in the query (strongest signal)
  for (const t of teams) {
    if (q.includes(normalize(t.code))) intent.codes.push(t.code);
  }

  // gender
  if (/\b(feminin|feminine|feminines|filles?|dames?|nanas?)\b/.test(q)) intent.gender = "F";
  else if (/\b(masculin|masculine|garcons?|gars|hommes?|mecs?)\b/.test(q)) intent.gender = "M";

  // category
  const u = q.match(/\bu\s?(\d{1,2})\b/);
  if (u) intent.category = `U${u[1]}`;
  else if (/\b(seniors?|sen|adultes?)\b/.test(q)) intent.category = "SE";
  else {
    for (const [word, cat] of Object.entries(CATEGORY_NICKNAMES)) {
      if (q.includes(word)) {
        intent.category = cat;
        break;
      }
    }
  }

  // level words
  if (/\bpre\s?regional/.test(q)) intent.levelWords.push("pre-regional");
  else if (/\bregional/.test(q)) intent.levelWords.push("regional");
  if (/\bdepartemental/.test(q)) intent.levelWords.push("departemental");
  if (/\bnational/.test(q)) intent.levelWords.push("national");

  // "équipe 1 / 2", "première / deuxième"
  const numMatch = q.match(/\bequipe\s?(\d)\b/) || q.match(/\bnumero\s?(\d)\b/);
  if (numMatch) intent.teamNumber = Number(numMatch[1]);
  else if (/\bpremiere?\b|\b1ere?\b/.test(q)) intent.teamNumber = 1;
  else if (/\bdeuxieme\b|\bseconde?\b|\b2eme?\b/.test(q)) intent.teamNumber = 2;

  // "équipe 1/2" with no other signal conventionally means the seniors teams,
  // ranked by division level.
  if (intent.teamNumber && !intent.category && !intent.codes.length) intent.category = "SE";

  return intent;
}

/** Lower = higher division. Used to order same-category teams ("équipe 1" = top level). */
function levelRank(label: string): number {
  const l = normalize(label);
  if (l.includes("national")) return 1;
  if (l.includes("pre regional")) return 3;
  if (l.includes("regional")) return 2;
  if (l.includes("departemental")) return 4;
  return 5;
}

function score(team: Team, intent: Intent): number {
  let s = 0;
  const label = normalize(team.label);

  if (intent.codes.includes(team.code)) s += 100;

  if (intent.gender) {
    if (team.gender === intent.gender) s += 12;
    else if (team.gender !== "X") s -= 60;
  }

  if (intent.category) {
    if (team.category === intent.category) s += 25;
    else s -= 40;
  }

  for (const w of intent.levelWords) {
    if (label.includes(w.replace("-", " "))) s += 15;
  }

  return s;
}

/**
 * Resolve a fuzzy French team name against the catalog — entirely in code (no network,
 * no LLM tokens). Returns a single match, a short candidate list to disambiguate, or none.
 */
export function resolveTeam(query: string, teams: Team[]): ResolveResult {
  if (teams.length === 0) return { kind: "none" };
  const intent = parseIntent(query, teams);

  const scored = teams
    .map((team) => ({ team, s: score(team, intent) }))
    .sort((a, b) => b.s - a.s);

  const best = scored[0];
  if (best.s <= 0) return { kind: "none" };

  const topTie = scored.filter((x) => x.s === best.s);

  // "équipe N": among the tied top teams, order by division and pick the Nth.
  if (topTie.length > 1 && intent.teamNumber) {
    const ordered = [...topTie].sort((a, b) => levelRank(a.team.label) - levelRank(b.team.label));
    const pick = ordered[intent.teamNumber - 1];
    if (pick) return { kind: "match", team: pick.team };
  }

  if (topTie.length === 1 && best.s - (scored[1]?.s ?? -Infinity) >= 10) {
    return { kind: "match", team: best.team };
  }
  if (topTie.length === 1) return { kind: "match", team: best.team };

  return { kind: "ambiguous", candidates: topTie.map((x) => x.team) };
}
