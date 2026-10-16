import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { CurriculumRelease } from "../../src/domain/curriculum/schema";
import { BUILD_DIR, ROOT, artifacts } from "../helpers";

const SCRIPT = join(ROOT, "scripts", "curriculum", "independent", "verify_independent.py");
const temps: string[] = [];

interface Report {
  pass: boolean;
  errors: string[];
  units_checked: number;
  cells_covered: number;
}

function runVerifier(lockPath: string): { code: number | null; report: Report } {
  const r = spawnSync("python3", ["-I", SCRIPT, lockPath], { encoding: "utf8" });
  if (r.error) throw r.error;
  return { code: r.status, report: JSON.parse(r.stdout) as Report };
}

/** Copia lock + Excel a un directorio temporal y escribe una release compilada alterada. */
function tamperedWorkspace(mutate: (rel: CurriculumRelease) => void): string {
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

afterAll(() => {
  for (const d of temps) rmSync(d, { recursive: true, force: true });
});

describe("F1-05 · doble lectura independiente (Python/openpyxl)", () => {
  it("la release versionada coincide celda por celda con el Excel", () => {
    const { code, report } = runVerifier(join(ROOT, "curriculum", "source", "SOURCE.lock.json"));
    expect(report.errors).toEqual([]);
    expect(code).toBe(0);
    expect(report.units_checked).toBe(572);
    expect(report.cells_covered).toBe(592);
  });

  it("detecta una paráfrasis mínima (un carácter cambiado)", () => {
    const lock = tamperedWorkspace((rel) => {
      const u = rel.units.find((x) => x.unitId === "S2.3#literatura");
      if (!u) throw new Error("unidad faltante");
      u.text = u.text.replace(".", ";");
    });
    const { code, report } = runVerifier(lock);
    expect(code).toBe(1);
    expect(report.errors.some((e) => e.startsWith("S2.3#literatura"))).toBe(true);
  });

  it("detecta una unidad eliminada (celda sin cubrir)", () => {
    const lock = tamperedWorkspace((rel) => {
      rel.units = rel.units.filter((x) => x.unitId !== "OBS-4");
    });
    const { code, report } = runVerifier(lock);
    expect(code).toBe(1);
    expect(report.errors.some((e) => e.includes("Observaciones!A5"))).toBe(true);
  });

  it("detecta textos intercambiados entre experiencias", () => {
    const lock = tamperedWorkspace((rel) => {
      const a = rel.units.find((x) => x.unitId === "K.1#arte");
      const b = rel.units.find((x) => x.unitId === "K.2#arte");
      if (!a || !b) throw new Error("unidad faltante");
      [a.text, b.text] = [b.text, a.text];
    });
    const { code, report } = runVerifier(lock);
    expect(code).toBe(1);
    expect(report.errors.filter((e) => e.includes("#arte")).length).toBeGreaterThanOrEqual(2);
  });

  it("detecta un segmento que deja texto fuera", () => {
    const lock = tamperedWorkspace((rel) => {
      const u = rel.units.find((x) => x.unitId === "T.4#juego");
      const last = u?.segments?.at(-1);
      if (!last) throw new Error("segmento faltante");
      last.end -= 3;
    });
    const { code } = runVerifier(lock);
    expect(code).toBe(1);
  });
});
