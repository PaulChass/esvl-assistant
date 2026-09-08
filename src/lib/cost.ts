import type { LlmUsage } from "./llm/types";

/** USD per 1,000,000 tokens. Cached input is billed at the (much cheaper) cacheRead rate. */
export interface Pricing {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
}

/**
 * Prices are per 1M tokens, verified from vendor pricing pages (see docs/architecture.md):
 * - Anthropic Haiku 4.5: $1 / $5, cache read 0.1x ($0.10), cache write 1.25x ($1.25)
 * - Google Gemini 2.5 Flash: $0.30 / $2.50, cached input $0.03
 * - Google Gemini 2.5 Flash-Lite: $0.10 / $0.40, cached input $0.01
 */
export const PRICING: Record<string, Pricing> = {
  "claude-haiku-4-5": { input: 1.0, output: 5.0, cacheRead: 0.1, cacheWrite: 1.25 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5, cacheRead: 0.03, cacheWrite: 0 },
  "gemini-2.5-flash-lite": { input: 0.1, output: 0.4, cacheRead: 0.01, cacheWrite: 0 },
};

export interface CostBreakdown {
  usd: number;
  /** USD per 1,000 equivalent turns — the readable unit for a low-volume club assistant. */
  usdPerThousand: number;
}

export function computeCost(model: string, usage: LlmUsage): CostBreakdown {
  const p = PRICING[model];
  if (!p) return { usd: 0, usdPerThousand: 0 };
  const usd =
    (usage.inputTokens * p.input +
      usage.outputTokens * p.output +
      usage.cacheReadTokens * p.cacheRead +
      usage.cacheWriteTokens * p.cacheWrite) /
    1_000_000;
  return { usd, usdPerThousand: usd * 1000 };
}
