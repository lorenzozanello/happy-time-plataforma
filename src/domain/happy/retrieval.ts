/**
 * Recuperación determinista (ADR-006, Baseline §8.3). Sin embeddings: filtros por contexto
 * curricular + búsqueda léxica con normalización española. Devuelve el conjunto acotado de
 * unidades que el modelo puede citar; el validador rechaza cualquier cita fuera de él.
 */
import type { LevelId } from "../curriculum/fields";
import type { CurriculumRepository } from "../curriculum/repository";
import type { Unit } from "../curriculum/schema";
import { searchUnits, type SearchIndex } from "../curriculum/search";
import type { HappyContext, Mode } from "./schema";

export interface RetrievalRequest {
  mode: Mode;
  message: string;
  context: HappyContext;
}

export interface Retrieval {
  /** Las 7 Observaciones (constitución pedagógica): siempre. */
  observations: Unit[];
  /** Nivel activo resuelto (del contexto o de la experiencia). */
  levelId?: LevelId;
  /** Fila de progresión del nivel (6 unidades) y perfiles del nivel. */
  level: Unit[];
  /** Experiencia activa: título + 24 campos. */
  experienceCode?: string;
  experience: Unit[];
  /** Resúmenes de las experiencias del nivel (título + alcance) cuando no hay experiencia activa. */
  levelExperiences: Unit[];
  /** Coincidencias léxicas con el mensaje (campos de experiencia), con los términos que coincidieron. */
  hits: { unit: Unit; terms: string[]; score: number }[];
  /** Todo lo que el modelo puede citar. */
  retrievedIds: Set<string>;
}

export const RETRIEVAL_LIMITS = {
  hitsWithExperience: 6,
  hitsWithoutExperience: 10,
  hitsConectar: 12,
} as const;

/** Resuelve la experiencia activa: código explícito o (nivel, periodo). */
export function resolveExperience(
  repo: CurriculumRepository,
  ctx: HappyContext,
): { code: string; levelId: LevelId } | undefined {
  if (ctx.experienceCode) {
    const e = repo.maybeExperience(ctx.experienceCode);
    if (e) return { code: e.code, levelId: e.levelId };
  }
  if (ctx.levelId && ctx.periodIndex) {
    const lvl = repo.levels.find((l) => l.id === ctx.levelId);
    if (lvl) {
      const e = repo.experiencesOf(lvl.id).find((x) => x.periodIndex === ctx.periodIndex);
      if (e) return { code: e.code, levelId: e.levelId };
    }
  }
  return undefined;
}

export function retrieve(
  repo: CurriculumRepository,
  index: SearchIndex,
  req: RetrievalRequest,
): Retrieval {
  const active = resolveExperience(repo, req.context);
  const levelId =
    active?.levelId ??
    (req.context.levelId && repo.levels.some((l) => l.id === req.context.levelId)
      ? (req.context.levelId as LevelId)
      : undefined);

  const observations = repo.observations;
  const level: Unit[] = levelId
    ? [
        ...repo.progressionOf(levelId),
        repo.levelField(levelId, "perfil_entrada"),
        repo.levelField(levelId, "perfil_salida"),
      ]
    : [];

  const experience: Unit[] = active
    ? [
        repo.unit(repo.experience(active.code).titleUnitId),
        ...Object.values(repo.experience(active.code).fieldUnitIds).map((id) => repo.unit(id)),
      ]
    : [];

  const levelExperiences: Unit[] =
    !active && levelId
      ? repo
          .experiencesOf(levelId)
          .flatMap((e) => [repo.unit(e.titleUnitId), repo.experienceField(e.code, "alcance")])
      : [];

  // Búsqueda léxica sobre campos de experiencia (y títulos), filtrada por nivel si lo hay.
  const limit = active
    ? RETRIEVAL_LIMITS.hitsWithExperience
    : req.mode === "conectar"
      ? RETRIEVAL_LIMITS.hitsConectar
      : RETRIEVAL_LIMITS.hitsWithoutExperience;
  const allow = (id: string) => {
    const u = repo.maybeUnit(id);
    if (!u) return false;
    if (u.kind !== "experience_field" && u.kind !== "experience_title") return false;
    // En modo «conectar» sin experiencia activa se busca en toda la malla.
    if (levelId && !(req.mode === "conectar" && !active)) return u.levelId === levelId;
    return true;
  };
  const query = cleanQuery(req.message);
  let hits = query ? searchUnits(index, query, allow) : [];
  if (hits.length === 0 && query) {
    hits = index
      .search(query, {
        prefix: (t) => t.length >= 3,
        fuzzy: (t) => (t.length >= 6 ? 0.15 : false),
        combineWith: "OR",
      })
      .filter((r) => allow(String(r.id)))
      .map((r) => ({ unitId: String(r.id), score: r.score, terms: r.terms }));
  }
  const seen = new Set<string>();
  const topHits = hits
    .filter((h) => (seen.has(h.unitId) ? false : (seen.add(h.unitId), true)))
    .slice(0, limit)
    .map((h) => ({ unit: repo.unit(h.unitId), terms: h.terms, score: h.score }));

  const retrievedIds = new Set<string>();
  for (const u of [...observations, ...level, ...experience, ...levelExperiences])
    retrievedIds.add(u.unitId);
  for (const h of topHits) retrievedIds.add(h.unit.unitId);

  return {
    observations,
    ...(levelId ? { levelId } : {}),
    level,
    ...(active ? { experienceCode: active.code } : {}),
    experience,
    levelExperiences,
    hits: topHits,
    retrievedIds,
  };
}

/** Quita marcadores de redacción y ruido para que la búsqueda léxica trabaje sobre el contenido. */
export function cleanQuery(message: string): string {
  return message
    .replace(/\[(nombre|contacto|documento|dirección)\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 400);
}
