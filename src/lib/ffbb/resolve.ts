import { seniorTeamNumbers } from "./labels";
import type { Gender, Team } from "./types";
import { divisionNumber, isLoisir, levelRank, levelTier, normalize } from "./util";

export type ResolveResult =
  | { kind: "match"; team: Team }
  | { kind: "ambiguous"; candidates: Team[] }
  | { kind: "none" };

interface Intent {
  gender?: Gender;
  category?: string; // "SE" | "U9".."U21"
  codes: string[];
  tier?: number; // levelTier: 1 Nationale … 5 Départementale
  division?: number;
  loisir?: boolean;
  teamNumber?: number;
}

/** FFBB shorthand tier prefixes: "DM3" = Départementale Masculine division 3, "PRF" = Pré-régionale Féminine… */
const ABBR_TIERS: Record<string, number> = { n: 1, pn: 2, r: 3, pr: 4, d: 5 };

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
  const intent: Intent = { codes: [] };

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

  // level: FFBB shorthand ("dm", "rf 2", "prm") or words ("régionale", "pré-région")
  const abbr = q.match(/\b(pn|pr|n|r|d)([mf])\s?(\d)?\b/);
  if (abbr) {
    intent.tier = ABBR_TIERS[abbr[1]];
    intent.gender ??= abbr[2] === "f" ? "F" : "M";
    if (abbr[3]) intent.division = Number(abbr[3]);
  } else {
    const tier = levelTier(q);
    if (tier < 6) intent.tier = tier;
  }
  const div = q.match(/\bdivision\s?(\d)\b/);
  if (div) intent.division = Number(div[1]);
  if (/\bloisirs?\b/.test(q)) intent.loisir = true;

  // "équipe 1 / 2", "première / deuxième"
  const numMatch = q.match(/\bequipe\s?(\d)\b/) || q.match(/\bnumero\s?(\d)\b/);
  if (numMatch) intent.teamNumber = Number(numMatch[1]);
  else if (/\bpremiere?\b|\b1ere?\b/.test(q)) intent.teamNumber = 1;
  else if (/\bdeuxieme\b|\bseconde?\b|\b2eme?\b/.test(q)) intent.teamNumber = 2;

  // "équipe 1/2", "la DM", "la régionale" with no age category conventionally mean the
  // seniors teams — youth teams are named by their category ("les U18").
  if ((intent.teamNumber || intent.tier) && !intent.category && !intent.codes.length) intent.category = "SE";

  return intent;
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

  if (intent.tier && levelTier(team.label) === intent.tier) s += 15;

  if (intent.division) {
    const d = divisionNumber(team.label);
    if (d === intent.division) s += 10;
    else if (d) s -= 10;
  }

  if (intent.loisir) s += isLoisir(team.label) ? 30 : -30;

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

  // "équipe N" = the senior team numbered N within its gender — the same derived numbering the
  // catalog shows the model. Without a gender, "équipe 1" can hit both the men's and women's
  // first teams: take the higher division (the club's fanion).
  if (intent.teamNumber) {
    const numbers = seniorTeamNumbers(teams);
    const numbered = topTie.filter((x) => numbers.has(x.team.engagementId));
    if (numbered.length) {
      const hits = numbered
        .filter((x) => numbers.get(x.team.engagementId) === intent.teamNumber)
        .sort((a, b) => levelRank(a.team.label) - levelRank(b.team.label));
      return hits.length ? { kind: "match", team: hits[0].team } : { kind: "none" };
    }
  }

  if (topTie.length === 1 && best.s - (scored[1]?.s ?? -Infinity) >= 10) {
    return { kind: "match", team: best.team };
  }
  if (topTie.length === 1) return { kind: "match", team: best.team };

  return { kind: "ambiguous", candidates: topTie.map((x) => x.team) };
}
