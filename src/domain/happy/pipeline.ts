/**
 * Pipeline de una solicitud a Happy (Baseline §8.1), independiente del transporte y del proveedor:
 *
 *   policy (entrada) → retrieval → composer → modelo (streaming) → validador por bloque → done
 *
 * Es un generador asíncrono de eventos; el route handler los serializa como NDJSON y la suite de
 * evaluación los consume en memoria. Garantías estructurales (ADR-007): el modelo solo devuelve
 * identificadores; aquí se resuelven a unidades literales y se descarta cualquier cita fuera del
 * conjunto recuperado o cualquier texto que reclame autoridad, diagnostique o copie la malla.
 */
import type { CurriculumRepository } from "../curriculum/repository";
import type { Unit } from "../curriculum/schema";
import type { SearchIndex } from "../curriculum/search";
import { estimateCostUsd, round6 } from "./cost";
import { EMPTY_USAGE, type ModelClient, type ModelUsage } from "./model";
import { checkPrivacy, PRIVACY_MESSAGE } from "./privacy";
import { buildModelRequest, PROMPT_VERSION, type ComposeOptions, type HistoryTurn } from "./prompt";
import { retrieve } from "./retrieval";
import {
  MAX_PATHS,
  V1_MODES,
  validateAction,
  validateBlock,
  validateResponse,
  type Action,
  type Block,
  type HappyContext,
  type HappyResponse,
  type Mode,
  type ValidationOptions,
} from "./schema";
import { BlockStreamReader } from "./stream-json";

export const MAX_BLOCKS = 8;
export const MAX_ATTEMPTS = 2;

export interface HappyMetrics {
  provider: string;
  model: string;
  promptVersion: string;
  release: string;
  attempts: number;
  /** Bloques o acciones descartados por el validador, con el motivo (acotado). */
  dropped: string[];
  usage: ModelUsage;
  costUsd: number;
  /** Milisegundos hasta el primer bloque válido (null si no hubo). */
  firstBlockMs: number | null;
  totalMs: number;
  retrieved: number;
  cited: string[];
  /** Política que resolvió la respuesta sin modelo. */
  policy?: "privacy";
}

export type HappyEvent =
  | { type: "meta"; retrieved: string[]; experienceCode?: string; levelId?: string }
  | { type: "block"; block: Block; units: Unit[] }
  | { type: "reset"; reason: string }
  | { type: "done"; response: HappyResponse; units: Unit[]; metrics: HappyMetrics }
  | {
      type: "error";
      code: "model" | "invalid" | "aborted";
      message: string;
      metrics?: HappyMetrics;
    };

export interface PipelineInput {
  mode: Mode;
  message: string;
  context: HappyContext;
  history: HistoryTurn[];
  signal?: AbortSignal;
}

export interface PipelineDeps {
  repo: CurriculumRepository;
  index: SearchIndex;
  model: ModelClient;
  compose: ComposeOptions;
  /** Secuencias de 8 palabras de la malla (copia literal prohibida). */
  windows: ReadonlySet<string>;
  now?: () => number;
}

const ERROR_MESSAGE =
  "Happy no pudo responder esta vez. Tu mensaje quedó guardado; vuelve a intentarlo.";

function unitsOf(repo: CurriculumRepository, blocks: Block[]): Unit[] {
  const seen = new Set<string>();
  const out: Unit[] = [];
  for (const b of blocks) {
    if (b.kind !== "malla_ref" || seen.has(b.unitId)) continue;
    const u = repo.maybeUnit(b.unitId);
    if (u) {
      seen.add(b.unitId);
      out.push(u);
    }
  }
  return out;
}

function addUsage(a: ModelUsage, b: Partial<ModelUsage>): ModelUsage {
  return {
    inputTokens: a.inputTokens + (b.inputTokens ?? 0),
    outputTokens: a.outputTokens + (b.outputTokens ?? 0),
    cacheReadTokens: a.cacheReadTokens + (b.cacheReadTokens ?? 0),
    cacheWrite5mTokens: a.cacheWrite5mTokens + (b.cacheWrite5mTokens ?? 0),
    cacheWrite1hTokens: a.cacheWrite1hTokens + (b.cacheWrite1hTokens ?? 0),
  };
}

export async function* runHappy(
  input: PipelineInput,
  deps: PipelineDeps,
): AsyncGenerator<HappyEvent> {
  const now = deps.now ?? (() => Date.now());
  const t0 = now();
  const { repo } = deps;
  const mode: Mode = (V1_MODES as readonly Mode[]).includes(input.mode) ? input.mode : "general";
  const release = repo.release.release;
  const base = {
    provider: deps.model.provider,
    model: deps.compose.model,
    promptVersion: PROMPT_VERSION,
    release,
  };

  // 1. Política de entrada (ADR-009/014): solo sigue la versión redactada.
  const privacy = checkPrivacy(input.message);
  if (privacy.sensitive) {
    const response: HappyResponse = {
      mode,
      blocks: [{ kind: "notice", code: "privacy", text: PRIVACY_MESSAGE }],
      nextActions: [],
    };
    yield {
      type: "done",
      response,
      units: [],
      metrics: {
        ...base,
        provider: "policy",
        attempts: 0,
        dropped: [],
        usage: EMPTY_USAGE,
        costUsd: 0,
        firstBlockMs: null,
        totalMs: now() - t0,
        retrieved: 0,
        cited: [],
        policy: "privacy",
      },
    };
    return;
  }
  const message = privacy.redacted;

  // 2. Recuperación determinista.
  const retrieval = retrieve(repo, deps.index, { mode, message, context: input.context });
  yield {
    type: "meta",
    retrieved: [...retrieval.retrievedIds],
    ...(retrieval.experienceCode ? { experienceCode: retrieval.experienceCode } : {}),
    ...(retrieval.levelId ? { levelId: retrieval.levelId } : {}),
  };

  const vopts: ValidationOptions = {
    unitExists: (id) => repo.maybeUnit(id) !== undefined,
    segmentExists: (id, seg) => repo.maybeUnit(id)?.segments?.some((s) => s.key === seg) ?? false,
    experienceExists: (code) => repo.maybeExperience(code) !== undefined,
    retrieved: retrieval.retrievedIds,
    curriculumWindows: deps.windows,
    allowedModes: V1_MODES,
    modelOutput: true,
  };

  let usage: ModelUsage = EMPTY_USAGE;
  const dropped: string[] = [];
  let firstBlockMs: number | null = null;
  let feedback: string[] | undefined;
  const metricsSoFar = (attempts: number): HappyMetrics => ({
    ...base,
    attempts,
    dropped: dropped.slice(0, 12),
    usage,
    costUsd: round6(estimateCostUsd(deps.compose.model, usage)),
    firstBlockMs,
    totalMs: now() - t0,
    retrieved: retrieval.retrievedIds.size,
    cited: [],
  });

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1) {
      yield { type: "reset", reason: (feedback ?? []).join("; ") };
      firstBlockMs = null; // lo mostrado en el intento anterior se descartó
    }
    const request = buildModelRequest(
      {
        mode,
        message,
        context: input.context,
        retrieval,
        history: input.history,
        ...(feedback ? { feedback } : {}),
      },
      { ...deps.compose, ...(input.signal ? { signal: input.signal } : {}) },
    );
    const reader = new BlockStreamReader();
    const accepted: Block[] = [];
    const attemptErrors: string[] = [];
    let paths = 0;
    let stopReason: string | null = null;

    try {
      for await (const ev of deps.model.stream(request)) {
        if (ev.type === "start") usage = addUsage(usage, ev.usage);
        else if (ev.type === "end") {
          usage = addUsage(usage, ev.usage);
          stopReason = ev.stopReason;
        } else {
          for (const raw of reader.push(ev.delta)) {
            const v = validateBlock(raw, vopts);
            if (!v.ok) {
              attemptErrors.push(...v.errors);
              dropped.push(...v.errors);
              continue;
            }
            const b = v.block;
            const nPaths = b.kind === "paths" ? b.paths.length : 0;
            if (paths + nPaths > MAX_PATHS) {
              const msg = `más de ${MAX_PATHS} caminos en la respuesta`;
              attemptErrors.push(msg);
              dropped.push(msg);
              continue;
            }
            if (accepted.length >= MAX_BLOCKS) {
              const msg = `más de ${MAX_BLOCKS} bloques`;
              attemptErrors.push(msg);
              dropped.push(msg);
              continue;
            }
            paths += nPaths;
            accepted.push(b);
            firstBlockMs ??= now() - t0;
            yield { type: "block", block: b, units: unitsOf(repo, [b]) };
          }
        }
      }
    } catch {
      if (input.signal?.aborted) {
        yield {
          type: "error",
          code: "aborted",
          message: "Solicitud cancelada",
          metrics: metricsSoFar(attempt),
        };
        return;
      }
      // Fallo del proveedor: no se reintenta con otro prompt (sería el mismo fallo); se informa.
      yield {
        type: "error",
        code: "model",
        message: ERROR_MESSAGE,
        metrics: metricsSoFar(attempt),
      };
      return;
    }

    const final = reader.final() as { nextActions?: unknown } | null;
    if (final === null)
      attemptErrors.push(`la salida no es JSON válido (stop: ${stopReason ?? "?"})`);
    const actions: Action[] = [];
    const rawActions = Array.isArray(final?.nextActions) ? (final.nextActions as unknown[]) : [];
    for (const raw of rawActions.slice(0, 4)) {
      const v = validateAction(raw, vopts);
      if (v.ok) actions.push(v.action);
      else {
        attemptErrors.push(...v.errors);
        dropped.push(...v.errors);
      }
    }
    const response: HappyResponse = { mode, blocks: accepted, nextActions: actions };
    const check = accepted.length
      ? validateResponse(response, vopts)
      : { ok: false as const, errors: ["no quedó ningún bloque válido"] };
    if (check.ok) {
      const units = unitsOf(repo, accepted);
      const metrics = metricsSoFar(attempt);
      metrics.cited = units.map((u) => u.unitId);
      yield { type: "done", response: check.response, units, metrics };
      return;
    }
    feedback = [...new Set([...attemptErrors, ...check.errors])].slice(0, 8);
    if (attempt === MAX_ATTEMPTS) {
      yield {
        type: "error",
        code: "invalid",
        message: ERROR_MESSAGE,
        metrics: metricsSoFar(attempt),
      };
      return;
    }
  }
}
