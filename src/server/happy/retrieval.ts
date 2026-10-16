/**
 * Recuperación determinista (§8.3, ADR-006). Decide qué unidades ve el modelo; el validador
 * exige que toda cita pertenezca a este conjunto.
 */
import type { CurriculumRepository } from "../../domain/curriculum/repository";
import type { Unit } from "../../domain/curriculum/schema";
import type { SearchIndex } from "../../domain/curriculum/search";
import type { Mode } from "../../domain/happy/schema";
import type { ResolvedContext } from "./context";

/** Tope de texto curricular por llamada (caracteres): ~10 mil tokens. */
export const MAX_RETRIEVED_CHARS = 36_000;
const LEXICAL_K = 12;

export interface Retrieval {
  /** Constitución: las Observaciones, siempre (van en el prompt de sistema). */
  observations: Unit[];
  /** Unidades de contexto para esta solicitud, en orden de prioridad. */
  units: Unit[];
  /** Todo lo que el modelo puede citar (Observaciones + unidades). */
  ids: Set<string>;
  /** Unidades halladas por búsqueda léxica (para medir "sin coincidencias"). */
  lexicalHits: number;
}

function lexical(
  repo: CurriculumRepository,
  index: SearchIndex,
  query: string,
  levelId: string | undefined,
): Unit[] {
  if (!query.trim()) return [];
  return index
    .search(query, {
      prefix: (t) => t.length >= 4,
      fuzzy: (t) => (t.length >= 6 ? 0.15 : false),
      combineWith: "OR",
      boost: { title: 2, header: 1.2 },
    })
    .map((r) => repo.maybeUnit(String(r.id)))
    .filter((u): u is Unit => u?.kind === "experience_field" && (!levelId || u.levelId === levelId))
    .slice(0, LEXICAL_K);
}

export function retrieve(
  repo: CurriculumRepository,
  index: SearchIndex,
  input: { mode: Mode; message: string; context: ResolvedContext },
): Retrieval {
  const { context } = input;
  const ordered: Unit[] = [];
  const seen = new Set<string>();
  const add = (u: Unit | undefined) => {
    if (!u || seen.has(u.unitId)) return;
    seen.add(u.unitId);
    ordered.push(u);
  };

  if (context.experienceCode) {
    const e = repo.experience(context.experienceCode);
    add(repo.unit(e.titleUnitId));
    for (const id of Object.values(e.fieldUnitIds)) add(repo.unit(id));
  }
  if (context.levelId) for (const u of repo.progressionOf(context.levelId)) add(u);

  const hits = lexical(repo, index, input.message, context.levelId);
  for (const u of hits) add(u);

  // Pregunta amplia de nivel sin experiencia: títulos y alcances del año del nivel.
  if (context.levelId && !context.experienceCode) {
    for (const e of repo.experiencesOf(context.levelId)) {
      add(repo.unit(e.titleUnitId));
      add(repo.experienceField(e.code, "alcance"));
    }
  }

  // Tope de tamaño: se conserva el orden de prioridad.
  const units: Unit[] = [];
  let chars = 0;
  for (const u of ordered) {
    if (chars + u.text.length > MAX_RETRIEVED_CHARS) continue;
    units.push(u);
    chars += u.text.length;
  }
  const observations = repo.observations;
  return {
    observations,
    units,
    ids: new Set([...observations, ...units].map((u) => u.unitId)),
    lexicalHits: hits.length,
  };
}
