import type { AgentResult } from "@/lib/agent/run";

export interface EvalCase {
  id: string;
  question: string;
  /** Behavioural grader — checks tool routing / answer shape, not exact text (data is live). */
  check: (r: AgentResult) => { pass: boolean; reason: string };
}

const usedTool = (r: AgentResult, name: string) => r.toolCalls.some((c) => c.name === name);
const answerHas = (r: AgentResult, ...subs: string[]) => {
  const a = r.answer.toLowerCase();
  return subs.some((s) => a.includes(s));
};

/**
 * A small behavioural eval set. Answers depend on live FFBB data, so we grade the agent's
 * behaviour (did it route to the right tool? did it disambiguate? did it refuse to invent?)
 * rather than exact strings.
 */
export const CASES: EvalCase[] = [
  {
    id: "schedule-team1",
    question: "Quand joue l'équipe 1 ?",
    check: (r) => ({ pass: usedTool(r, "get_schedule") && r.answer.length > 0, reason: "route → get_schedule" }),
  },
  {
    id: "club-next",
    question: "Quels sont les prochains matchs du club ?",
    check: (r) => ({ pass: usedTool(r, "get_schedule"), reason: "route → get_schedule (club)" }),
  },
  {
    id: "standing-ambiguous",
    question: "Classement des seniors ?",
    check: (r) => {
      // "seniors" is ambiguous (Régionale 3 vs Pré-régionale) → disambiguate OR fetch one.
      const pass = usedTool(r, "get_standing") || answerHas(r, "laquelle", "préc", "pré régionale", "régionale", "?");
      return { pass, reason: pass ? "disambiguated or fetched" : "neither" };
    },
  },
  {
    id: "standing-u18",
    question: "L'U18 est classé combien ?",
    check: (r) => ({ pass: usedTool(r, "get_standing"), reason: "route → get_standing" }),
  },
  {
    id: "no-feminine",
    question: "Y a-t-il une équipe féminine cette saison ?",
    check: (r) => {
      const pass = answerHas(r, "pas", "aucune", "non") && answerHas(r, "fémin", "femin");
      return { pass, reason: pass ? "correctly reports no féminine team" : "did not clearly say no" };
    },
  },
  {
    id: "list-teams",
    question: "Quelles équipes as-tu ?",
    check: (r) => ({
      pass: usedTool(r, "list_teams") || answerHas(r, "régionale", "pré", "u18", "u21"),
      reason: "listed the teams",
    }),
  },
  {
    id: "results",
    question: "Résultats du week-end ?",
    check: (r) => ({ pass: usedTool(r, "get_results"), reason: "route → get_results" }),
  },
  {
    id: "venue",
    question: "Où joue l'U21 au prochain match ?",
    check: (r) => ({ pass: usedTool(r, "get_schedule"), reason: "route → get_schedule (venue)" }),
  },
];
