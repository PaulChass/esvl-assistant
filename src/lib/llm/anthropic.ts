import Anthropic from "@anthropic-ai/sdk";
import type { LlmProvider, LlmRequest, LlmResponse, LlmToolCall, LlmTurn } from "./types";

function toMessages(turns: LlmTurn[]): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = [];
  for (const turn of turns) {
    if (turn.role === "user") {
      messages.push({ role: "user", content: turn.text });
    } else if (turn.role === "assistant") {
      const content: Anthropic.ContentBlockParam[] = [];
      if (turn.text) content.push({ type: "text", text: turn.text });
      for (const c of turn.toolCalls) {
        content.push({ type: "tool_use", id: c.id, name: c.name, input: c.input });
      }
      messages.push({ role: "assistant", content });
    } else {
      messages.push({
        role: "user",
        content: turn.results.map((r) => ({
          type: "tool_result" as const,
          tool_use_id: r.id,
          content: r.content,
        })),
      });
    }
  }
  return messages;
}

/** Claude provider with prompt caching on the static system head. */
export function anthropicProvider(model: string): LlmProvider {
  const client = new Anthropic(); // reads ANTHROPIC_API_KEY (or an `ant auth login` profile)

  return {
    vendor: "anthropic",
    model,
    label: `Claude ${model}`,

    async generate(req: LlmRequest): Promise<LlmResponse> {
      const system: Anthropic.TextBlockParam[] = [
        { type: "text", text: req.systemStatic, cache_control: { type: "ephemeral" } },
      ];
      if (req.systemDynamic) system.push({ type: "text", text: req.systemDynamic });

      const tools: Anthropic.Tool[] = req.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters as Anthropic.Tool.InputSchema,
      }));

      const params: Anthropic.MessageCreateParamsNonStreaming = {
        model,
        max_tokens: req.maxTokens ?? 1024,
        system,
        messages: toMessages(req.turns),
      };
      if (tools.length > 0) params.tools = tools;

      const res = await client.messages.create(params);

      let text = "";
      const toolCalls: LlmToolCall[] = [];
      for (const block of res.content) {
        if (block.type === "text") text += block.text;
        else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id,
            name: block.name,
            input: (block.input ?? {}) as Record<string, unknown>,
          });
        }
      }

      const u = res.usage;
      return {
        text,
        toolCalls,
        usage: {
          inputTokens: u.input_tokens ?? 0,
          outputTokens: u.output_tokens ?? 0,
          cacheReadTokens: u.cache_read_input_tokens ?? 0,
          cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
        },
        stop:
          res.stop_reason === "tool_use"
            ? "tool_use"
            : res.stop_reason === "max_tokens"
              ? "max_tokens"
              : res.stop_reason === "end_turn"
                ? "end"
                : "other",
      };
    },
  };
}
