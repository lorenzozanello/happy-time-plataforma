/**
 * Modelos de vista serializables (F3). Cada pantalla recibe solo las unidades que muestra:
 * así las páginas de producción no envían la malla completa al navegador.
 * Todo el texto institucional sigue siendo la unidad literal, con su procedencia.
 */
import type { DimensionKey, ExperienceFieldKey, LevelFieldKey, LevelId } from "./fields";
import type { CurriculumRepository } from "./repository";
import type { Unit } from "./schema";
import { buildSearchIndex } from "./search";

/**
 * Observaciones institucionales usadas en la ficha. Referencia estructural por id (release 2026-06:
 * OBS-1 = Observaciones!A2, OBS-3 = Observaciones!A4); el diff de releases marca cualquier cambio.
 */
export const OPENING_PRINCIPLE_UNIT = "OBS-1";
export const ALERTS_PRINCIPLE_UNIT = "OBS-3";

export interface LevelSummary {
  id: LevelId;
  codePrefix: string;
  labelLiteral: string;
  progresionLabelLiteral: string;
  equivalencia: Unit;
  edadEntrada: Unit;
  edadSalida: Unit;
}

export interface ExperienceSummary {
  code: string;
  levelId: LevelId;
  periodIndex: number;
  periodLiteral: string;
  title: Unit;
  alcance: Unit;
}

/** Catálogo liviano (~10 KB) disponible en todas las pantallas. */
export interface Catalog {
  release: string;
  sourceSha256: string;
  unitCount: number;
  levels: LevelSummary[];
  experiences: ExperienceSummary[];
}

export function buildCatalog(repo: CurriculumRepository): Catalog {
  return {
    release: repo.release.release,
    sourceSha256: repo.release.source.sha256,
    unitCount: repo.release.counts.units,
    levels: repo.levels.map((l) => ({
      id: l.id,
      codePrefix: l.codePrefix,
      labelLiteral: l.labelLiteral,
      progresionLabelLiteral: l.progresionLabelLiteral,
      equivalencia: repo.levelField(l.id, "equivalencia"),
      edadEntrada: repo.levelField(l.id, "edad_entrada"),
      edadSalida: repo.levelField(l.id, "edad_salida"),
    })),
    experiences: repo.experiences.map((e) => summary(repo, e.code)),
  };
}

function summary(repo: CurriculumRepository, code: string): ExperienceSummary {
  const e = repo.experience(code);
  return {
    code: e.code,
    levelId: e.levelId,
    periodIndex: e.periodIndex,
    periodLiteral: e.periodLiteral,
    title: repo.unit(e.titleUnitId),
    alcance: repo.experienceField(code, "alcance"),
  };
}

/* ── Consultas sobre el catálogo (cliente y servidor) ───────────────────── */
export const catalogLevel = (c: Catalog, id: string): LevelSummary | undefined =>
  c.levels.find((l) => l.id === id);
export const catalogExperience = (c: Catalog, code: string): ExperienceSummary | undefined =>
  c.experiences.find((e) => e.code === code);
export const catalogTitle = (c: Catalog, code: string): string =>
  catalogExperience(c, code)?.title.text ?? code;
export const experiencesOfLevel = (c: Catalog, id: string): ExperienceSummary[] =>
  c.experiences.filter((e) => e.levelId === id);
export function experienceAt(c: Catalog, levelId: string, periodIndex: number): ExperienceSummary {
  const e = c.experiences.find((x) => x.levelId === levelId && x.periodIndex === periodIndex);
  if (!e) throw new Error(`Sin experiencia para ${levelId} periodo ${String(periodIndex)}`);
  return e;
}

/** Código de experiencia al que pertenece una unidad ("S1.1#juego" → "S1.1"), si existe. */
export function unitExperienceCode(c: Catalog, unitId: string): string | undefined {
  const code = unitId.split("#")[0] ?? "";
  return catalogExperience(c, code) ? code : undefined;
}

/** Slug de URL de una experiencia: "S2.1" ↔ "s2-1". */
export const codeToSlug = (code: string) => code.toLowerCase().replace(".", "-");
export const slugToCode = (slug: string) => slug.toUpperCase().replace("-", ".");

/* ── Ficha ──────────────────────────────────────────────────────────────── */
export interface FichaData {
  experience: ExperienceSummary;
  level: LevelSummary;
  fields: Record<ExperienceFieldKey, Unit>;
  openingPrinciple: Unit;
  alertsPrinciple: Unit;
  prev?: { code: string; title: string };
  next?: { code: string; title: string };
}

export function buildFicha(repo: CurriculumRepository, code: string): FichaData | undefined {
  const e = repo.maybeExperience(code);
  if (!e) return undefined;
  const catalog = buildCatalog(repo);
  const level = catalogLevel(catalog, e.levelId);
  if (!level) return undefined;
  const fields = Object.fromEntries(
    Object.entries(e.fieldUnitIds).map(([k, id]) => [k, repo.unit(id)]),
  ) as Record<ExperienceFieldKey, Unit>;
  const { prev, next } = repo.neighbors(code);
  return {
    experience: summary(repo, code),
    level,
    fields,
    openingPrinciple: repo.unit(OPENING_PRINCIPLE_UNIT),
    alertsPrinciple: repo.unit(ALERTS_PRINCIPLE_UNIT),
    ...(prev ? { prev: { code: prev.code, title: repo.title(prev.code) } } : {}),
    ...(next ? { next: { code: next.code, title: repo.title(next.code) } } : {}),
  };
}

/* ── Nivel, progresión y principios ─────────────────────────────────────── */
export interface LevelData {
  level: LevelSummary;
  fields: Record<LevelFieldKey, Unit>;
  progression: Unit[];
  experiences: ExperienceSummary[];
}

export function buildLevel(repo: CurriculumRepository, id: string): LevelData | undefined {
  const l = repo.levels.find((x) => x.id === id);
  if (!l) return undefined;
  const catalog = buildCatalog(repo);
  const level = catalogLevel(catalog, l.id);
  if (!level) return undefined;
  return {
    level,
    fields: Object.fromEntries(
      Object.entries(l.fieldUnitIds).map(([k, uid]) => [k, repo.unit(uid)]),
    ) as Record<LevelFieldKey, Unit>,
    progression: repo.progressionOf(l.id),
    experiences: experiencesOfLevel(catalog, l.id),
  };
}

export interface ProgressionData {
  dimensions: { key: DimensionKey; headerLiteral: string }[];
  levels: LevelSummary[];
  cells: { levelId: LevelId; dimensionKey: DimensionKey; unit: Unit }[];
}

export function buildProgression(repo: CurriculumRepository): ProgressionData {
  return {
    dimensions: repo.release.dimensions,
    levels: buildCatalog(repo).levels,
    cells: repo.release.progression.map((p) => ({
      levelId: p.levelId,
      dimensionKey: p.dimensionKey,
      unit: repo.unit(p.unitId),
    })),
  };
}

export interface PrinciplesData {
  units: Unit[];
}

export const buildPrinciples = (repo: CurriculumRepository): PrinciplesData => ({
  units: repo.observations,
});

/* ── Búsqueda ───────────────────────────────────────────────────────────── */
export interface SearchUnit {
  unitId: string;
  kind: Unit["kind"];
  text: string;
  headerLiteral: string;
  code?: string;
  levelId?: LevelId;
}

/** Paquete de búsqueda: textos + índice serializado. Se carga bajo demanda en /buscar. */
export interface SearchBundle {
  release: string;
  units: SearchUnit[];
  index: string;
}

export function buildSearchBundle(repo: CurriculumRepository): SearchBundle {
  return {
    release: repo.release.release,
    units: repo.release.units.map((u) => ({
      unitId: u.unitId,
      kind: u.kind,
      text: u.text,
      headerLiteral: u.headerLiteral,
      ...(u.code ? { code: u.code } : {}),
      ...(u.levelId ? { levelId: u.levelId } : {}),
    })),
    index: JSON.stringify(buildSearchIndex(repo.release)),
  };
}
