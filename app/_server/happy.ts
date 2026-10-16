/**
 * Cableado de Happy en el servidor (F5): configuración por variables de entorno, repositorio e
 * índice en memoria, cliente de modelo (Claude API o falso) y límites de uso por instancia.
 * Ningún secreto sale de aquí; el cliente solo recibe el estado (`enabled`, `needsCode`).
 */
import "server-only";
import { curriculumWindows } from "../../src/domain/curriculum/fingerprint";
import { buildSearchIndex, type SearchIndex } from "../../src/domain/curriculum/search";
import { DEFAULT_LIMITS, UsageLimits, type LimitsConfig } from "../../src/domain/happy/limits";
import { createFakeModel, type ModelClient } from "../../src/domain/happy/model";
import { runHappy, type HappyEvent, type PipelineInput } from "../../src/domain/happy/pipeline";
import type { ComposeOptions } from "../../src/domain/happy/prompt";
import { createAnthropicModel } from "./anthropic-model";
import { getRepository } from "./curriculum";

export type HappyProvider = "anthropic" | "fake" | "off";

export interface HappyConfig {
  provider: HappyProvider;
  modelId: string;
  effort: "low" | "medium" | "high";
  thinking: "adaptive" | "between_tools";
  maxTokens: number;
  /** Código del piloto; sin él, en producción Happy queda deshabilitada (F5-10). */
  accessCode: string | undefined;
  limits: LimitsConfig;
  fake: { firstChunkDelayMs: number; chunkDelayMs: number };
}

const int = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : d;
};
const oneOf = <T extends string>(v: string | undefined, allowed: readonly T[], d: T): T =>
  (allowed as readonly string[]).includes(v ?? "") ? (v as T) : d;

export function readConfig(env: NodeJS.ProcessEnv = process.env): HappyConfig {
  const hasKey = Boolean(env.ANTHROPIC_API_KEY);
  const requested = oneOf(
    env.HAPPY_MODEL,
    ["anthropic", "fake", "off"] as const,
    hasKey ? "anthropic" : "off",
  );
  const provider: HappyProvider = requested === "anthropic" && !hasKey ? "off" : requested;
  const accessCode = env.HAPPY_ACCESS_CODE?.trim() || undefined;
  return {
    // En producción, Happy real exige código de acceso (sin autenticación hasta F4).
    provider: provider !== "off" && !accessCode && env.NODE_ENV === "production" ? "off" : provider,
    modelId: env.HAPPY_MODEL_ID?.trim() || "claude-sonnet-5-5",
    effort: oneOf(env.HAPPY_EFFORT, ["low", "medium", "high"] as const, "low"),
    thinking: oneOf(env.HAPPY_THINKING, ["adaptive", "between_tools"] as const, "adaptive"),
    maxTokens: int(env.HAPPY_MAX_TOKENS, 2048),
    accessCode,
    limits: {
      perKeyPerHour: int(env.HAPPY_LIMIT_PER_HOUR, DEFAULT_LIMITS.perKeyPerHour),
      perKeyPerDay: int(env.HAPPY_LIMIT_PER_DAY, DEFAULT_LIMITS.perKeyPerDay),
      globalPerDay: int(env.HAPPY_LIMIT_GLOBAL_DAY, DEFAULT_LIMITS.globalPerDay),
      monthlyBudgetUsd: int(env.HAPPY_MONTHLY_BUDGET_USD, DEFAULT_LIMITS.monthlyBudgetUsd),
    },
    fake: {
      firstChunkDelayMs: int(env.HAPPY_FAKE_FIRST_MS, 250),
      chunkDelayMs: int(env.HAPPY_FAKE_CHUNK_MS, 40),
    },
  };
}

interface Runtime {
  config: HappyConfig;
  index: SearchIndex;
  windows: Set<string>;
  model: ModelClient | undefined;
  limits: UsageLimits;
}

let runtime: Runtime | undefined;

export function getHappyRuntime(): Runtime {
  if (runtime) return runtime;
  const config = readConfig();
  const repo = getRepository();
  const model =
    config.provider === "anthropic"
      ? createAnthropicModel(process.env.ANTHROPIC_API_KEY ?? "")
      : config.provider === "fake"
        ? createFakeModel(config.fake)
        : undefined;
  runtime = {
    config,
    index: buildSearchIndex(repo.release),
    windows: curriculumWindows(repo.release.units),
    model,
    limits: new UsageLimits(config.limits),
  };
  return runtime;
}

/** Solo para pruebas: descarta el runtime para releer la configuración. */
export function resetHappyRuntime(): void {
  runtime = undefined;
}

export function composeOptions(config: HappyConfig): ComposeOptions {
  return {
    model: config.provider === "fake" ? "fake" : config.modelId,
    maxTokens: config.maxTokens,
    effort: config.effort,
    thinking: config.thinking,
  };
}

export function runHappyOnServer(input: PipelineInput): AsyncGenerator<HappyEvent> {
  const rt = getHappyRuntime();
  if (!rt.model) throw new Error("Happy no está habilitada en este despliegue");
  return runHappy(input, {
    repo: getRepository(),
    index: rt.index,
    model: rt.model,
    compose: composeOptions(rt.config),
    windows: rt.windows,
  });
}
