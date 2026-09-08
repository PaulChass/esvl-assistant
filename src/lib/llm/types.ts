/**
 * Provider-agnostic LLM interface.
 *
 * The agent loop (src/lib/agent/run.ts) is written entirely against these types, so the
 * same tool-use loop drives either Claude or Gemini. Each provider translates this neutral
 * shape to/from its own SDK. This is the "I can choose and route between vendors" proof —
 * and it keeps the agent/cost logic unambiguously ours.
 */

export type Vendor = "anthropic" | "google";

export interface LlmToolDef {
  name: string;
  description: string;
  /** JSON Schema object describing the tool input. */
  parameters: Record<string, unknown>;
}

export interface LlmToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface LlmToolResult {
  id: string;
  name: string;
  content: string; // JSON string
}

export type LlmTurn =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; toolCalls: LlmToolCall[] }
  | { role: "tool"; results: LlmToolResult[] };

export interface LlmUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}

export interface LlmRequest {
  /** Stable, cacheable head (instructions + team catalog). Identical across turns. */
  systemStatic: string;
  /** Volatile tail (e.g. today's date). Never cached. */
  systemDynamic?: string;
  tools: LlmToolDef[];
  turns: LlmTurn[];
  maxTokens?: number;
}

export interface LlmResponse {
  text: string;
  toolCalls: LlmToolCall[];
  usage: LlmUsage;
  stop: "end" | "tool_use" | "max_tokens" | "other";
}

export interface LlmProvider {
  vendor: Vendor;
  model: string;
  label: string;
  generate(req: LlmRequest): Promise<LlmResponse>;
}

export const zeroUsage = (): LlmUsage => ({
  inputTokens: 0,
  outputTokens: 0,
  cacheReadTokens: 0,
  cacheWriteTokens: 0,
});

export function addUsage(a: LlmUsage, b: LlmUsage): LlmUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  };
}
