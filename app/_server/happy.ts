/**
 * Cableado de Happy en el servidor (F5): configuración por variables de entorno, repositorio e
 * índice en memoria, cliente de modelo (Claude API o falso) y límites de uso por instancia.
 * Ningún secreto sale de aquí; el cliente solo recibe el estado (`enabled`, `needsCode`).
 */
import "server-only";
import { curriculumWindows } from "../../src/domain/curriculum/fingerprint";
import { hasKnownPrice } from "../../src/domain/happy/cost";
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
  /** Límites por dispositivo firmado (y globales/presupuesto). */
  limits: LimitsConfig;
  /** Límites por IP: más amplios, porque un jardín entero puede salir por la misma IP (NAT). */
  ipLimits: { perHour: number; perDay: number };
  fake: { firstChunkDelayMs: number; chunkDelayMs: number };
}

const int = (v: string | undefined, d: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : d;
};
const oneOf = <T extends string>(v: string | undefined, allowed: readonly T[], d: T): T =>
  (allowed as readonly string[]).includes(v ?? "") ? (v as T) : d;

/** Longitud mínima del código del piloto (la misma que exige la interfaz). */
export const MIN_ACCESS_CODE_LENGTH = 4;

/** Avisos de configuración (se registran una vez al arrancar). */
export function configWarnings(c: HappyConfig, env: NodeJS.ProcessEnv = process.env): string[] {
  const w: string[] = [];
  if (env.HAPPY_ACCESS_CODE && !c.accessCode)
    w.push(
      `HAPPY_ACCESS_CODE es demasiado corto (mínimo ${String(MIN_ACCESS_CODE_LENGTH)} caracteres): se ignora.`,
    );
  if (c.provider === "anthropic" && !hasKnownPrice(c.modelId))
    w.push(
      `Sin precio conocido para ${c.modelId}: el costo se estima al precio más alto (Opus) hasta actualizar cost.ts.`,
    );
  if (env.HAPPY_THINKING === "between_tools" && c.thinking !== "between_tools")
    w.push("HAPPY_THINKING=between_tools no está disponible en Haiku: se usa adaptive.");
  if (c.provider !== "off" && env.NODE_ENV === "production" && !env.HAPPY_DEVICE_SECRET)
    w.push(
      "Sin HAPPY_DEVICE_SECRET: la firma de dispositivos se deriva del código del piloto, que conocen las docentes. Define un secreto propio en producción.",
    );
  return w;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): HappyConfig {
  const hasKey = Boolean(env.ANTHROPIC_API_KEY);
  const requested = oneOf(
    env.HAPPY_MODEL,
    ["anthropic", "fake", "off"] as const,
    hasKey ? "anthropic" : "off",
  );
  const provider: HappyProvider = requested === "anthropic" && !hasKey ? "off" : requested;
  const rawCode = env.HAPPY_ACCESS_CODE?.trim() ?? "";
  const accessCode = rawCode.length >= MIN_ACCESS_CODE_LENGTH ? rawCode : undefined;
  const modelId = env.HAPPY_MODEL_ID?.trim() || "claude-sonnet-5-5";
  const thinking = oneOf(env.HAPPY_THINKING, ["adaptive", "between_tools"] as const, "adaptive");
  return {
    // En producción, Happy real exige código de acceso (sin autenticación hasta F4).
    provider: provider !== "off" && !accessCode && env.NODE_ENV === "production" ? "off" : provider,
    modelId,
    effort: oneOf(env.HAPPY_EFFORT, ["low", "medium", "high"] as const, "low"),
    // `between_tools` solo existe en Sonnet 5.5 y superiores; en Haiku devolvería 400 en cada petición.
    thinking:
      thinking === "between_tools" && modelId.startsWith("claude-haiku") ? "adaptive" : thinking,
    maxTokens: int(env.HAPPY_MAX_TOKENS, 2048),
    accessCode,
    limits: {
      perKeyPerHour: int(env.HAPPY_LIMIT_PER_HOUR, DEFAULT_LIMITS.perKeyPerHour),
      perKeyPerDay: int(env.HAPPY_LIMIT_PER_DAY, DEFAULT_LIMITS.perKeyPerDay),
      globalPerDay: int(env.HAPPY_LIMIT_GLOBAL_DAY, DEFAULT_LIMITS.globalPerDay),
      monthlyBudgetUsd: int(env.HAPPY_MONTHLY_BUDGET_USD, DEFAULT_LIMITS.monthlyBudgetUsd),
    },
    ipLimits: {
      perHour: int(env.HAPPY_LIMIT_IP_PER_HOUR, DEFAULT_LIMITS.perKeyPerHour * 10),
      perDay: int(env.HAPPY_LIMIT_IP_PER_DAY, DEFAULT_LIMITS.perKeyPerDay * 10),
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
  ipLimits: UsageLimits;
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
    ipLimits: new UsageLimits({
      perKeyPerHour: config.ipLimits.perHour,
      perKeyPerDay: config.ipLimits.perDay,
      globalPerDay: Number.MAX_SAFE_INTEGER,
      monthlyBudgetUsd: Number.MAX_SAFE_INTEGER,
    }),
  };
  for (const w of configWarnings(config))
    console.warn(JSON.stringify({ at: "happy-config", warning: w }));
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
