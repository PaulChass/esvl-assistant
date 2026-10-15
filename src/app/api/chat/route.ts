import type { NextRequest } from "next/server";
import { agentStep, initialTurns, MAX_STEPS, type HistoryTurn } from "@/lib/agent/run";
import { computeCost } from "@/lib/cost";
import type { Catalog, Team } from "@/lib/ffbb";
import { getProvider, providerAvailable, type LlmToolCall, type LlmTurn, type Vendor } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * One step of the agent loop. FFBB's CDN blocks cloud servers, so the BROWSER fetches the data:
 * it sends the team catalog with the question, runs any tool calls the model asks for against
 * FFBB itself, and posts the results back here as `turns` for the next step.
 * Everything client-supplied is size-bounded and reshaped before it reaches the model.
 */
interface ChatBody {
  message?: string;
  history?: HistoryTurn[];
  catalog?: unknown;
  turns?: unknown;
  step?: number;
  vendor?: Vendor;
}

const MAX_BODY_CHARS = 60_000;

/** Single-line, length-capped string (keeps client text from adding lines to the system prompt). */
const line = (v: unknown, max: number): string =>
  typeof v === "string" ? v.replace(/[\r\n\t]+/g, " ").trim().slice(0, max) : "";
const text = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "");

function parseCatalog(raw: unknown): Catalog | null {
  if (!raw || typeof raw !== "object") return null;
  const c = raw as Record<string, unknown>;
  const season = (c.season ?? {}) as Record<string, unknown>;
  if (!Array.isArray(c.teams)) return null;
  const teams: Team[] = c.teams.slice(0, 60).map((t: Record<string, unknown>) => ({
    engagementId: line(t?.engagementId, 40),
    competitionId: line(t?.competitionId, 40),
    pouleId: line(t?.pouleId, 40),
    label: line(t?.label, 120),
    code: line(t?.code, 40),
    gender: t?.gender === "M" || t?.gender === "F" ? t.gender : "X",
    category: /^(SE|U\d{1,2})$/.test(String(t?.category)) ? String(t.category) : "SE",
    numeroEquipe: line(t?.numeroEquipe, 4),
  }));
  return {
    orgId: line(c.orgId, 15),
    clubName: line(c.clubName, 80) || "le club",
    season: { id: line(season.id, 15), code: line(season.code, 10), label: line(season.label, 40) },
    teams,
    fetchedAt: Number(c.fetchedAt) || Date.now(),
  };
}

function parseToolCalls(v: unknown): LlmToolCall[] {
  if (!Array.isArray(v)) return [];
  return v.slice(0, 8).map((c: Record<string, unknown>) => ({
    id: line(c?.id, 80),
    name: line(c?.name, 40),
    input: c?.input && typeof c.input === "object" ? (c.input as Record<string, unknown>) : {},
    ...(typeof c?.signature === "string" ? { signature: c.signature.slice(0, 8000) } : {}),
  }));
}

function parseTurns(raw: unknown): LlmTurn[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 30) return null;
  const turns: LlmTurn[] = [];
  for (const t of raw as Record<string, unknown>[]) {
    if (t?.role === "user") turns.push({ role: "user", text: text(t.text, 500) });
    else if (t?.role === "assistant")
      turns.push({ role: "assistant", text: text(t.text, 4000), toolCalls: parseToolCalls(t.toolCalls) });
    else if (t?.role === "tool" && Array.isArray(t.results))
      turns.push({
        role: "tool",
        results: t.results.slice(0, 8).map((r: Record<string, unknown>) => ({
          id: line(r?.id, 80),
          name: line(r?.name, 40),
          content: text(r?.content, 12_000),
        })),
      });
    else return null;
  }
  // A continuation must end with the tool results the model asked for.
  return turns.at(-1)?.role === "tool" ? turns : null;
}

export async function POST(req: NextRequest) {
  let body: ChatBody;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_CHARS) return Response.json({ error: "Requête trop volumineuse." }, { status: 413 });
    body = JSON.parse(raw) as ChatBody;
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }

  const vendor: Vendor = body.vendor === "google" ? "google" : "anthropic";
  if (!providerAvailable(vendor)) {
    return Response.json(
      { error: `Le fournisseur « ${vendor} » n'est pas configuré (clé API manquante côté serveur).` },
      { status: 503 },
    );
  }

  const catalog = parseCatalog(body.catalog);
  if (!catalog) return Response.json({ error: "Catalogue d'équipes manquant." }, { status: 400 });

  const step = Math.max(1, Math.min(MAX_STEPS + 1, Math.floor(Number(body.step) || 1)));
  let turns: LlmTurn[];
  if (step === 1) {
    const message = (body.message ?? "").trim();
    if (!message) return Response.json({ error: "Message vide." }, { status: 400 });
    if (message.length > 500) return Response.json({ error: "Message trop long." }, { status: 400 });
    const history: HistoryTurn[] = (body.history ?? [])
      .filter((h): h is HistoryTurn => !!h && (h.role === "user" || h.role === "assistant") && typeof h.text === "string")
      .slice(-8)
      .map((h) => ({ role: h.role, text: h.text.slice(0, h.role === "user" ? 500 : 4000) }));
    turns = initialTurns(history, message);
  } else {
    const parsed = parseTurns(body.turns);
    if (!parsed) return Response.json({ error: "Requête invalide." }, { status: 400 });
    turns = parsed;
  }

  try {
    const provider = getProvider(vendor);
    const res = await agentStep(provider, catalog, turns, step);
    const meta = { model: provider.label, usage: res.usage, cost: computeCost(provider.model, res.usage), step };
    if (res.kind === "answer") return Response.json({ ...meta, answer: res.answer });
    return Response.json({ ...meta, turns: res.turns, toolCalls: res.toolCalls });
  } catch (e) {
    console.error("[chat] agent error:", e);
    return Response.json({ error: "Désolé, une erreur est survenue côté serveur." }, { status: 500 });
  }
}
