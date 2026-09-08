import { warmCatalog, type Catalog } from "@/lib/ffbb";
import type { LlmProvider, LlmToolResult, LlmTurn, LlmUsage } from "@/lib/llm/types";
import { addUsage, zeroUsage } from "@/lib/llm/types";
import { buildSystemDynamic, buildSystemStatic } from "./system";
import { dispatchTool, TOOLS } from "./tools";

const MAX_STEPS = 5;

export interface HistoryTurn {
  role: "user" | "assistant";
  text: string;
}

export interface AgentTrace {
  name: string;
  input: Record<string, unknown>;
}

export interface AgentResult {
  answer: string;
  usage: LlmUsage;
  steps: number;
  toolCalls: AgentTrace[];
}

/**
 * The provider-agnostic agent loop: generate → (if tool calls) execute → feed results → repeat,
 * up to MAX_STEPS, then force a final answer. Works identically for Claude and Gemini.
 */
export async function runAgent(
  provider: LlmProvider,
  history: HistoryTurn[],
  userMessage: string,
  catalog?: Catalog,
): Promise<AgentResult> {
  const cat = catalog ?? (await warmCatalog());
  const systemStatic = buildSystemStatic(cat);
  const systemDynamic = buildSystemDynamic();

  const turns: LlmTurn[] = [];
  for (const h of history) {
    if (h.role === "assistant") turns.push({ role: "assistant", text: h.text, toolCalls: [] });
    else turns.push({ role: "user", text: h.text });
  }
  turns.push({ role: "user", text: userMessage });

  let usage = zeroUsage();
  const toolCalls: AgentTrace[] = [];

  for (let step = 1; step <= MAX_STEPS; step++) {
    const res = await provider.generate({ systemStatic, systemDynamic, tools: TOOLS, turns, maxTokens: 1024 });
    usage = addUsage(usage, res.usage);

    if (res.toolCalls.length === 0) {
      return { answer: res.text.trim(), usage, steps: step, toolCalls };
    }

    turns.push({ role: "assistant", text: res.text, toolCalls: res.toolCalls });

    const results: LlmToolResult[] = [];
    for (const call of res.toolCalls) {
      toolCalls.push({ name: call.name, input: call.input });
      const content = await dispatchTool(call.name, call.input, cat);
      results.push({ id: call.id, name: call.name, content });
    }
    turns.push({ role: "tool", results });
  }

  // Hit the step cap — one more turn with no tools to force a final answer.
  const final = await provider.generate({ systemStatic, systemDynamic, tools: [], turns, maxTokens: 1024 });
  usage = addUsage(usage, final.usage);
  return {
    answer: final.text.trim() || "Désolé, je n'ai pas réussi à répondre. Peux-tu reformuler ?",
    usage,
    steps: MAX_STEPS,
    toolCalls,
  };
}
