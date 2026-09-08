import type { NextRequest } from "next/server";
import { runAgent, type HistoryTurn } from "@/lib/agent/run";
import { computeCost } from "@/lib/cost";
import { getProvider, providerAvailable, type Vendor } from "@/lib/llm";

export const runtime = "nodejs";
export const maxDuration = 30;

interface ChatBody {
  message?: string;
  history?: HistoryTurn[];
  vendor?: Vendor;
}

export async function POST(req: NextRequest) {
  let body: ChatBody;
  try {
    body = (await req.json()) as ChatBody;
  } catch {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }

  const message = (body.message ?? "").trim();
  if (!message) return Response.json({ error: "Message vide." }, { status: 400 });
  if (message.length > 500) return Response.json({ error: "Message trop long." }, { status: 400 });

  const vendor: Vendor = body.vendor === "google" ? "google" : "anthropic";
  if (!providerAvailable(vendor)) {
    return Response.json(
      { error: `Le fournisseur « ${vendor} » n'est pas configuré (clé API manquante côté serveur).` },
      { status: 503 },
    );
  }

  const history: HistoryTurn[] = (body.history ?? [])
    .filter((h): h is HistoryTurn => !!h && (h.role === "user" || h.role === "assistant") && typeof h.text === "string")
    .slice(-8);

  try {
    const provider = getProvider(vendor);
    const result = await runAgent(provider, history, message);
    return Response.json({
      answer: result.answer,
      model: provider.label,
      usage: result.usage,
      cost: computeCost(provider.model, result.usage),
      toolCalls: result.toolCalls,
      steps: result.steps,
    });
  } catch (e) {
    console.error("[chat] agent error:", e);
    return Response.json({ error: "Désolé, une erreur est survenue côté serveur." }, { status: 500 });
  }
}
