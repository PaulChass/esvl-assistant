import { MODEL_DEFAULTS } from "@/config";
import { anthropicProvider } from "./anthropic";
import { geminiProvider } from "./gemini";
import type { LlmProvider, Vendor } from "./types";

export * from "./types";

/** Resolve a provider from a vendor + optional model override. Defaults from env/config. */
export function getProvider(vendor?: Vendor, model?: string): LlmProvider {
  const v = vendor ?? MODEL_DEFAULTS.vendor;
  if (v === "google") return geminiProvider(model ?? MODEL_DEFAULTS.google);
  return anthropicProvider(model ?? MODEL_DEFAULTS.anthropic);
}

export function providerAvailable(vendor: Vendor): boolean {
  if (vendor === "google") return !!(process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY);
  return !!process.env.ANTHROPIC_API_KEY;
}
