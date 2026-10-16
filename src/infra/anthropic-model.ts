/**
 * Adaptador de Claude API al contrato `ModelClient` (ADR-008). Lo usan el servidor (app/_server)
 * y la suite de evaluación (scripts/happy); nunca el navegador.
 *
 * - Salida estructurada: `output_config.format` con el esquema JSON de Happy.
 * - Caché de prompt: cada bloque de `system` marcado con `cache` lleva `cache_control`.
 * - Streaming: se reenvían los `text_delta` tal cual; el pipeline arma los bloques.
 * - Uso: los tokens de entrada y caché vienen en `message_start`; los de salida, acumulados, en
 *   `message_delta`. Se reportan una sola vez cada uno.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { ModelClient, ModelUsage } from "../domain/happy/model";

function inputUsage(u: Anthropic.Messages.Usage | undefined): Partial<ModelUsage> {
  if (!u) return {};
  const creation = u.cache_creation_input_tokens ?? 0;
  const w5 = u.cache_creation?.ephemeral_5m_input_tokens;
  const w1 = u.cache_creation?.ephemeral_1h_input_tokens;
  return {
    inputTokens: u.input_tokens,
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    cacheWrite5mTokens: w5 ?? (w1 === undefined ? creation : 0),
    cacheWrite1hTokens: w1 ?? 0,
  };
}

export function createAnthropicModel(apiKey: string): ModelClient {
  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 60_000 });
  return {
    provider: "anthropic",
    async *stream(req) {
      const stream = client.messages.stream(
        {
          model: req.model,
          max_tokens: req.maxTokens,
          system: req.system.map((b) => ({
            type: "text" as const,
            text: b.text,
            ...(b.cache
              ? {
                  cache_control: {
                    type: "ephemeral" as const,
                    ...(b.cache === "1h" ? { ttl: "1h" as const } : {}),
                  },
                }
              : {}),
          })),
          messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
          output_config: {
            format: { type: "json_schema", schema: req.outputSchema },
            ...(req.effort ? { effort: req.effort } : {}),
          },
          ...(req.thinking === "between_tools"
            ? { thinking: { type: "between_tools" as const } }
            : {}),
        },
        req.signal ? { signal: req.signal } : {},
      );
      let stopReason: string | null = null;
      let outputTokens = 0;
      for await (const ev of stream) {
        if (ev.type === "message_start") {
          yield { type: "start", usage: inputUsage(ev.message.usage) };
        } else if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") {
          yield { type: "text", delta: ev.delta.text };
        } else if (ev.type === "message_delta") {
          stopReason = ev.delta.stop_reason ?? stopReason;
          outputTokens = ev.usage.output_tokens;
        }
      }
      yield { type: "end", stopReason, usage: { outputTokens } };
    },
  };
}
