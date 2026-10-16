import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CurriculumReleaseSchema, type CurriculumRelease } from "../src/domain/curriculum/schema";
import { runPipeline, ROOT, BUILD_DIR, type Artifacts } from "../scripts/curriculum/pipeline";

let cached: Artifacts | undefined;

/** Pipeline completo en memoria (se ejecuta una vez por archivo de prueba). */
export function artifacts(): Artifacts {
  cached ??= runPipeline();
  return cached;
}

export function release(): CurriculumRelease {
  return artifacts().compiled.release;
}

export function committedRelease(): CurriculumRelease {
  const r = artifacts().lock.release;
  return CurriculumReleaseSchema.parse(
    JSON.parse(readFileSync(join(BUILD_DIR, `curriculum.${r}.json`), "utf8")),
  );
}

export function sourceBytes(): Uint8Array {
  return new Uint8Array(readFileSync(join(ROOT, artifacts().lock.file)));
}

export { ROOT, BUILD_DIR };
