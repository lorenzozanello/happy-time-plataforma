/**
 * Acceso a la release curricular en el servidor (build). Lee el JSON compilado desde la fuente
 * autoritativa (`npm run curriculum:compile`); nunca texto curricular escrito a mano.
 * Este módulo no viaja al navegador: las páginas envían solo los modelos de vista que muestran.
 */
import "server-only";
import releaseJson from "../../curriculum/build/curriculum.2026-06.json";
import {
  createRepository,
  type CurriculumRepository,
} from "../../src/domain/curriculum/repository";
import { CurriculumReleaseSchema } from "../../src/domain/curriculum/schema";
import { curriculumShortTexts, curriculumWindows } from "../../src/domain/curriculum/fingerprint";
import { buildSearchIndex, type SearchIndex } from "../../src/domain/curriculum/search";
import {
  buildCatalog,
  buildSearchBundle,
  type Catalog,
  type SearchBundle,
} from "../../src/domain/curriculum/views";

let repo: CurriculumRepository | undefined;
let catalog: Catalog | undefined;

export function getRepository(): CurriculumRepository {
  repo ??= createRepository(CurriculumReleaseSchema.parse(releaseJson));
  return repo;
}

export function getCatalog(): Catalog {
  catalog ??= buildCatalog(getRepository());
  return catalog;
}

/** Nombre del archivo estático de búsqueda: versionado por release (caché inmutable). */
export function searchFileName(): string {
  return `busqueda-${getRepository().release.release}.json`;
}

export function getSearchBundle(): SearchBundle {
  return buildSearchBundle(getRepository());
}

let index: SearchIndex | undefined;
let windows: Set<string> | undefined;

/** Índice léxico para la recuperación de Happy (en memoria del servidor). */
export function getSearchIndex(): SearchIndex {
  index ??= buildSearchIndex(getRepository().release);
  return index;
}

/** Secuencias de 8 palabras de la malla: el texto generado no puede copiarlas. */
export function getCurriculumWindows(): Set<string> {
  windows ??= curriculumWindows(getRepository().release.units);
  return windows;
}

let shorts: string[] | undefined;

/** Unidades cortas normalizadas (Observaciones, etc.): tampoco pueden copiarse enteras. */
export function getCurriculumShorts(): string[] {
  shorts ??= curriculumShortTexts(getRepository().release.units);
  return shorts;
}
