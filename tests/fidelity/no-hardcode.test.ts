import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT, release } from "../helpers";

/** Directorios de código de la aplicación donde no puede vivir texto curricular. */
const CODE_DIRS = ["src", "scripts", "app", "prototype", "evals"];
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|json|md|css|html)$/;
/** Ventana deslizante: cualquier secuencia de N palabras consecutivas de la malla delata copia. */
// La ventana y las palabras vienen de src/domain/curriculum/fingerprint.ts
const WINDOW = 8;

function walk(dir: string): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  return entries.flatMap((e) => {
    if (e === "node_modules" || e.startsWith(".")) return [];
    const p = join(dir, e);
    if (statSync(p).isDirectory()) return walk(p);
    return CODE_EXT.test(e) ? [p] : [];
  });
}

/** Palabras normalizadas (minúsculas, solo letras y dígitos), sin puntuación ni saltos. */
const words = (s: string) =>
  s
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

function curriculumWindows(): Set<string> {
  const set = new Set<string>();
  for (const u of release().units) {
    const w = words(u.text);
    for (let i = 0; i + WINDOW <= w.length; i++) set.add(w.slice(i, i + WINDOW).join(" "));
  }
  return set;
}

describe("F1-09 · sin currículo hardcodeado en el código", () => {
  const windows = curriculumWindows();

  it("el detector trabaja con miles de secuencias reales", () => {
    // 9 620 secuencias únicas en la release 2026-06.
    expect(windows.size).toBeGreaterThan(5_000);
  });

  it(`ninguna secuencia de ${WINDOW} palabras de la malla aparece en src/, scripts/, app/, prototype/ o evals/`, () => {
    const offenders: string[] = [];
    for (const d of CODE_DIRS) {
      for (const file of walk(join(ROOT, d))) {
        const w = words(readFileSync(file, "utf8"));
        for (let i = 0; i + WINDOW <= w.length; i++) {
          const seq = w.slice(i, i + WINDOW).join(" ");
          if (windows.has(seq)) {
            offenders.push(`${relative(ROOT, file)}: "${seq}"`);
            break;
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it("el detector sí encuentra una copia parcial (control positivo)", () => {
    const sample = release().units.find((u) => u.unitId === "S2.3#momento_vivir");
    const fragment = words(sample?.text ?? "")
      .slice(3, 3 + WINDOW)
      .join(" ");
    expect(fragment.split(" ")).toHaveLength(WINDOW);
    expect(windows.has(fragment)).toBe(true);
  });
});
