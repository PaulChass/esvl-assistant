import { getResults, getSchedule, getStanding, listTeams, type Catalog } from "@/lib/ffbb";
import type { LlmToolDef } from "@/lib/llm/types";

/** The agent's tool surface. Kept deliberately small — four read-only FFBB tools. */
export const TOOLS: LlmToolDef[] = [
  {
    name: "list_teams",
    description:
      "Liste les équipes de l'ESVL engagées cette saison (nom + code). Utile pour lever une ambiguïté ou répondre « quelles équipes ? ».",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_schedule",
    description:
      "Prochains matchs d'une équipe : date, heure, gymnase, adversaire, domicile/extérieur. " +
      "Renseigne `team` en langage naturel (« les seniors », « U18 », « équipe 1 »). " +
      "Laisse `team` vide (ou « club ») pour les prochains matchs de TOUT le club.",
    parameters: {
      type: "object",
      properties: {
        team: { type: "string", description: "Nom d'équipe en langage naturel, ou vide pour tout le club." },
        limit: { type: "integer", description: "Nombre de matchs à renvoyer (défaut 3, max 6)." },
      },
    },
  },
  {
    name: "get_results",
    description:
      "Derniers résultats (scores). Renseigne `team` en langage naturel, ou laisse vide (« club ») pour tout le club.",
    parameters: {
      type: "object",
      properties: {
        team: { type: "string", description: "Nom d'équipe, ou vide pour tout le club." },
        limit: { type: "integer", description: "Nombre de résultats (défaut 5, max 8)." },
      },
    },
  },
  {
    name: "get_standing",
    description: "Classement de la poule d'une équipe. Nécessite une équipe précise.",
    parameters: {
      type: "object",
      properties: {
        team: { type: "string", description: "Nom d'équipe en langage naturel (obligatoire)." },
      },
      required: ["team"],
    },
  },
];

const CLUB_WORDS = new Set(["club", "le club", "tout le club", "tous", "toutes", "toute", "les equipes", "esvl"]);

function cleanTeam(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  if (CLUB_WORDS.has(s.toLowerCase())) return null;
  return s;
}

function clampLimit(v: unknown, def: number, max: number): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  if (!Number.isFinite(n)) return def;
  return Math.max(1, Math.min(max, Math.floor(n)));
}

/** Execute a tool call against the FFBB layer, returning a JSON string for the model. */
export async function dispatchTool(
  name: string,
  input: Record<string, unknown>,
  catalog: Catalog,
): Promise<string> {
  try {
    switch (name) {
      case "list_teams":
        return JSON.stringify(listTeams(catalog));
      case "get_schedule":
        return JSON.stringify(await getSchedule(catalog, cleanTeam(input.team), clampLimit(input.limit, 3, 6)));
      case "get_results":
        return JSON.stringify(await getResults(catalog, cleanTeam(input.team), clampLimit(input.limit, 5, 8)));
      case "get_standing":
        return JSON.stringify(await getStanding(catalog, String(input.team ?? "")));
      default:
        return JSON.stringify({ error: `Outil inconnu: ${name}` });
    }
  } catch (e) {
    return JSON.stringify({ error: `Erreur de l'outil ${name}: ${(e as Error).message}` });
  }
}
