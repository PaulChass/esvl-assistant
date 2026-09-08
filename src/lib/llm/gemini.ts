import { GoogleGenAI } from "@google/genai";
import type { Content, FunctionDeclaration, Part, Schema } from "@google/genai";
import type { LlmProvider, LlmRequest, LlmResponse, LlmToolCall, LlmTurn } from "./types";

/** Convert a JSON-Schema-ish object (what our tools declare) to a Gemini Schema. */
function toGeminiSchema(schema: Record<string, unknown>): Schema {
  const out: Record<string, unknown> = {};
  if (typeof schema.type === "string") out.type = schema.type.toUpperCase();
  if (schema.description) out.description = schema.description;
  if (schema.enum) out.enum = schema.enum;
  if (schema.properties && typeof schema.properties === "object") {
    const props: Record<string, Schema> = {};
    for (const [k, v] of Object.entries(schema.properties as Record<string, Record<string, unknown>>)) {
      props[k] = toGeminiSchema(v);
    }
    out.properties = props;
  }
  if (schema.items && typeof schema.items === "object") {
    out.items = toGeminiSchema(schema.items as Record<string, unknown>);
  }
  if (Array.isArray(schema.required)) out.required = schema.required;
  return out as Schema;
}

function toContents(turns: LlmTurn[]): Content[] {
  const contents: Content[] = [];
  for (const turn of turns) {
    if (turn.role === "user") {
      contents.push({ role: "user", parts: [{ text: turn.text }] });
    } else if (turn.role === "assistant") {
      const parts: Part[] = [];
      if (turn.text) parts.push({ text: turn.text });
      for (const c of turn.toolCalls) {
        parts.push({ functionCall: { id: c.id, name: c.name, args: c.input } });
      }
      contents.push({ role: "model", parts });
    } else {
      contents.push({
        role: "user",
        parts: turn.results.map((r): Part => ({
          functionResponse: { id: r.id, name: r.name, response: parseResponse(r.content) },
        })),
      });
    }
  }
  return contents;
}

function parseResponse(content: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(content);
    return typeof parsed === "object" && parsed !== null ? parsed : { result: parsed };
  } catch {
    return { result: content };
  }
}

/** Gemini provider (function calling). Same neutral interface as the Claude provider. */
export function geminiProvider(model: string): LlmProvider {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY;
  const ai = new GoogleGenAI({ apiKey });

  return {
    vendor: "google",
    model,
    label: `Gemini ${model}`,

    async generate(req: LlmRequest): Promise<LlmResponse> {
      const functionDeclarations: FunctionDeclaration[] = req.tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: toGeminiSchema(t.parameters),
      }));

      const systemInstruction = req.systemDynamic
        ? `${req.systemStatic}\n\n${req.systemDynamic}`
        : req.systemStatic;

      const res = await ai.models.generateContent({
        model,
        contents: toContents(req.turns),
        config: {
          systemInstruction,
          maxOutputTokens: req.maxTokens ?? 1024,
          ...(functionDeclarations.length > 0 ? { tools: [{ functionDeclarations }] } : {}),
        },
      });

      const calls = res.functionCalls ?? [];
      const toolCalls: LlmToolCall[] = calls.map((c, i) => ({
        id: c.id ?? `${c.name}-${i}`,
        name: c.name ?? "",
        input: (c.args ?? {}) as Record<string, unknown>,
      }));

      const um = res.usageMetadata;
      // Gemini's promptTokenCount INCLUDES cached tokens; Anthropic's input_tokens excludes
      // them. Normalize to "uncached input" + "cache read" so cost accounting is uniform.
      const cached = um?.cachedContentTokenCount ?? 0;
      return {
        text: res.text ?? "",
        toolCalls,
        usage: {
          inputTokens: Math.max(0, (um?.promptTokenCount ?? 0) - cached),
          outputTokens: um?.candidatesTokenCount ?? 0,
          cacheReadTokens: cached,
          cacheWriteTokens: 0,
        },
        stop: toolCalls.length > 0 ? "tool_use" : "end",
      };
    },
  };
}
