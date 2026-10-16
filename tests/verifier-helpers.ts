import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll } from "vitest";
import type { CurriculumRelease } from "../src/domain/curriculum/schema";
import { BUILD_DIR, ROOT, artifacts } from "./helpers";

export const SCRIPT = join(ROOT, "scripts", "curriculum", "independent", "verify_independent.py");
const temps: string[] = [];

export interface Report {
  pass: boolean;
  errors: string[];
  units_checked: number;
  cells_covered: number;
}

export function runVerifier(lockPath: string): { code: number | null; report: Report } {
  const r = spawnSync("python3", ["-I", SCRIPT, lockPath], { encoding: "utf8" });
  if (r.error) throw r.error;
  return { code: r.status, report: JSON.parse(r.stdout) as Report };
}

/** Copia lock + Excel a un directorio temporal y escribe una release compilada alterada. */
export function tamperedWorkspace(mutate: (rel: CurriculumRelease) => void): string {
  const { lock } = artifacts();
  const dir = mkdtempSync(join(tmpdir(), "ht-verify-"));
  temps.push(dir);
  mkdirSync(join(dir, "curriculum", "source"), { recursive: true });
  mkdirSync(join(dir, "curriculum", "build"), { recursive: true });
  copyFileSync(
    join(ROOT, "curriculum", "source", "SOURCE.lock.json"),
    join(dir, "curriculum", "source", "SOURCE.lock.json"),
  );
  copyFileSync(join(ROOT, lock.file), join(dir, lock.file));
  const name = `curriculum.${lock.release}.json`;
  const rel = JSON.parse(readFileSync(join(BUILD_DIR, name), "utf8")) as CurriculumRelease;
  mutate(rel);
  writeFileSync(join(dir, "curriculum", "build", name), JSON.stringify(rel));
  return join(dir, "curriculum", "source", "SOURCE.lock.json");
}

/** Registra la limpieza de directorios temporales en el archivo de prueba que lo llama. */
export function cleanupTemps(): void {
  afterAll(() => {
    for (const d of temps) rmSync(d, { recursive: true, force: true });
  });
}
