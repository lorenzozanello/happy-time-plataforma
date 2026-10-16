/** Orquesta lectura → gate → compilación → índice. Sin efectos: devuelve los artefactos en memoria. */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildSearchIndex } from "../../src/domain/curriculum/search";
import { compileCurriculum, serialize, type CompileResult } from "./compile";
import { runGate, type GateResult } from "./gate";
import { LevelAliasesSchema, SourceLockSchema, loadJson, type SourceLock } from "./lock";
import { readWorkbook } from "./xlsx";

export const ROOT = join(import.meta.dirname, "..", "..");
export const LOCK_PATH = join(ROOT, "curriculum", "source", "SOURCE.lock.json");
export const ALIASES_PATH = join(ROOT, "curriculum", "aliases", "levels.json");
export const BUILD_DIR = join(ROOT, "curriculum", "build");

export interface Artifacts {
  lock: SourceLock;
  gate: GateResult;
  compiled: CompileResult;
  files: Record<string, string>;
}

export function compilerInfo(): { name: string; version: string } {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")) as { version: string };
  return { name: "happy-time-curriculum-compiler", version: pkg.version };
}

export function runPipeline(sourceBytes?: Uint8Array): Artifacts {
  const lock = loadJson(LOCK_PATH, SourceLockSchema);
  const aliases = loadJson(ALIASES_PATH, LevelAliasesSchema);
  const bytes = sourceBytes ?? new Uint8Array(readFileSync(join(ROOT, lock.file)));
  const wb = readWorkbook(bytes);
  const gate = runGate(bytes, wb, lock);
  const compiled = compileCurriculum(wb, gate, lock, aliases, compilerInfo());
  const index = buildSearchIndex(compiled.release);
  const r = lock.release;
  const files: Record<string, string> = {
    [`curriculum.${r}.json`]: serialize(compiled.release),
    [`search-index.${r}.json`]: `${JSON.stringify(index)}\n`,
    [`compile-report.${r}.json`]: serialize({
      release: r,
      source: { file: lock.file, sha256: lock.sha256 },
      gate: { pass: gate.pass, checks: gate.checks, info: gate.info },
      counts: compiled.release.counts,
      warnings: compiled.warnings,
    }),
  };
  return { lock, gate, compiled, files };
}
