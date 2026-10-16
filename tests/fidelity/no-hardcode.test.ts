import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { ROOT, release } from "../helpers";

/** Directorios de código de la aplicación donde no puede vivir texto curricular. */
const CODE_DIRS = ["src", "scripts", "app"];
const CODE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|py|json|md|css|html)$/;

function walk(dir: string): string[] {
  let out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e === "node_modules" || e.startsWith(".")) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (CODE_EXT.test(e)) out.push(p);
  }
  return out;
}

const squash = (s: string) => s.replace(/\s+/g, " ").toLowerCase();

/** Frases de ≥6 palabras extraídas de las unidades (cortadas en puntuación fuerte). */
function phrases(): string[] {
  const set = new Set<string>();
  for (const u of release().units) {
    for (const piece of u.text.split(/[.;:\n]/)) {
      const words = piece.trim().split(/\s+/).filter(Boolean);
      if (words.length >= 6) set.add(squash(words.join(" ")));
    }
  }
  return [...set];
}

describe("F1-09 · sin currículo hardcodeado en el código", () => {
  it("ninguna frase de la malla aparece en src/, scripts/ o app/", () => {
    const ps = phrases();
    // Cordura: el detector debe trabajar con cientos de frases reales (665 en la release 2026-06).
    expect(ps.length).toBeGreaterThan(500);
    const offenders: string[] = [];
    for (const d of CODE_DIRS) {
      for (const file of walk(join(ROOT, d))) {
        const content = squash(readFileSync(file, "utf8"));
        for (const p of ps) {
          if (content.includes(p)) offenders.push(`${relative(ROOT, file)}: "${p.slice(0, 60)}…"`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
