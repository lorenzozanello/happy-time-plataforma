/**
 * Costo estimado por respuesta a partir del uso de tokens (Baseline §8.6: «costo por respuesta
 * medido»). Precios de lista por millón de tokens (USD) tomados de la documentación de Claude API
 * el 2026-10-16; se actualizan por ADR si cambian. Prompts ≤ 100k tokens.
 */
import type { ModelUsage } from "./model";

export interface ModelPrices {
  input: number;
  output: number;
  cacheWrite5m: number;
  cacheWrite1h: number;
  cacheRead: number;
}

export const PRICES: Record<string, ModelPrices> = {
  "claude-sonnet-5-5": { input: 2, output: 10, cacheWrite5m: 2.5, cacheWrite1h: 4, cacheRead: 0.1 },
  "claude-haiku-5-5": {
    input: 0.1,
    output: 0.5,
    cacheWrite5m: 0.125,
    cacheWrite1h: 0.2,
    cacheRead: 0.01,
  },
  "claude-opus-5-5": { input: 4, output: 20, cacheWrite5m: 5, cacheWrite1h: 8, cacheRead: 0.2 },
};

export const PRICES_AS_OF = "2026-10-16";

/** ¿El modelo tiene precio conocido? (El falso no; cualquier otro desconocido se cobra al precio más alto.) */
export const hasKnownPrice = (modelId: string): boolean => modelId in PRICES;

/**
 * Costo en USD. Falla cerrado (revisión F5, M5): un modelo real sin precio en la tabla se estima al
 * precio más alto conocido, para que el tope mensual siga actuando. Solo el modelo falso cuesta 0.
 */
export function estimateCostUsd(modelId: string, u: ModelUsage): number {
  if (modelId === "fake") return 0;
  const p = PRICES[modelId] ?? PRICES["claude-opus-5-5"];
  if (!p) return 0;
  const perTok = (n: number, price: number) => (n * price) / 1_000_000;
  return (
    perTok(u.inputTokens, p.input) +
    perTok(u.outputTokens, p.output) +
    perTok(u.cacheReadTokens, p.cacheRead) +
    perTok(u.cacheWrite5mTokens, p.cacheWrite5m) +
    perTok(u.cacheWrite1hTokens, p.cacheWrite1h)
  );
}

export const round6 = (n: number) => Math.round(n * 1_000_000) / 1_000_000;
