/**
 * Composer con la API de Claude (recomendación del Baseline para OD-2). Streaming de texto y
 * caché de prompt sobre la parte estable (prompt de sistema + Observaciones).
 * La clave vive solo en el servidor (variable de entorno); nunca llega al navegador.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { ComposeInput, Composer, Usage } from "./composer";

export interface AnthropicComposerOptions {
  apiKey: string;
  model: string;
  maxTokens?: number;
  /** Solo para pruebas: servidor simulado. */
  baseURL?: string;
  timeoutMs?: number;
}

export function createAnthropicComposer(opts: AnthropicComposerOptions): Composer {
  const client = new Anthropic({
    apiKey: opts.apiKey,
    ...(opts.baseURL ? { baseURL: opts.baseURL } : {}),
    timeout: opts.timeoutMs ?? 45_000,
    maxRetries: 1,
  });
  return {
    model: opts.model,
    async *compose(input: ComposeInput, { signal, onUsage }) {
      const stream = client.messages.stream(
        {
          model: opts.model,
          max_tokens: opts.maxTokens ?? 1800,
          system: [{ type: "text", text: input.system, cache_control: { type: "ephemeral" } }],
          messages: [{ role: "user", content: input.user }],
        },
        signal ? { signal } : {},
      );
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta")
          yield event.delta.text;
      }
      const final = await stream.finalMessage();
      const u = final.usage;
      const usage: Usage = {
        inputTokens: u.input_tokens,
        outputTokens: u.output_tokens,
        cacheReadTokens: u.cache_read_input_tokens ?? 0,
        cacheWriteTokens: u.cache_creation_input_tokens ?? 0,
      };
      onUsage?.(usage);
    },
  };
}
