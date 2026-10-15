import { warmCatalog, type Catalog } from "@/lib/ffbb";
import type { LlmProvider, LlmToolCall, LlmToolResult, LlmTurn, LlmUsage } from "@/lib/llm/types";
import { addUsage, zeroUsage } from "@/lib/llm/types";
import { buildSystemDynamic, buildSystemStatic } from "./system";
import { dispatchTool, TOOLS } from "./tools";

export const MAX_STEPS = 5;

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

/** Conversation history + the new question, as provider-neutral turns. */
export function initialTurns(history: HistoryTurn[], userMessage: string): LlmTurn[] {
  const turns: LlmTurn[] = [];
  for (const h of history) {
    if (h.role === "assistant") turns.push({ role: "assistant", text: h.text, toolCalls: [] });
    else turns.push({ role: "user", text: h.text });
  }
  turns.push({ role: "user", text: userMessage });
  return turns;
}

export type AgentStep =
  | { kind: "answer"; answer: string; usage: LlmUsage }
  | { kind: "tools"; turns: LlmTurn[]; toolCalls: LlmToolCall[]; usage: LlmUsage };

/**
 * ONE model call of the agent loop. Either the model answers, or it asks for tools — the
 * caller executes them and calls again with the results appended. Splitting the loop this way
 * lets the tools run wherever the FFBB data is reachable: in the visitor's browser in
 * production (FFBB's CDN blocks cloud servers), or in-process for evals. Past MAX_STEPS the
 * model gets no tools, which forces a final answer.
 */
export async function agentStep(
  provider: LlmProvider,
  catalog: Catalog,
  turns: LlmTurn[],
  step: number,
): Promise<AgentStep> {
  const tools = step <= MAX_STEPS ? TOOLS : [];
  const res = await provider.generate({
    systemStatic: buildSystemStatic(catalog),
    systemDynamic: buildSystemDynamic(),
    tools,
    turns,
    maxTokens: 1024,
  });

  if (res.toolCalls.length === 0 || tools.length === 0) {
    const answer = res.text.trim() || "Désolé, je n'ai pas réussi à répondre. Peux-tu reformuler ?";
    return { kind: "answer", answer, usage: res.usage };
  }
  return {
    kind: "tools",
    turns: [...turns, { role: "assistant", text: res.text, toolCalls: res.toolCalls }],
    toolCalls: res.toolCalls,
    usage: res.usage,
  };
}

/**
 * The provider-agnostic agent loop, run in-process: generate → (if tool calls) execute → feed
 * results → repeat, up to MAX_STEPS, then force a final answer. Used by the evals; the web chat
 * drives the same agentStep from the browser. Works identically for Claude and Gemini.
 */
export async function runAgent(
  provider: LlmProvider,
  history: HistoryTurn[],
  userMessage: string,
  catalog?: Catalog,
): Promise<AgentResult> {
  const cat = catalog ?? (await warmCatalog());
  let turns = initialTurns(history, userMessage);
  let usage = zeroUsage();
  const toolCalls: AgentTrace[] = [];

  for (let step = 1; ; step++) {
    const res = await agentStep(provider, cat, turns, step);
    usage = addUsage(usage, res.usage);
    if (res.kind === "answer") return { answer: res.answer, usage, steps: Math.min(step, MAX_STEPS), toolCalls };

    const results: LlmToolResult[] = [];
    for (const call of res.toolCalls) {
      toolCalls.push({ name: call.name, input: call.input });
      results.push({ id: call.id, name: call.name, content: await dispatchTool(call.name, call.input, cat) });
    }
    turns = [...res.turns, { role: "tool", results }];
  }
}
