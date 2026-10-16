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
