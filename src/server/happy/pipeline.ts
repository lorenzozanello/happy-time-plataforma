/**
 * Pipeline de una solicitud a Happy (§8.1): política → contexto → intención → recuperación →
 * composer → validación por bloque → eventos en streaming.
 *
 * Garantías:
 * - Datos identificables → aviso de privacidad sin llamar al modelo.
 * - Solo se emiten bloques válidos; cada cita llega con su unidad literal resuelta AQUÍ desde la
 *   release compilada (el modelo nunca aporta texto institucional).
 * - ≤ 3 caminos en toda la respuesta (se recorta), ≤ 8 bloques, ≤ 3 acciones.
 * - Si un intento no deja ningún bloque válido, se reintenta una vez; si persiste, error.
 */
import type { CurriculumRepository } from "../../domain/curriculum/repository";
import type { Unit } from "../../domain/curriculum/schema";
import type { SearchIndex } from "../../domain/curriculum/search";
import { checkPrivacy, PRIVACY_MESSAGE } from "../../domain/happy/privacy";
import {
  MAX_PATHS,
  validateAction,
  validateBlock,
  type Action,
  type Block,
  type Mode,
  type ValidationOptions,
} from "../../domain/happy/schema";
import type { Composer, Usage } from "./composer";
import { ndjsonLines } from "./composer";
import { resolveContext } from "./context";
import { buildSystemPrompt, buildUserParts, PROMPT_VERSION } from "./prompt.v1";
import type { HappyApiRequest } from "./request";
import { retrieve } from "./retrieval";
import { routeMode } from "./router";

export const MAX_BLOCKS = 8;
export const MAX_ACTIONS = 3;

export type HappyEvent =
  | {
      type: "meta";
      mode: Mode;
      release: string;
      model: string;
      promptVersion: string;
    }
  | { type: "block"; block: Block; units: Unit[] }
  | { type: "done"; nextActions: Action[] }
  | { type: "error"; code: "invalid_output" | "upstream"; message: string };

/** Registro operativo de una respuesta. Nunca incluye el texto de la docente. */
export interface HappyLog {
  mode: Mode;
  model: string;
  promptVersion: string;
  release: string;
  privacyBlocked: boolean;
  retrievedUnitIds: string[];
  citedUnitIds: string[];
  attempts: number;
  dropped: { reason: string }[];
  firstBlockMs: number | null;
  totalMs: number;
  usage: Usage | null;
  /** partial: el proveedor falló después de entregar bloques; aborted: la docente cerró la conexión. */
  outcome: "ok" | "partial" | "privacy" | "invalid_output" | "upstream" | "aborted";
}

export interface PipelineDeps {
  repo: CurriculumRepository;
  index: SearchIndex;
  windows: ReadonlySet<string>;
  /** Unidades cortas normalizadas (Observaciones, etc.): tampoco pueden copiarse enteras. */
  shorts?: readonly string[];
  composer: Composer;
  now?: () => number;
  log?: (entry: HappyLog) => void;
  signal?: AbortSignal;
}

/** El registro guarda la categoría del error, nunca el texto generado (podría repetir datos). */
const reasonOf = (errors: string[]) => errors.map((e) => e.replace(/:\s*".*$/s, "")).join("; ");

function literalUnits(repo: CurriculumRepository, block: Block): Unit[] {
  if (block.kind !== "malla_ref") return [];
  const u = repo.maybeUnit(block.unitId);
  return u ? [u] : [];
}

export async function* runHappy(
  req: HappyApiRequest,
  deps: PipelineDeps,
): AsyncGenerator<HappyEvent> {
  const now = deps.now ?? (() => performance.now());
  const t0 = now();
  const mode = routeMode(req.mode, req.message);
  const log: HappyLog = {
    mode,
    model: deps.composer.model,
    promptVersion: PROMPT_VERSION,
    release: deps.repo.release.release,
    privacyBlocked: false,
    retrievedUnitIds: [],
    citedUnitIds: [],
    attempts: 0,
    dropped: [],
    firstBlockMs: null,
    totalMs: 0,
    usage: null,
    outcome: "aborted",
  };
  // El registro se emite siempre, también si la docente cierra la conexión a mitad de camino.
  try {
    yield* steps(req, deps, mode, log, () => Math.round(now() - t0));
  } finally {
    log.totalMs = Math.round(now() - t0);
    deps.log?.(log);
  }
}

async function* steps(
  req: HappyApiRequest,
  deps: PipelineDeps,
  mode: Mode,
  log: HappyLog,
  elapsed: () => number,
): AsyncGenerator<HappyEvent> {
  const { repo, composer } = deps;
  yield {
    type: "meta",
    mode,
    release: repo.release.release,
    model: composer.model,
    promptVersion: PROMPT_VERSION,
  };

  // 1 · Política de entrada: mensaje y turnos de la docente. El original nunca sale de aquí.
  // Los turnos de Happy los produjo el servidor: revisarlos daba avisos falsos (revisión F5).
  const privacy = checkPrivacy(req.message);
  const historySensitive = req.history.some(
    (t) => t.role === "docente" && checkPrivacy(t.text).sensitive,
  );
  if (privacy.sensitive || historySensitive) {
    log.privacyBlocked = true;
    log.outcome = "privacy";
    log.firstBlockMs = elapsed();
    yield {
      type: "block",
      block: { kind: "notice", code: "privacy", text: PRIVACY_MESSAGE },
      units: [],
    };
    yield { type: "done", nextActions: [] };
    return;
  }

  // 2 · Contexto y recuperación.
  const context = resolveContext(req.context, repo);
  const retrieval = retrieve(repo, deps.index, { mode, message: req.message, context });
  log.retrievedUnitIds = [...retrieval.ids];
  const level = context.levelId ? repo.level(context.levelId) : undefined;
  const user = buildUserParts({
    mode,
    message: req.message,
    context,
    contextLabels: {
      ...(level ? { level: level.labelLiteral } : {}),
      ...(context.periodIndex ? { period: String(context.periodIndex) } : {}),
      ...(context.experienceCode
        ? { experience: `${context.experienceCode} · ${repo.title(context.experienceCode)}` }
        : {}),
    },
    units: retrieval.units,
    history: req.history,
  });
  const system = buildSystemPrompt(retrieval.observations);

  const opts: ValidationOptions = {
    unitExists: (id) => repo.maybeUnit(id) !== undefined,
    segmentExists: (id, seg) => repo.maybeUnit(id)?.segments?.some((s) => s.key === seg) ?? false,
    experienceExists: (code) => repo.maybeExperience(code) !== undefined,
    retrieved: retrieval.ids,
    curriculumWindows: deps.windows,
    ...(deps.shorts ? { curriculumShorts: deps.shorts } : {}),
  };

  // 3 · Composer + validación por bloque, con un reintento si no queda nada válido.
  let emitted = 0;
  let pathsLeft = MAX_PATHS;
  let actions: Action[] = [];
  for (let attempt = 1; attempt <= 2 && emitted === 0; attempt++) {
    log.attempts = attempt;
    actions = [];
    try {
      const chunks = composer.compose(
        {
          system,
          userCached: user.stable,
          user: user.variable,
          mode,
          message: req.message,
          unitIds: retrieval.units.map((u) => u.unitId),
          ...(context.experienceCode ? { experienceCode: context.experienceCode } : {}),
        },
        {
          ...(deps.signal ? { signal: deps.signal } : {}),
          onUsage: (u) => {
            log.usage = u;
          },
        },
      );
      for await (const raw of ndjsonLines(chunks)) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(raw);
        } catch {
          log.dropped.push({ reason: "línea que no es JSON" });
          continue;
        }
        if (typeof parsed === "object" && parsed !== null && "nextActions" in parsed) {
          const list = parsed.nextActions;
          for (const a of Array.isArray(list) ? list : []) {
            const v = validateAction(a, opts);
            // «Guardar idea» ya existe en cada camino; la acción del modelo no tiene manejador.
            if (v.ok && v.action.kind === "save_idea")
              log.dropped.push({ reason: "acción save_idea no admitida" });
            else if (v.ok && actions.length < MAX_ACTIONS) actions.push(v.action);
            else if (!v.ok) log.dropped.push({ reason: reasonOf(v.errors) });
          }
          continue;
        }
        if (emitted >= MAX_BLOCKS) {
          log.dropped.push({ reason: "más de 8 bloques" });
          continue;
        }
        const v = validateBlock(parsed, opts);
        if (!v.ok) {
          log.dropped.push({ reason: reasonOf(v.errors) });
          continue;
        }
        let block = v.block;
        // El aviso de privacidad tiene un único texto, el del servidor.
        if (block.kind === "notice" && block.code === "privacy")
          block = { ...block, text: PRIVACY_MESSAGE };
        if (block.kind === "paths") {
          if (pathsLeft === 0) {
            log.dropped.push({ reason: "caminos por encima del máximo" });
            continue;
          }
          if (block.paths.length > pathsLeft) {
            log.dropped.push({ reason: "caminos recortados al máximo" });
            block = { ...block, paths: block.paths.slice(0, pathsLeft) };
          }
          pathsLeft -= block.paths.length;
        }
        if (block.kind === "malla_ref") log.citedUnitIds.push(block.unitId);
        log.firstBlockMs ??= elapsed();
        emitted++;
        yield { type: "block", block, units: literalUnits(repo, block) };
      }
    } catch (e) {
      if (deps.signal?.aborted) return; // queda "aborted"
      log.dropped.push({ reason: `proveedor: ${e instanceof Error ? e.name : "error"}` });
      if (emitted > 0) {
        log.outcome = "partial";
        yield { type: "done", nextActions: [] };
        return;
      }
      if (attempt === 2) {
        log.outcome = "upstream";
        yield { type: "error", code: "upstream", message: "Happy no pudo responder esta vez." };
        return;
      }
    }
  }

  if (emitted === 0) {
    log.outcome = "invalid_output";
    yield {
      type: "error",
      code: "invalid_output",
      message: "Happy no logró una respuesta que cumpla sus reglas. Intenta de nuevo o reformula.",
    };
    return;
  }
  log.outcome = "ok";
  yield { type: "done", nextActions: actions };
}
