/**
 * Acceso de solo lectura a una release curricular compilada.
 * La UI y Happy obtienen todo el texto institucional a través de este módulo, por `unitId`.
 */
import type { ExperienceFieldKey, LevelFieldKey, LevelId } from "./fields";
import { EXPERIENCE_FIELDS } from "./fields";
import type { CurriculumRelease, Experience, Level, Unit } from "./schema";

export interface CurriculumRepository {
  release: CurriculumRelease;
  unit(id: string): Unit;
  maybeUnit(id: string): Unit | undefined;
  levels: Level[];
  level(id: LevelId): Level;
  experiences: Experience[];
  experience(code: string): Experience;
  maybeExperience(code: string): Experience | undefined;
  experiencesOf(levelId: LevelId): Experience[];
  experienceAt(levelId: LevelId, periodIndex: number): Experience;
  title(code: string): string;
  levelField(levelId: LevelId, key: LevelFieldKey): Unit;
  experienceField(code: string, key: ExperienceFieldKey): Unit;
  observations: Unit[];
  progressionOf(levelId: LevelId): Unit[];
  /** Experiencia anterior / siguiente en el orden oficial (S1.1 … T.4). */
  neighbors(code: string): { prev?: Experience; next?: Experience };
}

export function createRepository(release: CurriculumRelease): CurriculumRepository {
  const units = new Map(release.units.map((u) => [u.unitId, u]));
  const experiences = new Map(release.experiences.map((e) => [e.code, e]));
  const levels = new Map(release.levels.map((l) => [l.id, l]));

  const unit = (id: string): Unit => {
    const u = units.get(id);
    if (!u) throw new Error(`Unidad curricular inexistente: ${id}`);
    return u;
  };
  const level = (id: LevelId): Level => {
    const l = levels.get(id);
    if (!l) throw new Error(`Nivel inexistente: ${id}`);
    return l;
  };
  const experience = (code: string): Experience => {
    const e = experiences.get(code);
    if (!e) throw new Error(`Experiencia inexistente: ${code}`);
    return e;
  };
  const experiencesOf = (levelId: LevelId) =>
    release.experiences.filter((e) => e.levelId === levelId);

  return {
    release,
    unit,
    maybeUnit: (id) => units.get(id),
    levels: release.levels,
    level,
    experiences: release.experiences,
    experience,
    maybeExperience: (code) => experiences.get(code),
    experiencesOf,
    experienceAt(levelId, periodIndex) {
      const e = experiencesOf(levelId).find((x) => x.periodIndex === periodIndex);
      if (!e) throw new Error(`Sin experiencia para ${levelId} periodo ${periodIndex}`);
      return e;
    },
    title: (code) => unit(experience(code).titleUnitId).text,
    levelField: (levelId, key) => unit(level(levelId).fieldUnitIds[key]),
    experienceField: (code, key) => unit(experience(code).fieldUnitIds[key]),
    observations: release.observationUnitIds.map(unit),
    progressionOf: (levelId) =>
      release.progression.filter((p) => p.levelId === levelId).map((p) => unit(p.unitId)),
    neighbors(code) {
      const i = release.experiences.findIndex((e) => e.code === code);
      const prev = i > 0 ? release.experiences[i - 1] : undefined;
      const next = release.experiences[i + 1];
      return { ...(prev ? { prev } : {}), ...(next ? { next } : {}) };
    },
  };
}

/** Nombre corto de una actividad rectora, tomado de su encabezado literal ("Juego: tema, …" → "Juego"). */
export function shortHeader(headerLiteral: string): string {
  const i = headerLiteral.indexOf(":");
  return i === -1 ? headerLiteral : headerLiteral.slice(0, i);
}

export const EXPERIENCE_FIELD_KEYS = EXPERIENCE_FIELDS.map((f) => f.key);

/** Valor de un segmento (sin su etiqueta) tal como aparece en el literal. */
export function segmentValue(u: Unit, key: string): string | undefined {
  const s = u.segments?.find((x) => x.key === key);
  return s ? u.text.slice(s.valueStart, s.valueEnd) : undefined;
}
